from depmap.methylation.util import merge_results
from depmap.methylation.extension import open_db
from tests.factories import CellLineFactory


def test_methylation_query(empty_db_mock_downloads):
    cell_line_1 = CellLineFactory(
        cell_line_name="A2058_SKIN", cell_line_display_name="A2058"
    )
    cell_line_2 = CellLineFactory(
        cell_line_name="CJM_SKIN", cell_line_display_name="CJM"
    )
    db = open_db("sample_data/cpg-meth.sqlite3")
    result1 = db.get("NRAS", cell_line_1)
    result2 = db.get("NRAS", cell_line_2)
    merged = merge_results([result1, result2])

    assert "19:58864118" in merged["x"]
    assert "19:58864821" in merged["x"]

    assert "A2058" in merged["y"]
    assert "CJM" in merged["y"]

    matches = [
        x for x in merged["data"] if x["x"] == "19:58863131" and x["y"] == "A2058"
    ]
    assert len(matches) == 1
    m = matches[0]
    print(m)
    assert m["meth"] == 0
    assert m["coverage"] == 9
    assert m["value"] == "#0000FF"
    assert m["r"] == 3
