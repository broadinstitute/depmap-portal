import sqlalchemy as sa

from depmap.interactive import interactive_utils
from depmap.dataset.models import (
    Compound,
    CompoundExperiment,
)
from depmap.partials.matrix.models import Matrix, RowMatrixIndex

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