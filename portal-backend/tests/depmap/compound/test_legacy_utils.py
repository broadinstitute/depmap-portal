from depmap.compound.legacy_utils import (
    get_compound_ids_by_experiment_id,
    get_compound_labels_by_experiment_label,
)
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
        [
            compound_experiment_1A, 
            compound_experiment_1B,
            compound_experiment_2,
        ],
        [DepmapModelFactory(), DepmapModelFactory(), DepmapModelFactory()],
        using_depmap_model_table=True,
    )
    dataset = DependencyDatasetFactory(matrix=matrix)
    dataset_id = dataset.name.name
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    result = get_compound_ids_by_experiment_id(dataset_id)
    assert list(result.keys()) == [compound_experiment_1A.entity_id, compound_experiment_2.entity_id] # pyright: ignore
    assert result[compound_experiment_1A.entity_id] == compound1.entity_id # pyright: ignore
    assert result[compound_experiment_2.entity_id] == compound2.entity_id # pyright: ignore


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
        [
            compound_experiment_1A, 
            compound_experiment_1B,
            compound_experiment_2,
        ],
        [DepmapModelFactory(), DepmapModelFactory(), DepmapModelFactory()],
        using_depmap_model_table=True,
    )
    dataset = DependencyDatasetFactory(matrix=matrix)
    dataset_id = dataset.name.name
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    result = get_compound_labels_by_experiment_label(dataset_id)
    assert list(result.keys()) == [compound_experiment_1A.label, compound_experiment_2.label]
    assert result[compound_experiment_1A.label] == compound1.label # pyright: ignore
    assert result[compound_experiment_2.label] == compound2.label # pyright: ignore