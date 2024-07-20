from flask import Blueprint, jsonify, request, abort
from .util import set_value, get_value
from depmap.extensions import csrf_protect

blueprint = Blueprint("cas", __name__, url_prefix="/cas", static_folder="../static")

# end points for storing small amounts of state in content-addressable-storage
@blueprint.route("/", methods=["POST"])
@csrf_protect.exempt
def cas_set():
    value = request.form["value"]
    key = set_value(value)
    return jsonify({"key": key})


@blueprint.route("/<key>")
def cas_get(key):
    value = get_value(key)
    if value is None:
        abort(404)
    return jsonify({"value": value})
