from depmap.compound.legacy_utils import (
    does_legacy_dataset_exist_with_compound_experiment,
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


def test_get_compound_ids_by_experiment_id(empty_db_mock_downloads):
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
    dataset = DependencyDatasetFactory(matrix=matrix)
    dataset_id = dataset.name.name
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

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
    dataset = DependencyDatasetFactory(matrix=matrix)
    dataset_id = dataset.name.name
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    result = get_compound_labels_by_experiment_label(dataset_id)
    assert list(result.keys()) == [
        compound_experiment_1A.label,
        compound_experiment_2.label,
    ]
    assert result[compound_experiment_1A.label] == compound1.label  # pyright: ignore
    assert result[compound_experiment_2.label] == compound2.label  # pyright: ignore


def test_does_legacy_dataset_exist_with_compound_experiment(empty_db_mock_downloads):
    dataset_name = DependencyDataset.DependencyEnum.Prism_oncology_AUC
    dataset_name_repurposing = DependencyDataset.DependencyEnum.Rep_all_single_pt

    # Compound 1 has 3 corresponding experiments (2 of which are in our dataset)
    compound1 = CompoundFactory()
    compound_experiment_1A = CompoundExperimentFactory(compound=compound1)
    compound_experiment_1B = CompoundExperimentFactory(compound=compound1)
    # Compound 2 only has one experiment (which is in our dataset)
    compound2 = CompoundFactory()
    compound_experiment_2 = CompoundExperimentFactory(compound=compound2)
    # Compound 3 has one experiment (which is not in our dataset)
    compound3 = CompoundFactory()
    compound_experiment_3 = CompoundExperimentFactory(compound=compound3)

    matrix = MatrixFactory(
        [compound_experiment_1A, compound_experiment_1B, compound_experiment_2,],
        [
            DepmapModelFactory(depmap_id="a"),
            DepmapModelFactory(depmap_id="b"),
            DepmapModelFactory(depmap_id="c"),
        ],
        using_depmap_model_table=True,
    )
    oncref_dataset = DependencyDatasetFactory(matrix=matrix, name=dataset_name)
    rep_dataset = DependencyDatasetFactory(
        matrix=MatrixFactory(), name=dataset_name_repurposing
    )

    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    compound_exp_and_dataset = [
        (compound_experiment_2, rep_dataset),
        (compound_experiment_1A, oncref_dataset),
    ]

    # 1. Return True if the dataset exists with that compound experiment
    dataset_exists_w_compound = does_legacy_dataset_exist_with_compound_experiment(
        dataset_name=dataset_name.value,
        compound_exp_and_dataset=compound_exp_and_dataset,
    )
    assert dataset_exists_w_compound is True

    # 2. The dataset exists and the compound experiment exist, but the compound experiment is not in the dataset of interest.
    dataset_exists_w_compound = does_legacy_dataset_exist_with_compound_experiment(
        dataset_name=dataset_name_repurposing.value,
        compound_exp_and_dataset=compound_exp_and_dataset,
    )
    assert dataset_exists_w_compound is False

    dataset_no_ce = [
        (compound_experiment_3, rep_dataset),
        (compound_experiment_3, oncref_dataset),
    ]
    # 3. The dataset exists, but the compound we are searching for is not in that dataset.
    dataset_exists_w_compound = does_legacy_dataset_exist_with_compound_experiment(
        dataset_name=dataset_name.value, compound_exp_and_dataset=dataset_no_ce
    )
    assert dataset_exists_w_compound is False

    ce_no_dataset = [
        (compound_experiment_3, DependencyDataset()),
        (compound_experiment_3, DependencyDataset()),
    ]
    # 4. The dataset exists, but the compound we are searching for is not in that dataset.
    dataset_exists_w_compound = does_legacy_dataset_exist_with_compound_experiment(
        dataset_name=dataset_name.value, compound_exp_and_dataset=ce_no_dataset
    )
    assert dataset_exists_w_compound is False
