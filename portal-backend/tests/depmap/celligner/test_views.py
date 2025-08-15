import pytest
from flask import url_for


def test_view_celligner(app, empty_db_with_celligner):
    with app.test_client() as c:
        r = c.get(url_for("celligner.view_celligner"))
        assert r.status_code == 200, r.status_code


def test_celligner_distance_cell_line_to_tumors(app, empty_db_with_celligner):
    with app.test_client() as c:
        r = c.get(
            url_for("celligner.celligner_distance_cell_line_to_tumors"),
            query_string={"modelConditionId": "PR-QmkJ5E", "kNeighbors": 5},
        )
        assert r.status_code == 200, r.status_code
        data = r.json
        assert set(data.keys()) == {
            "distance_to_tumors",
            "most_common_lineage",
            "color_indexes",
        }
        assert len(data["color_indexes"]) == 5
        assert data["most_common_lineage"] == "Lung"


def test_celligner_distance_tumors_to_cell_lines(app, empty_db_with_celligner):
    with app.test_client() as c:
        r = c.get(
            url_for("celligner.celligner_distance_tumors_to_cell_lines"),
            query_string={"primarySite": "bile_duct", "subtype": "all"},
        )
        assert r.status_code == 200, r.status_code
        data = r.json
        assert set(data.keys()) == {"medianDistances"}
