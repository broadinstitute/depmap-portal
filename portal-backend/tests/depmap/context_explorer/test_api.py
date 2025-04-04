from flask import url_for
import numpy as np
import pytest


def test_get_context_info(populated_db):
    with populated_db.app.test_client() as c:
        r = c.get(
            url_for("api.context_explorer_context_info", level_0_subtype_code="BONE",),
            content_type="application/json",
        )
        context_info = r.json
        tree = context_info["tree"]

        assert len(list(tree.keys())) > 0

        overview_table_data = context_info["table_data"]

        # Make sure all expected columns are present in the Overview Table
        assert list(overview_table_data[0].keys()) == [
            "model_id",
            "subtype_code",
            "level_0",
            "level_1",
            "level_2",
            "level_3",
            "level_4",
            "level_5",
            "node_name",
            "node_level",
            "repurposing",
            "rna_seq",
            "wgs",
            "wes",
            "rnai",
            "crispr",
            "oncref",
            "cell_line_display_name",
        ]

        for row in overview_table_data:
            for value in row.values():
                if isinstance(value, float):
                    assert not np.isnan(value)

        assert tree["node_level"] == 0
        assert tree["subtype_code"] == "BONE"
        assert len(tree["model_ids"]) > 0

        if len(tree["children"]) > 0:
            for child in tree["children"]:
                assert child["node_level"] > 0
                assert len(child["model_ids"]) > 0


def test_get_context_search_options(populated_db):
    with populated_db.app.test_client() as c:
        r = c.get(
            url_for("api.context_explorer_context_search_options"),
            content_type="application/json",
        )
        search_options = r.json

        assert search_options == {
            "lineage": [
                {
                    "name": "Bone",
                    "subtype_code": "BONE",
                    "node_level": 0,
                    "numModels": 5,
                },
                {
                    "name": "Lung",
                    "subtype_code": "LUNG",
                    "node_level": 0,
                    "numModels": 2,
                },
                {
                    "name": "Peripheral Nervous System",
                    "subtype_code": "PNS",
                    "node_level": 0,
                    "numModels": 1,
                },
                {
                    "name": "Skin",
                    "subtype_code": "SKIN",
                    "node_level": 0,
                    "numModels": 11,
                },
            ],
            "molecularSubtype": [
                {
                    "name": "ALK Hotspot",
                    "subtype_code": "ALKHotspot",
                    "node_level": 0,
                    "numModels": 4,
                },
                {
                    "name": "EGFR",
                    "subtype_code": "EGFR",
                    "node_level": 0,
                    "numModels": 4,
                },
            ],
        }


def test_get_context_summary(populated_db):
    with populated_db.app.test_client() as c:
        r = c.get(
            url_for("api.context_explorer_context_summary", tree_type="Lineage"),
            content_type="application/json",
        )
        context_summary = r.json

        # The data type list determines the number and order of rows on
        # the Context Explorer Data Availability graph.
        assert context_summary["summary"]["data_types"] == [
            "PRISMRepurposing",
            "RNASeq",
            "WGS",
            "WES",
            "RNAi",
            "CRISPR",
            "PRISMOncRef",
        ]

        # There should be a value row for each data type.
        assert len(context_summary["summary"]["values"]) == len(
            context_summary["summary"]["data_types"]
        )

        for row in context_summary["summary"]["values"]:
            # Every row of values should consist of an integer for each potentially available cell line.
            assert len(row) == len(context_summary["summary"]["all_depmap_ids"])

        assert {
            "model_id": "ACH-000052",
            "subtype_code": "ES",
            "level_0": "BONE",
            "level_1": "ES",
            "level_2": "",
            "level_3": "",
            "level_4": "",
            "level_5": "",
            "node_name": "Ewing Sarcoma",
            "node_level": 1,
            "repurposing": True,
            "rna_seq": True,
            "wgs": False,
            "wes": True,
            "rnai": True,
            "crispr": True,
            "oncref": False,
            "cell_line_display_name": "A673",
        } in context_summary["table"]

        assert {
            "model_id": "ACH-000210",
            "subtype_code": "ES",
            "level_0": "BONE",
            "level_1": "ES",
            "level_2": "",
            "level_3": "",
            "level_4": "",
            "level_5": "",
            "node_name": "Ewing Sarcoma",
            "node_level": 1,
            "repurposing": True,
            "rna_seq": True,
            "wgs": False,
            "wes": True,
            "rnai": True,
            "crispr": False,
            "oncref": False,
            "cell_line_display_name": "CADOES1",
        } in context_summary["table"]
        assert {
            "model_id": "ACH-000279",
            "subtype_code": "ES",
            "level_0": "BONE",
            "level_1": "ES",
            "level_2": "",
            "level_3": "",
            "level_4": "",
            "level_5": "",
            "node_name": "Ewing Sarcoma",
            "node_level": 1,
            "repurposing": True,
            "rna_seq": True,
            "wgs": False,
            "wes": True,
            "rnai": True,
            "crispr": True,
            "oncref": False,
            "cell_line_display_name": "EWS502",
        } in context_summary["table"]
        assert {
            "model_id": "ACH-000585",
            "subtype_code": "LUSC",
            "level_0": "LUNG",
            "level_1": "NSCLC",
            "level_2": "LUSC",
            "level_3": "",
            "level_4": "",
            "level_5": "",
            "node_name": "Lung Squamous Cell Carcinoma",
            "node_level": 2,
            "repurposing": False,
            "rna_seq": True,
            "wgs": False,
            "wes": True,
            "rnai": True,
            "crispr": True,
            "oncref": False,
            "cell_line_display_name": "EPLC272H",
        } in context_summary["table"]
        assert {
            "model_id": "ACH-000706",
            "subtype_code": "LUAD",
            "level_0": "LUNG",
            "level_1": "NSCLC",
            "level_2": "LUAD",
            "level_3": "",
            "level_4": "",
            "level_5": "",
            "node_name": "Lung Adenocarcinoma",
            "node_level": 2,
            "repurposing": True,
            "rna_seq": True,
            "wgs": False,
            "wes": True,
            "rnai": True,
            "crispr": True,
            "oncref": False,
            "cell_line_display_name": "EKVX",
        } in context_summary["table"]
        assert {
            "model_id": "ACH-001001",
            "subtype_code": "OS",
            "level_0": "BONE",
            "level_1": "OS",
            "level_2": "",
            "level_3": "",
            "level_4": "",
            "level_5": "",
            "node_name": "Osteosarcoma",
            "node_level": 1,
            "repurposing": True,
            "rna_seq": True,
            "wgs": True,
            "wes": True,
            "rnai": True,
            "crispr": True,
            "oncref": True,
            "cell_line_display_name": "143B",
        } in context_summary["table"]
        assert {
            "model_id": "ACH-001205",
            "subtype_code": "ES",
            "level_0": "BONE",
            "level_1": "ES",
            "level_2": "",
            "level_3": "",
            "level_4": "",
            "level_5": "",
            "node_name": "Ewing Sarcoma",
            "node_level": 1,
            "repurposing": True,
            "rna_seq": False,
            "wgs": False,
            "wes": True,
            "rnai": False,
            "crispr": True,
            "oncref": False,
            "cell_line_display_name": "TC32",
        } in context_summary["table"]

        r = c.get(
            url_for(
                "api.context_explorer_context_summary", tree_type="MolecularSubtype"
            ),
            content_type="application/json",
        )
        context_summary = r.json

        assert context_summary["summary"]["data_types"] == [
            "PRISMRepurposing",
            "RNASeq",
            "WGS",
            "WES",
            "RNAi",
            "CRISPR",
            "PRISMOncRef",
        ]

        model_id_indices = {}
        for index, model_id in context_summary["summary"]["all_depmap_ids"]:
            model_id_indices[model_id] = index

        # 552
        actual_552 = [
            row[model_id_indices["ACH-000552"]]
            for row in context_summary["summary"]["values"]
        ]
        expected_552 = [True, True, True, True, True, True, False]
        assert actual_552 == expected_552

        # 001001
        actual_001001 = [
            row[model_id_indices["ACH-001001"]]
            for row in context_summary["summary"]["values"]
        ]
        expected_001001 = [True, True, True, True, True, True, True]

        assert actual_001001 == expected_001001

        # 000706
        actual_000706 = [
            row[model_id_indices["ACH-000706"]]
            for row in context_summary["summary"]["values"]
        ]
        expected_000706 = [True, True, False, True, True, True, False]
        assert actual_000706 == expected_000706

        # 000279
        actual_000279 = [
            row[model_id_indices["ACH-000279"]]
            for row in context_summary["summary"]["values"]
        ]
        expected_000279 = [True, True, False, True, True, True, False]
        assert actual_000279 == expected_000279

        # 001170
        actual_001170 = [
            row[model_id_indices["ACH-001170"]]
            for row in context_summary["summary"]["values"]
        ]
        expected_001170 = [False, False, False, False, True, False, False]
        assert actual_001170 == expected_001170

        assert {
            "model_id": "ACH-001170",
            "subtype_code": "ALKHotspot",
            "level_0": "ALKHotspot",
            "level_1": "",
            "level_2": "",
            "level_3": "",
            "level_4": "",
            "level_5": "",
            "node_name": "ALK Hotspot",
            "node_level": 0,
            "repurposing": False,
            "rna_seq": False,
            "wgs": False,
            "wes": False,
            "rnai": True,
            "crispr": False,
            "oncref": False,
            "cell_line_display_name": "PETA",
        } in context_summary["table"]
        assert {
            "model_id": "ACH-000210",
            "subtype_code": "ALKHotspot",
            "level_0": "ALKHotspot",
            "level_1": "",
            "level_2": "",
            "level_3": "",
            "level_4": "",
            "level_5": "",
            "node_name": "ALK Hotspot",
            "node_level": 0,
            "repurposing": True,
            "rna_seq": True,
            "wgs": False,
            "wes": True,
            "rnai": True,
            "crispr": False,
            "oncref": False,
            "cell_line_display_name": "CADOES1",
        } in context_summary["table"]
        assert {
            "model_id": "ACH-000279",
            "subtype_code": "ALKHotspot",
            "level_0": "ALKHotspot",
            "level_1": "",
            "level_2": "",
            "level_3": "",
            "level_4": "",
            "level_5": "",
            "node_name": "ALK Hotspot",
            "node_level": 0,
            "repurposing": True,
            "rna_seq": True,
            "wgs": False,
            "wes": True,
            "rnai": True,
            "crispr": True,
            "oncref": False,
            "cell_line_display_name": "EWS502",
        } in context_summary["table"]
        assert {
            "model_id": "ACH-001205",
            "subtype_code": "ALKHotspot",
            "level_0": "ALKHotspot",
            "level_1": "",
            "level_2": "",
            "level_3": "",
            "level_4": "",
            "level_5": "",
            "node_name": "ALK Hotspot",
            "node_level": 0,
            "repurposing": True,
            "rna_seq": False,
            "wgs": False,
            "wes": True,
            "rnai": False,
            "crispr": True,
            "oncref": False,
            "cell_line_display_name": "TC32",
        } in context_summary["table"]
        assert {
            "model_id": "ACH-000552",
            "subtype_code": "EGFR",
            "level_0": "EGFR",
            "level_1": "",
            "level_2": "",
            "level_3": "",
            "level_4": "",
            "level_5": "",
            "node_name": "EGFR",
            "node_level": 0,
            "repurposing": True,
            "rna_seq": True,
            "wgs": True,
            "wes": True,
            "rnai": True,
            "crispr": True,
            "oncref": False,
            "cell_line_display_name": "HT29",
        } in context_summary["table"]
        assert {
            "model_id": "ACH-000706",
            "subtype_code": "EGFR",
            "level_0": "EGFR",
            "level_1": "",
            "level_2": "",
            "level_3": "",
            "level_4": "",
            "level_5": "",
            "node_name": "EGFR",
            "node_level": 0,
            "repurposing": True,
            "rna_seq": True,
            "wgs": False,
            "wes": True,
            "rnai": True,
            "crispr": True,
            "oncref": False,
            "cell_line_display_name": "EKVX",
        } in context_summary["table"]
        assert {
            "model_id": "ACH-001001",
            "subtype_code": "EGFR",
            "level_0": "EGFR",
            "level_1": "",
            "level_2": "",
            "level_3": "",
            "level_4": "",
            "level_5": "",
            "node_name": "EGFR",
            "node_level": 0,
            "repurposing": True,
            "rna_seq": True,
            "wgs": True,
            "wes": True,
            "rnai": True,
            "crispr": True,
            "oncref": True,
            "cell_line_display_name": "143B",
        } in context_summary["table"]
        assert {
            "model_id": "ACH-000014",
            "subtype_code": "EGFR",
            "level_0": "EGFR",
            "level_1": "",
            "level_2": "",
            "level_3": "",
            "level_4": "",
            "level_5": "",
            "node_name": "EGFR",
            "node_level": 0,
            "repurposing": True,
            "rna_seq": True,
            "wgs": False,
            "wes": False,
            "rnai": True,
            "crispr": True,
            "oncref": False,
            "cell_line_display_name": "HS294T",
        } in context_summary["table"]


def test_unknown_context_analysis_data(populated_db):
    with populated_db.app.test_client() as c:
        r = c.get(
            url_for(
                "api.context_explorer_analysis_data",
                in_group="unknown",
                out_group_type="All",
                entity_type="gene",
                dataset_name="Chronos_Combined",
            ),
            content_type="application/json",
        )

        assert r.json == {"data_table": None, "out_group_heme_subtype_codes": []}


def test_get_context_path(populated_db):
    with populated_db.app.test_client() as c:
        # Test to level 0
        r = c.get(
            url_for("api.context_explorer_context_path", selected_code="BONE",),
            content_type="application/json",
        )

        assert r.json == {"path": ["BONE"], "tree_type": "Lineage"}

        # Test to level 1
        r = c.get(
            url_for("api.context_explorer_context_path", selected_code="ES",),
            content_type="application/json",
        )

        assert r.json == {"path": ["BONE", "ES"], "tree_type": "Lineage"}

        # Test to level 2
        r = c.get(
            url_for("api.context_explorer_context_path", selected_code="LUAD",),
            content_type="application/json",
        )

        assert r.json == {"path": ["LUNG", "NSCLC", "LUAD"], "tree_type": "Lineage"}

        # TODO: Update same subtype_tree and sample subtype_contexts to include the nodes and
        # contexts necessary for these commented out tests

        # Test level 3 / also test a data driven genetic subtype that's part of the Lineage tree
        # r = c.get(
        #     url_for(
        #         "api.context_explorer_context_path", selected_code="LUAD:EGFRp.L858R"
        #     ),
        #     content_type="application/json",
        # )
        # assert r.json == {
        #     "path": ["LUNG", "NSCLC", "LUAD", "LUAD:EGFRp.L858R"],
        #     "tree_type": "Lineage",
        # }

        # # Test a branch of the Molecular Subtype Tree
        # r = c.get(
        #     url_for("api.context_explorer_context_path", selected_code="EGFRp.L858R"),
        #     content_type="application/json",
        # )

        # assert r.json == {
        #     "path": ["EGFR", "EGFRp.L858R"],
        #     "tree_type": "MolecularSubtype",
        # }

        # Something is very wrong if we pass a nonsense code to this endpoint
        with pytest.raises(Exception):
            r = c.get(
                url_for("api.context_explorer_context_path", selected_code="NONSENSE",),
                content_type="application/json",
            )


def test_get_context_dose_curves_invalid_request_arguments(populated_db):
    with populated_db.app.test_client() as c:
        with pytest.raises(AssertionError):
            r = c.get(
                url_for(
                    "api.context_explorer_context_dose_curves",
                    dataset_name="Chronos_Combined",
                    entity_full_label="BRD:PRC-003330600-058-29",
                    context_name="bone",
                    level="1",
                    out_group_type="All Others",
                ),
                content_type="application/json",
            )
