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
        self.cache = {}
        self.get_slice_data = get_slice_data

    def is_match(self, entity_label: str):
        """
        This evaluates `expr` against a given `entity_label`. It returns
        True/False depending on if `entity_label` satifies the conditions of
        the expression, including any variables ("var" subexpressions) which
        are bound by using a magic dict that does lookups lazily.
        """
        data = _LazyContextDict(
            self.context_type, entity_label, self.cache, self.get_slice_data
        )

        try:
            return jsonLogic(self.expr, data)
        except (TypeError, ValueError) as e:
            print("Exception evaluating", self.expr, "against", entity_label)
            print(e)
            return False


# Interesting thread on overriding the Dict class:
# https://stackoverflow.com/questions/3387691/how-to-perfectly-override-a-dict
# But we don't need to "perfectly" override it; just well enough to trick the
# JsonLogic library.
class _LazyContextDict(dict):
    def __init__(
        self,
        context_type: str,
        entity_label: str,
        cache: dict,
        get_slice_data: Callable[[str], dict[str, Any]],
    ):
        self.context_type = context_type
        self.entity_label = entity_label
        self.cache = cache
        self.get_slice_data = get_slice_data

    def __getitem__(self, prop):
        # Handle trivial case where we're just looking up an entity's own label
        if prop == "entity_label":
            return self.entity_label

        if prop.startswith("slice/"):
            if prop not in self.cache:
                self.cache[prop] = self.get_slice_data(prop)

            return self.cache[prop][self.entity_label]

        raise LookupError(
            f"Unable to find context property '{prop}'. Are you sure a corresponding "
            f"dataset exists and can be looked up by {self.context_type}?"
        )

    # We don't want our virtual dictionary to appear empty.
    # Otherwise, the JsonLogic library will stomp it out with an empty default dict:
    # https://github.com/nadirizr/json-logic-py/blob/master/json_logic/__init__.py#L180
    def __bool__(self):
        return True


def _encode_dots_in_vars(expr):
    def walk(node, key):
        if isinstance(node, dict):
            return {k: walk(v, k) for k, v in node.items()}
        if isinstance(node, list):
            return [walk(x, key) for x in node]
        if key == "var":
            # URL-encode any dots. Otherwise, JsonLogic thinks they are
            # property lookups.
            return node.replace(".", "%2E")

        return node

    return walk(expr, None)


def decode_slice_id(slice_id) -> tuple[str, str, str]:
    """
    Based on the function of the same name from SliceSerializer but we don't
    enforce that feature_type is of type SliceRowType. That way we can handle
    novel feature types like the "transpose_label".

    Data Explorer 2 slice ids are a superset of legacy slice ids.
    One difference is that DE2 slice ids can include "transpose_label"
    as a feature type, which indicates that the result should be transposed.
    "transpose_label" is used similarly to the "depmap_model" feature type in slice ids.
    """
    parts = slice_id.split("/")
    assert (
        parts[0] == "slice" and len(parts) >= 4 and len(parts) <= 5
    ), f"Malformed slice_id: {slice_id}"

    if len(parts) == 5:
        # handle dataset IDs with slashes in them
        parts[1:3] = ["/".join(parts[1:3])]

    dataset_id = unquote(parts[1])
    feature = unquote(parts[2])
    feature_type = unquote(parts[3])

    return dataset_id, feature, feature_type
