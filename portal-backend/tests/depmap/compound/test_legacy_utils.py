from typing import Optional
from depmap.compound.legacy_utils import (
    get_compound_ids_by_experiment_id,
    get_compound_labels_by_experiment_label,
)
from depmap.dataset.models import DependencyDataset
from tests.factories import (
    CompoundExperimentFactory,
    CompoundFactory,
    DependencyDatasetFactory,
    DepmapModelFactory,
    MatrixFactory,
)
from tests.utilities import interactive_test_utils


def _setup_factories(
    empty_db_mock_downloads,
    dataset_name: Optional[DependencyDataset.DependencyEnum] = None,
):
    # Compound 1 has 3 corresponding experiments (2 of which are in our dataset)
    compound1 = CompoundFactory()
    compound_experiment_1A = CompoundExperimentFactory(compound=compound1)
    compound_experiment_1B = CompoundExperimentFactory(compound=compound1)
    compound_experiment_1C = CompoundExperimentFactory(compound=compound1)
    # Compound 2 only has one experiment (which is in our dataset)
    compound2 = CompoundFactory()
    compound_experiment_2 = CompoundExperimentFactory(compound=compound2)
    # Compound 3 has one experiment (which is not in our dataset)
    compound3 = CompoundFactory()
    compound_experiment_3 = CompoundExperimentFactory(compound=compound3)
    # multiple cell lines so can plot distplot
    matrix = MatrixFactory(
        [compound_experiment_1A, compound_experiment_1B, compound_experiment_2,],
        [DepmapModelFactory(), DepmapModelFactory(), DepmapModelFactory()],
        using_depmap_model_table=True,
    )
    dataset = (
        DependencyDatasetFactory(matrix=matrix)
        if not dataset_name
        else DependencyDatasetFactory(matrix=matrix, name=dataset_name)
    )
    dataset_id = dataset.name.name
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    return (
        dataset_id,
        compound_experiment_1A,
        compound_experiment_2,
        compound1,
        compound2,
    )


def test_get_compound_ids_by_experiment_id(empty_db_mock_downloads):
    (
        dataset_id,
        compound_experiment_1A,
        compound_experiment_2,
        compound1,
        compound2,
    ) = _setup_factories(empty_db_mock_downloads)

    result = get_compound_ids_by_experiment_id(dataset_id)
    assert list(result.keys()) == [
        compound_experiment_1A.entity_id,
        compound_experiment_2.entity_id,
    ]  # pyright: ignore
    assert (
        result[compound_experiment_1A.entity_id] == compound1.compound_id
    )  # pyright: ignore
    assert (
        result[compound_experiment_2.entity_id] == compound2.compound_id
    )  # pyright: ignore


def test_get_compound_labels_by_experiment_labels(empty_db_mock_downloads):
    # Compound 1 has 3 corresponding experiments (2 of which are in our dataset)
    (
        dataset_id,
        compound_experiment_1A,
        compound_experiment_2,
        compound1,
        compound2,
    ) = _setup_factories(empty_db_mock_downloads)

    result = get_compound_labels_by_experiment_label(dataset_id)
    assert list(result.keys()) == [
        compound_experiment_1A.label,
        compound_experiment_2.label,
    ]
    assert result[compound_experiment_1A.label] == compound1.label  # pyright: ignore
    assert result[compound_experiment_2.label] == compound2.label  # pyright: ignore


def test_does_legacy_dataset_exist_with_compound_experiment(empty_db_mock_downloads):
    # Returns False if:
    (
        dataset_id,
        compound_experiment_1A,
        compound_experiment_2,
        compound1,
        compound2,
    ) = _setup_factories(empty_db_mock_downloads)

    # 1. dataset does not exist (setup does not define an Prism_oncology_AUC or Rep_all_single_pt dataset)
    dataset = DependencyDataset.get_dataset_by_name(
        DependencyDataset.DependencyEnum.Prism_oncology_AUC.value
    )
    assert dataset is None

    # 2. compound_exp_dataset is not found with matching dataset

    #


def test_dataset_exist(empty_db_mock_downloads):
    (
        dataset_id,
        compound_experiment_1A,
        compound_experiment_2,
        compound1,
        compound2,
    ) = _setup_factories(
        empty_db_mock_downloads,
        dataset_name=DependencyDataset.DependencyEnum.Prism_oncology_AUC,
    )
