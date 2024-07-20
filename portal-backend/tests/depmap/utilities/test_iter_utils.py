from depmap.utilities import iter_utils


def test_pairwise_no_repeat():
    list = [1, 2, 1, 2, 1, 2]
    for one, two in iter_utils.pairwise_no_repeat(list):
        assert one == 1
        assert two == 2


def test_pairwise_with_repeat():
    list = [1, 2, 3, 4, 5, 6]
    for first, second in iter_utils.pairwise_with_repeat(list):
        assert first + 1 == second
