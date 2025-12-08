from typing import List, Optional, Dict

from dataclasses import dataclass
from depmap.cell_line.models_new import DepmapModel
from depmap.context.models_new import SubtypeContext
from depmap.gene.models import GeneExecutiveInfo
import pandas as pd

from depmap.database import db
from depmap.cell_line.models import CellLine
from depmap.dataset.models import (
    BiomarkerDataset,
    Mutation,
)
from depmap.compute.models import CustomCellLineGroup
from depmap.interactive.config.utils import (
    get_context_dataset,
    get_lineage_dataset,
    get_primary_disease_dataset,
    get_disease_subtype_dataset,
    get_tumor_type_dataset,
    get_entity_type,
    get_gender_dataset,
    get_growth_pattern_dataset,
    get_custom_cell_lines_dataset,
    __get_config,
    has_config,
    is_prepopulate,
    is_continuous,
    is_categorical,
    is_standard,
)
from depmap.interactive.standard import standard_utils
from depmap.interactive.nonstandard import nonstandard_utils
from depmap.partials.matrix.models import CellLineSeries
from depmap.interactive.common_utils import RowSummary

def get_matrix(dataset_id):
    """
    There is already a common .get_matrix_id, but this wraps to provide a common interface for getting the matrix /object/.
    :param dataset_id:
    :return:
    """
    if is_continuous(dataset_id):
        if is_standard(dataset_id):
            return standard_utils.get_matrix(dataset_id)
        else:
            return nonstandard_utils.get_matrix(dataset_id)
    else:
        raise NotImplementedError


def get_all_row_indices_labels_entity_ids(dataset_id) -> List[RowSummary]:
    """
    Thus far, this is only used in the compute module, for computing custom analyses
    entity id may be none, in the case of nonstandard datasets that use label only
    """
    if is_standard(dataset_id):
        return standard_utils.get_all_row_indices_labels_entity_ids(dataset_id)
    else:
        return nonstandard_utils.get_all_row_indices_labels_entity_ids(dataset_id)


def get_dataset_feature_labels_by_id(dataset_id: str) -> dict[str, str]:
    """
    Get a mapping of feature IDs to feature labels.
    """
    row_summaries = get_all_row_indices_labels_entity_ids(dataset_id)
    return {str(row.entity_id): row.label for row in row_summaries}


def get_dataset_sample_labels_by_id(dataset_id: str) -> dict[str, str]:
    """
    Get a mapping of sample labels to sample IDs.
    Samples from the legacy backend are always depmap_models, so it's safe to
    hard-code that labels should always be cell line display names. 
    """
    dataset_sample_ids = get_dataset_sample_ids(dataset_id)
    all_model_labels_by_id = CellLine.get_cell_line_display_name_series().to_dict()
    return {
        id: label
        for id, label in all_model_labels_by_id.items()
        if id in dataset_sample_ids
    }


def get_dataset_feature_labels(dataset_id: str) -> list[str]:
    """
    Get a list of all feature/entity labels for the given dataset.
    """
    # Special cases for DE2
    #
    # "mutation_protein_change_by_gene" is a virtual dataset. Its features are
    # genes. It can be thought of as a view onto the mutation table. That table
    # often has several rows for any given gene. This collapses that into a
    # single value per gene, collecting all the values in the protein_change
    # column into a list.
    if dataset_id == "mutation_protein_change_by_gene":
        return Mutation.gene_labels_with_non_null_protein_change()

    row_summaries = get_all_row_indices_labels_entity_ids(dataset_id)
    labels = [row.label for row in row_summaries]
    return labels


def get_dataset_sample_ids(dataset_id: str) -> list[str]:
    """
    Get all depmap ids for the given dataset.
    """
    assert is_continuous(dataset_id)
    if is_standard(dataset_id):
        return standard_utils.get_dataset_sample_ids(dataset_id)
    else:
        return nonstandard_utils.get_dataset_sample_ids(dataset_id)


def get_depmap_id_to_col_index_map(dataset_id) -> dict[str, int]:
    col_index_objects = get_matrix(dataset_id).col_index
    return {i.depmap_id: i.index for i in col_index_objects}


def get_subsetted_df_by_labels(
    dataset_id: str,
    feature_row_labels: Optional[list[str]],
    sample_col_ids: Optional[list[str]],
) -> pd.DataFrame:
    """
    Get a filtered dataframe with rows indexed by entity labels and columns indexed by depmap ids. 
    """
    row_index_to_entity_label = {}
    col_index_to_depmap_id = {}
    feature_row_labels_set = set(feature_row_labels) if feature_row_labels else set()
    row_summaries = get_all_row_indices_labels_entity_ids(dataset_id)

    # convert the list of entity labels to row indices
    row_indices = []
    for row in row_summaries:
        if feature_row_labels is None or row.label in feature_row_labels_set:
            row_indices.append(row.index)
            row_index_to_entity_label[row.index] = row.label

    depmap_id_to_matrix_index = get_depmap_id_to_col_index_map(dataset_id)

    col_indices = []
    if sample_col_ids:
        # convert the list of sample labels / depmap ids to column indices
        for col_label in sample_col_ids:
            if col_label in depmap_id_to_matrix_index:
                index = depmap_id_to_matrix_index[col_label]
                col_indices.append(index)
                col_index_to_depmap_id[index] = col_label
    else:
        # Load the list of all column indices
        col_indices = list(depmap_id_to_matrix_index.values())
        col_index_to_depmap_id = dict(
            [(value, key) for key, value in depmap_id_to_matrix_index.items()]
        )

    # Load the dataframe and set the index to use labels
    if is_continuous(dataset_id):
        subsetted_df = get_subsetted_df(dataset_id, row_indices, col_indices)
        subsetted_df.rename(index=row_index_to_entity_label, inplace=True)
        subsetted_df.rename(columns=col_index_to_depmap_id, inplace=True)
        return subsetted_df
    else:
        raise NotImplementedError


def get_subsetted_df(dataset_id, row_indices, col_indices):
    """
    Thus far, this is only used in the compute module, for computing custom analyses
    :return: dataframe where rows
    """
    assert is_continuous(dataset_id)
    if is_standard(dataset_id):
        df = standard_utils.get_subsetted_df(dataset_id, row_indices, col_indices)
    else:
        df = nonstandard_utils.get_subsetted_df(dataset_id, row_indices, col_indices)

    return df


def valid_row(dataset_id, row_name):
    if dataset_id == get_context_dataset():
        return db.session.query(
            SubtypeContext.query.filter_by(subtype_code=row_name).exists()
        ).scalar()

    elif dataset_id in [
        get_primary_disease_dataset(),
        get_disease_subtype_dataset(),
        get_tumor_type_dataset(),
        get_gender_dataset(),
        get_growth_pattern_dataset(),
    ]:
        return row_name == "all"

    elif dataset_id == get_custom_cell_lines_dataset():
        return CustomCellLineGroup.exists(row_name)

    elif dataset_id == get_lineage_dataset():
        return row_name in ["all", "1", "2", "3"]

    elif has_config(dataset_id):
        if is_standard(dataset_id):
            return standard_utils.valid_row(dataset_id, row_name)
        else:
            return nonstandard_utils.valid_row(dataset_id, row_name)

    else:
        raise ValueError("Invalid dataset " + dataset_id + "; not in the config")


def get_row_of_values(dataset_id, feature):

    """
    Returns values
        These may be numeric, or string
        If string, these are values, and not display names/labels

    Whenever a new path is added to here, it should be added to the corresponding test
    """
    if dataset_id == get_context_dataset():
        context = SubtypeContext.get_by_code(feature)
        assert context is not None
        # TODO: Not sure if we should be using the SubtypeNode hierarchy to get the model ids of the
        # child contexts, too
        series = pd.Series(
            context.subtype_code, [model.model_id for model in context.depmap_model]
        )
    elif dataset_id == get_custom_cell_lines_dataset():
        series = pd.Series(1, CustomCellLineGroup.get_depmap_ids(feature))

    elif dataset_id == get_lineage_dataset():
        level = feature
        # todo:  fix this hack (replace all instances of using "all" to create a lineage slice id with 1)
        if level == "all":
            level = 1
        series = CellLine.get_cell_line_lineage_name_series(level)

    elif dataset_id == get_primary_disease_dataset():
        series = CellLine.get_cell_line_primary_disease_series()

    elif dataset_id == get_disease_subtype_dataset():
        series = CellLine.get_cell_line_disease_subtype_series()

    elif dataset_id == get_tumor_type_dataset():
        series = CellLine.get_cell_line_tumor_type_series()

    elif dataset_id == get_gender_dataset():
        series = CellLine.get_cell_line_gender_series()

    elif dataset_id == get_growth_pattern_dataset():
        series = CellLine.get_cell_line_growth_pattern_series()

    elif dataset_id == "mutation_details":
        series = Mutation.get_mutation_detail_label(feature)

    elif has_config(dataset_id):
        if is_standard(dataset_id):
            series = standard_utils.get_row_of_values(dataset_id, feature)
        else:
            series = nonstandard_utils.get_row_of_values(dataset_id, feature)

    # Special cases for DE2
    elif dataset_id == "mutation_protein_change_by_gene":
        series = Mutation.get_cell_line_mutation_protein_change_series_by_gene(
            feature, True
        )
    elif dataset_id == "cell_line_display_name" and feature == "all":
        series = CellLine.get_cell_line_display_name_series()
    elif dataset_id == "gene_essentiality" and feature == "all":
        series = GeneExecutiveInfo.get_gene_essentiality_series()
    elif dataset_id == "gene_selectivity" and feature == "all":
        series = GeneExecutiveInfo.get_gene_selectivity_series()
    elif dataset_id == "age_category" and feature == "all":
        series = DepmapModel.get_models_age_category_series()
    else:
        raise ValueError("Invalid dataset " + dataset_id + "; not in the config")

    series.dropna(inplace=True)

    if is_categorical(dataset_id):
        category_config = get_category_config(dataset_id)
        if hasattr(category_config, "map_value"):
            series = series.map(lambda x: category_config.map_value(x, feature))

    if not isinstance(series, CellLineSeries):
        series = CellLineSeries(series)

    return series


def get_category_config(color_dataset):
    category_config = __get_config().get(color_dataset)["categories"]
    return category_config


###############################
# new method which superceeds many of the existing methods


@dataclass
class SummarizedExperiment:
    # a matrix of scalars where rows represent samples and columns represent features
    values: pd.DataFrame

    # will always have a depmap_id column
    samples: pd.DataFrame

    # will always have a entity_id and a label column
    features: pd.DataFrame

    def validate(self):
        assert self.values.shape == [self.samples.shape[0], self.features.shape[0]]


def get_summarized_experiment(
    dataset_id: str, sample_ids: Optional[List[str]], entity_id: Optional[List[str]]
) -> SummarizedExperiment:
    """
    extracts a slice of data from dataset_id for the specified samples and features. If either is None,
    returns it for all features/samples

    Examples:
        getting all data in a dataset
        se = get_summarized_experiment(dataset_id, None, None)

        get all features in a dataset
        get_summarized_experiment(dataset_id, [], None).features

        get all samples in a dataset
        get_summarized_experiment(dataset_id, None, []).samples

        get a single sample's worth of data
        get_summarized_experiment(dataset_id, [sample_id], None).values
    """
    raise NotImplementedError()
