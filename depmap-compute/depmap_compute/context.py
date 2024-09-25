# Note: There is another python implementation of JsonLogic floating out there.
# It looks very robust but it's 10 times slower! I've decided against using it
# but it serves as a good reference for patching operators:
# https://github.com/panzi/panzi-json-logic
from json_logic import jsonLogic, operations  # type: ignore
from typing import Any, Callable
from urllib.parse import unquote


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
    def __init__(self, context: dict, get_slice_data: Callable[[str], dict[str, Any]]):
        """
        A `context` should have:
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
        dictionary_override = _LazyLoadingSliceLookup(
            self.context_type, dimension_label, self.cache, self.get_slice_data
        )

        try:
            return jsonLogic(self.expr, dictionary_override)
        except (TypeError, ValueError) as e:
            print("Exception evaluating", self.expr, "against", dimension_label)
            print(e)
            return False


class _LazyLoadingSliceLookup(dict):
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

        # TODO: handle new-style slice IDs

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


def decode_slice_id(slice_id) -> tuple[str, str, str]:
    """
    Originally based on the function of the same name from vector_catalog.SliceSerializer,
    Data Explorer 2 slice ids are a superset of the legacy slice ids.
    Originally, slice IDs were formatted like "slice/some_dataset_id/some_feature_label/label", 
    or "slice/some_dataset_id/some_feature_id/entity_id", where the last part of the string
    (originally called the SliceRowType) specifies whether the feature is being identified by ID or by label. 

    The DE2 slice IDs give you flexibility by letting you query samples as well using the "transpose_label" specifier.
    When "transpose_label" is used as the last segment of the slice ID, it means we should query for samples.
    """
    parts = slice_id.split("/")
    assert (
        parts[0] == "slice" and len(parts) >= 4 and len(parts) <= 5
    ), f"Malformed slice_id: {slice_id}"

    if len(parts) == 5:
        # handle dataset IDs with slashes in them
        parts[1:3] = ["/".join(parts[1:3])]

    dataset_id = unquote(parts[1])
    dimension_identifier = unquote(parts[2])
    slice_type = unquote(parts[3])  # "label", "entity_id", or "transpose_label"

    return dataset_id, dimension_identifier, slice_type
