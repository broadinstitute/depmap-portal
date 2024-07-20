from flask import abort, current_app
from flask_restplus import Namespace, Resource, fields

from depmap.access_control.utils import get_visible_owner_id_configs

namespace = Namespace("access_groups", description="Get access controls")


@namespace.route("/get")
class Private(
    Resource
):  # the flask url_for endpoint is automagically the snake case of the namespace prefix plus class name
    @namespace.marshal_with(
        namespace.model(
            "AccessGroup",
            {
                "displayName": fields.String(
                    description="Name of a group the user has access to"
                ),
                "description": fields.String(description="Group description"),
                "ownerId": fields.String(description="ID of the group"),
            },
        ),
        as_list=True,
    )
    def get(self):
        # Note: docstrings to restplus methods end up in the swagger documentation.
        # DO NOT put a docstring here that you would not want exposed to users of the API. Use # for comments instead
        """
        Returns list of access groups which you have access to upload to/access
        """
        if not current_app.config["ENABLED_FEATURES"].private_datasets:
            abort(404)

        valid_groups = get_visible_owner_id_configs().values()

        # return display name, decription, owner_id
        valid_groups_formatted = []
        for group in valid_groups:
            valid_groups_formatted.append(
                {
                    "displayName": group.display_name,
                    "description": group.description,
                    "ownerId": group.owner_id,
                }
            )

        return valid_groups_formatted
