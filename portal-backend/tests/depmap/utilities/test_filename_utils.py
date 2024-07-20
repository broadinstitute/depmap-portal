import pytest
from depmap.utilities.filename_utils import sanitize_filename_string


@pytest.mark.parametrize(
    "input, expected",
    [('A/B?C|D"E\F:G<H>I', "ABCDEFGHI"), ("concentration μM", "concentration uM")],
)
def test_sanitize_filename_string(input, expected):
    assert sanitize_filename_string(input) == expected
