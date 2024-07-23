from depmap.enums import DataTypeEnum
from flask import current_app
from typing import Dict, NamedTuple
import enum

from depmap.access_control import get_visible_owner_id_configs

from depmap.dataset.models import DependencyDataset, BiomarkerDataset, TabularDataset
from depmap.interactive.config import categories
from depmap.interactive.nonstandard.models import (
    NonstandardMatrix,
    CustomDatasetConfig,
    PrivateDatasetMetadata,
)
from depmap.taiga_id.models import TaigaAlias
from depmap.utilities.exception import InteractiveDatasetNotFound


class DatasetSortFirstKey(enum.Enum):
    custom_or_private = 0
    standard_or_standard_related = 1
    other_nonstandard = 2


class DatasetSortKey(NamedTuple):
    """
    Sorting aims for the following goals
        1) Custom and private datasets are the most important and should appear first
        2) Generally, standard datasets appear before nonstandard
        3) Some standard datasets are more important than others. These should appear before the other standard datasets
        4) The nonstandard PR (gene_dependency) datasets should appear next to the standard gene_effect datasets (these are Chronos_Combined, etc DependencyDatasets that use the gene_effect file from taiga).
        5) Finally, we can have the rest of the nonstandard datasets

    first key:
        DatasetSortFirstKey.custom_or_private = 0
        DatasetSortFirstKey.standard_or_standard_related = 1
        DatasetSortFirstKey.other_nonstandard = 2
    second key:
        numerical prioritization within those where first key = standard_or_standard_related
            nonstandard datasets related to standard ones have the same second key as the standard dataset they are related to
        0 if not standard_or_standard_related
    third key:
        display name

    These keys are kept a separate keys because
        1) keys for private and custom datasets are dynamic, or at least, should not be cached/made available without appropriate permissions on a per-request basis
        2) it can be useful to other modules to know the key values, for instance vector catolog gene_nodes.py it looks at the first key to determine whether the dataset should be under "Latest" or "Other"
    """

    first_key: int
    second_key: int
    third_key_display_name: str


def _format_common_dataset_metadata(dataset):
    entity_type = dataset.entity_type
    kwargs = {
        "label": dataset.display_name,
        "units": dataset.matrix.units,
        "data_type": dataset.data_type,
        "priority": dataset.priority,
        "feature_name": "compound"
        if entity_type == "compound_experiment"
        else entity_type.replace("_", " "),
        "entity_type": entity_type,
        "matrix_id": dataset.matrix.matrix_id,
        "matrix_uuid": dataset.matrix.matrix_uuid,
        "taiga_id": dataset.taiga_id,
        "is_continuous": True,
        "transpose": False,
    }

    return Config(**kwargs)


from typing import Union
import re


def _lookup_entity_type_by_name(label):
    for pattern, new_entity_type in [
        ("Fusions Internal .*", "fusion"),
        (".*confounders", "confounder"),
        ("Average TSS Methylation.*", "gene"),
        ("Methylation Expression Impact.*", "gene"),
        ("Paralogs .*", "gene pair"),
        ("Olink Proteomics .*", "protein and dilution"),
        ("ATAC Pseudobulk Gene Accessibility .*", "transcript"),
        ("ssGSEA", "msigdb_gene_set"),
        ("Omics Signatures", "signature"),
        (".*", f"{label} feature"),
    ]:
        if re.match(pattern, label):
            return new_entity_type
    raise Exception("Should never reach this line")


class Config:
    def __init__(
        self,
        label,
        feature_name,
        data_type: Union[str, DataTypeEnum],
        units=None,
        priority=None,
        taiga_id=None,
        matrix_id=None,
        matrix_uuid=None,
        entity_type=None,
        feature_example=None,
        transpose=None,
        is_discoverable=True,
        is_standard=False,
        is_custom=False,
        is_continuous=False,
        is_categorical=False,
        prepopulate=None,
        is_private=False,
        has_opaque_features=False,  # currently only used for custom cell line groups, feature is a uuid
        categories=None,
        private_group_display_name=None,
        use_arxspan_id="ignored",  # convenience, for us to be able to pass a spread config dictionary into this constructor
    ):
        """
        :param categories: an instance of CategoryConfig
        """
        assert transpose is not None
        self.label = label
        self.units = units
        # this is a bandaid being made in the interest of time. It appears
        # we are inconsistent about whether data_type is a str or an enum
        # so if we see we've been passed a str, convert it.
        if isinstance(data_type, str):
            _data_type = DataTypeEnum[data_type]
        else:
            _data_type = data_type
        assert isinstance(_data_type, DataTypeEnum)
        self.data_type = _data_type
        self.priority = priority
        self.original_taiga_id = taiga_id
        self.matrix_id = matrix_id
        self.matrix_uuid = matrix_uuid

        # okay, more hackery that is going in here because in theory it should all be deleted
        # when the corresponding datasets data moves over to Breadbox.
        #
        # Here's the situation: We need decent 'entity_type' labels to show in the UI but
        # often this is "GenericFeature" to line up with the entity class name. In order to preserve
        # the code that relies on the class name, this is now stored in a new field named `entity_class_name`.
        #
        # We do have a `feature_name` which often has a reasonable label we could show people. However, that
        # too is often populated with unhelpful names like `generic entity` or `generic feature`. Now
        # the best thing to do would be to fix the database, but these are coming from multiple places and
        # all this will going to be thrown away anyway, so I'm taking a different strategy.
        #
        # If the feature_name is a bad one, take the value from a hardcoded map. Now this map is ignored
        # if the dataset has a non-bad feature name, so if we do update the field, it'll use that value and
        # the map will have no effect.

        self.entity_class_name = (
            entity_type  # this is used solely by legacy_get_entity_class_name
        )
        if (entity_type is None) or (entity_type == "generic_entity"):
            entity_type = feature_name
            if feature_name in ["generic entity", "feature"]:
                entity_type = _lookup_entity_type_by_name(label)
                feature_name = entity_type
        assert isinstance(feature_name, str)
        assert isinstance(entity_type, str)
        self.feature_name = feature_name
        self.entity_type = entity_type
        self.feature_example = feature_example
        self.transpose = transpose
        self.is_discoverable = is_discoverable
        self.is_standard = is_standard
        self.is_custom = is_custom
        self.is_private = is_private
        self.is_continuous = is_continuous
        self.is_categorical = is_categorical
        self.has_opaque_features = has_opaque_features
        self.prepopulate = prepopulate
        self.categories = categories  # only used for categorical
        self.private_group_display_name = private_group_display_name

        # private and custom are mutually exclusive. neither should be discoverable
        if is_private:
            assert not is_custom
            # private datasets are discoverable. this is because they are listable on a per user basis, a given user should be able to list all their private datasets. access control is handled lower, in the access_control module
            assert is_discoverable
            # private_group_display_name should be filled for private datasets
            assert private_group_display_name
        if private_group_display_name:
            # only private dataset should have this
            assert is_private
        if is_custom:
            assert not is_private
            # custom datasets are not discoverable. they should not be listed, and should only be accessible if the specific dataset id is provided
            assert not is_discoverable
        if is_categorical:
            assert not is_continuous
            assert categories is not None  # must specify names of categorical levels

    def __getitem__(self, key):
        return getattr(self, key)

    def __setitem__(self, key, value):
        self.__dict__[key] = value

    def __contains__(self, item):
        return hasattr(self, item)

    def __eq__(self, other):
        return self.__dict__ == other.__dict__

    def __ne__(
        self, other
    ):  # could be done with new-style python3 classes, but trying to be more explicit
        return not self == other

    @property
    def taiga_id(self):
        if self.original_taiga_id is None:
            return None
        return TaigaAlias.get_canonical_taiga_id(self.original_taiga_id)

    @property
    def use_arxspan_id(self):
        raise NotImplementedError(
            "use_arxspan_id is not a valid property on Config. Its presence in settings dictionaries is used as a flag for loaders. We allow it as a valid argument to this Config constructor as a convenience, so that a spread settings dictionary can be passed to the constructor of this Config"
        )


class InteractiveConfig:
    """
    ONLY TWO FUNCTIONS SHOULD BE EXPOSED
        .get(dataset_id)
        .all_datasets

    Plus these properties
        .context_dataset
        .lineage_dataset
        .primary_disease_dataset
        .disease_subtype_dataset
        .tumor_type_dataset
        .gender_dataset
        .custom_cell_lines_dataset
    """

    def __init__(self):
        self.context_dataset = "context"
        self.lineage_dataset = "lineage"
        self.primary_disease_dataset = "primary_disease"
        self.disease_subtype_dataset = "disease_subtype"
        self.tumor_type_dataset = "tumor_type"
        self.gender_dataset = "gender"
        self.growth_pattern_dataset = "growth_pattern"
        self.custom_cell_lines_dataset = "custom_cell_lines"  # this dataset has custom rows, such that the /rows/ are not discoverable and should not be listed. they are opaque uuids that you are required to know to access

        # datasets which are visible for all users
        self._immutable_datasets = self.__format_immutable_datasets()

    def get(self, dataset_id):
        """
        Given a dataset_id, retrieves the interactive config object

        Permitted dataset_ids
            - are always visible to all users (standard datasets and noncustom nonstandard datasets)
            - and private datasets for a given user (automatically determined by sqlalchemy for a given request. see access control module)
            - and custom datasets can be directly accessed if you know their dataset id
        """

        if dataset_id in self._immutable_datasets:
            return self._immutable_datasets[dataset_id]
        elif dataset_id == self.custom_cell_lines_dataset:
            return self.__get_custom_cell_lines_dataset_config()
        else:
            """
            This function is called many times and in loops
            Checking private and custom datasets require database hits
            Thus, for performance reasons we leave them for this last else block. We want to avoid making those database hits if we can

            Note that private datasets CANNOT BE CACHED.
            """
            # private datasets MUST be re-retrieved on every request and CANNOT BE CACHED. Note that this is a db hit
            private_datasets = self.get_allowed_private_datasets()
            if dataset_id in private_datasets:
                return private_datasets[dataset_id]
            elif CustomDatasetConfig.exists(dataset_id):
                # custom datasets can be directly accessed if you know their dataset id
                # but otherwise, are not discoverable (their dataset ids should not be listed)
                return Config(**CustomDatasetConfig.get(dataset_id))
            else:
                raise InteractiveDatasetNotFound(
                    "{} was not found in the interactive config".format(dataset_id)
                )

    @property
    def all_datasets(self):
        """
        Returns all interactive dataset ids
        Includes datasets that
            - are always visible to all users (standard datasets and noncustom nonstandard datasets)
            - and private datasets for a given user (automatically determined by sqlalchemy for a given request. see access control module)

        This allows us to list all datasets that should be discoverable.
            E.g. to populate trees (the vector_catalog module)
            Or to populate the interactive.get_datasets endpoint

        DO NOT modify to include custom datasets
            Custom datasets should not be listed
            They are not tired to a particular user, and instead their dataset ids are bearer tokens
            They should only be accessed if the dataset id is specifically provided
            We should not list all the custom dataset ids. This violates access control

        Private datasets are user specific, and given the appropriate user they should be discoverable
            This allows us to list all the datasets for a particular user.
            Unlike custom, users do not need to know the specific dataset id of the dataset to access it
            We just need their identity in the request context, and our access control module makes the sqlalchemy-returned return automatically filter by user identity
        """
        # private datasets must be re-retrieved on every request and CANNOT BE CACHED
        private_datasets = self.get_allowed_private_datasets()
        datasets = {**self._immutable_datasets, **private_datasets}
        assert all([config.is_discoverable for config in datasets.values()])
        return datasets.keys()

    def __format_immutable_datasets(self):
        """
        These are datasets that are global/common/accessible for every user
        They were are called "immutable datasets", because they are the same for every instance of the interactive config
        They can thus be cached as self._immutable_datasets
            vs e.g. private datasets, which depend on the request context and cannot be cached
        :return:
        """
        standard_continuous_datasets = self._get_standard_datasets()
        categorical_datasets = self._get_context_mutation_lineage_datasets()
        nonstandard_datasets = self._get_nonstandard_noncustom_datasets()

        immutable_datasets = {
            **standard_continuous_datasets,
            **categorical_datasets,
            **nonstandard_datasets,
        }
        return immutable_datasets

    def _get_standard_datasets(self):
        """
        prefixed by single underscore to suggest not using externally unless you know what you're doing
        """
        axes_datasets = {}
        non_plottable_biomarker_dataset_names = {  # mostly one-hot encoded matrices
            BiomarkerDataset.BiomarkerEnum.context.name
        }

        for dataset in DependencyDataset.query.all():
            axes_datasets[dataset.name.name] = _format_common_dataset_metadata(dataset)

        biomarker_datasets = [
            x
            for x in BiomarkerDataset.query.all()
            if x.name.name not in non_plottable_biomarker_dataset_names
        ]
        for dataset in biomarker_datasets:
            metadata = _format_common_dataset_metadata(dataset)
            # mutations prioritized is exception. Used to replace TabularEnum.mutations for categorical values
            # instead of creating a separate config for mutations prioritized in _get_context_mutation_lineage_datasets,
            # add the below fields to denote that it is also a categorical dataset;
            # can't add to _get_context_mutation_lineage_datasets bc immutable_datasets ends up with a set
            if (
                dataset.name.name
                == BiomarkerDataset.BiomarkerEnum.mutations_prioritized.name
            ):
                metadata.is_categorical = True
                metadata.is_continuous = False
                metadata.categories = (
                    categories.MutationsPrioritizedConfig()
                )  # used by get_category_config, format_as_trace, add_color_to_df
            axes_datasets[dataset.name.name] = metadata

        for key in axes_datasets:
            axes_datasets[key]["is_standard"] = True
        return axes_datasets

    def _get_context_mutation_lineage_datasets(self):
        datasets = {
            self.context_dataset: Config(
                **{
                    "label": "Context",
                    "data_type": DataTypeEnum.model_metadata,
                    "feature_name": "Context",
                    "categories": categories.ContextConfig(),
                    "is_categorical": True,
                    "is_standard": True,
                    "transpose": False,
                }
            ),
            TabularDataset.TabularEnum.mutation.name: Config(
                **{
                    "label": "Mutations",
                    "data_type": DataTypeEnum.mutations,
                    "feature_name": "Gene symbol",
                    "categories": categories.MutationConfig(),
                    "taiga_id": self._get_mutations_taiga_id(),
                    "is_categorical": True,
                    "is_standard": True,
                    "transpose": False,
                }
            ),
            self.lineage_dataset: Config(
                **{
                    "label": "Lineage",
                    "data_type": DataTypeEnum.model_metadata,
                    "feature_name": "Lineage",
                    "is_categorical": True,
                    "is_standard": True,
                    "transpose": False,
                    "categories": categories.LineageConfig(),
                }
            ),
            self.primary_disease_dataset: Config(
                **{
                    "label": "Primary Disease",
                    "data_type": DataTypeEnum.model_metadata,
                    "feature_name": "Primary Disease",
                    "is_categorical": True,
                    "is_standard": True,
                    "transpose": False,
                    "categories": categories.CategoricalSingletonConfig(
                        "Primary Disease"
                    ),
                }
            ),
            self.disease_subtype_dataset: Config(
                **{
                    "label": "Disease Subtype",
                    "data_type": DataTypeEnum.model_metadata,
                    "feature_name": "Disease Subtype",
                    "is_categorical": True,
                    "is_standard": True,
                    "transpose": False,
                    "categories": categories.CategoricalSingletonConfig(
                        "Disease Subtype"
                    ),
                }
            ),
            self.tumor_type_dataset: Config(
                **{
                    "label": "Tumor Type",
                    "data_type": DataTypeEnum.model_metadata,
                    "feature_name": "Tumor Type",
                    "is_categorical": True,
                    "is_standard": True,
                    "transpose": False,
                    "categories": categories.CategoricalSingletonConfig("Tumor Type"),
                }
            ),
            self.gender_dataset: Config(
                **{
                    "label": "Gender",
                    "data_type": DataTypeEnum.model_metadata,
                    "feature_name": "Gender",
                    "is_categorical": True,
                    "is_standard": True,
                    "transpose": False,
                    "categories": categories.CategoricalSingletonConfig("Gender"),
                }
            ),
            self.growth_pattern_dataset: Config(
                **{
                    "label": "Growth Pattern",
                    "data_type": DataTypeEnum.model_metadata,
                    "feature_name": "Growth Pattern",
                    "is_categorical": True,
                    "is_standard": True,
                    "transpose": False,
                    "categories": categories.CategoricalSingletonConfig(
                        "Growth Pattern"
                    ),
                }
            ),
        }
        return datasets

    def _get_nonstandard_noncustom_datasets(self):
        """
        Prefixed by single underscore to indicate to not use externally
        External things interested in getting this subset of datasets should filter on all_datasets
        """
        nonstandard_settings = current_app.config["GET_NONSTANDARD_DATASETS"]()
        nonstandard_datasets = {}
        for key in nonstandard_settings:
            # copy+create a new dict so that we don't modify the original
            # the nonstandard loader relies on this config having e.g. the entity key for its purposes, and will silently load a dataset as a non-entity mapped load if it doesn't find the key
            # this doesn't seem to happen in dev right now, but it happens in test and it's risky to rely that this config will not be created before the nonstandard load
            nonstandard_dict = {
                **nonstandard_settings[key],
                "is_standard": False,
                "taiga_id": key,
            }

            if "entity" in nonstandard_settings[key]:
                nonstandard_dict["entity_type"] = nonstandard_settings[key][
                    "entity"
                ].get_entity_type()
                del nonstandard_dict["entity"]

            nonstandard_datasets[key] = Config(**nonstandard_dict)
        return nonstandard_datasets

    def is_legacy_private_dataset(self, dataset_id: str) -> bool:
        all_private_dataset_ids = [
            dataset.dataset_id for dataset in PrivateDatasetMetadata.get_all()
        ]
        return dataset_id in all_private_dataset_ids

    def get_allowed_private_datasets(self) -> Dict[str, Config]:
        """
        WARNING: This CANNOT BE CACHED and must be re-retrieved on every request.
        For every nonstandard dataset, check if it is in the environment settings of private datasets.
        If so, create and add config
        Return all configs
        """
        allowed_private_datasets = {}
        # this query automatically only retrieves datasets that are accessible by a
        # given user we thus CANNOT CACHE THIS RESULT. NonstandardMatrix.get_all() and
        # PrivateDatasetMetadata.get_all()will return different results depending on
        # the user identity as indicated in the request
        all_private_datasets = {
            dataset.dataset_id: dataset for dataset in PrivateDatasetMetadata.get_all()
        }
        visible_owner_ids = get_visible_owner_id_configs()
        for dataset in NonstandardMatrix.get_all():
            dataset_id = (
                dataset.nonstandard_dataset_id
            )  # the dataset id, not the matrix id
            if dataset_id in all_private_datasets:  # if is private
                settings = all_private_datasets[dataset_id]
                private_group_display_name = visible_owner_ids[
                    settings.owner_id
                ].display_name
                allowed_private_datasets[dataset_id] = Config(
                    label=settings.display_name,
                    feature_name=settings.feature_name,
                    data_type=settings.data_type,
                    units=settings.units,
                    is_discoverable=True,  # private datasets are discoverable. this is because they are listable on a per user basis, a given user should be able to list all their private datasets. access control is handled lower, in the access_control module
                    is_standard=False,
                    is_private=True,
                    is_continuous=True,
                    prepopulate=False,  # just being explicit
                    transpose=settings.is_transpose,
                    private_group_display_name=private_group_display_name,
                )
        return allowed_private_datasets

    def __get_custom_cell_lines_dataset_config(self):
        """
        This should NOT be discoverable
        Its rows should not even be listable, i.e. it does not implement get matching rows or get all rows
        :return:
        """
        return Config(
            **{
                "label": "Custom cell line group",
                "data_type": DataTypeEnum.model_metadata,
                "feature_name": "",  # this should not be used for this dataset; it is not shown in dropdowns and thus does not need a placeholder
                "categories": categories.CustomCellLinesConfig(),
                "entity_type": "cell line group",
                "is_discoverable": False,
                "is_categorical": True,
                "is_standard": True,
                "has_opaque_features": True,
                "transpose": False,
            }
        )

    @classmethod
    def _get_mutations_taiga_id(cls):
        return TabularDataset.get_by_name(TabularDataset.TabularEnum.mutation).taiga_id
