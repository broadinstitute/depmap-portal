import logging
import pandas as pd
import sqlalchemy as sa

from depmap.interactive import interactive_utils
from depmap.dataset.models import (
    Compound,
    CompoundExperiment,
)
from depmap.partials.matrix.models import Matrix, RowMatrixIndex

# These methods can all be deleted once compound datasets are migrated to breadbox.

log = logging.getLogger(__name__)

def get_compound_labels_for_compound_experiment_dataset(dataset_name: str) -> dict[str, str]:
    """
    In the future, all drug screen datasets will be indexed by compound instead of compound experiment. 
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

def get_dataset_data_indexed_by_compound_label(dataset_id: str) -> pd.DataFrame:
    feature_type = interactive_utils.get_entity_type(dataset_id)
    assert feature_type == "compound", f"Cannot re-index a non-compound dataset '{dataset_id}' by compound label"
    compound_labels_by_experiment = get_compound_labels_for_compound_experiment_dataset(dataset_id)
    compound_experiment_df = interactive_utils.get_subsetted_df_by_labels(dataset_id, None, None)
    compound_df = compound_experiment_df.rename(index=compound_labels_by_experiment)

    # Check for duplicate compound labels (which is possible since there are multiple CEs per compound)
    if compound_df.index.duplicated().any():
        log.warning(f"Found duplicate compounds in the dataset {dataset_id}. Keeping first occurance, dropping others.")
        compound_df = compound_df.reset_index().drop_duplicates(subset="index").set_index("index") # pyright: ignore
    return compound_df
