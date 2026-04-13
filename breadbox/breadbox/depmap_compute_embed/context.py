from dataclasses import dataclass

# Note: There is another python implementation of JsonLogic floating out there.
# It looks very robust but it's 10 times slower! I've decided against using it
# but it serves as a good reference for patching operators:
# https://github.com/panzi/panzi-json-logic
from json_logic import jsonLogic, operations  # type: ignore
import pandas as pd
from typing import Callable

from breadbox.depmap_compute_embed.slice import SliceQuery


# Custom JsonLogic operators
operations.update(
    {
        # a more convenient version of { "!": { "in": [...] } }
        "!in": lambda a, b: not operations["in"](a, b),
        # tests if list `a` overlaps with list `b`
        "has_any": (
            lambda a, b: not set(a).isdisjoint(set(b))
            if isinstance(a, list) and isinstance(b, list)
            else False
        ),
        "!has_any": (
            lambda a, b: set(a).isdisjoint(set(b))
            if isinstance(a, list) and isinstance(b, list)
            else True
        ),
        # Note: {"context": "<name>"} references are not standard JsonLogic.
        # They are resolved during ContextEvaluator.__init__ by
        # _resolve_context_refs, which recursively evaluates the named
        # context and replaces the node with a flat list of matching IDs
        # before any expression evaluation occurs.
    }
)


@dataclass
class ContextMatch:
    """Result of evaluating a context."""

    ids: list[str]
    labels: list[str]
    num_candidates: int


def _dict_to_slice_query(d: dict) -> SliceQuery:
    """Convert a raw dict (from a deserialized Context) to a SliceQuery dataclass,
    including any nested reindex_through chain."""
    identifier_type = d["identifier_type"]
    if hasattr(identifier_type, "value"):
        identifier_type = identifier_type.value

    reindex_through = None
    if d.get("reindex_through") is not None:
        reindex_through = _dict_to_slice_query(d["reindex_through"])
    return SliceQuery(
        dataset_id=d["dataset_id"],
        identifier=d["identifier"],
        identifier_type=identifier_type,
        reindex_through=reindex_through,
    )


class ContextEvaluator:
    """
    Instantiated for a specific context.
    Eagerly loads slice data and resolves any nested context references.
    For context examples, see tests.
    """

    def __init__(
        self,
        context: dict,
        get_slice_data: Callable[[SliceQuery], pd.Series],
        get_labels_by_id: Callable[[str], dict[str, str]],
        max_depth: int = 5,
    ):
        """
        A `context` dict should have:
            - a `dimension_type` such as "gene" or "gene_pair"
            - an `expr` such as { "==": [ { "var": "var1" }, "Breast" ] }
            - a dictionary of `vars` which assigns names to slice queries, such as
              {
                  "var1": {
                      "dataset_id": "depmap_model_metadata",
                      "identifier": "OncotreeLineage",
                      "identifier_type": "column"
                  }
              }
              Vars may also include a `reindex_through` field for FK-chain traversal:
              {
                  "var1": {
                      "dataset_id": "depmap_model_metadata",
                      "identifier": "OncotreeLineage",
                      "identifier_type": "column",
                      "reindex_through": {
                          "dataset_id": "screen_metadata",
                          "identifier": "ModelID",
                          "identifier_type": "column"
                      }
                  }
              }
            - an optional dictionary of `contexts` which assigns names to nested
              context definitions. These are referenced in `expr` via
              { "context": "<name>" } and resolve to a list of matching IDs.

        Example using a nested context:
            {
                "dimension_type": "gene_pair",
                "expr": { "in": [ { "var": "gene_1" }, { "context": "selective" } ] },
                "vars": { "gene_1": { "dataset_id": "...", ... } },
                "contexts": {
                    "selective": {
                        "dimension_type": "gene",
                        "expr": { "==": [ { "var": "0" }, "strongly selective" ] },
                        "vars": { "0": { "dataset_id": "...", ... } }
                    }
                }
            }
        """
        if max_depth <= 0:
            raise ValueError("Maximum context nesting depth exceeded")

        self.dimension_type = context["dimension_type"]
        self.expr = _encode_dots_in_vars(context["expr"])
        slice_query_vars = _escape_dots(context.get("vars", {}))

        # Stored for recursive construction of inner contexts
        self._get_slice_data = get_slice_data
        self._get_labels_by_id = get_labels_by_id
        self._max_depth = max_depth

        # Eagerly load all slice data as {var_name: {given_id: value}} dicts
        self.slice_data: dict[str, dict] = {}
        for var_name, raw_query in slice_query_vars.items():
            try:
                slice_query = _dict_to_slice_query(raw_query)
                self.slice_data[var_name] = get_slice_data(slice_query).to_dict()
            except (KeyError, TypeError, ValueError) as e:
                raise LookupError(e) from e

        # Resolve { "context": "<name>" } references into flat ID lists
        self.expr = self._resolve_context_refs(self.expr, context.get("contexts", {}))

        # Validate that all var references in the expression are defined
        _validate_var_refs(self.expr, self.slice_data)

    def evaluate(self) -> ContextMatch:
        """
        Returns all matching IDs and labels for this context's dimension_type.
        """
        all_labels_by_id = self._get_labels_by_id(self.dimension_type)
        matching_ids = []
        matching_labels = []
        for given_id, label in all_labels_by_id.items():
            if self._is_match(given_id):
                matching_ids.append(given_id)
                matching_labels.append(label)

        return ContextMatch(
            ids=matching_ids,
            labels=matching_labels,
            num_candidates=len(all_labels_by_id),
        )

    def _evaluate_ids(self) -> list[str]:
        """Used internally for resolving nested context references."""
        all_labels_by_id = self._get_labels_by_id(self.dimension_type)
        return [cid for cid in all_labels_by_id if self._is_match(cid)]

    def _is_match(self, given_id: str) -> bool:
        """
        Evaluates `expr` for a `given_id`. Missing slice values are passed
        as None, letting JsonLogic handle them according to operator semantics.
        """
        data: dict = {"given_id": given_id}
        for var_name, slice_values in self.slice_data.items():
            data[var_name] = slice_values.get(given_id)

        try:
            return bool(jsonLogic(self.expr, data))
        except (ValueError, TypeError) as e:
            raise ValueError(
                f"{e} (while evaluating given_id={given_id!r} with data={data!r})"
            ) from e

    def _resolve_context_refs(self, node, contexts: dict):
        """
        Walk the expression tree. When a { "context": "<name>" } node is found,
        look up the named context definition, recursively evaluate it, and
        replace the node with a flat list of matching IDs.
        """
        if isinstance(node, dict):
            if "context" in node:
                context_name = node["context"]
                try:
                    inner_context = contexts[context_name]
                except KeyError as e:
                    raise LookupError(
                        f"Context reference '{context_name}' not found in contexts"
                    ) from e

                inner_evaluator = ContextEvaluator(
                    inner_context,
                    self._get_slice_data,
                    self._get_labels_by_id,
                    max_depth=self._max_depth - 1,
                )
                # pylint: disable-next=protected-access
                result = inner_evaluator._evaluate_ids()
                return result

            return {k: self._resolve_context_refs(v, contexts) for k, v in node.items()}

        if isinstance(node, list):
            return [self._resolve_context_refs(x, contexts) for x in node]

        return node


def _encode_dots_in_vars(expr: dict):
    """
    URL-encode any dots in variables. Otherwise, JsonLogic thinks they are property lookups.
    This was important back when we would use slice IDs as var names. Example:
    { "var": "slice/msi-0584.6%2Fmsi/CCLE (NGS)/label" }
    This is no longer much of an issue because the UI now generates simplified var names.
    """

    def walk(node, key):
        if isinstance(node, dict):
            return {k: walk(v, k) for k, v in node.items()}
        if isinstance(node, list):
            return [walk(x, key) for x in node]
        if key == "var":
            return node.replace(".", "%2E")

        return node

    return walk(expr, None)


def _escape_dots(d: dict) -> dict:
    """
    Return a new dict with all dots in keys replaced by %2E. This is the complement to
    _encode_dots_in_vars, ensuring entries in the `slice_query_vars` dict will match
    those found in { "var": "..." } expressions.
    """
    return {
        (k.replace(".", "%2E") if isinstance(k, str) else k): v for k, v in d.items()
    }


def _collect_vars(expr) -> set[str]:
    """Extract all {"var": "<name>"} references from a JsonLogic expression."""
    if isinstance(expr, dict):
        if "var" in expr:
            return {expr["var"]}
        return set().union(*(_collect_vars(v) for v in expr.values()))
    if isinstance(expr, list):
        return set().union(*(_collect_vars(x) for x in expr), set())
    return set()


def _validate_var_refs(expr, slice_data: dict):
    """Raise LookupError if the expression references any undefined variables."""
    for name in _collect_vars(expr):
        if name != "given_id" and name not in slice_data:
            defined = ", ".join(sorted(slice_data.keys())) or "(none)"
            raise LookupError(
                f"Expression references var '{name}' but it is not defined "
                f"in 'vars'. Defined vars: {defined}"
            )
