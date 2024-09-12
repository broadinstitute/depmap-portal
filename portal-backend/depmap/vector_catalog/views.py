from flask import abort, Blueprint, request
from flask_restplus import Api, Resource, fields

from depmap.breadbox_shim import breadbox_shim
from depmap.extensions import (
    csrf_protect,
    restplus_handle_exception,
)
from depmap.context.models import Lineage
from depmap.vector_catalog.models import SliceSerializer, NodeType
from depmap.vector_catalog.trees import InteractiveTree, Trees
from depmap.interactive import interactive_utils
from depmap.utilities import iter_utils
from depmap.utilities.exception import ApiNodeNotFound

blueprint = Blueprint("vector_catalog", __name__, url_prefix="/vector_catalog")
api = Api(
    blueprint,
    validate=True,
    decorators=[csrf_protect.exempt],
    title="DepMap internal APIs",
    version="1.0",
    description="These APIs are intended for internal use and may change without notice.",
)
api.errorhandler(Exception)(restplus_handle_exception)

VectorValues = api.model(
    "VectorValues",
    {
        "cellLines": fields.List(fields.String),
        "values": fields.List(fields.Float),
        "categoricalValues": fields.List(fields.String),
    },
)

Child = api.model(
    "Child",
    {
        "id": fields.String(description="The internal ID of the child entry"),
        "label": fields.String(
            description="The label to show users for the child entry"
        ),
        "childValue": fields.String(
            attribute="value",
            description="An identifier that is stable for the value of the object chosen, e.g. the same gene symbol across datasets or the same dataset name across a gene",
        ),
        "terminal": fields.Boolean(
            attribute="is_terminal",
            description="If true, then this can be selected as a vector. If false this entry is a collection of other entries",
        ),
        "url": fields.String(description="Link corresponding to selection"),
        "group": fields.String(
            description="Label of optional grouping that this child should be part of"
        ),
    },
)

node_info = {
    "children": fields.List(
        fields.Nested(Child),
        description="For the /children/ endpoint's response, this field contains child nodes. For the /path/ endpoint's response this contains sibling nodes, not children (be warned!)",
    ),
    "type": fields.String(
        attribute="children_list_type",
        description="If 'dynamic', the children will vary depending on the prefix provided. If 'static', present the user with an autocomplete box with callbacks to the server. If false, present a static list of options.",
    ),
    "category": fields.String(
        attribute="children_category",
        description="Used to fill in placeholder shown in the selection box",
    ),
    "persistChildIfNotFound": fields.Boolean(
        attribute="persist_child_if_not_found",
        description="Used to indicate that on this node level, the front end should keep selection on this node, even if the parent changes and it is no longer under the new parent's children",
    ),
}
Node = api.model("Node", node_info)

catalog_path = api.model(
    "CatalogPath",
    {
        **node_info,
        **{
            "selectedId": fields.String(
                attribute="selected_id", description="id of selected child"
            )
        },
    },
)


@api.route("/data/catalog/children")
@api.doc(False)
class CatalogChildren(
    Resource
):  # the flask url_for endpoint is automagically the snake case of the class name
    @api.marshal_with(Node)
    @api.doc(
        description="Used to lazily list the tree of all data which is available. This can be called "
        "with no arguments and you'll get the root of a tree which all data is listed under. For "
        "each child you can make an additional call to get its children and so on until you find a "
        "'terminal' which represents a data vector which you can fetch via '/data/vector/{id}'.",
        params={
            "catalog": {"description": "The tree to look in", "in": "query"},
            "id": {"description": "The parent ID to list options for", "in": "query"},
            "prefix": {
                "description": "A label prefix to filter the results by",
                "in": "query",
            },
        },
    )
    def get(self):
        id = request.values.get("id")
        prefix = request.values.get("prefix", "")
        catalog = request.values.get("catalog")
        limit = int(request.values.get("limit", "20"))

        if id == "root" and prefix == "":
            # this is a bit roundabout, but the goal is to call a separate (marked
            # memoized) function for the special case of the root because we return call this frequently
            return self._get_root_node(catalog, limit)
        elif id.startswith("breadbox/"):
            return breadbox_shim.get_vector_catalog_children(slice_id=id)
        else:
            legacy_result = self._get_node(catalog, id, prefix, limit)
            if id == "others":
                # Append breadbox datasets as children
                breadbox_nodes = breadbox_shim.get_dataset_nodes(catalog_type=catalog)
                legacy_result["children"].extend(breadbox_nodes)
            return legacy_result

    # we can't memoize this because user information leaks between sessions. I haven't investigated fully, but it
    # looks like OtherNodeFactory is resulting in a permission check. I think in practice this is just controlling whether we show the
    # folder "other" or not. Still, we should find a way that does this robustly without leaking state across session. (Maybe just _always_ show "other"?)
    # @memoized()
    def _get_root_node(self, catalog, limit):
        return self._get_node(catalog, "root", "", limit)

    def _get_node(self, catalog, id, prefix, limit):
        tree = Trees[catalog].value()
        node = tree.get_node(id)
        children = tree.get_children(id, prefix, limit)

        return {
            "children": children,
            "children_category": node.children_category,
            "children_list_type": node.children_list_type_str,
            "persist_child_if_not_found": node.persist_child_if_not_found,
        }

    # @cached(
    #     unless=lambda: request.values.get("id") != "root"
    #     or request.values.get("prefix", "") != ""
    # )


@api.route("/data/catalog/path")
@api.doc(False)
class CatalogPath(
    Resource
):  # the flask url_for endpoint is automagically the snake case of the class name
    @api.marshal_with(catalog_path, as_list=True)
    @api.doc(
        description="",
        params={
            "id": {"description": "", "in": "query"},
            "catalog": {"description": "The tree to look in", "in": "query"},
        },
    )
    def get(self):
        id = request.values.get("id")
        catalog = request.values.get("catalog")
        if id.startswith("breadbox/"):
            nodes = get_legacy_portal_catalog_path("others", catalog)[:1]
            legacy_nonstandard_datasets = Trees[catalog].value().get_children("others")
            breadbox_nodes = breadbox_shim.get_breadbox_catalog_path(
                slice_id=id,
                catalog=catalog,
                legacy_nonstandard_dataset_nodes=legacy_nonstandard_datasets,
            )
            nodes.extend(breadbox_nodes)
        else:
            nodes = get_legacy_portal_catalog_path(id, catalog)
            if nodes == []:
                return nodes, 404

            # If the response path descends from the "others" node, and contains dataset-level info
            if len(nodes) > 1 and nodes[0].get("selected_id") == "others":
                # append breadbox datasets to the second (dataset-level) node
                bb_dataset_nodes = breadbox_shim.get_dataset_nodes(catalog_type=catalog)
                nodes[1]["children"].extend(bb_dataset_nodes)
        return nodes


def get_legacy_portal_catalog_path(id: str, catalog: str) -> list[dict]:
    tree: InteractiveTree = Trees[catalog].value()
    try:
        selected_nodes = tree.get_path_to_node(id)
    except ApiNodeNotFound as e:
        return []
    return format_path(tree, selected_nodes)


def format_path(tree, selected_childs):
    """
    :param selected_childs: List of TreeChilds from (and including) root to the last selection. It includes root, but is TreeChilds instead of TreeNodes because we only guarantee that they are TreeChild instances
    """
    path = []

    for parent, selected in iter_utils.pairwise_with_repeat(selected_childs):
        if parent.children_list_type == NodeType.static:
            children = tree.get_children(parent.id)
            # if selected is not in children, append. this happens for custom, i.e. for when child should not be discoverable from parent.
            if selected.id not in {child.id for child in children}:
                children.append(selected)
        else:
            children = [selected]  # just fill the selected one

        path.append(
            {
                "children": children,
                "children_category": parent.children_category,
                "children_list_type": parent.children_list_type_str,
                "persist_child_if_not_found": parent.persist_child_if_not_found,
                "selected_id": selected.id,
            }
        )

    # handle if final is not terminal
    final_selected = selected_childs[-1]
    if not final_selected.is_terminal:
        children = tree.get_children(final_selected.id)
        path.append(
            {
                "children": children,
                "children_category": final_selected.children_category,
                "children_list_type": final_selected.children_list_type_str,
                "persist_child_if_not_found": final_selected.persist_child_if_not_found,
                "selected_id": "",
            }
        )
    return path


@api.route("/data/vector/<path:id>")
@api.doc(False)
class Vector(
    Resource
):  # the flask url_for endpoint is automagically the snake case of the class name
    @api.doc(
        description="Fetches values for a data vector given its ID. The ID must one marked as a terminal from the result of a query to '/data/catalog'"
    )
    @api.marshal_with(VectorValues)
    def get(self, id):
        series = interactive_utils.get_row_of_values_from_slice_id(id)
        dataset_id, row, row_type = SliceSerializer.decode_slice_id(id)
        cell_line_names = []
        values = []
        for cell_line, value in series.zipped_cell_line_value:
            if cell_line is not None:
                cell_line_names.append(cell_line.depmap_id)
                values.append(value)
        if interactive_utils.is_continuous(dataset_id):

            return {
                "cellLines": cell_line_names,
                "values": values,
                "categoricalValues": None,
            }
        else:
            if dataset_id == interactive_utils.get_lineage_dataset():
                values = [Lineage.get_display_name(x) for x in values]
            return {
                "cellLines": cell_line_names,
                "values": None,
                "categoricalValues": values,
            }
