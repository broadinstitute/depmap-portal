import re
import urllib.parse
from enum import Enum

# This file only contains legacy slice ID parsing utilities. 
# For newer slice ID parsing methods, see: depmap-compute/depmap_compute/slice.py


# Used for IDs which represent terminal ids
# Format: slice/interactive dataset key/interactive feature identifier/slice row type
SLICE_ID_PATTERN = re.compile("slice/([^/]+)/([^/]+)/([^/]+)")


class SliceRowType(Enum):
    entity_id = "entity_id"
    label = "label"


class Serializer:
    def __init__(self, get_attr_names):
        self.get_attr_names = get_attr_names

    @staticmethod
    def quote(x):
        # safe indicates chars that should not be quoted, the default is '/'
        # setting safe lets us quote slashes
        return urllib.parse.quote(x, safe="")

    unquote = urllib.parse.unquote

    def encode(self, key, attrs):
        attr_names = self.get_attr_names(key)
        assert set(attrs.keys()) == set(attr_names)
        return "/".join([key] + [Serializer.quote(str(attrs[x])) for x in attr_names])

    def decode(self, node_id, attr_types):
        fields = node_id.split("/")
        key = fields[0]
        rest = [Serializer.unquote(x) for x in fields[1:]]
        names = self.get_attr_names(key)
        attrs = dict(zip(names, rest))
        for attr_name in attrs:
            if attr_name not in attr_types:
                raise KeyError("{} was not specified in attr types".format(attr_name))
            attrs[attr_name] = attr_types[attr_name](attrs[attr_name])
        return key, attrs


class SliceSerializer:
    @staticmethod
    def encode_slice_id(dataset, feature, slice_row_type):
        return "slice/{}/{}/{}".format(
            Serializer.quote(str(dataset)),
            Serializer.quote(str(feature)),
            slice_row_type.name,
        )

    @staticmethod
    def decode_slice_id(slice_id):
        m = SLICE_ID_PATTERN.match(slice_id)
        assert m, "Could not match id {}".format(slice_id)

        dataset_id = Serializer.unquote(m.group(1))
        feature = Serializer.unquote(m.group(2))
        feature_type = SliceRowType[m.group(3)]
        return dataset_id, feature, feature_type
