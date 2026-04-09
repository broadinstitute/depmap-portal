import pandas as pd
from breadbox.depmap_compute_embed.context import ContextEvaluator
from breadbox.depmap_compute_embed.slice import SliceQuery

# Our ContextEvaluator makes heavy use of an extension to the 3rd party library: json_logic
# These tests ensure that behavior is continuing to work as expected.


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
    get_slice_data_mock = lambda _: pd.Series(dtype=object)
    result = ContextEvaluator(context, get_slice_data_mock).is_match(
        var_name
    )  # pyright: ignore

    return result == boolean_value


# ============================================================
# Tests for reindex_through passthrough in ContextEvaluator
# ============================================================


def test_context_evaluator_with_reindex_through():
    """
    The ContextEvaluator should pass reindex_through through to get_slice_data,
    and the returned data should be indexed by the root entity IDs.
    """
    context = {
        "dimension_type": "screen_pair",
        "expr": {"==": [{"var": "lineage"}, "Breast"]},
        "vars": {
            "lineage": {
                "dataset_id": "model_meta",
                "identifier": "Lineage",
                "identifier_type": "column",
                "reindex_through": {
                    "dataset_id": "screen_meta",
                    "identifier": "ModelID",
                    "identifier_type": "column",
                    "reindex_through": {
                        "dataset_id": "screen_pair_meta",
                        "identifier": "ScreenID",
                        "identifier_type": "column",
                    },
                },
            }
        },
    }

    def mock_get_slice_data(sq: SliceQuery):
        """
        When the evaluator calls get_slice_data, it should pass a SliceQuery
        with the full reindex_through chain. We simulate the resolved result:
        screen_pair IDs → Lineage values.
        """
        assert sq.dataset_id == "model_meta"
        assert sq.identifier == "Lineage"
        assert sq.reindex_through is not None
        assert sq.reindex_through.dataset_id == "screen_meta"
        assert sq.reindex_through.reindex_through is not None
        assert sq.reindex_through.reindex_through.dataset_id == "screen_pair_meta"

        # Return data as if the chain was already resolved to screen_pair IDs
        return pd.Series({"PAIR_1": "Breast", "PAIR_2": "Lung", "PAIR_3": "Breast"})

    evaluator = ContextEvaluator(context, mock_get_slice_data)
    matches = [pid for pid in ["PAIR_1", "PAIR_2", "PAIR_3"] if evaluator.is_match(pid)]

    # Only screen_pairs with Lineage == "Breast" should match
    assert matches == ["PAIR_1", "PAIR_3"]


def test_context_evaluator_without_reindex_through_still_works():
    """
    Ensure the existing behavior is unchanged when reindex_through is absent.
    """
    context = {
        "dimension_type": "model",
        "expr": {"==": [{"var": "lineage"}, "Breast"]},
        "vars": {
            "lineage": {
                "dataset_id": "model_meta",
                "identifier": "Lineage",
                "identifier_type": "column",
            }
        },
    }

    def mock_get_slice_data(sq: SliceQuery):
        assert sq.reindex_through is None
        return pd.Series({"MODEL_A": "Breast", "MODEL_B": "Lung"})

    evaluator = ContextEvaluator(context, mock_get_slice_data)
    matches = [mid for mid in ["MODEL_A", "MODEL_B"] if evaluator.is_match(mid)]

    assert matches == ["MODEL_A"]


def test_context_evaluator_reindex_through_ignored_fields():
    """
    _dict_to_slice_query only reads the three core fields + reindex_through
    from each var dict, so any extra fields are silently dropped.
    """
    context = {
        "dimension_type": "dummy",
        "expr": {"==": [{"var": "0"}, "yes"]},
        "vars": {
            "0": {
                "dataset_id": "ds",
                "identifier": "col",
                "identifier_type": "column",
                "some_unknown_field": "should be ignored",
                "reindex_through": {
                    "dataset_id": "root_ds",
                    "identifier": "fk_col",
                    "identifier_type": "column",
                    "another_unknown": 42,
                },
            }
        },
    }

    def mock_get_slice_data(sq: SliceQuery):
        assert sq.reindex_through is not None
        assert sq.reindex_through.dataset_id == "root_ds"
        return pd.Series({"id1": "yes"})

    evaluator = ContextEvaluator(context, mock_get_slice_data)
    assert evaluator.is_match("id1") is True
