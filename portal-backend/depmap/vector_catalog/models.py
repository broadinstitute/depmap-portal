import re
import inspect
from typing import Dict
import urllib.parse
from enum import Enum
from depmap.utilities.exception import ApiNodeNotFound

# Used for IDs which represent terminal ids
# Format: slice/interactive dataset key/interactive feature identifier/slice row type
SLICE_ID_PATTERN = re.compile("slice/([^/]+)/([^/]+)/([^/]+)")


class SliceRowType(Enum):
    entity_id = "entity_id"
    label = "label"


class NodeType(Enum):
    static = "static"
    dynamic = "dynamic"


class NodeTemplate:
    def __init__(
        self, key, node_factory: "NodeFactory", children=[], visible_from_parent=True
    ):
        """
        :param visible_from_parent: Used for custom. Custom should not be available when asking what are the children of root. However, it should be visible if you have a url to a custom dataset.
        """
        self.key = key
        self.node_factory = node_factory  # put on node factory
        self.__all_children_including_invisible = children
        self.visible_from_parent = visible_from_parent

    def get_children(
        self, show_invisible=False
    ):  # get children with optional param, default to only visible
        if show_invisible:
            return self._get_all_children_including_invisible()
        else:
            return [
                child
                for child in self.__all_children_including_invisible
                if child.visible_from_parent
            ]

    def _get_all_children_including_invisible(self):
        return self.__all_children_including_invisible


class Node:
    def __init__(
        self,
        id,
        key,
        attrs,
        is_terminal,
        label,
        value,
        children_list_type=None,
        children_category=None,
        url=None,
        group=None,
        sort_key=None,
        persist_child_if_not_found=False,
    ):
        # def __init__(self, encode_id, key, attrs, label, value, type, is_terminal, children_category=None, url=None, group=None):
        # remove if self.children_list_type check in type_str
        assert attrs is not None

        if is_terminal:
            assert children_list_type is None and children_category is None
        else:
            assert children_list_type and children_category

        if persist_child_if_not_found:
            # must be prepopulate for persisting child if not found. not saying it won't work for dynamic, just haven't tried/thought about it
            assert children_list_type == NodeType.static

        self.id = id
        self.key = key
        self.attrs = attrs
        self.is_terminal = is_terminal
        self.label = label
        self.value = value
        self.children_list_type = children_list_type
        self.children_category = children_category
        self.url = url
        self.group = group
        self.sort_key = sort_key
        self.persist_child_if_not_found = persist_child_if_not_found

    def __eq__(self, other):
        return (
            self.id == other.id
            and self.key == other.key
            and self.attrs == other.attrs
            and self.is_terminal == other.is_terminal
            and self.label == other.label
            and self.value == other.value
            and self.children_list_type == other.children_list_type
            and self.children_category == other.children_category
            and self.url == other.url
            and self.group == other.group
            and self.persist_child_if_not_found == other.persist_child_if_not_found
        )

    @property
    def children_list_type_str(self):
        if self.children_list_type:
            return self.children_list_type.name
        return None


class NodeFactory:
    def __init__(
        self,
        shared_parent_attr_names,
        added_attr_names,
        is_terminal,
        children_list_type=None,
        children_category=None,
        persist_child_if_not_found=False,
    ):
        """
        Note: see function comments for which functions should be implemented by subclasses

        shared parent attrs as split out so that in the initializing walk of the tree, we can verify that shared parent attrs have been specified correctly by asserting that it matches the all attrs of the parent node
        :param shared_parent_attr_names: List of attrs from all parents
        :param added_attr_names: List of attrs added by this node layer
        :param is_terminal: Whether this node layer is terminal
        :param children_list_type: a NodeType, whether all children of this layer should be retrieved at once (static), or looked up by prefix (dynamic)
        :param children_category: string, or function that takes in attrs. used in front end in the placeholder
        """
        if is_terminal:
            # superclass implements this. this probably isn't a nice way to organize things
            assert hasattr(
                self, "get_attrs_from_slice_id"
            )  # terminal node must implement method to get all attrs of self and parent
            assert hasattr(
                self, "get_slice_id"
            )  # terminal node must implement method to get interactive-style id (currently slice id)
            assert not children_list_type and not children_category
        else:
            # these are properties on NodeFactory so that we can assert them in the construction of NodeFactory,
            # which happens on construction of the tree. meaning we can test validity just by ensuring that we can construct the tree
            assert children_list_type and children_category
            assert isinstance(children_list_type, NodeType)

        self.shared_parent_attr_names = shared_parent_attr_names
        self.added_attr_names = added_attr_names
        self.is_terminal = is_terminal
        self.children_list_type = children_list_type
        self.children_category = children_category
        self.persist_child_if_not_found = persist_child_if_not_found

    # Implement in subclass
    def get_added_attrs(self, prefix, limit, *rest):
        """
        Returns a list of dictionaries (added attrs) that provide information needed to call create

        The function signature differs when implementing this in a subclass:
            1) the presence of prefix and limit in the function signature indicates whether the NodeFactory is prepopulate
                If there are few enough options in this NodeFactory that the user should see all of them at once, then prefix and limit should not be in the signature
                If there are many options and the user should type to make API calls to retrieve only created Nodes that match what they typed, then prefix and limit should be included in the signature.
                    prefix represents what the user types
            2) *rest is any parent attrs needed to determine what nodes should be created

            e.g., imagine a path gene -> SOX10 -> dataset
            The NodeFactory for the dataset tier should only create datasets that have the gene SOX10
            There are also only a small number of datasets
            Thus, the function signature would look like
                def get_added_attrs(self, gene_id):
        """
        raise NotImplementedError(
            "Attempted to call get_added_attrs on base NodeFactory class"
        )

    # Implement in subclass
    def create(self, tree_id_encoder, key, *all_attrs):
        """
        Takes in attrs, and returns a Node computed from the attrs

        *all_attrs is all shared parent attrs, plus any attrs added in this NodeFactory by get_added_attrs
        """
        # returns a Node computed from attrs
        raise NotImplementedError("Attempted to call create on base NodeFactory class")

    # Implement get_slice_id in subclass if terminal
    def get_slice_id_tombstone_marker(self, attrs):
        """
        This function exists only for documentation of def get_slice_id. See below for why this is not named get_slice_id

        get_slice_id
            This function takes in attrs and returns a slice id
            This must be implemented if a NodeFactory is terminal, and must _not_ be implemented if it is not

            attrs is a dictionary, of the necessary pieces of identifying information for a tree node. Its properties are used to identify a node to create, within a NodeFactory tier. Typically the further down a node is in the tree, the more attrs it has.
            slice_id is a string, with identifying information for the interactive module. See SliceSerializer

            By converting attrs -> slice id, this function converts from the tree module identifier necessary to encode tiers of nodes, to the interactive module identifier necessary to access data.
            It is called when creating terminal nodes

        Note about different function name:
            NodeFactory SHOULD NOT implement get_slice_id and get_attrs_from_slice_id functions, even if the implementation raises NotImplementedErrors.
            There is a check on the NodeFactory constructor for these methods, so that the lack of implementation of these methods is caught upon hitting the tree root, without the methods having to be called. Implementing them with NotImplementedError here tricks the constructor check so that it slips through, can hit the children of the root but runs into an error getting the parent of this.

        """
        raise NotImplementedError(
            "This exists only for documentation of get_slice_id and should not be called."
            "get_slice_id (not the tombstone marker) should be implemented if a NodeFactory is terminal."
        )

    # Implement get_attrs_from_slice_id in subclass if terminal
    def get_attrs_from_slice_id_tombstone_marker(self, slice_id):
        """
        This function exists only for documentation of def get_attrs_from_slice_id. See below for why this is not named get_attrs_from_slice_id

        get_attrs_from_slice_id
            This function takes in a slice id and returns attrs
            This must be implemented if a NodeFactory is terminal, and must _not_ be implemented if it is not

            This does the opposite of get_slice_id, and converts from interactive module identifier -> tree identifier necessary to reconstruct the tiers of nodes
            This is called when given a child terminal node, asking for the path of parent nodes up to the root.

        The implementation of this function has the following contract:
            If the slice id is one that this NodeFactory would create, return all the attrs it would have
            If this slice id does not belong to this NodeFactory, return None

        Code for whether a slice id "belongs" to this NodeFactory should closely mirror the code in get_added_attrs.
            get_added_attrs defines what nodes this factory creates
            while get_attrs_from_slice_id tells whether the node slice id was created by this factory

        When getting a path from a terminal child to the root, this function is called on every terminal NodeFactory until one returns a dict of attrs instead of None.


        Note about different function name:
            NodeFactory SHOULD NOT implement get_slice_id and get_attrs_from_slice_id functions, even if the implementation raises NotImplementedErrors.
            There is a check on the NodeFactory constructor for these methods, so that the lack of implementation of these methods is caught upon hitting the tree root, without the methods having to be called. Implementing them with NotImplementedError here tricks the constructor check so that it slips through, can hit the children of the root but runs into an error getting the parent of this.

        """
        raise NotImplementedError(
            "This exists only for documentation of get_attrs_from_slice_id and should not be called."
            "get_attrs_from_slice_id (not the tombstone marker) should be implemented if a NodeFactory is terminal."
        )

    @property
    def all_attr_names(self):
        return self.shared_parent_attr_names + self.added_attr_names

    def get_attrs(self, values_pool):
        """
        Formats a dictionary of attrs, verifying that expected attrs are present
        :param values_pool: dict that contains, among other things, key value pairs of attrs
        :return: dict where keys are attr names and values are atr values (filtered relative to values_pool)
        """
        return {attr_name: values_pool[attr_name] for attr_name in self.all_attr_names}

    def create_node(
        self, encode_id, key, attrs, label, value, url=None, group=None, sort_key=None
    ):
        """
        Wrapper around the Node constructor for superclasses to call, that automatically fills in the
        is_terminal, children_list_type and children_category from NodeFactory properties
        """
        if inspect.isfunction(self.children_category):
            children_category = self.children_category(attrs)
        else:
            children_category = self.children_category

        if self.is_terminal:
            # slice-style id if terminal
            node_id = self.get_slice_id(attrs)
            assert (
                self.get_attrs_from_slice_id(node_id) is not None
            ), "NodeFactory {} generated slice id {} that is not recognized by its get_attrs_from_slice_id".format(
                key, node_id
            )
        else:
            # tree-style id if not
            # backwards correctness of tree-style id is reliant on mutual correctness of serializer encode/decode
            node_id = encode_id(key, attrs)

        return Node(
            node_id,
            key,
            attrs,
            self.is_terminal,
            label,
            value,
            self.children_list_type,
            children_category,
            url,
            group,
            sort_key,
            self.persist_child_if_not_found,
        )


class SingleNodeFactory(NodeFactory):
    def __init__(
        self,
        label,
        is_terminal,
        value,
        children_list_type=None,
        children_category=None,
        url=None,
        group=None,
        parent_attr_names=[],
    ):
        """
        This class cannot be used with is_terminal True without subclassing and implementing the get_slice_id and get_attrs_from_slice_id methods
        """
        NodeFactory.__init__(
            self,
            parent_attr_names,
            [],
            is_terminal,
            children_list_type,
            children_category,
        )
        self.label = label
        self.is_terminal = is_terminal
        self.value = value
        self.url = url
        self.group = group

    # Note: this class SHOULD NOT implement get_slice_id and get_attrs_from_slice_id functions, even if the implementation raises NotImplementedErrors.
    # see explanation on NodeFactory

    def get_added_attrs(self):
        return [{}]

    def create(self, tree_id_encoder, key):
        return self.create_node(
            tree_id_encoder,
            key,
            self.get_attrs(locals()),
            label=self.label,
            value=self.value,
            url=self.url,
            group=self.group,
        )


## functions for parsing/creating IDs


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


#### Class of tree


class Tree:
    def __init__(self, root, attr_types):
        self.root = root
        self.attr_types = attr_types
        self.by_key: Dict[str, NodeTemplate] = {}
        self.parent_by_key = {}
        self.attr_names_by_key = {}

        serializer = Serializer(self.get_attr_names)
        self.decode = serializer.decode
        self.encode = serializer.encode

        def walk(node_template, parent_template):
            assert node_template.key not in self.by_key, (
                "Detected duplicate node template key " + node_template.key
            )
            assert isinstance(node_template, NodeTemplate)
            parent_attr_names = []

            if parent_template is not None and parent_template.node_factory is not None:
                parent_attr_names = parent_template.node_factory.all_attr_names

            self.by_key[node_template.key] = node_template
            self.parent_by_key[node_template.key] = parent_template

            assert (
                parent_attr_names == node_template.node_factory.shared_parent_attr_names
            )  # make sure these are specified correctly
            self.attr_names_by_key[
                node_template.key
            ] = node_template.node_factory.all_attr_names

            for c in node_template.get_children(
                show_invisible=True
            ):  # this is okay because the walk registers keys, parents, attributes, and not children
                walk(c, node_template)

        walk(root, None)

    def get_attr_names(self, key):
        return self.attr_names_by_key[key]

    def get_node_template_by_key(self, key):
        return self.by_key[key]

    def get_parent_template_by_key(self, key):
        """
        :param key: key of the child to find the parent of
        """
        return self.parent_by_key[key]

    def _create_node(self, node_template, attrs):
        # return node_template.node_factory.create(self.encode, node_template.key, attrs)
        return node_template.node_factory.create(
            self.encode, node_template.key, **attrs
        )  # this makes explicit that these are all the params of the parent

    def _create_nodes(self, node_template, shared_parent_attrs, prefix, limit):
        """
        :param node_template: a NodeTemplate
        """

        def mk_result(attrs):
            _attrs = dict(shared_parent_attrs)
            _attrs.update(attrs)
            return self._create_node(node_template, _attrs)

        # depending on whether static/dynamic, the params may or may not include limit and prefix
        function_args = inspect.signature(
            node_template.node_factory.get_added_attrs
        ).parameters.keys()

        # # if dynamic, should not return anything until something is typed. otherwise this gives the impression that it is static
        # # we put this here, so that it does not need to be repeated in the get_added_attrs of every node factory
        # if "prefix" in function_args and "limit" in function_args and prefix == "":
        #     return []

        bound_args = {
            **shared_parent_attrs,
            **dict(limit=limit, prefix=prefix),
        }  # must create a new dictionary, otherwise we modify the attrs being passed

        # look up attrs for these nodes based on parent's attrs
        added_attrs = node_template.node_factory.get_added_attrs(
            **{k: bound_args[k] for k in function_args}
        )
        return [mk_result(x) for x in added_attrs]

    def _create_node_from_slice_id(self, slice_id):
        node = None
        for _, template in self.by_key.items():
            if template.node_factory.is_terminal:
                attrs = template.node_factory.get_attrs_from_slice_id(slice_id)
                if attrs is not None:
                    # assert that only one node recognizes this slice id
                    assert (
                        node is None
                    ), "Slice id {} was recognized by multiple node templates: {} and {}".format(
                        slice_id, node.key, template.key
                    )
                    node = self._create_node(template, attrs)

        if node is None:
            raise ApiNodeNotFound(
                "Slice id " + slice_id + " was not recognized by any NodeFactory"
            )
        else:
            return node

    def get_node(self, node_id):
        key, attrs = self.decode(node_id, self.attr_types)
        node_template = self.get_node_template_by_key(key)
        return self._create_node(node_template, attrs)

    def get_children(self, node_id, prefix="", limit=20):
        """
        Can't do Node.children because a node has no way to getting its template. Only the tree knows its template.

        :param node_id: id of a Node object
        :return: list of Node objects that are the children of the node with the specified node_id
        """

        key, attrs = self.decode(node_id, self.attr_types)
        node_template = self.get_node_template_by_key(key)

        children = []

        for child_template in node_template.get_children():
            child_nodes = self._create_nodes(child_template, attrs, prefix, limit)
            children.extend(child_nodes)

        # sort by sort_key if provided, putting nodes with sort_key None at the back
        # None is not orderable, so first sort by whether with value is none
        # Somehow it doesn't attempt to compare the second half, maybe because the equals operator works with None
        children.sort(key=lambda x: (x.sort_key is None, x.sort_key))

        return children

    def get_parent(self, child_key, child_attrs):
        """
        :param child_key: key of child node
        :param child_attrs: attrs of child node
        key and attrs are used instead of node_id to identify a node, because the id of terminal nodes is a slice id that does not have enough information (without asking for the key and attrs) to create the node. Instead we just ask for the key and attrs
        :return: Node object that is the parent of the node with the specified node_id
        """
        parent_template = self.get_parent_template_by_key(child_key)
        parent_attr_names = self.attr_names_by_key[parent_template.key]
        attrs = {k: child_attrs[k] for k in parent_attr_names}
        return self._create_node(parent_template, attrs)

    def get_path_to_node(self, node_id):
        """
        Allows getting path from any point in the tree
        We can say that outside things know of simple enough things like genes/gene id?
        :param node_id:
        :return:
        """
        if SLICE_ID_PATTERN.match(node_id):
            node = self._create_node_from_slice_id(node_id)
        else:
            node = self.get_node(node_id)

        nodes = [node]

        while node.key != "root":
            node = self.get_parent(node.key, node.attrs)
            nodes.insert(0, node)

        return nodes
