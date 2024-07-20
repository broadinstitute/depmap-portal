from depmap.vector_catalog.models import Serializer


def test_serializer_encode_decode():
    """
    Sharing variables to test both encode and decode lets us test that the output of one works as the input of the other, both ways
    """

    attrs = {"string_attr": "string/with/slashes", "int_attr": 1}

    def get_attr_names(key):
        return ["string_attr", "int_attr"]

    node_id = "key/string%2Fwith%2Fslashes/1"

    assert Serializer(get_attr_names).encode("key", attrs) == node_id

    attr_types = {"string_attr": str, "int_attr": int}
    assert Serializer(get_attr_names).decode(node_id, attr_types) == ("key", attrs)
