"""
The vectorized evaluator is only allowed to be faster, never different. These
tests run the same context through both paths (`vectorized=True/False`) and
require identical answers -- including identical failures.
"""
import random

import numpy as np
import pandas as pd
import pytest

from breadbox.depmap_compute_embed.context import ContextEvaluator

CANDIDATES = [f"c{i}" for i in range(40)]


def _sparse(rng, values):
    """Give each candidate a value from `values`, or leave it out."""
    present = [c for c in CANDIDATES if rng.random() < 0.75]
    return {c: rng.choice(values) for c in present}


def _build_series(rng):
    strings = ["a", "b", "c", "1", "1.0", "None", ""]
    out = {
        "str": pd.Series(_sparse(rng, strings), dtype=object),
        "float": pd.Series(_sparse(rng, [0.5, 1.0, 2.5, -3.0, 10.0])),
        "int": pd.Series(_sparse(rng, [0, 1, 2, 5, 10])),
        "list": pd.Series(
            _sparse(rng, [["a", "b"], ["c"], [], ["a"], ["x", "y", "1"]]), dtype=object
        ),
        "mixed": pd.Series(_sparse(rng, ["a", 1, 2.5, "1"]), dtype=object),
        "bool": pd.Series(_sparse(rng, [True, False])),
        "obj_none": pd.Series(
            {**_sparse(rng, ["a", "b"]), "c0": None, "c1": None}, dtype=object
        ),
    }
    with_nan = _sparse(rng, [1.0, 2.0])
    with_nan["c2"] = float("nan")
    out["nan"] = pd.Series(with_nan)
    # ids outside the candidates, and a duplicated index
    out["extra_ids"] = pd.Series({**_sparse(rng, ["a", "b"]), "not_a_candidate": "a"})
    dup = pd.Series(["a", "b", "a"], index=["c3", "c4", "c3"])
    out["dup"] = dup
    return out


def _literals(rng):
    return rng.choice(
        [
            "a",
            "b",
            "None",
            "1",
            "",
            0,
            1,
            2.5,
            10,
            True,
            None,
            ["a", "b"],
            ["c0", "c3", "c4", "zzz"],
            ["x", "1"],
            [1, 2.5, 10],
            ["a", 1],
            [],
            [["a"]],
        ]
    )


_BINARY = ["==", "!=", "<", "<=", ">", ">=", "in", "!in", "has_any", "!has_any"]
_CTX = ["in_context", "!in_context"]


def _random_expr(rng, var_names, depth=0):
    kind = rng.random()
    if depth < 3 and kind < 0.35:
        op = rng.choice(["and", "or"])
        return {
            op: [
                _random_expr(rng, var_names, depth + 1)
                for _ in range(rng.randint(0, 3))
            ]
        }
    if depth < 3 and kind < 0.45:
        return {"!": _random_expr(rng, var_names, depth + 1)}
    if depth < 3 and kind < 0.52:
        return {"complement": _random_expr(rng, var_names, depth + 1)}

    var = {"var": rng.choice(var_names + ["given_id"])}
    leaf = rng.random()
    if leaf < 0.12:
        return {rng.choice(["is_null", "not_null"]): [var]}
    if leaf < 0.17:
        # operators we never vectorize, to exercise the fallback
        return rng.choice(
            [
                {"===": [var, _literals(rng)]},
                {"cat": [var, "x"]},
                {"missing": ["str", "nope"]},
                var,
                True,
            ]
        )
    op = rng.choice(_BINARY + _CTX)
    literal = _literals(rng)
    args = [var, literal] if rng.random() < 0.85 else [literal, var]
    if rng.random() < 0.03:
        args.append(_literals(rng))  # e.g. JsonLogic's three-argument "between"
    return {op: args}


def _run(expr, series, vectorized):
    names = list(series)
    context = {
        "dimension_type": "t",
        "expr": expr,
        "vars": {
            n: {"dataset_id": n, "identifier": n, "identifier_type": "column"}
            for n in names
        },
    }
    evaluator = None
    try:
        evaluator = ContextEvaluator(
            context,
            lambda q: series[q.dataset_id],
            lambda _: {c: c.upper() for c in CANDIDATES},
            vectorized=vectorized,
        )
        result = evaluator.evaluate()
        return ("ok", result.ids, result.labels, result.num_candidates)
    except (ValueError, TypeError, LookupError) as e:
        return ("error", type(e).__name__)


@pytest.mark.parametrize("seed", range(40))
def test_vectorized_matches_per_row_evaluation(seed):
    rng = random.Random(seed)
    series = _build_series(rng)
    names = list(series)

    for _ in range(100):
        expr = _random_expr(rng, names)
        expected = _run(expr, series, vectorized=False)
        actual = _run(expr, series, vectorized=True)
        assert actual == expected, f"seed={seed} expr={expr}"


@pytest.mark.parametrize(
    "expr",
    [
        # soft_equals compares str(a) == str(b), so these are not what they look like
        {"==": [{"var": "str"}, "None"]},
        {"==": [{"var": "str"}, 1]},
        {"==": [{"var": "float"}, "1.0"]},
        {"==": [{"var": "mixed"}, "1"]},
        # missing values never satisfy a comparison
        {">": [{"var": "float"}, -100]},
        {"<=": [10, {"var": "int"}]},
        # a NaN that is really present is not a missing value to is_null
        {"is_null": [{"var": "nan"}]},
        {"not_null": [{"var": "nan"}]},
        # empty lists are nulls
        {"is_null": [{"var": "list"}]},
        {"has_any": [{"var": "list"}, ["a", "zzz"]]},
        {"in_context": [{"var": "list"}, ["x"]]},
        {"in_context": [{"var": "str"}, ["a", "c"]]},
        # duplicated ids: the last one wins
        {"==": [{"var": "dup"}, "a"]},
        {"!in": [{"var": "str"}, ["a", "b"]]},
        {"complement": {"in": [{"var": "str"}, ["a"]]}},
        # type errors must surface the same way
        {">": [{"var": "str"}, 5]},
        {"<": [{"var": "mixed"}, 2]},
    ],
)
def test_known_quirks_match(expr):
    series = _build_series(random.Random(7))
    assert _run(expr, series, True) == _run(expr, series, False)


def test_vectorized_path_is_actually_taken(monkeypatch):
    """Guard against the fallback silently handling everything."""
    calls = []
    original = ContextEvaluator._is_match

    def counting(self, *args, **kwargs):
        calls.append(1)
        return original(self, *args, **kwargs)

    monkeypatch.setattr(ContextEvaluator, "_is_match", counting)
    series = _build_series(random.Random(3))
    expr = {
        "and": [
            {"not_null": [{"var": "str"}]},
            {"!": {"in": [{"var": "str"}, ["a"]]}},
            {
                "or": [
                    {">": [{"var": "float"}, 1.0]},
                    {"has_any": [{"var": "list"}, ["a"]]},
                ]
            },
        ]
    }
    _run(expr, series, vectorized=True)
    assert calls == []
