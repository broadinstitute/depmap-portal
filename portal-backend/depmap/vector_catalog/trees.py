from typing import Any, Tuple, Iterable, Union
from depmap.entity.models import GenericEntity
from flask import current_app

from enum import Enum
from sqlalchemy.orm.exc import NoResultFound
from depmap.interactive import interactive_utils
from depmap.vector_catalog.models import (
    Tree,
    NodeTemplate,
    SingleNodeFactory,
    NodeType,
    SliceRowType,
    SliceSerializer,
)
from depmap.vector_catalog.nodes.continuous_tree import (
    gene_nodes,
    compound_nodes,
    other_nodes,
    custom_nodes,
)
from depmap.vector_catalog.nodes import categorical_tree_nodes

OTHER_DATASET_NON_PREPOPULATE_ID_BASE = "other_label_dataset_non_prepopulate"


class InteractiveTree(Tree):
    @staticmethod
    def get_dataset_feature_from_id(id):
        if id is None or id == "":
            return id, id

        dataset_id, feature, feature_type = SliceSerializer.decode_slice_id(id)

        if feature_type == SliceRowType.entity_id:
            feature = (
                interactive_utils.get_entity_class(dataset_id)
                .get_by_id(int(feature))
                .label
            )
        return dataset_id, feature

    @staticmethod
    def get_id_from_dataset_feature(
        dataset: str, feature: Union[str, int], feature_is_entity_id=False
    ):
        return InteractiveTree.get_ids_from_dataset_features(
            dataset, [feature], feature_is_entity_id
        )[0]

    @staticmethod
    def get_ids_from_dataset_features(
        dataset: str, features: Iterable[Union[str, int]], feature_is_entity_id=False
    ):
        """
        For features with entity id, this function will be faster if providing entity id.
        ^^ The above comment claims this, but I have a hard time believing this looking at the implementation.
        As far as I can tell, the behavior is identical regardless of the value of feature_is_entity_id. A
        cleanup that might be worth attempting is removing that flag and seeing if anything changes.

        This method is designed to speed up instances where we need to make a lot of ids within the same dataset
        """
        if dataset == "":
            # escape hatch for existing tests
            return ["" for _ in features]

        row_type = SliceRowType.label

        if feature_is_entity_id:
            row_type = SliceRowType.entity_id

        # This check is to accommodate the interactive config hack for mutations_prioritized. See depmap/interactive/config/models.py::_get_standard_datasets
        # mutations_prioritized is a biomarker which is currently defaulted to be defined there as continuous but we actually want it to be categorical
        # TODO: Make mutations_prioritized interactive config nonambiguous and move it to a categorical config.
        elif interactive_utils.is_categorical(dataset):
            row_type = SliceRowType.label
        # get_entity_class does not work on categorical/binary datasets
        elif interactive_utils.is_continuous(dataset):
            entity_class = interactive_utils.get_entity_class(dataset)
            if entity_class:
                try:
                    features = [
                        entity_class.get_by_label(feature).entity_id
                        for feature in features
                    ]
                except NoResultFound as e:
                    raise Exception(
                        "Could not find {} with label {}. get_by_label may not be implemented on {}".format(
                            entity_class, features, entity_class
                        )
                    ) from e
                row_type = SliceRowType.entity_id

        return [
            SliceSerializer.encode_slice_id(dataset, feature, row_type)
            for feature in features
        ]


class ContinuousBranch:
    gene_node_template_key = "gene"

    @staticmethod
    def get_continuous_nodes():
        return [
            NodeTemplate(
                "genes",
                SingleNodeFactory(
                    "Gene",
                    is_terminal=False,
                    value="gene",
                    children_list_type=NodeType.dynamic,
                    children_category="gene symbol",
                ),
                [
                    NodeTemplate(
                        ContinuousBranch.gene_node_template_key,
                        gene_nodes.GeneNodeFactory(),
                        [
                            NodeTemplate(
                                "gene_standard_dataset",
                                gene_nodes.GeneStandardDatasetNodeFactory(),
                            ),
                            NodeTemplate(
                                "gene_nonstandard_dataset",
                                gene_nodes.GeneNonstandardDatasetNodeFactory(),
                            ),
                            NodeTemplate(
                                "rppa",
                                gene_nodes.RppaDatasetNodeFactory(),
                                [
                                    # this may not appear depending on the gene selected, thus we cannot use SingleNodeFactory
                                    NodeTemplate(
                                        "rppa_antibody",
                                        gene_nodes.RppaAntibodyNodeFactory(),
                                    )
                                ],
                            ),
                            NodeTemplate(
                                "rrbs",
                                gene_nodes.RrbsDatasetNodeFactory(),
                                [
                                    NodeTemplate(
                                        "rrbs_tss", gene_nodes.RrbsTssNodeFactory()
                                    )
                                ],
                            ),
                            NodeTemplate(
                                "proteomics",
                                gene_nodes.ProteomicsDatasetNodeFactory(),
                                [
                                    NodeTemplate(
                                        "proteomics_protein",
                                        gene_nodes.ProteinNodeFactory(),
                                    )
                                ],
                            ),
                            NodeTemplate(
                                "sanger_proteomics",
                                gene_nodes.SangerProteomicsDatasetNodeFactory(),
                                [
                                    NodeTemplate(
                                        "sanger_proteomics_protein",
                                        gene_nodes.SangerProteinNodeFactory(),
                                    )
                                ],
                            ),
                        ],
                    )
                ],
            ),
            NodeTemplate(
                "compounds",
                SingleNodeFactory(
                    "Compound",
                    is_terminal=False,
                    value="compound",
                    children_list_type=NodeType.dynamic,
                    children_category="compound",
                ),
                [
                    NodeTemplate(
                        "compound",
                        compound_nodes.CompoundNodeFactory(),
                        [
                            NodeTemplate(
                                "compound_experiment_terminating_dataset",
                                compound_nodes.CompoundExperimentTerminatingDatasetNodeFactory(),
                                [
                                    NodeTemplate(
                                        "compound_experiment_terminating_dataset_experiment",
                                        compound_nodes.CompoundExperimentNodeFactory(
                                            is_terminal=True
                                        ),
                                    )
                                ],
                            ),
                            NodeTemplate(
                                "compound_dose_dataset",
                                compound_nodes.CompoundDoseDatasetNodeFactory(),
                                [
                                    NodeTemplate(
                                        "compound_dose_dataset_experiment",
                                        compound_nodes.CompoundExperimentNodeFactory(
                                            is_terminal=False
                                        ),
                                        [
                                            NodeTemplate(
                                                "compound_dose",
                                                compound_nodes.CompoundDoseNodeFactory(),
                                            )
                                        ],
                                    )
                                ],
                            ),
                            NodeTemplate(
                                "compound_dose_replicate_dataset",
                                compound_nodes.CompoundDoseReplicateDatasetNodeFactory(),
                                [
                                    NodeTemplate(
                                        "compound_dose_replicate_dataset_experiment",
                                        compound_nodes.CompoundExperimentNodeFactory(
                                            is_terminal=False
                                        ),
                                        [
                                            NodeTemplate(
                                                "compound_dose_replicate",
                                                compound_nodes.CompoundDoseReplicateNodeFactory(),
                                            )
                                        ],
                                    )
                                ],
                            ),
                        ],
                    )
                ],
            ),
            NodeTemplate(
                # datasets with rows not related to genes or compounds
                "others",
                other_nodes.OtherNodeFactory(),
                [
                    NodeTemplate(
                        "other_generic_entity_dataset_non_prepopulate",
                        other_nodes.OtherGenericEntityDatasetNonPrepopulateNodeFactory(),
                        [
                            NodeTemplate(
                                "other_generic_entity_dataset_non_prepopulate_feature",
                                other_nodes.OtherGenericEntityDatasetRowNonPrepopulateNodeFactory(),
                            ),
                        ],
                    ),
                    # The two below are separated in order to have different params of get_added_attrs, because we inspect those params and have different behavior
                    NodeTemplate(
                        OTHER_DATASET_NON_PREPOPULATE_ID_BASE,
                        other_nodes.OtherLabelDatasetNonPrepopulateNodeFactory(),
                        [
                            NodeTemplate(
                                "other_label_dataset_non_prepopulate_feature",
                                other_nodes.OtherLabelDatasetRowNonPrepopulateNodeFactory(),
                            ),
                        ],
                    ),
                    NodeTemplate(
                        "other_label_dataset_prepopulate",
                        other_nodes.OtherLabelDatasetPrepopulateNodeFactory(),
                        [
                            NodeTemplate(
                                "other_label_dataset_prepopulate_feature",
                                other_nodes.OtherLabelDatasetRowPrepopulateNodeFactory(),
                            ),
                        ],
                    ),
                ],
            ),
            NodeTemplate(
                "custom",
                SingleNodeFactory(
                    "Custom",
                    is_terminal=False,
                    value="other",
                    children_list_type=NodeType.static,
                    children_category="dataset",
                ),
                visible_from_parent=False,
                children=[
                    NodeTemplate(
                        "custom_dataset",
                        custom_nodes.CustomDatasetNodeFactory(),
                        visible_from_parent=False,
                        children=[
                            NodeTemplate(
                                "custom_dataset_feature",
                                custom_nodes.CustomDatasetRowNodeFactory(),
                                visible_from_parent=True,
                            )
                        ],
                    )
                ],
            ),
        ]


class ContinuousValuesTree(InteractiveTree):
    def __init__(self):
        self.gene_node_template_key = ContinuousBranch.gene_node_template_key
        self.continuous_nodes = ContinuousBranch.get_continuous_nodes()
        branches = NodeTemplate(
            "root",
            SingleNodeFactory(
                "root",
                is_terminal=False,
                value="root",
                children_list_type=NodeType.static,
                children_category="type",
            ),
            self.continuous_nodes,
        )

        attr_types = {
            "row": str,
            "gene_id": int,
            "dataset_id": str,
            "antibody_id": int,
            "compound_id": int,
            "compound_experiment_id": int,
            "compound_dose_replicate_id": int,
        }

        super().__init__(branches, attr_types)

    def get_gene_node_id(self, gene_id):
        gene_node_template = self.get_node_template_by_key(self.gene_node_template_key)
        return self._create_node(gene_node_template, {"gene_id": gene_id}).id

    def get_continuous_nodes(self):
        return self.continuous_nodes


class ContinuousAndCategoricalValuesTree(InteractiveTree):
    def __init__(self):
        self.gene_node_template_key = ContinuousBranch.gene_node_template_key
        tree = [
            NodeTemplate(
                "cell_line_metadatas",
                SingleNodeFactory(
                    "Cell Line Metadata",
                    is_terminal=False,
                    value="cell line metadata",
                    children_list_type=NodeType.static,
                    children_category="cell line metadata",
                ),
                CategoricalBranch.get_categorical_nodes(),
            )
        ]
        tree.extend(ContinuousBranch.get_continuous_nodes())
        branches = NodeTemplate(
            "root",
            SingleNodeFactory(
                "root",
                is_terminal=False,
                value="root",
                children_list_type=NodeType.static,
                children_category="type",
            ),
            tree,
        )

        attr_types = {
            "row": str,
            "gene_id": int,
            "dataset_id": str,
            "antibody_id": int,
            "compound_id": int,
            "compound_experiment_id": int,
            "compound_dose_replicate_id": int,
        }

        super().__init__(branches, attr_types)

    def get_gene_node_id(self, gene_id):
        gene_node_template = self.get_node_template_by_key(self.gene_node_template_key)
        return self._create_node(gene_node_template, {"gene_id": gene_id}).id


class CategoricalBranch:
    @staticmethod
    def get_categorical_nodes():
        nodes = [
            NodeTemplate(
                "contexts",
                SingleNodeFactory(
                    "Context",
                    is_terminal=False,
                    value="context",
                    children_list_type=NodeType.static,
                    children_category="type",
                ),
                [NodeTemplate("context", categorical_tree_nodes.ContextNodeFactory())],
            ),
            NodeTemplate("lineage", categorical_tree_nodes.LineageNodeFactory(), []),
            NodeTemplate(
                "primary_disease",
                categorical_tree_nodes.PrimaryDiseaseSingletonNodeFactory(
                    "Primary Disease", is_terminal=True, value="primary_disease"
                ),
                [],
            ),
            NodeTemplate(
                "disease_subtype",
                categorical_tree_nodes.DiseaseSubtypeSingletonNodeFactory(
                    "Disease Subtype", is_terminal=True, value="disease_subtype"
                ),
                [],
            ),
            NodeTemplate(
                "tumor_type",
                categorical_tree_nodes.TumorTypeSingletonNodeFactory(
                    "Tumor Type", is_terminal=True, value="tumor_type"
                ),
                [],
            ),
            NodeTemplate(
                "gender",
                categorical_tree_nodes.GenderSingletonNodeFactory(
                    "Gender", is_terminal=True, value="gender"
                ),
                [],
            ),
            NodeTemplate(
                "growth_pattern",
                categorical_tree_nodes.GrowthPatternSingletonNodeFactory(
                    "Growth Pattern", is_terminal=True, value="growth_pattern"
                ),
                [],
            ),
            NodeTemplate(
                "mutations",
                SingleNodeFactory(
                    "Mutation",
                    is_terminal=False,
                    value="mutation",
                    children_list_type=NodeType.dynamic,
                    children_category="type",
                ),
                [
                    NodeTemplate(
                        "mutation", categorical_tree_nodes.MutationNodeFactory()
                    ),
                ],
            ),
            NodeTemplate(
                "mutation_details",
                SingleNodeFactory(
                    "Mutation details",
                    is_terminal=False,
                    value="mutation_detail",
                    children_list_type=NodeType.dynamic,
                    children_category="type",
                ),
                [
                    NodeTemplate(
                        "mutation_detail",
                        categorical_tree_nodes.MutationDetailsNodeFactory(),
                    ),
                ],
            ),
            NodeTemplate(
                "nonstandard_dataset",
                categorical_tree_nodes.NonstandardNodeFactory(),
                [
                    NodeTemplate(
                        "nonstandard_dataset_feature",
                        categorical_tree_nodes.NonstandardRowNodeFactory(),
                    )
                ],
            ),
        ]
        return nodes


class CategoricalValuesTree(InteractiveTree):
    def __init__(self):
        branches = NodeTemplate(
            "root",
            SingleNodeFactory(
                "root",
                is_terminal=False,
                value="root",
                children_list_type=NodeType.static,
                children_category="type",
            ),
            CategoricalBranch.get_categorical_nodes(),
        )

        attr_types = {"dataset_id": str, "row": str}

        super().__init__(branches, attr_types)


class BinaryValuesTree(InteractiveTree):
    def __init__(self):
        branches = NodeTemplate(
            "root",
            SingleNodeFactory(
                "root",
                is_terminal=False,
                value="root",
                children_list_type=NodeType.static,
                children_category="type",
            ),
            [NodeTemplate("context", categorical_tree_nodes.ContextNodeFactory())],
        )

        attr_types = {"row": str}
        super().__init__(branches, attr_types)


class Trees(Enum):
    """
    Enum holding the lookup from a string to a Tree class
    Has to be at the bottom because classes are defined above
    """

    continuous = ContinuousValuesTree
    categorical = CategoricalValuesTree
    continuous_and_categorical = ContinuousAndCategoricalValuesTree
    binary = BinaryValuesTree
