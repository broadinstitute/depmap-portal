from flask import url_for
import pytest
from unittest.mock import MagicMock

from breadbox_client.models import (
    MatrixDatasetResponse,
    MatrixDatasetResponseDatasetMetadata,
    Group,
    ValueType,
)
from depmap.vector_catalog.models import (
    NodeTemplate,
    SingleNodeFactory,
    NodeType,
    Serializer,
)
from depmap.vector_catalog.trees import InteractiveTree
from depmap.vector_catalog.views import format_path
from depmap.dataset.models import DependencyDataset, BiomarkerDataset
from tests.factories import (
    GeneFactory,
    GenericEntityFactory,
    BiomarkerDatasetFactory,
    MatrixFactory,
    NonstandardMatrixFactory,
    CompoundFactory,
    CompoundExperimentFactory,
    CompoundDoseFactory,
    CompoundDoseReplicateFactory,
    CellLineFactory,
    DependencyDatasetFactory,
    EntityAliasFactory,
)
from tests.depmap.utilities.test_endpoint_utils import parse_resp
from tests.depmap.utilities.test_url_utils import assert_url_contains_parts
from tests.depmap.utilities.test_tree_utils import TerminalTestNodeFactory
from loader.global_search_loader import load_global_search_index
from depmap.vector_catalog.models import SliceRowType
from tests.utilities import interactive_test_utils
from tests.utilities.override_fixture import override
from depmap.settings.settings import TestConfig

NONSTANDARD_NON_PREPOPULATE_DATASET_ID = "test-id.1/non_prepopulate"
NONSTANDARD_PREPOPULATE_DATASET_ID = "test-id.1/prepopulate"


@pytest.mark.parametrize("prefix", [("ampk_alpha"), ("aMPk_alPha"), ("AMPK_alpha")])
def test_catalog_children_case_insensitive(app, empty_db_mock_downloads, prefix):
    gene = GeneFactory(label="AMPK_alpha", entity_alias=[])
    empty_db_mock_downloads.session.flush()
    load_global_search_index()  # the gene lookup uses global search

    with app.test_client() as c:
        # Verify gene is a working dynamic lookup
        r = c.get(
            url_for(
                "vector_catalog.catalog_children",
                catalog="continuous",
                id="genes",
                prefix=prefix,
            )
        )
        response = parse_resp(r)
        assert response["children"] == [
            {
                "id": "gene/{}".format(gene.entity_id),
                "childValue": "AMPK_alpha",
                "label": "AMPK_alpha",
                "terminal": False,
                "url": "/gene/AMPK_alpha",
                "group": None,
            }
        ]


def test_gene_lookup(app, empty_db_mock_downloads):
    alpha = GeneFactory(
        label="alpha", entity_alias=[EntityAliasFactory(alias="alpha-a")]
    )
    beta = GeneFactory(label="beta")
    cellline = CellLineFactory(cell_line_name="CL1")
    gene_dataset = BiomarkerDatasetFactory(
        display_name="genedata",
        matrix=MatrixFactory(
            entities=[alpha, beta], cell_lines=[cellline], data=[[1.0], [2.0]]
        ),
    )
    empty_db_mock_downloads.session.flush()
    load_global_search_index()  # the gene lookup uses global search
    interactive_test_utils.reload_interactive_config()

    with app.test_client() as c:
        # Verify gene is a working dynamic lookup
        r = c.get(
            url_for("vector_catalog.catalog_children", catalog="continuous", id="genes")
        )

        resp = parse_resp(r)
        assert resp["type"] == "dynamic"
        assert len(resp["children"]) == 2

        # Verify prefix is honored
        r = c.get(
            url_for(
                "vector_catalog.catalog_children",
                catalog="continuous",
                id="genes",
                prefix="alph",
            )
        )

        resp = parse_resp(r)

        assert set([x["label"] for x in resp["children"]]) == {"alpha (alpha-a)"}

        # Verify we can look up datasets referenced by gene
        r = c.get(
            url_for(
                "vector_catalog.catalog_children",
                catalog="continuous",
                id="gene/{}".format(alpha.entity_id),
            )
        )

        resp = parse_resp(r)
        print(resp)
        assert resp["type"] == "static"
        assert len(resp["children"]) == 1
        c = resp["children"][0]
        assert c["label"] == "genedata"
        assert c["terminal"] is True
        assert c["id"] == "slice/{}/{}/{}".format(
            gene_dataset.name.name, alpha.entity_id, SliceRowType.entity_id.name
        )


def test_root_lookup(app, empty_db_mock_downloads):
    with app.test_client() as c:
        # verify looking up at the root that we get gene and compound as the roots
        r = c.get(
            url_for("vector_catalog.catalog_children", catalog="continuous", id="root")
        )

        resp = parse_resp(r)
        assert resp["type"] == "static"
        assert set([x["label"] for x in resp["children"]]) == {
            "Gene",
            "Compound",
            "Other",
        }  # should not contain Custom


def test_compound_dose_replicate_lookup(app, empty_db_mock_downloads):
    """
    Test that
        a path from start -> compound -> dataset -> experiment -> dose replicate works fine
        the repurposing dose replicate dataset does not show up, because it has a dose enum
    """
    compound = CompoundFactory(label="compound1")
    compound_exp = CompoundExperimentFactory(label="compound1 exp", compound=compound)
    compound_dose_replicate = CompoundDoseReplicateFactory(
        label="compound1 dose rep1", compound_experiment=compound_exp
    )
    cellline = CellLineFactory(cell_line_name="CL1")

    compound_dose_replicate_dataset = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.CTRP_dose_replicate,
        display_name="test name ctrp",
        matrix=MatrixFactory(
            entities=[compound_dose_replicate], cell_lines=[cellline], data=[[3.0]]
        ),
    )

    hidden_compound_dose_replicate_dataset = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.Repurposing_secondary_dose_replicate,
        display_name="test name repurposing",
        matrix=MatrixFactory(
            entities=[compound_dose_replicate], cell_lines=[cellline], data=[[500]]
        ),
    )
    # this should not show up, because it has an associated dose dataset
    assert hidden_compound_dose_replicate_dataset.get_dose_enum() is not None

    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    with app.test_client() as c:
        # verify looking up at the root that we get gene and compound as the roots
        r = c.get(
            url_for("vector_catalog.catalog_children", catalog="continuous", id="root")
        )

        resp = parse_resp(r)
        assert resp["type"] == "static"
        assert set([x["label"] for x in resp["children"]]) == {
            "Gene",
            "Compound",
            "Other",
        }

    with app.test_client() as c:
        # Verify compound is a working dynamic lookup
        r = c.get(
            url_for(
                "vector_catalog.catalog_children",
                catalog="continuous",
                id="compounds",
                prefix="compound1",
            )
        )
        resp = parse_resp(r)
        assert resp["type"] == "dynamic"
        assert (
            len(resp["children"]) == 1
        )  # as opposed to 2, because the Repurposing_secondary_dose_replicate should be hidden
        c = resp["children"][0]
        assert c["label"] == "compound1"
        assert c["terminal"] is False
        expected_compound_id = "compound/{}".format(compound.entity_id)
        assert c["id"] == expected_compound_id

    with app.test_client() as c:
        # now, compounds have datasets under them
        r = c.get(
            url_for(
                "vector_catalog.catalog_children",
                catalog="continuous",
                id=expected_compound_id,
            )
        )
        resp = parse_resp(r)
        assert resp["type"] == "static"
        assert len(resp["children"]) == 1
        c = resp["children"][0]
        assert c["label"] == "test name ctrp"
        assert c["terminal"] is False
        expected_compound_exp_id = "compound_dose_replicate_dataset/{}/{}".format(
            compound.entity_id, compound_dose_replicate_dataset.name.name
        )
        assert c["id"] == expected_compound_exp_id

    with app.test_client() as c:
        # the datasets have compound experiments under them
        r = c.get(
            url_for(
                "vector_catalog.catalog_children",
                catalog="continuous",
                id=expected_compound_exp_id,
            )
        )

        resp = parse_resp(r)
        assert resp["type"] == "static"
        assert len(resp["children"]) == 1
        c = resp["children"][0]
        assert c["label"] == "compound1 exp"
        assert c["terminal"] is False
        expected_compound_dose_replicate_id = "compound_dose_replicate_dataset_experiment/{}/{}/{}".format(
            compound.entity_id,
            compound_dose_replicate_dataset.name.name,
            compound_exp.entity_id,
        )
        assert c["id"] == expected_compound_dose_replicate_id

    with app.test_client() as c:
        # dose replicate is next
        r = c.get(
            url_for(
                "vector_catalog.catalog_children",
                catalog="continuous",
                id=expected_compound_dose_replicate_id,
            )
        )
        resp = parse_resp(r)
        assert resp["type"] == "static"
        assert len(resp["children"]) == 1
        c = resp["children"][0]
        assert c["label"] == compound_dose_replicate.label_without_compound_name
        assert c["terminal"] is True
        assert c["id"] == "slice/{}/{}/{}".format(
            compound_dose_replicate_dataset.name.name,
            compound_dose_replicate.entity_id,
            SliceRowType.entity_id.name,
        )


def test_compound_dose_lookup(app, empty_db_mock_downloads):
    """
    Test that
        The path of selecting compound -> dose dataset, and compound experiment -> dose works fine
        That the repurposing dose replicate dataset does not show up, because it has a dose enum
    """
    compound = CompoundFactory(label="compound1")
    compound_exp = CompoundExperimentFactory(label="compound1 exp", compound=compound)
    compound_dose = CompoundDoseFactory(
        label="compound1 dose rep1", compound_experiment=compound_exp
    )
    cellline = CellLineFactory(cell_line_name="CL1")

    compound_dose_dataset = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.Repurposing_secondary_dose,
        display_name="test dose dataset",
        matrix=MatrixFactory(
            entities=[compound_dose], cell_lines=[cellline], data=[[3.0]]
        ),
    )

    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    with app.test_client() as c:
        # Verify compound dose dataset appears as a child of selecting compound
        id_compound_selected = "compound/{}".format(compound.entity_id)
        r = c.get(
            url_for(
                "vector_catalog.catalog_children",
                catalog="continuous",
                id=id_compound_selected,
            )
        )
        resp = parse_resp(r)
        assert resp["type"] == "static"
        assert len(resp["children"]) == 1
        c = resp["children"][0]
        assert c["label"] == "test dose dataset"
        assert c["terminal"] is False
        expected_compound_exp_id = "compound_dose_dataset/{}/{}".format(
            compound.entity_id, compound_dose_dataset.name.name
        )
        assert c["id"] == expected_compound_exp_id

    with app.test_client() as c:
        # Verify that compound dose appears as a child of selecting compound experiment
        id_compound_experiment_selected = "compound_dose_dataset_experiment/{}/{}/{}".format(
            compound.entity_id, compound_dose_dataset.name.name, compound_exp.entity_id
        )
        r = c.get(
            url_for(
                "vector_catalog.catalog_children",
                catalog="continuous",
                id=id_compound_experiment_selected,
            )
        )
        resp = parse_resp(r)
        assert resp["type"] == "static"
        assert len(resp["children"]) == 1
        c = resp["children"][0]
        assert c["label"] == compound_dose.label_without_compound_name
        assert c["terminal"] is True
        assert c["id"] == "slice/{}/{}/{}".format(
            compound_dose_dataset.name.name,
            compound_dose.entity_id,
            SliceRowType.entity_id.name,
        )


def other_nonentity_config(request):
    """
    Override the default conftest config fixture
    """

    def get_nonstandard_datasets():
        return {
            NONSTANDARD_NON_PREPOPULATE_DATASET_ID: {
                "transpose": False,
                # "use_arxspan_id": True,
                "label": "non prepopulate dataset",
                "units": "test",
                "data_type": "user_upload",
                "feature_name": "test",
                "is_continuous": True,
            },
            NONSTANDARD_PREPOPULATE_DATASET_ID: {
                "transpose": False,
                "prepopulate": True,
                "label": "prepopulate dataset",
                "units": "test",
                "data_type": "user_upload",
                "feature_name": "test",
                "is_continuous": True,
            },
        }

    class TestVersionConfig(TestConfig):
        GET_NONSTANDARD_DATASETS = get_nonstandard_datasets

    return TestVersionConfig


@override(config=other_nonentity_config)
def test_catalog_children_other_lookup(
    app, empty_db_mock_downloads, mock_breadbox_client
):
    generic_entity = GenericEntityFactory()
    generic_entity_dataset = BiomarkerDatasetFactory(
        name=BiomarkerDataset.BiomarkerEnum.ssgsea,
        matrix=MatrixFactory(entities=[generic_entity]),
    )

    feature_label = "feature1"
    NonstandardMatrixFactory(
        nonstandard_dataset_id=NONSTANDARD_NON_PREPOPULATE_DATASET_ID,
        entities=[feature_label],
        rows_are_entities=False,
    )
    NonstandardMatrixFactory(
        nonstandard_dataset_id=NONSTANDARD_PREPOPULATE_DATASET_ID,
        entities=[feature_label],
        rows_are_entities=False,
    )
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    # Mock breadbox response
    breadbox_dataset_uuid = "DATASET1-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
    mock_breadbox_datasets = [
        MatrixDatasetResponse(
            id=breadbox_dataset_uuid,
            name="Dataset 1",
            units="Gene Effect",
            is_transient=False,
            group_id="00000000-0000-0000-0000-000000000001",
            group=Group(id="00000000-0000-0000-0000-000000000001", name="Public"),
            feature_type_name="gene",
            sample_type_name="depmap_model",
            data_type="user_upload",
            dataset_metadata=MatrixDatasetResponseDatasetMetadata.from_dict(
                {"show_in_vector_catalog": True}
            ),
            value_type=ValueType.CONTINUOUS,
        ),
    ]
    mock_breadbox_client.get_datasets = MagicMock(return_value=mock_breadbox_datasets)

    with app.test_client() as c:
        # now, compounds have datasets under them
        r = c.get(
            url_for(
                "vector_catalog.catalog_children", catalog="continuous", id="others",
            )
        )
        resp = parse_resp(r)

        assert len(resp["children"]) == 4
        generic_entity_dataset_node_id = f"other_generic_entity_dataset_non_prepopulate/{generic_entity_dataset.name.name}"
        label_non_prepopulate_dataset_node_id = f"other_label_dataset_non_prepopulate/{Serializer.quote(NONSTANDARD_NON_PREPOPULATE_DATASET_ID)}"
        label_prepopulate_dataset_node_id = f"other_label_dataset_prepopulate/{Serializer.quote(NONSTANDARD_PREPOPULATE_DATASET_ID)}"
        breadbox_dataset_id = f"breadbox/{breadbox_dataset_uuid}"
        expected_children_ids = {
            generic_entity_dataset_node_id,
            label_non_prepopulate_dataset_node_id,
            label_prepopulate_dataset_node_id,
            breadbox_dataset_id,
        }
        assert {child["id"] for child in resp["children"]} == expected_children_ids

        # test the generic entity dataset
        r = c.get(
            url_for(
                "vector_catalog.catalog_children",
                catalog="continuous",
                id=generic_entity_dataset_node_id,
                prefix=generic_entity.label[0],
            )
        )
        resp = parse_resp(r)
        expected = {
            "children": [
                {
                    "id": f"slice/{generic_entity_dataset.name.name}/{generic_entity.entity_id}/entity_id",
                    "label": "generic_entity_0",
                    "childValue": "generic_entity_0",
                    "terminal": True,
                    "url": None,
                    "group": None,
                }
            ],
            "type": "dynamic",
            "category": "ssgsea display name feature",  # renamed from "generic entity" due to heuristics in interactive.models.Config()
            "persistChildIfNotFound": False,
        }
        assert resp == expected

        # test the label non prepopulate dataset
        r = c.get(
            url_for(
                "vector_catalog.catalog_children",
                catalog="continuous",
                id=label_non_prepopulate_dataset_node_id,
                prefix=feature_label[0],
            )
        )
        resp = parse_resp(r)
        expected = {
            "children": [
                {
                    "id": f"slice/{Serializer.quote(NONSTANDARD_NON_PREPOPULATE_DATASET_ID)}/{feature_label}/label",
                    "label": feature_label,
                    "childValue": feature_label,
                    "terminal": True,
                    "url": None,
                    "group": None,
                }
            ],
            "type": "dynamic",
            "category": "test",
            "persistChildIfNotFound": False,
        }
        assert resp == expected

        # test the label prepopulate dataset
        r = c.get(
            url_for(
                "vector_catalog.catalog_children",
                catalog="continuous",
                id=label_prepopulate_dataset_node_id,
            )
        )
        resp = parse_resp(r)
        expected = {
            "children": [
                {
                    "id": f"slice/{Serializer.quote(NONSTANDARD_PREPOPULATE_DATASET_ID)}/{feature_label}/label",
                    "label": feature_label,
                    "childValue": feature_label,
                    "terminal": True,
                    "url": None,
                    "group": None,
                }
            ],
            "type": "static",
            "category": "test",
            "persistChildIfNotFound": False,
        }
        assert resp == expected


def test_catalog_children_breadbox_lookup(
    app, empty_db_mock_downloads, mock_breadbox_client
):
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    # Mock breadbox response
    breadbox_dataset1_uuid = "DATASET1-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
    mock_breadbox_features = [
        {"id": "FEATURE1-XXXX-XXXX-XXXX-XXXXXXXXXXXX", "label": "feature1"},
        {"id": "FEATURE2-XXXX-XXXX-XXXX-XXXXXXXXXXXX", "label": "feature2"},
    ]
    mock_breadbox_client.get_dataset_features = MagicMock(
        return_value=mock_breadbox_features
    )

    with app.test_client() as c:
        # now, compounds have datasets under them
        r = c.get(
            url_for(
                "vector_catalog.catalog_children",
                catalog="continuous",
                id=f"breadbox/{breadbox_dataset1_uuid}",
            )
        )
        response = parse_resp(r)
        response_children = response["children"]
        assert len(response_children) == 2
        for child in response_children:
            assert child["terminal"] == True
            assert child["label"] in [
                feature["label"] for feature in mock_breadbox_features
            ]
            assert child["childValue"] in [
                feature["label"] for feature in mock_breadbox_features
            ]
            assert child["id"].startswith(f"breadbox/{breadbox_dataset1_uuid}/")


def test_catalog_path_gene(app, empty_db_mock_downloads):
    """
    This test_catalog_path test tests more stuff, including the full path
    """
    gene = GeneFactory()
    dataset = DependencyDatasetFactory(matrix=MatrixFactory(entities=[gene]))

    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    entity_id = gene.entity_id
    dataset_name = dataset.name.name

    with app.test_client() as c:
        id = "gene/{}".format(gene.entity_id)
        r = c.get(url_for("vector_catalog.catalog_path", catalog="continuous", id=id))
        resp = parse_resp(r)

        expected = [
            {
                "type": "static",
                "category": "type",
                "selectedId": "genes",
                "children": [  # static should list all
                    {
                        "id": "genes",
                        "terminal": False,
                        "childValue": "gene",
                        "label": "Gene",
                        "url": None,
                        "group": None,
                    },
                    {
                        "id": "compounds",
                        "terminal": False,
                        "childValue": "compound",
                        "label": "Compound",
                        "url": None,
                        "group": None,
                    },
                    {
                        "id": "others",
                        "terminal": False,
                        "childValue": "other",
                        "label": "Other",
                        "url": None,
                        "group": None,
                    },
                ],
                "persistChildIfNotFound": False,
            },
            {
                "type": "dynamic",
                "category": "gene symbol",
                "selectedId": "gene/{}".format(entity_id),
                "children": [  # dynamic should just have this one child
                    {
                        "id": id,
                        "terminal": False,
                        "label": "{} ({})".format(
                            gene.label, gene.entity_alias[0].alias
                        ),
                        "childValue": gene.label,
                        "url": "/gene/{}".format(gene.label),
                        "group": None,
                    }
                ],
                "persistChildIfNotFound": False,
            },
            {
                "type": "static",
                "selectedId": "",
                "category": "dataset",
                "children": [
                    {
                        "childValue": dataset_name,
                        "id": "slice/{}/{}/entity_id".format(dataset_name, entity_id),
                        "label": dataset.display_name,
                        "terminal": True,
                        "url": [
                            "/download/all/?",
                            "file=test+file+name+2",
                            "release=test+name+version",
                        ],
                        "group": None,
                    }
                ],
                "persistChildIfNotFound": False,
            },
        ]

        assert resp[0] == expected[0]
        assert resp[1] == expected[1]
        assert resp[2]["category"] == expected[2]["category"]
        assert resp[2]["selectedId"] == expected[2]["selectedId"]
        assert resp[2]["type"] == expected[2]["type"]

        assert len(resp[2]["children"]) == 1
        assert (
            resp[2]["children"][0]["childValue"]
            == expected[2]["children"][0]["childValue"]
        )
        assert resp[2]["children"][0]["id"] == expected[2]["children"][0]["id"]
        assert resp[2]["children"][0]["label"] == expected[2]["children"][0]["label"]
        assert (
            resp[2]["children"][0]["terminal"] == expected[2]["children"][0]["terminal"]
        )
        assert_url_contains_parts(
            resp[2]["children"][0]["url"], expected[2]["children"][0]["url"]
        )


@override(config=other_nonentity_config)
def test_catalog_path_other_label(app, empty_db_mock_downloads, mock_breadbox_client):
    """
    This tests two paths at once, both the prepopulate and non-prepopulate label branches within the "Other" branch
    """
    label = "feature1"
    interactive_test_utils.reload_interactive_config()  # to load canonical taiga ids from the overridden config

    # Mock breadbox response
    breadbox_dataset_uuid = "DATASET1-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
    mock_breadbox_datasets = [
        MatrixDatasetResponse(
            id=breadbox_dataset_uuid,
            name="Breadbox Dataset 1",
            units="Gene Effect",
            is_transient=False,
            group_id="00000000-0000-0000-0000-000000000001",
            group=Group(id="00000000-0000-0000-0000-000000000001", name="Public"),
            feature_type_name="gene",
            sample_type_name="depmap_model",
            data_type="user_upload",
            dataset_metadata=MatrixDatasetResponseDatasetMetadata.from_dict(
                {"show_in_vector_catalog": True}
            ),
            value_type=ValueType.CONTINUOUS,
        ),
    ]
    mock_breadbox_client.get_datasets = MagicMock(return_value=mock_breadbox_datasets)

    expected_second_node_children = [
        {
            "id": f"other_label_dataset_non_prepopulate/{Serializer.quote(NONSTANDARD_NON_PREPOPULATE_DATASET_ID)}",
            "label": "non prepopulate dataset",
            "childValue": NONSTANDARD_NON_PREPOPULATE_DATASET_ID,
            "terminal": False,
            "url": "https://cds.team/taiga/dataset/test-id/1",
            "group": None,
        },
        {
            "id": f"other_label_dataset_prepopulate/{Serializer.quote(NONSTANDARD_PREPOPULATE_DATASET_ID)}",
            "label": "prepopulate dataset",
            "childValue": NONSTANDARD_PREPOPULATE_DATASET_ID,
            "terminal": False,
            "url": "https://cds.team/taiga/dataset/test-id/1",
            "group": None,
        },
        {
            "id": f"breadbox/{breadbox_dataset_uuid}",
            "label": "Breadbox Dataset 1",
            "childValue": "Breadbox Dataset 1",
            "terminal": False,
            "url": None,
            "group": None,
        },
    ]

    # non prepopulate
    with app.test_client() as c:
        non_prepopulate_id = InteractiveTree.get_id_from_dataset_feature(
            NONSTANDARD_NON_PREPOPULATE_DATASET_ID, label
        )

        r = c.get(
            url_for(
                "vector_catalog.catalog_path",
                catalog="continuous",
                id=non_prepopulate_id,
            )
        )
        resp = parse_resp(r)
        assert len(resp) == 3
        assert resp[1]["children"] == expected_second_node_children
        assert resp[1]["type"] == "static"
        assert (
            resp[1]["selectedId"]
            == f"other_label_dataset_non_prepopulate/{Serializer.quote(NONSTANDARD_NON_PREPOPULATE_DATASET_ID)}"
        )

        expected_non_prepopulate_terminal_node = {
            "children": [
                {
                    "id": f"slice/{Serializer.quote(NONSTANDARD_NON_PREPOPULATE_DATASET_ID)}/feature1/label",
                    "label": "feature1",
                    "childValue": "feature1",
                    "terminal": True,
                    "url": None,
                    "group": None,
                }
            ],
            "type": "dynamic",
            "category": "test",
            "persistChildIfNotFound": False,
            "selectedId": f"slice/{Serializer.quote(NONSTANDARD_NON_PREPOPULATE_DATASET_ID)}/feature1/label",
        }
        assert resp[2] == expected_non_prepopulate_terminal_node

    # prepopulate
    with app.test_client() as c:
        prepopulate_id = InteractiveTree.get_id_from_dataset_feature(
            NONSTANDARD_PREPOPULATE_DATASET_ID, label
        )

        r = c.get(
            url_for(
                "vector_catalog.catalog_path", catalog="continuous", id=prepopulate_id,
            )
        )
        resp = parse_resp(r)
        assert len(resp) == 3
        assert resp[1]["children"] == expected_second_node_children
        assert resp[1]["type"] == "static"
        assert (
            resp[1]["selectedId"]
            == f"other_label_dataset_prepopulate/{Serializer.quote(NONSTANDARD_PREPOPULATE_DATASET_ID)}"
        )

        expected_prepopulate_terminal_node = {
            "children": [
                {
                    "id": f"slice/{Serializer.quote(NONSTANDARD_PREPOPULATE_DATASET_ID)}/feature1/label",
                    "label": "feature1",
                    "childValue": "feature1",
                    "terminal": True,
                    "url": None,
                    "group": None,
                }
            ],
            "type": "static",
            "category": "test",
            "persistChildIfNotFound": False,
            "selectedId": f"slice/{Serializer.quote(NONSTANDARD_PREPOPULATE_DATASET_ID)}/feature1/label",
        }
        assert resp[2] == expected_prepopulate_terminal_node


def test_catalog_path_other_generic_entity(
    app, empty_db_mock_downloads, mock_breadbox_client
):
    generic_entity = GenericEntityFactory()
    matrix = MatrixFactory(entities=[generic_entity])
    dataset = BiomarkerDatasetFactory(
        name=BiomarkerDataset.BiomarkerEnum.ssgsea, matrix=matrix
    )
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    # Mock breadbox response (return an empty list of datasets)
    mock_breadbox_client.get_datasets = MagicMock(return_value=[])

    with app.test_client() as c:
        id = InteractiveTree.get_id_from_dataset_feature(
            dataset.name.name, generic_entity.label
        )

        r = c.get(url_for("vector_catalog.catalog_path", catalog="continuous", id=id))
        resp = parse_resp(r)

        assert len(resp) == 3

        expected_terminal_node = {
            "children": [
                {
                    "id": id,
                    "label": generic_entity.label,
                    "childValue": generic_entity.label,
                    "terminal": True,
                    "url": None,
                    "group": None,
                }
            ],
            "type": "dynamic",
            "category": "ssgsea display name feature",
            "persistChildIfNotFound": False,
            "selectedId": id,
        }
        assert resp[2] == expected_terminal_node


def test_catalog_path_breadbox_feature(
    app, empty_db_mock_downloads, mock_breadbox_client
):
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    # Mock breadbox dataset response
    dataset_uuid = "DATASET1-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
    mock_breadbox_datasets = [
        MatrixDatasetResponse(
            id=dataset_uuid,
            name="Breadbox Dataset 1",
            units="Gene Effect",
            is_transient=False,
            group_id="00000000-0000-0000-0000-000000000001",
            group=Group(id="00000000-0000-0000-0000-000000000001", name="Public"),
            feature_type_name="gene",
            sample_type_name="depmap_model",
            data_type="user_upload",
            dataset_metadata=MatrixDatasetResponseDatasetMetadata.from_dict(
                {"show_in_vector_catalog": True}
            ),
            value_type=ValueType.CONTINUOUS,
        ),
    ]
    mock_breadbox_client.get_datasets = MagicMock(return_value=mock_breadbox_datasets)

    # Mock breadbox features response
    feature1_uuid = "FEATURE1-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
    feature2_uuid = "FEATURE2-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
    mock_breadbox_features = [
        {"id": feature1_uuid, "label": "feature1"},
        {"id": feature2_uuid, "label": "feature2"},
    ]
    mock_breadbox_client.get_dataset_features = MagicMock(
        return_value=mock_breadbox_features
    )

    with app.test_client() as c:
        requested_slice_id = f"breadbox/{dataset_uuid}/{feature2_uuid}"
        r = c.get(
            url_for(
                "vector_catalog.catalog_path",
                catalog="continuous",
                id=requested_slice_id,
            )
        )
        response = parse_resp(r)

        # The response should have three node elements, starting with the "others" node
        assert len(response) == 3
        assert response[0]["selectedId"] == "others"

        # Check that the breadbox dataset is listed in the children in the second node
        # and that it is the selected value for the second node.
        expected_dataset_child_node = {
            "id": f"breadbox/{dataset_uuid}",
            "label": "Breadbox Dataset 1",
            "childValue": "Breadbox Dataset 1",
            "terminal": False,
            "url": None,
            "group": None,
        }
        assert response[1]["category"] == "generic entity"
        assert response[1]["selectedId"] == f"breadbox/{dataset_uuid}"
        assert expected_dataset_child_node in response[1]["children"]

        expected_features_node = {
            "children": [
                {
                    "id": f"breadbox/{dataset_uuid}/{feature1_uuid}",
                    "label": "feature1",
                    "childValue": "feature1",
                    "terminal": True,
                    "url": None,
                    "group": None,
                },
                {
                    "id": requested_slice_id,
                    "label": "feature2",
                    "childValue": "feature2",
                    "terminal": True,
                    "url": None,
                    "group": None,
                },
            ],
            "type": "dynamic",
            "category": "generic entity",
            "persistChildIfNotFound": False,
            "selectedId": requested_slice_id,
        }
        assert response[2] == expected_features_node


def test_catalog_path_not_found(app, empty_db_mock_downloads):
    with app.test_client() as c:
        r = c.get(
            url_for(
                "vector_catalog.catalog_path",
                catalog="continuous",
                id="slice/invalid/invalid/label",
            )
        )
        assert r.status_code == 404


def test_format_path():
    """
    Test that
        Format is correct
        We get back child options if the final node is not terminal
        Includes all possible children if the node type is static
        Includes self if dynamic
    :return:
    """
    child_2_template = NodeTemplate(
        "level_2", TerminalTestNodeFactory("level_2", value="level_2")
    )
    other_2_template = NodeTemplate(
        "other_2", TerminalTestNodeFactory("other_2", value="other_2")
    )

    # child 1 is static
    child_1_template = NodeTemplate(
        "level_1",
        SingleNodeFactory(
            "level_1",
            is_terminal=False,
            value="level_1",
            children_list_type=NodeType.static,
            children_category="level_1",
        ),
        [child_2_template, other_2_template],
    )

    # root is dynamic
    root = NodeTemplate(
        "root",
        SingleNodeFactory(
            "root",
            is_terminal=False,
            value="root",
            children_list_type=NodeType.dynamic,
            children_category="root",
        ),
        [
            child_1_template,
            NodeTemplate(
                "other_1", TerminalTestNodeFactory("other_1", value="other_1")
            ),
        ],
    )
    tree = InteractiveTree(root, {})

    selected_non_terminal = [
        tree._create_node(root, {}),
        tree._create_node(child_1_template, {}),
    ]

    non_terminal_expected = [
        {
            "children": [
                tree._create_node(
                    child_1_template, {}
                )  # only selected child because dynamic
            ],
            "selected_id": "level_1",
            "children_category": "root",
            "children_list_type": "dynamic",
            "persist_child_if_not_found": False,
        },
        {
            "children": [
                tree._create_node(
                    child_2_template, {}
                ),  # creates multiple children because static
                tree._create_node(other_2_template, {}),
            ],
            "selected_id": "",  # gets this last node, but without a selection
            "children_category": "level_1",
            "children_list_type": "static",
            "persist_child_if_not_found": False,
        },
    ]
    assert format_path(tree, selected_non_terminal) == non_terminal_expected

    selected_terminal = selected_non_terminal + [
        tree._create_node(child_2_template, {})
    ]

    terminal_expected = [
        {
            "children": [tree._create_node(child_1_template, {})],
            "selected_id": "level_1",
            "children_category": "root",
            "children_list_type": "dynamic",
            "persist_child_if_not_found": False,
        },
        {
            "children": [
                tree._create_node(child_2_template, {}),
                tree._create_node(other_2_template, {}),
            ],
            "selected_id": "slice/level_2/test/test",  # selected
            "children_category": "level_1",
            "children_list_type": "static",
            "persist_child_if_not_found": False,
        },
    ]

    assert format_path(tree, selected_terminal) == terminal_expected


def test_vector_get(app, empty_db_mock_downloads):
    alpha = GeneFactory(label="alpha")
    beta = GeneFactory(label="beta")
    cellline = CellLineFactory(depmap_id="ACH-1")

    gene_dataset = BiomarkerDatasetFactory(
        display_name="genedata",
        matrix=MatrixFactory(
            entities=[alpha, beta], cell_lines=[cellline], data=[[1.0], [2.0]]
        ),
    )
    empty_db_mock_downloads.session.flush()
    interactive_test_utils.reload_interactive_config()

    with app.test_client() as c:
        r = c.get(
            url_for(
                "vector_catalog.vector",
                id="slice/{}/{}/{}".format(
                    gene_dataset.name.name, alpha.entity_id, SliceRowType.entity_id.name
                ),
            )
        )
        resp = parse_resp(r)
        assert resp == {
            "cellLines": ["ACH-1"],
            "values": [1.0],
            "categoricalValues": None,
        }

        r = c.get(
            url_for(
                "vector_catalog.vector",
                id="slice/{}/{}/{}".format(
                    gene_dataset.name.name, beta.entity_id, SliceRowType.entity_id.name
                ),
            )
        )
        resp = parse_resp(r)
        assert resp == {
            "cellLines": ["ACH-1"],
            "values": [2.0],
            "categoricalValues": None,
        }
