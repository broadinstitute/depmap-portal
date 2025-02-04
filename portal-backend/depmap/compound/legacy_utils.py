import logging
import pandas as pd
import re
import sqlalchemy as sa
from sqlalchemy import nullslast, case  # type: ignore
from typing import Optional

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

def _get_deduplicated_experiment_compound_mapping(dataset_id: str) -> list[tuple[CompoundExperiment, Compound]]:
    """ 
    Returns a 1-1 mapping between CompoundExperiments and Compounds within the given dataset. 
    All compound experiments not in the mapping should be dropped. 
    """
    matrix_id = interactive_utils.get_matrix_id(dataset_id)
    comp_exp_alias = sa.orm.aliased(CompoundExperiment)
    compound_alias = sa.orm.aliased(Compound)
    comp_exp_info = (
        Matrix.query.filter_by(matrix_id=matrix_id)
        .join(RowMatrixIndex)
        .join(comp_exp_alias)
        .join(compound_alias, compound_alias.entity_id == comp_exp_alias.compound_id)
        .with_entities(comp_exp_alias, compound_alias)
        .all()
    )
    # Organize values by compound ID
    experiments_by_compound_id: dict[str, list] = {}
    compounds_by_compound_id: dict[str, Compound] = {}
    for comp_exp, compound in comp_exp_info:
        compound_id = compound.entity_id
        if compound_id in experiments_by_compound_id:
            # Add to the existing list of experiments
            experiments_by_compound_id[compound_id].append(comp_exp)
        else:
            # Add records to both dictionaries
            experiments_by_compound_id[compound_id] = [comp_exp]
            compounds_by_compound_id[compound_id] = compound

    # Remove duplicate compound experiments, re-index by compound experiment
    result = []
    for compound_id, compound in compounds_by_compound_id.items():
        experiments = experiments_by_compound_id[compound_id]
        selected_experiment = sorted(experiments, key=lambda e: e.entity_id)[0]
        result.append((selected_experiment, compound))
    return result


def get_compound_labels_by_experiment_label(dataset_id: str) -> dict[str, str]:
    result = {}
    experiment_compound_pairs = _get_deduplicated_experiment_compound_mapping(dataset_id)
    for experiment, compound in experiment_compound_pairs:
        result[experiment.label] = compound.label
    return result


def get_compound_ids_by_experiment_id(dataset_id: str) -> dict[int, int]:
    result = {}
    experiment_compound_pairs = _get_deduplicated_experiment_compound_mapping(dataset_id)
    for experiment, compound in experiment_compound_pairs:
        result[experiment.entity_id] = compound.entity_id
    return result


def get_experiment_label_for_compound_label(dataset_id: str, compoound_label: str) -> Optional[str]:
    """
    For a given compound label, find the compound experiment that's used to index the underlying dataset.
    This should only be called for datasets where the feature_type is "compound_experiment".
    This can be used to generate backwards compatible links to DE2. 
    """
    for exp_label, c_label in get_compound_labels_by_experiment_label(dataset_id).items():
        if c_label == compoound_label:
            return exp_label
    return None


def get_subsetted_df_by_compound_labels(dataset_id: str) -> pd.DataFrame:
    """
    Load the data for a drug screen dataset. This is similar to get_subsetted_df_by_labels,
    except that for compound datasets, the result will be indexed by compound (to match breadbox).
    """
    feature_type = interactive_utils.get_entity_type(dataset_id)
    assert feature_type == "compound_experiment", f"Dataset '{dataset_id}' is indexed by '{feature_type}', cannot be re-indexed by compound label"
    compound_labels_by_experiment = get_compound_labels_by_experiment_label(dataset_id)
    compound_experiment_df = interactive_utils.get_subsetted_df_by_labels(dataset_id, None, None)
    compound_df = compound_experiment_df.loc[list(compound_labels_by_experiment.keys()),:].rename(index=compound_labels_by_experiment)
    return compound_df


def get_compound_experiment_priority_sorted_datasets(compound_id: int) -> list[str]:
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
    return [dataset.name.name for dataset in datasets]
