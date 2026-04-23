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


def test_operator__not_in_with_none():
    """None is not a member of any list, so !in should return True."""
    assert expressions_are_equivalent(True, {"!in": [None, ["a", "b"]]},)

    assert expressions_are_equivalent(True, {"!in": [None, []]},)


def test_operator__in_with_none():
    """None is not a member of any list, so `in` should return False."""
    assert expressions_are_equivalent(False, {"in": [None, ["a", "b"]]},)


def test_operator__has_any_with_none():
    """has_any expects two lists. If either operand is None (not a list),
    it should return False."""
    assert expressions_are_equivalent(False, {"has_any": [None, ["a", "b"]]},)

    assert expressions_are_equivalent(False, {"has_any": [["a", "b"], None]},)

    assert expressions_are_equivalent(False, {"has_any": [None, None]},)


def test_operator__not_has_any_with_none():
    """!has_any expects two lists. If either operand is None (not a list),
    it should return True (they trivially don't overlap)."""
    assert expressions_are_equivalent(True, {"!has_any": [None, ["a", "b"]]},)

    assert expressions_are_equivalent(True, {"!has_any": [["a", "b"], None]},)

    assert expressions_are_equivalent(True, {"!has_any": [None, None]},)


def test_comparison_operators_with_none():
    """Standard comparison operators should handle None gracefully."""
    assert expressions_are_equivalent(True, {"!=": [None, "foo"]},)

    assert expressions_are_equivalent(False, {"==": [None, "foo"]},)


def test_operator__complement_negates_when_data_present():
    """complement behaves as negation when all referenced vars have values."""
    context = {
        "dimension_type": "dummy",
        "expr": {"complement": {">": [{"var": "0"}, 1.5]}},
        "vars": {
            "0": {"dataset_id": "ds", "identifier": "col", "identifier_type": "column",}
        },
    }

    get_slice_data = lambda _: pd.Series({"high": 2.0, "low": 0.5})
    get_labels = lambda _: {"high": "High", "low": "Low"}

    evaluator = ContextEvaluator(context, get_slice_data, get_labels)
    result = evaluator.evaluate()

    # high=2.0 > 1.5, so complement is False. low=0.5 <= 1.5, so complement is True.
    assert result.ids == ["low"]


def test_operator__complement_returns_false_when_var_is_null():
    """complement returns False for entities with missing data,
    letting them fall through to 'Other' instead of being misclassified."""
    context = {
        "dimension_type": "dummy",
        "expr": {"complement": {">": [{"var": "0"}, 1.5]}},
        "vars": {
            "0": {"dataset_id": "ds", "identifier": "col", "identifier_type": "column",}
        },
    }

    # "missing" has no entry in the slice data
    get_slice_data = lambda _: pd.Series({"has_data": 0.5})
    get_labels = lambda _: {"has_data": "Has Data", "missing": "Missing"}

    evaluator = ContextEvaluator(context, get_slice_data, get_labels)
    result = evaluator.evaluate()

    # has_data: 0.5 <= 1.5, complement is True -> matches
    # missing: null, complement returns False -> doesn't match (falls to "Other")
    assert result.ids == ["has_data"]


def test_operator__complement_vs_plain_not():
    """Demonstrates the bug that complement fixes: plain '!' misclassifies
    entities with null data into the outgroup."""
    vars_def = {
        "0": {"dataset_id": "ds", "identifier": "col", "identifier_type": "column",}
    }
    inner_expr = {">": [{"var": "0"}, 1.5]}

    # "present" has data below threshold, "missing" has no data at all
    get_slice_data = lambda _: pd.Series({"present": 0.5})
    get_labels = lambda _: {"present": "Present", "missing": "Missing"}

    # With plain "!" — the old buggy behavior
    not_evaluator = ContextEvaluator(
        {"dimension_type": "dummy", "expr": {"!": inner_expr}, "vars": vars_def},
        get_slice_data,
        get_labels,
    )
    not_result = not_evaluator.evaluate()

    # BUG: "missing" is incorrectly included because !(null > 1.5) => !(False) => True
    assert "missing" in not_result.ids

    # With "complement" — the correct behavior
    complement_evaluator = ContextEvaluator(
        {
            "dimension_type": "dummy",
            "expr": {"complement": inner_expr},
            "vars": vars_def,
        },
        get_slice_data,
        get_labels,
    )
    complement_result = complement_evaluator.evaluate()

    # FIXED: "missing" is excluded, only "present" matches
    assert complement_result.ids == ["present"]


def test_operator__complement_multiple_vars_any_null():
    """If any referenced var is null, complement returns False —
    even if other vars have data. This includes vars referenced inside
    not_null gates: see test_operator__complement_with_not_null_gate
    for the motivating two-class-comparison use case."""
    context = {
        "dimension_type": "dummy",
        "expr": {
            "complement": {
                "and": [{">": [{"var": "a"}, 1.0]}, {"==": [{"var": "b"}, "yes"]},]
            }
        },
        "vars": {
            "a": {
                "dataset_id": "ds1",
                "identifier": "col_a",
                "identifier_type": "column",
            },
            "b": {
                "dataset_id": "ds2",
                "identifier": "col_b",
                "identifier_type": "column",
            },
        },
    }

    slice_data = {
        ("ds1", "col_a", "column"): pd.Series({"full": 0.5, "partial": 0.5}),
        ("ds2", "col_b", "column"): pd.Series({"full": "no"}),
        # "partial" has no entry in ds2
    }

    def get_slice_data(q):
        return slice_data[(q.dataset_id, q.identifier, q.identifier_type)]

    get_labels = lambda _: {"full": "Full", "partial": "Partial"}

    evaluator = ContextEvaluator(context, get_slice_data, get_labels)
    result = evaluator.evaluate()

    # full: a=0.5, b="no" — both present, inner=(0.5>1.0 and "no"=="yes")=False,
    #   complement=True -> matches
    # partial: a=0.5, b=None — b is null, complement returns False
    assert result.ids == ["full"]


def test_operator__complement_of_is_null_passes_through():
    """`complement` should NOT null-guard `is_null` — it is the one operator
    whose correct behavior on null is to return True, so wrapping it in a
    null guard would destroy its meaning. Null-guarding `is_null(x)` would
    exclude exactly the entities the user is trying to identify.

    {"complement": {"is_null": [{"var": "x"}]}} should behave the same as
    {"not_null": [{"var": "x"}]}: true for entities where x has data, false
    where x is null. Credit to Phil for catching this asymmetry in review."""
    context = {
        "dimension_type": "dummy",
        "expr": {"complement": {"is_null": [{"var": "0"}]}},
        "vars": {
            "0": {"dataset_id": "ds", "identifier": "col", "identifier_type": "column"}
        },
    }

    get_slice_data = lambda _: pd.Series({"has_data": "foo"})
    get_labels = lambda _: {"has_data": "Has Data", "missing": "Missing"}

    evaluator = ContextEvaluator(context, get_slice_data, get_labels)
    result = evaluator.evaluate()

    # has_data: is_null is False, complement is True -> included
    # missing:  is_null is True,  complement is False -> excluded
    assert result.ids == ["has_data"]


def test_operator__complement_with_not_null_gate():
    """`not_null` IS null-guarded like any other operator, because the
    typical use case is a data-completeness gate in a two-class comparison.
    Given `complement(and(not_null(metadata), expression > 5))`, the user's
    intent is "entities where metadata is known AND expression > 5", and
    the complement should be "other entities where metadata is known" —
    NOT "other entities plus entities with unknown metadata." The positive
    and complement groups should form a clean partition of the entities
    the user actually cared about (those with known metadata).
    """
    context = {
        "dimension_type": "dummy",
        "expr": {
            "complement": {
                "and": [
                    {"not_null": [{"var": "metadata"}]},
                    {">": [{"var": "expression"}, 5]},
                ]
            }
        },
        "vars": {
            "metadata": {
                "dataset_id": "ds1",
                "identifier": "meta_col",
                "identifier_type": "column",
            },
            "expression": {
                "dataset_id": "ds2",
                "identifier": "expr_col",
                "identifier_type": "column",
            },
        },
    }

    slice_data = {
        ("ds1", "meta_col", "column"): pd.Series(
            {"high_with_meta": "tag", "low_with_meta": "tag"}
            # "low_without_meta" and "all_missing" have no metadata
        ),
        ("ds2", "expr_col", "column"): pd.Series(
            {"high_with_meta": 10.0, "low_with_meta": 1.0, "low_without_meta": 1.0}
            # "all_missing" has no expression either
        ),
    }

    def get_slice_data(q):
        return slice_data[(q.dataset_id, q.identifier, q.identifier_type)]

    get_labels = lambda _: {
        "high_with_meta": "High + Meta",
        "low_with_meta": "Low + Meta",
        "low_without_meta": "Low, No Meta",
        "all_missing": "All Missing",
    }

    evaluator = ContextEvaluator(context, get_slice_data, get_labels)
    result = evaluator.evaluate()

    # high_with_meta: both vars present, inner=(True AND True)=True
    #   -> complement=False -> excluded (correctly in positive group)
    # low_with_meta: both vars present, inner=(True AND False)=False
    #   -> complement=True -> INCLUDED (correctly in outgroup)
    # low_without_meta: metadata null -> null guard on `metadata` fails
    #   -> complement returns False -> EXCLUDED (gate is preserved)
    # all_missing: both vars null -> null guards fail -> excluded
    #
    # Key property: positive and complement together cover only entities
    # with known metadata. Users running a two-class comparison can trust
    # that their data-completeness gate is respected in both groups.
    assert result.ids == ["low_with_meta"]


def test_operator__is_null():
    """is_null returns True when the value is None."""
    context = {
        "dimension_type": "dummy",
        "expr": {"is_null": [{"var": "0"}]},
        "vars": {
            "0": {"dataset_id": "ds", "identifier": "col", "identifier_type": "column"}
        },
    }

    get_slice_data = lambda _: pd.Series({"has_data": "foo"})
    get_labels = lambda _: {"has_data": "Has Data", "missing": "Missing"}

    evaluator = ContextEvaluator(context, get_slice_data, get_labels)
    result = evaluator.evaluate()

    # has_data: "foo" is not None -> False
    # missing: None (not in slice) -> True
    assert result.ids == ["missing"]


def test_operator__not_null():
    """not_null returns True when the value is not None."""
    context = {
        "dimension_type": "dummy",
        "expr": {"not_null": [{"var": "0"}]},
        "vars": {
            "0": {"dataset_id": "ds", "identifier": "col", "identifier_type": "column"}
        },
    }

    get_slice_data = lambda _: pd.Series({"has_data": "foo"})
    get_labels = lambda _: {"has_data": "Has Data", "missing": "Missing"}

    evaluator = ContextEvaluator(context, get_slice_data, get_labels)
    result = evaluator.evaluate()

    # has_data: "foo" is not None -> True
    # missing: None -> False
    assert result.ids == ["has_data"]


def test_not_in_excludes_null_var_values():
    """!in with a var reference now excludes entities where the var is null.
    This fixes the bug where null !in ["a", "b"] would incorrectly match."""
    context = {
        "dimension_type": "dummy",
        "expr": {"!in": [{"var": "0"}, ["Breast", "Lung"]]},
        "vars": {
            "0": {"dataset_id": "ds", "identifier": "col", "identifier_type": "column"}
        },
    }

    get_slice_data = lambda _: pd.Series({"breast": "Breast", "other": "Skin"})
    get_labels = lambda _: {
        "breast": "Breast",
        "other": "Other",
        "missing": "Missing",
    }

    evaluator = ContextEvaluator(context, get_slice_data, get_labels)
    result = evaluator.evaluate()

    # breast: "Breast" in ["Breast", "Lung"] -> negated -> False
    # other: "Skin" not in list, not null -> True
    # missing: null -> null guard fails -> False (previously would have matched!)
    assert result.ids == ["other"]


def test_not_has_any_excludes_null_var_values():
    """!has_any with a var reference now excludes entities where the var is null."""
    context = {
        "dimension_type": "dummy",
        "expr": {"!has_any": [{"var": "0"}, ["a", "b"]]},
        "vars": {
            "0": {"dataset_id": "ds", "identifier": "col", "identifier_type": "column"}
        },
    }

    get_slice_data = lambda _: pd.Series(
        {"overlaps": ["a", "c"], "disjoint": ["d", "e"]}
    )
    get_labels = lambda _: {
        "overlaps": "Overlaps",
        "disjoint": "Disjoint",
        "missing": "Missing",
    }

    evaluator = ContextEvaluator(context, get_slice_data, get_labels)
    result = evaluator.evaluate()

    # overlaps: ["a", "c"] overlaps ["a", "b"] -> negated -> False
    # disjoint: ["d", "e"] no overlap, not null -> True
    # missing: null -> null guard fails -> False
    assert result.ids == ["disjoint"]


def test_nested_not_in_excludes_null():
    """!in correctly excludes null values even when nested inside 'and'."""
    context = {
        "dimension_type": "dummy",
        "expr": {
            "and": [
                {"!in": [{"var": "0"}, ["Breast", "Lung"]]},
                {"==": [{"var": "1"}, "yes"]},
            ]
        },
        "vars": {
            "0": {
                "dataset_id": "ds1",
                "identifier": "col1",
                "identifier_type": "column",
            },
            "1": {
                "dataset_id": "ds2",
                "identifier": "col2",
                "identifier_type": "column",
            },
        },
    }

    slice_data = {
        ("ds1", "col1", "column"): pd.Series({"full": "Skin", "partial": "Skin"}),
        ("ds2", "col2", "column"): pd.Series({"full": "yes"}),
    }

    def get_slice_data(q):
        return slice_data[(q.dataset_id, q.identifier, q.identifier_type)]

    get_labels = lambda _: {
        "full": "Full",
        "partial": "Partial",
        "missing": "Missing",
    }

    evaluator = ContextEvaluator(context, get_slice_data, get_labels)
    result = evaluator.evaluate()

    # full: "Skin" !in list (with guard pass), "yes"=="yes" -> match
    # partial: "Skin" !in list (with guard pass), but col2=None, None=="yes" -> False
    # missing: col1=None -> null guard on !in fails -> False
    assert result.ids == ["full"]


def test_not_in_with_literal_none_still_works():
    """Literal None (not a var reference) in !in still behaves as before.
    The null guard only applies to var references."""
    assert expressions_are_equivalent(True, {"!in": [None, ["a", "b"]]})
    assert expressions_are_equivalent(True, {"!in": [None, []]})


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


# ============================================================
# Tests for nested context references containing complement
# ============================================================


def test_nested_context_ref_with_complement_in_inner():
    """A gene_pair context can reference a gene-level outgroup (complement)
    via {"context": "<name>"}. The inner complement should resolve against
    the gene dimension type, producing a flat list of gene IDs, and the
    outer expression should use that list for membership testing. The
    data-completeness gate on the inner should carry forward: genes with
    unknown essentiality belong neither to the positive nor the outgroup,
    so gene pairs referencing such genes should be excluded.

    This is the one situation where `complement` can legitimately appear
    in user-generated output: as the inner `expr` of a context referenced
    by another context. The top-level context is still always positive,
    but the embedded reference can be to an auto-synthesized outgroup.
    """
    context = {
        "dimension_type": "gene_pair",
        "expr": {"in": [{"var": "gene_1"}, {"context": "non_essential"}]},
        "vars": {
            "gene_1": {
                "dataset_id": "pair_meta",
                "identifier": "gene_1_id",
                "identifier_type": "column",
            }
        },
        "contexts": {
            "non_essential": {
                "dimension_type": "gene",
                "expr": {"complement": {"==": [{"var": "0"}, "common essential"]}},
                "vars": {
                    "0": {
                        "dataset_id": "gene_meta",
                        "identifier": "essentiality",
                        "identifier_type": "column",
                    }
                },
            }
        },
    }

    # Three genes exercising all the interesting cases:
    #   ESSENTIAL_GENE: known essential    -> in positive, NOT in outgroup
    #   NONESS_GENE:   known non-essential -> NOT in positive, in outgroup
    #   UNKNOWN_GENE:  unknown essentiality -> in neither (gate'd out by null guard)
    gene_essentiality = pd.Series(
        {
            "ESSENTIAL_GENE": "common essential",
            "NONESS_GENE": "not common essential",
            # UNKNOWN_GENE has no entry: essentiality is null
        }
    )

    # Four pairs, one per gene scenario plus one edge case:
    #   PAIR_E: gene_1 = ESSENTIAL_GENE -> should be EXCLUDED
    #   PAIR_N: gene_1 = NONESS_GENE   -> should be INCLUDED
    #   PAIR_U: gene_1 = UNKNOWN_GENE  -> should be EXCLUDED (gate)
    #   PAIR_X: gene_1 = nonexistent   -> should be EXCLUDED
    pair_gene_1 = pd.Series(
        {
            "PAIR_E": "ESSENTIAL_GENE",
            "PAIR_N": "NONESS_GENE",
            "PAIR_U": "UNKNOWN_GENE",
            "PAIR_X": "SOME_OTHER_GENE_NOT_IN_TABLE",
        }
    )

    slice_data = {
        ("gene_meta", "essentiality"): gene_essentiality,
        ("pair_meta", "gene_1_id"): pair_gene_1,
    }

    def get_slice_data(q):
        return slice_data[(q.dataset_id, q.identifier)]

    def get_labels(dim_type):
        if dim_type == "gene":
            return {
                "ESSENTIAL_GENE": "Essential Gene",
                "NONESS_GENE": "Non-Essential Gene",
                "UNKNOWN_GENE": "Unknown Gene",
            }
        if dim_type == "gene_pair":
            return {
                "PAIR_E": "Pair with Essential",
                "PAIR_N": "Pair with Non-Essential",
                "PAIR_U": "Pair with Unknown",
                "PAIR_X": "Pair with Other",
            }
        raise ValueError(f"unexpected dim_type {dim_type!r}")

    evaluator = ContextEvaluator(context, get_slice_data, get_labels)
    result = evaluator.evaluate()

    # Only PAIR_N should match — its gene_1 is in the non_essential outgroup.
    # PAIR_E is excluded because ESSENTIAL_GENE is in the positive, not the
    # outgroup. PAIR_U is excluded because UNKNOWN_GENE is gate'd out of the
    # outgroup by the null guard — the positive-and-complement partition
    # only covers genes with known essentiality, and this property is
    # preserved through the nested context reference. PAIR_X is excluded
    # because SOME_OTHER_GENE_NOT_IN_TABLE isn't a member of any gene group.
    assert result.ids == ["PAIR_N"]
