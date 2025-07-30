import os
from depmap.cell_line.models_new import DepmapModel
from loader.cell_line_loader import load_cell_lines_metadata

import pytest

from loader.gene_loader import load_hgnc_genes
from loader.dataset_loader import (
    load_single_input_file_dependency_dataset,
    load_compound_dose_replicate_dataset,
    load_curve_parameters_csv,
)
from depmap.database import transaction
from depmap.dataset.models import DependencyDataset
from depmap.compound.models import DoseResponseCurve
from depmap.gene.models import Gene
from depmap.cell_line.models import CellLine
from depmap.utilities import hdf5_utils
from tests.utilities.df_test_utils import load_sample_cell_lines
from tests.factories import CompoundExperimentFactory, CellLineFactory
from depmap.access_control import PUBLIC_ACCESS_GROUP
from depmap.settings.shared import DATASET_METADATA


def test_load_row_col_all_nan(empty_db_mock_downloads):
    matrix_file_name_root = "dataset/avana"
    score_file_path = matrix_file_name_root + "_score.hdf5"
    loader_data_dir = empty_db_mock_downloads.app.config["LOADER_DATA_DIR"]

    # Check that the test set up is valid for testing that these rows and cols get dropped
    row_index = hdf5_utils.get_row_index(loader_data_dir, score_file_path)
    col_index = hdf5_utils.get_col_index(loader_data_dir, score_file_path)
    assert "F8A1 (8263)" in row_index
    assert "ACH-000805" in col_index

    with transaction(empty_db_mock_downloads):
        load_hgnc_genes(os.path.join(loader_data_dir, "gene/hgnc-database-1a29.1.csv"))
        load_cell_lines_metadata(
            os.path.join(loader_data_dir, "cell_line/cell_line_metadata.csv")
        )
        load_sample_cell_lines()
        from depmap.enums import DataTypeEnum

        load_single_input_file_dependency_dataset(
            DependencyDataset.DependencyEnum.Avana,
            {
                "matrix_file_name_root": matrix_file_name_root,
                "display_name": "Avana-17Q2-Broad",
                "units": "Gene Effect (CERES)",
                "data_type": DataTypeEnum.crispr,
                "priority": 1,
                "global_priority": None,
                "taiga_id": "placeholder-taiga-id.1",
            },
            PUBLIC_ACCESS_GROUP,
        )

    all_nan_gene = Gene.get_by_label(
        "F8A1"
    )  # present in the matrix, but not added to row index because row is nan
    all_nan_cell_line = CellLine.get_by_name(
        "COLO679_SKIN"
    )  # present in the matrix, but not added to col index because col is nan

    dataset = DependencyDataset.get_dataset_by_name(
        DependencyDataset.DependencyEnum.Avana
    )
    entity_ids = [row.entity_id for row in dataset.matrix.row_index.all()]
    cell_line_names = [
        col.cell_line.cell_line_name for col in dataset.matrix.col_index.all()
    ]

    assert all_nan_gene.entity_id not in entity_ids
    assert all_nan_cell_line.cell_line_name not in cell_line_names


def test_cannot_load_without_taiga_id(empty_db_mock_downloads):
    loader_data_dir = empty_db_mock_downloads.app.config["LOADER_DATA_DIR"]
    with transaction(empty_db_mock_downloads):
        load_hgnc_genes(os.path.join(loader_data_dir, "gene/hgnc-database-1a29.1.csv"))
        load_cell_lines_metadata(
            os.path.join(loader_data_dir, "cell_line/cell_line_metadata.csv")
        )
        load_sample_cell_lines()

        with pytest.raises(KeyError) as e:
            load_single_input_file_dependency_dataset(
                DependencyDataset.DependencyEnum.Avana,
                {
                    "matrix_file_name_root": "dataset/avana",
                    "display_name": "Avana-17Q2-Broad",
                    "units": "Gene Effect (CERES)",
                    "data_type": "CRISPR",
                    "priority": 1,
                    "global_priority": None,
                },
                PUBLIC_ACCESS_GROUP,
            )
        assert "taiga_id" in str(e.value)


def test_load_curve_parameters_csv(empty_db_mock_downloads):
    cpd_exp = CompoundExperimentFactory(
        xref_type="CTRP", xref="606135", label="CTRP:606135"
    )
    cell_line = CellLineFactory(cell_line_name="CADOES1_BONE")
    empty_db_mock_downloads.session.flush()
    load_curve_parameters_csv("sample_data/compound/ctd2_per_curve.csv", "dataset")

    curve = DoseResponseCurve.query.filter(
        DoseResponseCurve.compound_exp == cpd_exp,
        DoseResponseCurve.cell_line == cell_line,
    ).one()
    assert curve.ec50 == 0.5
    assert curve.slope == -1
    assert curve.upper_asymptote == 2
    assert curve.lower_asymptote == 1
    assert curve.drc_dataset_label == "dataset"


def test_load_and_access_viability(empty_db_mock_downloads):
    CompoundExperimentFactory(xref_type="CTRP", xref="606135", label="CTRP:606135")

    # create necessary cell lines, defined in subsets.py
    for cell_line_name in [
        "HS294T_SKIN",
        "A673_BONE",
        "EWS502_BONE",
        "HT29_LARGE_INTESTINE",
        "A2058_SKIN",
        "C32_SKIN",
        "143B_BONE",
        "CADOES1_BONE",
        "CJM_SKIN",
        "COLO679_SKIN",
        "EKVX_LUNG",
        "EPLC272H_LUNG",
        "UACC62_SKIN",
        "SKMEL30_SKIN",
        "WM88_SKIN",
        "PETA_SKIN",
        "TC32_BONE",
        "WM115_SKIN",
        "SH4_SKIN",
    ]:
        CellLineFactory(cell_line_name=cell_line_name)

    empty_db_mock_downloads.session.flush()

    # create the matrix
    matrix = load_compound_dose_replicate_dataset(
        "sample_data/compound/ctd2_dose_replicate_perturbations.csv",
        "sample_data/compound/ctd2_dose_replicate_cell_lines.csv",
        "sample_data/compound/ctd2_dose_replicate.hdf5",
        DependencyDataset.DependencyEnum.CTRP_dose_replicate,
        DATASET_METADATA[DependencyDataset.DependencyEnum.CTRP_dose_replicate],
        "placeholder taiga id",
        PUBLIC_ACCESS_GROUP,
    )
    empty_db_mock_downloads.session.flush()

    # verify that we can read the values back out
    a = matrix.get_cell_line_values_and_depmap_ids(
        "CTRP:606135 9.2μM rep1", by_label=True
    )
    assert len(a) == 16

    # now verify we can load a second dataset with the same compound dose replicates without getting an error
    matrix2 = load_compound_dose_replicate_dataset(
        "sample_data/compound/ctd2_dose_replicate_perturbations.csv",
        "sample_data/compound/ctd2_dose_replicate_cell_lines.csv",
        "sample_data/compound/ctd2_dose_replicate.hdf5",
        DependencyDataset.DependencyEnum.Repurposing_secondary_dose_replicate,
        DATASET_METADATA[DependencyDataset.DependencyEnum.Repurposing_secondary_dose_replicate],
        "placeholder taiga id",
        PUBLIC_ACCESS_GROUP,
    )
    empty_db_mock_downloads.session.flush()
    assert matrix.matrix_id != matrix2.matrix_id
    a = matrix2.get_cell_line_values_and_depmap_ids(
        "CTRP:606135 9.2μM rep1", by_label=True
    )
    assert len(a) == 16
