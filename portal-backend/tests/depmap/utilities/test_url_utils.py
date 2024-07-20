from depmap.utilities.url_utils import *
import pytest


@pytest.mark.parametrize(
    "param, expected_param, reason",
    [
        ("{data}", "'+data+'", "{} is replaced to data variable"),
        ("{row[0]}", "'+row[0]+'", "[ and ] are not url encoded"),
        ("non*js", "non%2Ajs", "url encoded and not replaced with a js variable"),
    ],
)
def test_js_url_for(app, param, expected_param, reason):
    with app.test_client() as c:
        js_url_string = js_url_for("gene.view_gene", gene_symbol=param)
        expected = "'/gene/{}'".format(expected_param)
        assert js_url_string == expected


def assert_url_contains_parts(url, url_parts):
    for part in url_parts:
        assert part in url
