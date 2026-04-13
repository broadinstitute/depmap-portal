import pandas as pd
from breadbox.depmap_compute_embed.context import ContextEvaluator
from breadbox.depmap_compute_embed.slice import SliceQuery

# Our ContextEvaluator makes heavy use of an extension to the 3rd party library: json_logic
# These tests ensure that behavior is continuing to work as expected.


def expressions_are_equivalent(boolean_value, json_logic_expr):
    context = {
        "dimension_type": "dummy",
        "expr": json_logic_expr,
    }

    # These expressions don't use variables (just pure logic)
    get_slice_data_mock = lambda _: pd.Series(dtype=object)
    get_labels_by_id_mock = lambda _: {"dummy_id": "dummy_label"}
    evaluator = ContextEvaluator(context, get_slice_data_mock, get_labels_by_id_mock)

    return evaluator._is_match("dummy_id") == boolean_value


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

    mock_get_labels = lambda dim_type: {
        "PAIR_1": "Pair 1",
        "PAIR_2": "Pair 2",
        "PAIR_3": "Pair 3",
    }

    evaluator = ContextEvaluator(context, mock_get_slice_data, mock_get_labels)
    result = evaluator.evaluate()

    # Only screen_pairs with Lineage == "Breast" should match
    assert sorted(result.ids) == ["PAIR_1", "PAIR_3"]


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

    mock_get_labels = lambda dim_type: {
        "MODEL_A": "Model A",
        "MODEL_B": "Model B",
    }

    evaluator = ContextEvaluator(context, mock_get_slice_data, mock_get_labels)
    result = evaluator.evaluate()

    assert result.ids == ["MODEL_A"]


def test_context_evaluator_reindex_through_ignored_fields():
    """
    SliceQueryRef has extra='ignore', so unknown fields in the vars dict
    should be silently dropped. This also verifies that only the three core
    fields + reindex_through are passed through.
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

    mock_get_labels = lambda _: {"id1": "Label 1"}

    evaluator = ContextEvaluator(context, mock_get_slice_data, mock_get_labels)
    result = evaluator.evaluate()
    assert result.ids == ["id1"]
