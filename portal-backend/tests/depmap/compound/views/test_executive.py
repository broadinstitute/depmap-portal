from depmap.compound.models import Compound
from depmap.compound.views.executive import format_availability_tile
from depmap.dataset.models import DependencyDataset
from tests.factories import (
    CompoundExperimentFactory,
    CompoundFactory,
    DependencyDatasetFactory,
    DepmapModelFactory,
    MatrixFactory,
)
from tests.utilities import interactive_test_utils


def test_format_availability_tile(empty_db_mock_downloads):
    compound: Compound = CompoundFactory()  # pyright: ignore
    compound_experiment_1 = CompoundExperimentFactory(
        label="exp_label_1", compound=compound
    )
    compound_experiment_2 = CompoundExperimentFactory(
        label="exp_label_2", compound=compound
    )

    models = [DepmapModelFactory() for _ in range(3)]

    matrix_1 = MatrixFactory(
        entities=[compound_experiment_1],
        cell_lines=models,
        using_depmap_model_table=True,
    )
    matrix_2 = MatrixFactory(
        entities=[compound_experiment_2],
        cell_lines=models,
        using_depmap_model_table=True,
    )

    DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.GDSC1_AUC, matrix=matrix_1
    )
    DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.CTRP_AUC, matrix=matrix_2
    )

    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    expected = [
        {
            "dataset_name": "CTRP",
            "dose_range": "1nM - 10μM",
            "assay": "CellTitreGlo",
            "cell_lines": 3,
            "dataset_url": "/download/all/?release=test+name+version&file=test+file+name+2",
        },
        {
            "dataset_name": "GDSC1",
            "dose_range": "1nM - 10μM",
            "assay": "Resazurin or Syto60",
            "cell_lines": 3,
            "dataset_url": "/download/all/?release=test+name+version&file=test+file+name+2",
        },
    ]
    availability = format_availability_tile(compound)

    assert expected == availability
