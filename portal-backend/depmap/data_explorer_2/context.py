# Note: There is another python implementation of JsonLogic floating out there.
# It looks very robust but it's 10 times slower! I've decided against using it
# but it serves as a good reference for patching operators:
# https://github.com/panzi/panzi-json-logic
from json_logic import jsonLogic, operations  # type: ignore
from depmap.data_explorer_2.utils import slice_to_dict


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
    def __init__(self, context):
        """
        A `context` should have:
            - a `context_type` such as "depmap_model"
            - an `expr` such as { "==": [ { "var": "slice/lineage/1/label" }, "Breast" ] }
        """
        self.context_type = context["context_type"]
        self.expr = _encode_dots_in_vars(context["expr"])
        self.cache = {}

    def is_match(self, entity_label):
        """
        This evaluates `expr` against a given `entity_label`. It returns
        True/False depending on if `entity_label` satifies the conditions of
        the expression, including any variables ("var" subexpressions) which
        are bound by using a magic dict that does lookups lazily.
        """
        data = _LazyContextDict(self.context_type, entity_label, self.cache)

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
    def __init__(self, context_type, entity_label, cache):
        self.context_type = context_type
        self.entity_label = entity_label
        self.cache = cache

    def __getitem__(self, prop):
        # Handle trivial case where we're just looking up an entity's own label
        if prop == "entity_label":
            return self.entity_label

        if prop.startswith("slice/"):
            if prop not in self.cache:
                self.cache[prop] = slice_to_dict(prop)

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
