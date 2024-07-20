import pandas as pd
import json
import collections
from flask import url_for

from depmap.constellation.views import _get_graph_definitions, _make_network_graph
from depmap.constellation.utils import (
    SimilarityOption,
    ConnectivityOption,
    remove_duplicated_features,
    select_n_features,
)
from depmap.constellation import utils


def test_get_graph_definitions(empty_db_with_constellation):
    input_df = pd.DataFrame(
        {
            "Feature": ["ANOS1", "NRAS"],
            "-log10(p)": [1, 2],
            "effect": [-0.1, 0.3],
            "task": ["task1", "task1"],
        }
    )
    similarity_measure = SimilarityOption.misgdb
    n_genes = 2
    connectivity = ConnectivityOption.high
    topSelectedFeature = utils.TopFeatureEnum.abs_correlation

    graphs = _get_graph_definitions(
        input_df, n_genes, similarity_measure, connectivity, topSelectedFeature
    )
    assert len(graphs["table"]) == 2
    assert len(graphs["network"]["nodes"]) == 2
    assert len(graphs["network"]["edges"]) == 1
    assert graphs["overrepresentation"] is not None


def test_remove_gene_duplication():
    input_df = pd.DataFrame(
        {
            "feature": ["S1", "S2", "S1", "S1"],
            "effect": [0.5, 0.3, -0.1, -0.8],
            "-log10(p)": [3, 2, 1, 4],
        }
    )

    gene_removed_df = remove_duplicated_features(input_df)

    assert set(gene_removed_df["feature"]) == {"S1", "S2"}
    assert set(gene_removed_df["effect"]) == {0.5, 0.3}
    assert set(gene_removed_df["-log10(p)"]) == {3, 2}


def test_post_one_get_graph_definitions(app, monkeypatch, empty_db_with_constellation):
    """
    Test that the get graph definitions endpoint returns as expected for 1 task id
    """

    def mockFunc(str):
        input_df = pd.DataFrame(
            {
                "label": ["SOX10", "KDM7A"],
                "-log10(P)": [1, 2],
                "Cor": [-0.1, 0.3],
                "task": ["task1", "task1"],
            }
        )
        return input_df

    monkeypatch.setattr(utils, "get_df_from_task_id", mockFunc)
    with app.test_client() as c:

        res = c.post(
            url_for("constellation.get_graph_definitions"),
            data={
                "resultId": json.dumps(["2ne1"]),
                "nFeatures": 2,
                "similarityMeasure": "codependency",
                "connectivity": 2,
                "topSelectedFeature": utils.TopFeatureEnum.abs_correlation.value,
            },
        )

        assert res.status_code == 200
        res_data = res.json
        assert (
            res_data["network"] and res_data["overrepresentation"] and res_data["table"]
        )
        assert len(res_data["network"]["nodes"]) == 2


def test_post_multi_duplicate_get_graph_definitions(
    app, monkeypatch, empty_db_with_constellation
):
    """
    Test that the get graph definitions endpoint returns as expected for multiple task id and removes duplication
    """
    count = 0

    def mockFunc(str):
        nonlocal count
        count += 1
        if count % 2 != 0:
            input_df = pd.DataFrame(
                {
                    "label": ["SOX10", "KDM7A"],
                    "-log10(P)": [1, 2],
                    "Cor": [-0.6, 0.5],
                    "task": ["task1", "task1"],
                }
            )
        else:
            input_df = pd.DataFrame(
                {
                    "label": ["SOX10", "KDM7A"],
                    "-log10(P)": [1, 2],
                    "Cor": [-0.2, 0.7],
                    "task": ["task2", "task2"],
                }
            )
        return input_df

    with app.test_client() as c:
        monkeypatch.setattr(utils, "get_df_from_task_id", mockFunc)
        res = c.post(
            url_for("constellation.get_graph_definitions"),
            data={
                "resultId": json.dumps(["2ne2", "2ne1"]),
                "nFeatures": 2,
                "similarityMeasure": "codependency",
                "connectivity": 2,
                "topSelectedFeature": utils.TopFeatureEnum.abs_correlation.value,
            },
        )

        assert res.status_code == 200
        res_data = res.json
        assert (
            res_data["network"] and res_data["overrepresentation"] and res_data["table"]
        )
        assert len(res_data["network"]["nodes"]) == 2
        assert len(res_data["table"]) == 4
        gene_list = [data["id"] for data in res_data["network"]["nodes"]]
        assert collections.Counter(gene_list) == collections.Counter(["KDM7A", "SOX10"])


def test_post_multi_get_graph_definitions(
    app, monkeypatch, empty_db_with_constellation
):
    """
    Test that the get graph definitions endpoint returns as expected for multiple task id and removes duplication
    """
    count = 0

    def mockFunc(str):
        # Return different df depending on times mock func is called
        nonlocal count
        count += 1
        if count % 2 != 0:
            input_df = pd.DataFrame(
                {
                    "label": ["SOX10", "KDM7A"],
                    "-log10(P)": [1, 2],
                    "Cor": [-0.2, 0.5],
                    "task": ["task1", "task1"],
                }
            )
        else:
            input_df = pd.DataFrame(
                {
                    "label": ["SOX10", "MED1"],
                    "-log10(P)": [3, 4],
                    "Cor": [-0.8, 0.6],
                    "task": ["task2", "task2"],
                }
            )
        return input_df

    with app.test_client() as c:
        monkeypatch.setattr(utils, "get_df_from_task_id", mockFunc)
        res = c.post(
            url_for("constellation.get_graph_definitions"),
            data={
                "resultId": json.dumps(["2ne2", "2ne1"]),
                "nFeatures": 2,
                "similarityMeasure": "codependency",
                "connectivity": 2,
                "topSelectedFeature": utils.TopFeatureEnum.abs_correlation.value,
            },
        )

        assert res.status_code == 200
        res_data = res.json
        assert (
            res_data["network"] and res_data["overrepresentation"] and res_data["table"]
        )
        assert len(res_data["network"]["nodes"]) == 2
        assert len(res_data["table"]) == 4
        gene_list = [data["id"] for data in res_data["network"]["nodes"]]
        assert collections.Counter(gene_list) == collections.Counter(["MED1", "SOX10"])


def test_select_n_genes():
    """
    Selects top n genes sorted by absolute effect size or negative log pvalue. Deduplication done after top n genes selected.
    If duplicated genes available after selecting top n, result returned may be less than n unless is_depmap_cor is True
    """
    input_df = pd.DataFrame(
        {
            "feature": ["S1", "S2", "S1", "S1"],
            "effect": [0.5, 0.3, -0.1, -0.8],
            "-log10(P)": [4, 2, 1, 3],
        }
    )

    def test_select_genes_by_abs_effect():
        selected_n_genes_df = select_n_features(
            input_df, 3, utils.TopFeatureEnum.abs_correlation, False
        )

        assert set(selected_n_genes_df["feature"]) == {"S1", "S2"}
        assert set(selected_n_genes_df["effect"]) == {-0.8, 0.3}
        assert set(selected_n_genes_df["-log10(P)"]) == {3, 2}

    def test_select_genes_by_pval():
        selected_n_genes_df = select_n_features(
            input_df, 3, utils.TopFeatureEnum.neg_log_p, False
        )
        assert set(selected_n_genes_df["feature"]) == {"S1", "S2"}
        assert set(selected_n_genes_df["effect"]) == {0.5, 0.3}
        assert set(selected_n_genes_df["-log10(P)"]) == {4, 2}

    def test_select_genes_by_max_effect():
        selected_n_genes_df = select_n_features(
            input_df, 3, utils.TopFeatureEnum.max_correlation, False
        )

        assert set(selected_n_genes_df["feature"]) == {"S1", "S2"}
        assert set(selected_n_genes_df["effect"]) == {0.5, 0.3}
        assert set(selected_n_genes_df["-log10(P)"]) == {4, 2}

    def test_select_genes_by_min_effect():
        selected_n_genes_df = select_n_features(
            input_df, 3, utils.TopFeatureEnum.min_correlation, False
        )

        assert set(selected_n_genes_df["feature"]) == {"S1", "S2"}
        assert set(selected_n_genes_df["effect"]) == {-0.8, 0.3}
        assert set(selected_n_genes_df["-log10(P)"]) == {3, 2}

    def test_select_genes_by_abs_effect_is_depmap_cor():
        selected_n_genes_df = select_n_features(
            input_df, 3, utils.TopFeatureEnum.abs_correlation, True
        )

        assert set(selected_n_genes_df["feature"]) == {"S1", "S1", "S2"}
        assert set(selected_n_genes_df["effect"]) == {-0.8, 0.5, 0.3}
        assert set(selected_n_genes_df["-log10(P)"]) == {3, 4, 2}

    test_select_genes_by_abs_effect()
    test_select_genes_by_pval()
    test_select_genes_by_max_effect()
    test_select_genes_by_min_effect()
    test_select_genes_by_abs_effect_is_depmap_cor()


def test_make_network_graph_with_orphans():
    """
    Makes sure orphan genes (gene nodes not connected by an edge) are removed 
    and returns list of nodes with coordinates and a list of edges
    """
    input_df = pd.DataFrame(
        {
            "feature": ["S3", "S2", "S1"],
            "effect": [0.5, 0.3, 0.2],
            "-log10(P)": [4, 2, 1],
            "gene_sets": ["GENESET1", "GENESET2", "GENESET3"],
            "task": ["task1", "task1", "task1"],
        }
    )
    similarity_df = pd.DataFrame(
        {"v1": ["S1"], "v2": ["S2"], "weight": [0.5], "set": [3],}
    )

    network_graph = _make_network_graph(
        input_df, similarity_df, ConnectivityOption.high, False
    )

    assert len(network_graph["nodes"]) == 2
    assert len(network_graph["edges"]) == 1


def test_make_network_graph_with_or_without_task():
    """
    Makes sure orphan genes (gene nodes not connected by an edge) are removed 
    and returns list of nodes with coordinates and a list of edges
    """
    task_df = pd.DataFrame(
        {
            "feature": ["S3", "S2", "S1"],
            "effect": [0.5, 0.3, 0.2],
            "-log10(P)": [4, 2, 1],
            "gene_sets": ["GENESET1", "GENESET2", "GENESET3"],
            "task": ["task1", "task1", "task1"],
        }
    )

    no_task_df = pd.DataFrame(
        {
            "feature": ["S3", "S2", "S1"],
            "effect": [0.5, 0.3, 0.2],
            "-log10(P)": [4, 2, 1],
            "gene_sets": ["GENESET1", "GENESET2", "GENESET3"],
        }
    )
    similarity_df = pd.DataFrame(
        {"v1": ["S1"], "v2": ["S2"], "weight": [0.5], "set": [3],}
    )

    task_network_graph = _make_network_graph(
        task_df, similarity_df, ConnectivityOption.high, False
    )

    no_task_network_graph = _make_network_graph(
        no_task_df, similarity_df, ConnectivityOption.high, False
    )

    assert (
        len(task_network_graph["nodes"]) == 2
        and len(no_task_network_graph["nodes"]) == 2
    )
    assert (
        len(task_network_graph["edges"]) == 1
        and len(no_task_network_graph["edges"]) == 1
    )
    assert "task" in task_network_graph["nodes"][0]
    assert no_task_network_graph["nodes"][0]["task"] is None
