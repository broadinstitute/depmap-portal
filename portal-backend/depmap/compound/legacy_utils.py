import collections
import logging
from depmap import data_access
import pandas as pd
import re
import sqlalchemy as sa
from sqlalchemy import nullslast, case  # type: ignore
from typing import List, Optional, Tuple

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


# compound_exp_and_dataset is a weird pre-existing hack for finding the compound experiment. Pass it in here as a param to avoid adding too many
# independent hacks.
def does_legacy_dataset_exist_with_compound_experiment(
    dataset_name: str,
    compound_exp_and_dataset: List[Tuple[CompoundExperiment, DependencyDataset]],
):
    dataset = DependencyDataset.get_dataset_by_name(dataset_name)

    # Find the dataset we are looking for in the list of comound experiment and dataset tuples
    compound_exp_dataset = next(
        filter(lambda item: item[1] == dataset, compound_exp_and_dataset), None,
    )
    if compound_exp_dataset is None:
        return False

    dataset_exists = data_access.dataset_exists(dataset_name)
    if not dataset_exists:
        return dataset_exists

    compound_exp_is_in_dataset = data_access.valid_row(
        dataset_name, row_name=compound_exp_dataset[0].label,
    )

    return compound_exp_is_in_dataset


def _get_deduplicated_experiment_compound_mapping(
    dataset_id: str,
) -> list[tuple[CompoundExperiment, Compound]]:
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

    experiments_by_compound_id = collections.defaultdict(lambda: [])
    compounds_by_compound_id: dict[str, Compound] = {}
    for comp_exp, compound in comp_exp_info:
        compound_id = compound.entity_id
        experiments_by_compound_id[compound_id].append(comp_exp)
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
    experiment_compound_pairs = _get_deduplicated_experiment_compound_mapping(
        dataset_id
    )
    for experiment, compound in experiment_compound_pairs:
        result[experiment.label] = compound.label
    return result


def get_compound_ids_by_experiment_id(dataset_id: str) -> dict[int, int]:
    """Get a mapping between compound entity IDs and experiment entity IDs (not given IDs)."""
    result = {}
    experiment_compound_pairs = _get_deduplicated_experiment_compound_mapping(
        dataset_id
    )
    for experiment, compound in experiment_compound_pairs:
        result[experiment.entity_id] = compound.compound_id
    return result


def get_experiment_label_for_compound_label(
    dataset_id: str, compoound_label: str
) -> Optional[str]:
    """
    For a given compound label, find the compound experiment that's used to index the underlying dataset.
    This should only be called for datasets where the feature_type is "compound_experiment".
    This can be used to generate backwards compatible links to DE2. 
    """
    for exp_label, c_label in get_compound_labels_by_experiment_label(
        dataset_id
    ).items():
        if c_label == compoound_label:
            return exp_label
    return None


def get_subsetted_df_by_compound_labels(dataset_id: str) -> pd.DataFrame:
    """
    Load the data for a drug screen dataset. This is similar to get_subsetted_df_by_labels,
    except that for compound datasets, the result will be indexed by compound (to match breadbox).
    """
    feature_type = interactive_utils.get_entity_type(dataset_id)
    assert (
        feature_type == "compound_experiment"
    ), f"Dataset '{dataset_id}' is indexed by '{feature_type}', cannot be re-indexed by compound label"
    compound_labels_by_experiment = get_compound_labels_by_experiment_label(dataset_id)
    compound_experiment_df = interactive_utils.get_subsetted_df_by_labels(
        dataset_id, None, None
    )
    compound_df = compound_experiment_df.loc[
        list(compound_labels_by_experiment.keys()), :
    ].rename(index=compound_labels_by_experiment)
    return compound_df


def get_compound_experiment_priority_sorted_datasets(compound_id: str) -> list[str]:
    """Get a list of dataset ids in priority order for the given compound ID (the given ID, not the entity ID)"""
    # Get a list of dataset IDs with an initial priority order sorting
    datasets = (
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
        .filter(Compound.compound_id == compound_id)
        .order_by(
            nullslast(DependencyDataset.priority),
            CompoundExperiment.entity_id,
            case([(DependencyDataset.data_type == "drug_screen", 0)], else_=1),
        )
        .with_entities(DependencyDataset)
        .all()
    )
    return [dataset.name.name for dataset in datasets]
