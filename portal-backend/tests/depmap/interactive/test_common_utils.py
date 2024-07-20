from depmap.interactive.common_utils import sort_insensitive


def test_sort_insensitive():
    values = ["aaa", "ZZZ", "mmm"]
    expected = ["aaa", "mmm", "ZZZ"]

    assert sorted(values) != expected  # check that we are actuallyl testing something
    assert sort_insensitive(values) == expected
