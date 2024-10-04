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
    PrimaryDiseaseFactory,
    MatrixFactory,
    CellLineFactory,
    LineageFactory,
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
            "lineage_counts",
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
    genes = [GeneFactory() for _ in range(1)]

    es_primary_disease = PrimaryDiseaseFactory(name="Ewing Sarcoma")
    os_primary_disease = PrimaryDiseaseFactory(name="Osteosarcoma")
    myeloid_primary_disease = PrimaryDiseaseFactory(name="Acute Myeloid Leukemia")

    myeloid_cell_lines = [
        DepmapModelFactory(
            model_id=f"ACH-{num}myeloid",
            stripped_cell_line_name=f"myeloid_{num}",
            cell_line=CellLineFactory(
                depmap_id=f"ACH-{num}myeloid",
                lineage=[
                    LineageFactory(level=1, name="Myeloid"),
                    LineageFactory(level=2, name="Acute Myeloid Leukemia"),
                ],
            ),
            oncotree_primary_disease=myeloid_primary_disease.name,
        )
        for num in range(5)
    ]
    bone_es_cell_lines = [
        DepmapModelFactory(
            model_id=f"ACH-{num}es",
            stripped_cell_line_name=f"{num}es",
            # cell_line needs to be explicitly defined to properly generate the lineages
            cell_line=CellLineFactory(
                depmap_id=f"ACH-{num}es",
                lineage=[
                    LineageFactory(level=1, name="Bone"),
                    LineageFactory(level=2, name="Ewing Sarcoma"),
                ],
            ),
            oncotree_primary_disease=es_primary_disease.name,
        )
        for num in range(5)
    ]
    bone_os_cell_lines = [
        DepmapModelFactory(
            model_id=f"ACH-{num}os",
            stripped_cell_line_name=f"{num}os",
            cell_line=CellLineFactory(
                depmap_id=f"ACH-{num}os",
                lineage=[
                    LineageFactory(level=1, name="Bone"),
                    LineageFactory(level=2, name="Osteosarcoma"),
                ],
            ),
            oncotree_primary_disease=os_primary_disease.name,
        )
        for num in range(5)
    ]

    lung_cell_lines = [
        DepmapModelFactory(
            model_id=f"ACH-{num}lung",
            stripped_cell_line_name=f"lung_line_{num}",
            cell_line=CellLineFactory(
                depmap_id=f"ACH-{num}lung",
                lineage=[LineageFactory(level=1, name="Lung")],
            ),
        )
        for num in range(5)
    ]

    matrix_cell_lines = (
        bone_es_cell_lines
        + lung_cell_lines
        + bone_os_cell_lines
        + myeloid_cell_lines  # all acute myeloid leukemia
    )

    matrix = MatrixFactory(
        data=np.array([[num for num in range(20)]]),
        cell_lines=matrix_cell_lines,
        entities=genes,
        using_depmap_model_table=True,
    )
    dataset = DependencyDatasetFactory(matrix=matrix, name=dataset_name, priority=1,)

    drug_dataset_name = DependencyDataset.DependencyEnum.CTRP_AUC
    compounds = [CompoundFactory() for _ in range(3)]
    compound_experiments = [CompoundExperimentFactory(compound=c) for c in compounds]
    matrix = MatrixFactory(
        data=[
            [2, 3, 4, 5, 6],
            [0, 2, 1, 3, 5],
            [np.NaN, np.NaN, np.NaN, np.NaN, np.NaN],
        ],
        cell_lines=lung_cell_lines,
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
                [
                    True,
                    False,
                    False,
                    False,
                    True,
                    True,
                    True,
                    False,
                    False,
                    False,
                    True,
                    False,
                    True,
                    False,
                    False,
                    False,
                    True,
                    False,
                    False,
                    False,
                    False,
                    False,
                    True,
                    False,
                ],
                [
                    False,
                    True,
                    True,
                    True,
                    True,
                    True,
                    False,
                    True,
                    True,
                    False,
                    False,
                    True,
                    False,
                    False,
                    True,
                    False,
                    False,
                    True,
                    False,
                    False,
                    True,
                    False,
                    True,
                    False,
                ],
                [
                    False,
                    False,
                    False,
                    False,
                    True,
                    False,
                    False,
                    False,
                    False,
                    False,
                    True,
                    False,
                    False,
                    False,
                    True,
                    False,
                    True,
                    False,
                    False,
                    False,
                    False,
                    False,
                    True,
                    False,
                ],
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
            "lineage_counts": {
                "CRISPR_Achilles_Broad": {
                    "Bone": {"Ewing Sarcoma": "2", "Osteosarcoma": "2"},
                    "Lung": {},
                    "Myeloid": {"Acute Myeloid Leukemia": "1"},
                },
                "Drug_CTD_Broad": {
                    "Bone": {"Osteosarcoma": "2", "Ewing Sarcoma": "1"},
                    "Lung": {},
                    "Myeloid": {"Acute Myeloid Leukemia": "2"},
                },
                "Drug_Repurposing_Broad": {
                    "Bone": {"Ewing Sarcoma": "2", "Osteosarcoma": "1"},
                    # Is it possible for a lineage to not have primary diseases?
                    # Or are the primary disease counts always going to add up to the
                    # lineage count?
                    "Lung": {},
                    "Myeloid": {"Acute Myeloid Leukemia": "1"},
                },
            },
            "data_types": [
                "CRISPR_Achilles_Broad",
                "Drug_CTD_Broad",
                "Drug_Repurposing_Broad",
            ],
            "all_depmap_ids": [
                [0, "ACH-0lung"],
                [1, "ACH-1lung"],
                [2, "ACH-2lung"],
                [3, "ACH-3lung"],
                [4, "ACH-4lung"],
                [5, "ACH-5lung"],
                [6, "ACH-0os"],
                [7, "ACH-1os"],
                [8, "ACH-2os"],
                [9, "ACH-3os"],
                [10, "ACH-4os"],
                [11, "ACH-5os"],
                [12, "ACH-0es"],
                [13, "ACH-1es"],
                [14, "ACH-2es"],
                [15, "ACH-3es"],
                [16, "ACH-4es"],
                [17, "ACH-5es"],
                [18, "ACH-0myeloid"],
                [19, "ACH-1myeloid"],
                [20, "ACH-2myeloid"],
                [21, "ACH-3myeloid"],
                [22, "ACH-4myeloid"],
                [23, "ACH-5myeloid"],
            ],
        }
