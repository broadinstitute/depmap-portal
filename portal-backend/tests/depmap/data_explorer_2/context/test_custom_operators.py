from depmap_compute.context import ContextEvaluator

from depmap.data_explorer_2.utils import slice_to_dict


def test_operator__not_in():
    assert expressions_are_equivalent(
        # python
        "a" not in [],
        # JsonLogic
        {"!in": ["a", []]},
    )

    assert expressions_are_equivalent(
        # python
        "a" not in ["b", "c"],
        # JsonLogic
        {"!in": ["a", ["b", "c"]]},
    )

    assert expressions_are_equivalent(
        # python
        "b" not in ["b", "c"],
        # JsonLogic
        {"!in": ["b", ["b", "c"]]},
    )


def test_operator__has_any():
    assert expressions_are_equivalent(
        # python
        bool({"a", "b"} & {"a", "b"}),
        # JsonLogic
        {"has_any": [["a", "b"], ["a", "b"]]},
    )

    assert expressions_are_equivalent(
        # python
        bool({"a", "b"} & {"b", "c"}),
        # JsonLogic
        {"has_any": [["a", "b"], ["b", "c"]]},
    )

    assert expressions_are_equivalent(
        # python
        bool({"a", "b"} & {"c", "d"}),
        # JsonLogic
        {"has_any": [["a", "b"], ["c", "d"]]},
    )


def test_operator__not_has_any():
    assert expressions_are_equivalent(
        # python
        not ({"a", "b"} & {"a", "b"}),
        # JsonLogic
        {"!has_any": [["a", "b"], ["a", "b"]]},
    )

    assert expressions_are_equivalent(
        # python
        not ({"a", "b"} & {"b", "c"}),
        # JsonLogic
        {"!has_any": [["a", "b"], ["b", "c"]]},
    )

    assert expressions_are_equivalent(
        # python
        not ({"a", "b"} & {"c", "d"}),
        # JsonLogic
        {"!has_any": [["a", "b"], ["c", "d"]]},
    )


def expressions_are_equivalent(boolean_value, json_logic_expr):
    context = {"context_type": "don't care", "expr": json_logic_expr}

    # These expressions don't use variables (just pure logic)
    var_name = "dummy variable"
    result = ContextEvaluator(context, slice_to_dict).is_match(var_name)

    return result == boolean_value
