"""
Vectorized evaluation of the JsonLogic expressions a ContextEvaluator runs.

Evaluating one candidate at a time through jsonLogic costs a dict and an
interpreter walk per candidate, and requires every slice to be inflated into a
{given_id: value} dict first. Here the whole expression is evaluated once over
columns aligned to the candidate ids: each node yields a boolean mask and
and/or/! become &, | and ~.

Only leaves whose semantics can be reproduced exactly are vectorized. These are
the ones the Context Builder emits (after _resolve_complements has run): ==,
<, <=, >, >=, in, in_context, has_any, is_null and not_null, applied to a
column of known type against a literal of the matching type. Everything else --
an operator we don't know, a mixed-type column, or any of the places where
jsonLogic's JS-style coercion would make a vectorized answer differ -- is handed
back to `fallback`, which evaluates just that subtree row by row with jsonLogic.
The result is then combined with the vectorized masks, so correctness never
depends on this module recognizing an expression.

Note that this version of json_logic evaluates every operand of and/or before
combining them (no short-circuiting), so evaluating every leaf over every row
is exactly what the per-row path does too.
"""

from typing import Any, Callable, Optional, cast

import numpy as np
import pandas as pd

Mask = np.ndarray  # dtype bool, one entry per candidate

_COMPARISONS = {"<", "<=", ">", ">="}


def normalize_series(series: pd.Series) -> pd.Series:
    """Apply the same cleanup the per-row path applied while building dicts:
    the last of any duplicated ids wins (as in Series.to_dict()) and an empty
    list is treated as a missing value."""
    if not series.index.is_unique:
        series = cast(pd.Series, series[~series.index.duplicated(keep="last")])

    if series.dtype == object and pd.api.types.infer_dtype(series, skipna=True) != (
        "string"
    ):
        values = series.to_numpy(dtype=object).copy()
        empties = [
            i for i, v in enumerate(values) if isinstance(v, list) and len(v) == 0
        ]
        if empties:
            # Built by hand: Series.map would turn [1.0, None] into a float
            # column and silently change None into NaN.
            values[empties] = None
            series = pd.Series(values, index=series.index, dtype=object)

    return series


class Column:
    """A slice aligned to the candidate ids.

    kind is one of:
      "numeric": values is float64, NaN where absent
      "string":  values is an object array of str, None where absent
      "list":    values is an object array of list, None where absent
      "other":   anything else; leaves on it are never vectorized
    """

    __slots__ = ("kind", "values", "present")

    def __init__(self, kind: str, values: Optional[np.ndarray], present: np.ndarray):
        self.kind = kind
        self.values = values
        self.present = present


def _classify(series: pd.Series) -> str:
    if series.empty:
        return "other"

    kind = series.dtype.kind
    if kind in "iu":
        return "numeric"
    if kind == "f":
        # A NaN that is really present is not the same thing as a missing
        # value to is_null, so leave those to the per-row path.
        return "other" if series.isna().any() else "numeric"
    if kind != "O":
        return "other"

    missing = series.isna()
    if missing.any() and any(v is not None for v in series[missing]):
        return "other"  # NaN / pd.NA mixed in with objects

    inferred = pd.api.types.infer_dtype(series, skipna=True)
    if inferred == "string":
        return "string"
    if inferred in ("integer", "floating", "mixed-integer-float"):
        return "numeric"

    non_null = series[~missing]
    if len(non_null) and all(isinstance(v, list) for v in non_null):
        return "list"
    return "other"


def make_column(series: pd.Series, candidates: pd.Index) -> Column:
    pos = series.index.get_indexer(candidates)
    found = pos >= 0
    kind = _classify(series)

    if kind == "other":
        return Column(kind, None, np.zeros(len(candidates), dtype=bool))

    safe_pos = np.where(found, pos, 0)
    if kind == "numeric":
        values = series.astype("float64").to_numpy()[safe_pos]
        values = np.where(found, values, np.nan)
        return Column(kind, values, found & ~np.isnan(values))

    values = series.to_numpy(dtype=object)[safe_pos]  # fancy indexing: a copy
    values[~found] = None
    return Column(kind, values, found & ~pd.isna(values))


def _is_number(x: Any) -> bool:
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def _var_name(node: Any) -> Optional[str]:
    if isinstance(node, dict) and len(node) == 1:
        name = node.get("var")
        if isinstance(name, str):
            return name
    return None


class VectorizedEvaluator:
    def __init__(
        self,
        candidate_ids: list,
        get_column: Callable[[str], Optional[Column]],
        fallback: Callable[[Any], Mask],
    ):
        """
        `get_column(name)` returns the aligned Column for a var, or None if
        there is no such var. `fallback(node)` evaluates a subtree row by row
        and returns its truthiness as a mask.
        """
        self._n = len(candidate_ids)
        self._get_column = get_column
        self._fallback = fallback

    def mask(self, node: Any) -> Mask:
        if not isinstance(node, dict):
            # A literal used as an operand: jsonLogic returns it as is.
            return np.full(self._n, bool(node))
        if len(node) != 1:
            return self._fallback(node)

        op, raw = next(iter(node.items()))
        args = list(raw) if isinstance(raw, (list, tuple)) else [raw]

        if op in ("and", "or"):
            masks = [self.mask(a) for a in args]
            if not masks:
                return np.full(self._n, op == "and")
            reducer = np.logical_and if op == "and" else np.logical_or
            return reducer.reduce(masks)

        if op == "!" and len(args) == 1:
            return ~self.mask(args[0])

        result = self._leaf(op, args)
        return self._fallback(node) if result is None else result

    def _leaf(self, op: str, args: list) -> Optional[Mask]:
        if op in ("is_null", "not_null"):
            if len(args) != 1:
                return None
            name = _var_name(args[0])
            col = self._column(name)
            if col is None:
                return None
            return ~col.present if op == "is_null" else col.present.copy()

        if len(args) != 2:
            return None

        name_left, name_right = _var_name(args[0]), _var_name(args[1])
        if name_left is not None and not isinstance(args[1], dict):
            name, literal, var_left = name_left, args[1], True
        elif name_right is not None and not isinstance(args[0], dict):
            name, literal, var_left = name_right, args[0], False
        else:
            return None

        col = self._column(name)
        if col is None:
            return None

        if op == "==":
            return self._equals(col, literal)
        if op in _COMPARISONS:
            return self._compare(op, col, literal, var_left)
        if op in ("in", "in_context") and var_left:
            return self._contained(op, col, literal)
        if op == "has_any":
            # Symmetric, so the side the var is on doesn't matter.
            return self._has_any(col, literal)
        return None

    def _column(self, name: Optional[str]) -> Optional[Column]:
        if name is None:
            return None
        col = self._get_column(name)
        if col is None or col.kind == "other":
            return None
        return col

    def _equals(self, col: Column, literal: Any) -> Optional[Mask]:
        # soft_equals compares str(a) == str(b) whenever either side is a
        # string, so the literal "None" would equal a missing value, and a
        # string literal would equal a number's repr. Only the unambiguous
        # same-type cases are vectorized.
        if col.kind == "string" and isinstance(literal, str) and literal != "None":
            return np.asarray(col.values == literal, dtype=bool)
        if col.kind == "numeric" and _is_number(literal):
            return np.asarray(col.values == literal, dtype=bool)
        return None

    def _compare(
        self, op: str, col: Column, literal: Any, var_left: bool
    ) -> Optional[Mask]:
        if col.kind != "numeric" or not _is_number(literal):
            return None
        assert col.values is not None
        a, b = (col.values, literal) if var_left else (literal, col.values)
        with np.errstate(invalid="ignore"):
            # NaN (missing) compares False everywhere, which is what the
            # per-row path's "float(None) raised, so False" amounts to.
            if op == "<":
                out = a < b
            elif op == "<=":
                out = (a < b) | (a == b)
            elif op == ">":
                out = b < a
            else:
                out = (b < a) | (a == b)
        return np.asarray(out, dtype=bool)

    def _contained(self, op: str, col: Column, literal: Any) -> Optional[Mask]:
        if not isinstance(literal, list):
            # `in` against a string means substring; in_context against a
            # non-list is always False.
            return np.zeros(self._n, dtype=bool) if op == "in_context" else None

        assert col.values is not None
        if col.kind == "list":
            return self._overlaps(col, literal) if op == "in_context" else None
        if col.kind == "string" and all(isinstance(x, str) for x in literal):
            return np.asarray(pd.Series(col.values).isin(literal), dtype=bool)
        if col.kind == "numeric" and all(_is_number(x) for x in literal):
            return np.isin(col.values, literal)
        return None

    def _has_any(self, col: Column, literal: Any) -> Optional[Mask]:
        if not isinstance(literal, list) or col.kind in ("string", "numeric"):
            # Both operands must be lists for there to be an overlap.
            return np.zeros(self._n, dtype=bool)
        return self._overlaps(col, literal)

    def _overlaps(self, col: Column, literal: list) -> Optional[Mask]:
        assert col.values is not None
        try:
            wanted = set(literal)  # built once, not once per candidate
            out = np.zeros(self._n, dtype=bool)
            for i in np.flatnonzero(col.present):
                out[i] = not wanted.isdisjoint(col.values[i])
        except TypeError:
            # Unhashable elements. Let the per-row path raise its usual error.
            return None
        return out
