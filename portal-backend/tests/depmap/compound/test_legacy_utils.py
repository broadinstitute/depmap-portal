from typing import List, Tuple
import typing
from depmap.compound.legacy_utils import (
    does_legacy_dataset_exist_with_compound_experiment,
    get_compound_ids_by_experiment_id,
    get_compound_labels_by_experiment_label,
)
from depmap.compound.models import CompoundExperiment, Compound
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
        typing.cast(CompoundExperiment, compound_experiment_1A).entity_id,
        typing.cast(CompoundExperiment, compound_experiment_2).entity_id,
    ]
    assert (
        result[typing.cast(CompoundExperiment, compound_experiment_1A).entity_id]
        == typing.cast(Compound, compound1).compound_id
    )
    assert (
        result[typing.cast(CompoundExperiment, compound_experiment_2).entity_id]
        == typing.cast(Compound, compound2).compound_id  # pyright: ignore
    )


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
        typing.cast(CompoundExperiment, compound_experiment_1A).label,
        typing.cast(CompoundExperiment, compound_experiment_2).label,
    ]
    assert (
        result[typing.cast(CompoundExperiment, compound_experiment_1A).label]
        == typing.cast(Compound, compound1).label
    )
    assert (
        result[typing.cast(CompoundExperiment, compound_experiment_2).label]
        == typing.cast(Compound, compound2).label
    )


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

    compound_exp_and_dataset: List[Tuple[CompoundExperiment, DependencyDataset]] = [
        (
            typing.cast(CompoundExperiment, compound_experiment_2),
            typing.cast(DependencyDataset, rep_dataset),
        ),
        (
            typing.cast(CompoundExperiment, compound_experiment_1A),
            typing.cast(DependencyDataset, oncref_dataset),
        ),
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

    dataset_no_ce: List[Tuple[CompoundExperiment, DependencyDataset]] = [
        (
            typing.cast(CompoundExperiment, compound_experiment_3),
            typing.cast(DependencyDataset, rep_dataset),
        ),
        (
            typing.cast(CompoundExperiment, compound_experiment_3),
            typing.cast(DependencyDataset, oncref_dataset),
        ),
    ]
    # 3. The dataset exists, but the compound we are searching for is not in that dataset.
    dataset_exists_w_compound = does_legacy_dataset_exist_with_compound_experiment(
        dataset_name=dataset_name.value, compound_exp_and_dataset=dataset_no_ce
    )
    assert dataset_exists_w_compound is False

    ce_no_dataset: List[Tuple[CompoundExperiment, DependencyDataset]] = [
        (
            typing.cast(CompoundExperiment, compound_experiment_3),
            typing.cast(
                DependencyDataset,
                DependencyDatasetFactory(
                    name=DependencyDataset.DependencyEnum.GDSC1_AUC
                ),
            ),
        ),
        (
            typing.cast(CompoundExperiment, compound_experiment_3),
            typing.cast(
                DependencyDataset,
                DependencyDatasetFactory(
                    name=DependencyDataset.DependencyEnum.GDSC2_AUC
                ),
            ),
        ),
    ]

    # 4. The dataset exists, but the compound we are searching for is not in that dataset.
    dataset_exists_w_compound = does_legacy_dataset_exist_with_compound_experiment(
        dataset_name=dataset_name.value, compound_exp_and_dataset=ce_no_dataset
    )
    assert dataset_exists_w_compound is False
