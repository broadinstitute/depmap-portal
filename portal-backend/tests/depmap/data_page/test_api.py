import depmap.data_page.api as data_page_api
from depmap.dataset.models import DependencyDataset
from flask import url_for
import pandas as pd
from tests.factories import (
    DependencyDatasetFactory,
    DepmapModelFactory,
    GeneFactory,
    CompoundFactory,
    CompoundExperimentFactory,
    MatrixFactory,
)
import numpy as np
from tests.utilities import interactive_test_utils


def test_get_data_availability(populated_db):
    with populated_db.app.test_client() as c:
        r = c.get(
            url_for("api.data_page_data_availability"), content_type="application/json",
        )
        data_availablity = r.json
        assert list(data_availablity.keys()) == [
            "values",
            "data_type_url_mapping",
            "drug_count_mapping",
            "data_types",
            "all_depmap_ids",
        ]

        assert len(data_availablity["values"]) == 22
        assert data_availablity["data_types"] == [
            "CRISPR_Achilles_Broad",
            "CRISPR_Score_Sanger",
            "CRISPR_ParalogsScreens",
            "RNAi_Marcotte",
            "RNAi_Achilles_Broad",
            "RNAi_Drive_Novartis",
            "Sequencing_WES_Broad",
            "Sequencing_WES_Sanger",
            "Sequencing_WGS_Broad",
            "Sequencing_RNA_Broad",
            "Drug_CTD_Broad",
            "Drug_Repurposing_Broad",
            "Drug_GDSC_Sanger",
            "Drug_OncRef_Broad",
            "Proteomics_Olink",
            "Proteomics_RPPA_CCLE",
            "Proteomics_MS_CCLE",
            "Proteomics_MS_Sanger",
            "Methylation_Sanger",
            "Methylation_CCLE",
            "Uncategorized_miRNA_CCLE",
            "Uncategorized_ATACSeq_Broad",
        ]
        assert len(data_availablity["all_depmap_ids"]) == 2280


def test_get_data_availability_not_all_data_types_present(
    empty_db_mock_downloads, monkeypatch
):
    dataset_name = DependencyDataset.DependencyEnum.Chronos_Combined
    cell_line = DepmapModelFactory(model_id="ACH-000019")
    genes = [GeneFactory() for _ in range(1)]
    matrix = MatrixFactory(
        data=[[2]],
        cell_lines=[cell_line],
        entities=genes,
        using_depmap_model_table=True,
    )
    dataset = DependencyDatasetFactory(matrix=matrix, name=dataset_name, priority=1,)

    drug_dataset_name = DependencyDataset.DependencyEnum.CTRP_AUC
    cell_lines = [
        DepmapModelFactory(model_id="ACH-000020"),
        DepmapModelFactory(model_id="ACH-000021"),
        DepmapModelFactory(model_id="ACH-000022"),
    ]
    compounds = [CompoundFactory() for _ in range(3)]
    compound_experiments = [CompoundExperimentFactory(compound=c) for c in compounds]
    matrix = MatrixFactory(
        data=[[2, 3, 4], [0, 2, 1], [np.NaN, np.NaN, np.NaN]],
        cell_lines=cell_lines,
        entities=compound_experiments,
        using_depmap_model_table=True,
    )
    DependencyDatasetFactory(matrix=matrix, name=drug_dataset_name, priority=1)
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    def mock_get_all_data_avail_df():
        with open(
            "tests/depmap/data_page/test_all_data_avail_partial.csv", "rt",
        ) as fd:
            df = pd.DataFrame(pd.read_csv(fd, index_col="ModelID"))
            return df

    monkeypatch.setattr(
        data_page_api, "_get_all_data_avail_df", mock_get_all_data_avail_df
    )

    with empty_db_mock_downloads.app.test_client() as c:
        r = c.get(
            url_for("api.data_page_data_availability"), content_type="application/json",
        )
        data_availability = r.json
        assert data_availability == {
            "values": [
                [True, False, False, False],
                [False, True, True, True],
                [False, False, False, False],
            ],
            "data_type_url_mapping": {
                "CRISPR_Achilles_Broad": "/data_page/?release=test+name+version&file=test+file+name+2",
                "Drug_CTD_Broad": "/data_page/?release=test+name+version&file=test+file+name+2",
                "Drug_Repurposing_Broad": None,
            },
            "drug_count_mapping": {
                "Drug_CTD_Broad": 3,
                "Drug_Repurposing_Broad": None,
            },
            "data_types": [
                "CRISPR_Achilles_Broad",
                "Drug_CTD_Broad",
                "Drug_Repurposing_Broad",
            ],
            "all_depmap_ids": [
                [0, "ACH-000019"],
                [1, "ACH-000020"],
                [2, "ACH-000021"],
                [3, "ACH-000022"],
            ],
        }
