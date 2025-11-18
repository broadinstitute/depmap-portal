# Note: There is another python implementation of JsonLogic floating out there.
# It looks very robust but it's 10 times slower! I've decided against using it
# but it serves as a good reference for patching operators:
# https://github.com/panzi/panzi-json-logic
from json_logic import jsonLogic, operations  # type: ignore
import pandas as pd
from typing import Any, Callable

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
    }
)


class ContextEvaluator:
    """
    Instantiated for a specific context. 
    Caches data for the slices referenced in the context (in memory).
    For context examples, see tests.
    """

    def __init__(
        self, context: dict, get_slice_data: Callable[[SliceQuery], pd.Series],
    ):
        """
        A `context` dict should have:
            - a `dimension_type` such as "depmap_model" (which is not used in this evaluator)
            - an `expr` such as { "==": [ { "var": "var1" }, "Breast" ] }
            - a set of `vars`, each of which assigns a name to a slice query
        """
        self.expr = _encode_dots_in_vars(context["expr"])
        self.slice_query_vars = _escape_dots(context.get("vars", {}))

        # Takes a slice query, returns a dictionary of slice values (indexed by ID)
        self.get_slice_data = get_slice_data

        # The cache is used so that slice values only need to be looked up once per context.
        # - The keys in this dictionary are slice queries encoded as a tuple
        #   (ex. `("Chronos_combined", "SOX10", "feature_label")`).
        # - The values are each an entire dictionary of slice values (indexed by given ID)
        self.cache = {}

    def is_match(self, given_id: str):
        """
        This evaluates `expr` against a `given_id`. It returns
        True/False depending on if `given_id` satifies the conditions of
        the expression, including any variables ("var" subexpressions) which
        are bound by using a magic dict (_JsonLogicVarLookup) that does lookups lazily.
        """
        dictionary_override = _JsonLogicVarLookup(
            given_id, self.cache, self.get_slice_data, self.slice_query_vars,
        )
        return jsonLogic(self.expr, dictionary_override)


class _JsonLogicVarLookup(dict):
    """
    Context expressions use `var` fields to load data on the fly. 
        For example, the following expression might be used to exclude certain given IDs from a query:
            - { "!in": [ { "var": "given_id" }, ["1", "2", "3"] ] }

    In order to populate these with real values, the JsonLogic library 
    wants to be passed a dictionary it can use to look up values by variable name. 

    However, we need to inject our own special cases and
    caching, so we override the dictionary class with special functionality.
    We don't need to "perfectly" override it; just well enough to trick the JsonLogic library.
    Interesting thread on overriding the Dict class:
    https://stackoverflow.com/questions/3387691/how-to-perfectly-override-a-dict
    """

    def __init__(
        self,
        given_id: str,
        cache: dict,
        get_slice_data: Callable[[SliceQuery], pd.Series],
        slice_query_vars: dict[str, dict[str, str]],
    ):
        self.given_id = given_id
        self.get_slice_data = get_slice_data
        # The cache is stored outside of this class so it can be reused.
        self.cache = cache
        self.slice_query_vars = slice_query_vars

    def __getitem__(self, var_name: str) -> Any:
        """
        Given a variable from the context definition, load the corresponding slice value. 
        Look up the value by the "given_id" that's already been passed into the constructor of this class.
        Context vars can be either:
        - a slice query (used to reference a dimension value)
        - the string "given_id" (used to reference an id)
        """
        # There is a special case where "given_id" may be specified instead of
        # a slice query. This allows our context definitions to reference ids, which
        # wouldn't otherwise be possible because slice queries are used to load dataset values.
        if var_name == "given_id":
            return self.given_id

        else:
            if var_name not in self.cache:
                try:
                    # fmt: off
                    slice_query = SliceQuery(
                        **self.slice_query_vars[var_name] # pyright: ignore
                    )
                    # fmt: on
                    self.cache[var_name] = self.get_slice_data(slice_query).to_dict()
                except (KeyError, TypeError, ValueError) as e:
                    raise LookupError(e)

            slice_values = self.cache[var_name]
            return slice_values[self.given_id]

    # We don't want our virtual dictionary to appear empty.
    # Otherwise, the JsonLogic library will stomp it out with an empty default dict:
    # https://github.com/nadirizr/json-logic-py/blob/master/json_logic/__init__.py#L180
    def __bool__(self):
        return True


class LegacyContextEvaluator:
    """
    DEPRECATED: Use `ContextEvaluator` for future development.
    This older version has a few differences from the new one:
    - Slices are specified using string slice IDs instead of slice queries
    - Matching on index is done with a field called "entity_label". For features, 
    this is expected to match the feature label. For samples, this matches on sample ID (not label).
    This confusing behavior is part of why we're deprecating the old version. 
    - the field "context_type" is used to specify the dimension type
    """

    def __init__(self, context: dict, get_slice_data: Callable[[str], dict[str, Any]]):
        """
        A `context` dict should have:
            - a `context_type` such as "depmap_model"
            - an `expr` such as { "==": [ { "var": "slice/lineage/1/label" }, "Breast" ] }
        """
        self.context_type = context["context_type"]
        self.expr = _encode_dots_in_vars(context["expr"])
        # Cache is keyed by Slice ID. Each value is an entire dictionary of slice values.
        self.cache = {}
        self.get_slice_data = get_slice_data

    def is_match(self, dimension_label: str):
        """
        This evaluates `expr` against a given `dimension_label`. It returns
        True/False depending on if `dimension_label` satifies the conditions of
        the expression, including any variables ("var" subexpressions) which
        are bound by using a magic dict that does lookups lazily.
        """
        dictionary_override = _LegacyLazyContextDict(
            self.context_type, dimension_label, self.cache, self.get_slice_data
        )

        try:
            return jsonLogic(self.expr, dictionary_override)
        except (TypeError, ValueError) as e:
            print("Exception evaluating", self.expr, "against", dimension_label)
            print(e)
            return False


class _LegacyLazyContextDict(dict):
    """
    The JsonLogic library wants to be passed a dictionary of values. However, we need to 
    inject our own special cases and caching, so we override the dictionary class with 
    special functionality. Interesting thread on overriding the Dict class:
    https://stackoverflow.com/questions/3387691/how-to-perfectly-override-a-dict
    But we don't need to "perfectly" override it; just well enough to trick the JsonLogic library.

    This implementation uses and updates the cache that's been passed in to the constructor.
    """

    def __init__(
        self,
        context_type: str,
        dimension_label: str,
        cache: dict,
        get_slice_data: Callable[[str], dict[str, Any]],
    ):
        self.context_type = context_type
        self.dimension_label = dimension_label
        self.cache = cache
        self.get_slice_data = get_slice_data

    def __getitem__(self, prop):
        """
        Given a slice ID, get the slice value which corresponds to the 
        "dimension_label" that's already been passed into the constructor of this class.
        """
        # Handle trivial case where we're just looking up a dimension's own
        # label. Note that this is called "entity_label" for historical
        # reasons.
        if prop == "entity_label":
            return self.dimension_label

        if prop.startswith("slice/"):
            if prop not in self.cache:
                self.cache[prop] = self.get_slice_data(prop)

            return self.cache[prop][self.dimension_label]

        raise LookupError(
            f"Unable to find context property '{prop}'. Are you sure a corresponding "
            f"dataset exists and can be looked up by {self.context_type}?"
        )

    # We don't want our virtual dictionary to appear empty.
    # Otherwise, the JsonLogic library will stomp it out with an empty default dict:
    # https://github.com/nadirizr/json-logic-py/blob/master/json_logic/__init__.py#L180
    def __bool__(self):
        return True


def _encode_dots_in_vars(expr: dict):
    """
    URL-encode any dots in variables. Otherwise, JsonLogic thinks they are property lookups.
    Example expression: { "==": [ { "var": "slice/lineage/1/label" }, "Breast" ] }
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
    """Return a new dict with all dots in keys replaced by %2E."""
    return {
        (k.replace(".", "%2E") if isinstance(k, str) else k): v for k, v in d.items()
    }
