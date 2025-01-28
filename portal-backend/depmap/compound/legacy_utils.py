import logging
import pandas as pd
import re
import sqlalchemy as sa
from sqlalchemy import nullslast, case  # type: ignore

from depmap.interactive import interactive_utils
from depmap.database import db
from depmap.dataset.models import (
    Compound,
    CompoundExperiment,
    DependencyDataset,
)
from depmap.partials.matrix.models import Matrix, RowMatrixIndex

# These methods can all be deleted once compound datasets are migrated to breadbox.

log = logging.getLogger(__name__)

def get_compound_labels_for_compound_experiment_dataset(dataset_name: str) -> dict[str, str]:
    """ 
    This method loads a mapping between the old index (compound experiment label) and 
    method is used to re-index datasets which are indexed by compound experiment. 
    """
    matrix_id = interactive_utils.get_matrix_id(dataset_name)
    comp_exp_alias = sa.orm.aliased(CompoundExperiment)
    compound_alias = sa.orm.aliased(Compound)
    labels_by_indeces = (
        Matrix.query.filter_by(matrix_id=matrix_id)
        .join(RowMatrixIndex)
        .join(comp_exp_alias)
        .join(compound_alias, compound_alias.entity_id == comp_exp_alias.compound_id)
        .with_entities(comp_exp_alias.label, compound_alias.label)
        .all()
    )
    return {experiment_id: compound_label for experiment_id, compound_label in labels_by_indeces}

def get_subsetted_df_by_compound_labels(dataset_id: str) -> pd.DataFrame:
    """
    Load the data for a drug screen dataset. This is similar to get_subsetted_df_by_labels,
    except that for compound datasets, the result will be indexed by compound (to match breadbox).
    """
    feature_type = interactive_utils.get_entity_type(dataset_id)
    assert feature_type == "compound_experiment", f"Dataset '{dataset_id}' is indexed by '{feature_type}', cannot be re-indexed by compound label"
    compound_labels_by_experiment = get_compound_labels_for_compound_experiment_dataset(dataset_id)
    compound_experiment_df = interactive_utils.get_subsetted_df_by_labels(dataset_id, None, None)
    compound_df = compound_experiment_df.rename(index=compound_labels_by_experiment)

    # Check for duplicate compound labels (which is possible since there are multiple CEs per compound)
    if compound_df.index.duplicated().any():
        log.warning(f"Found duplicate compounds in the dataset {dataset_id}. Keeping first occurance, dropping others.")
        compound_df = compound_df.reset_index().drop_duplicates(subset="index").set_index("index") # pyright: ignore
    return compound_df


def get_compound_experiment_priority_sorted_datasets(compound_id) -> list[str]:
    """Get a list of dataset ids in priority order"""
    # Get a list of dataset IDs with an initial priority order sorting
    datasets =  (
        db.session.query(CompoundExperiment, DependencyDataset)
        .join(
            Matrix, DependencyDataset.matrix_id == Matrix.matrix_id
        )  # NOTE: I'm not sure if this join is necessary since RowMatrixIndex already has a matrix_id
        .join(RowMatrixIndex)
        .join(
            CompoundExperiment,
            RowMatrixIndex.entity_id == CompoundExperiment.entity_id,
        )
        .join(Compound, Compound.entity_id == CompoundExperiment.compound_id)
        .filter(Compound.entity_id == compound_id)
        .order_by(
            nullslast(DependencyDataset.priority),
            CompoundExperiment.entity_id,
            case([(DependencyDataset.data_type == "drug_screen", 0)], else_=1),
        )
        .with_entities(DependencyDataset)
    )
    # For the compound page, an additional prioritization step has been done as well.
    # I'm not sure why this was done, but want to keep the same functionality for legacy datasets.
    dataset_regexp_ranking = [
        "Prism_oncology.*",
        "Repurposing_secondary.*",
        "Rep_all_single_pt.*",
        ".*",
    ]
    result = []
    for regexp in dataset_regexp_ranking:
        for dataset in datasets:
            dataset_id = dataset.name.name
            pattern = re.compile(regexp)
            if pattern.match(dataset_id) and dataset_id not in result:
                result.append(dataset_id)
    return result 
