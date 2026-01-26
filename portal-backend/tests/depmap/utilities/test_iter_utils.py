from depmap.utilities import iter_utils


def test_pairwise_no_repeat():
    list = [1, 2, 1, 2, 1, 2]
    for one, two in iter_utils.pairwise_no_repeat(list):
        assert one == 1
        assert two == 2
