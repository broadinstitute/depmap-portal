from depmap.access_control.utils.get_authorizations import get_authenticated_user
from flask import (
    Blueprint,
    render_template,
    request,
    redirect,
    url_for,
    abort,
    current_app,
    session,
)
from depmap.access_control import (
    set_user_override,
    get_current_user_for_access_control,
    is_current_user_an_admin,
)
from itsdangerous import Serializer

blueprint = Blueprint(
    "access_control", __name__, url_prefix="/access_control", static_folder="../static"
)


@blueprint.route("/opt_in", methods=["POST", "GET"])
def opt_in():
    "Allow users to opt-in to early access functionality by setting flag in session (used in settings.py)"
    if request.method == "POST":
        opt_in = request.values["opt_in"]
        session["EARLY_ACCESS"] = opt_in == "ON"
        # redirect to this same form so that we re-render with the value in the session set appropriately
        redirect(url_for("access_control.opt_in"))

    return render_template(
        "access_control/opt_in.html",
        early_access_enabled=current_app.config["ENABLED_FEATURES"].is_early_access(),
    )


@blueprint.route("/override", methods=["POST", "GET"])
def override():
    """
    Show user a form which allows admins to override user id
    """
    if not is_current_user_an_admin():
        return abort(404)
    if request.method == "POST":
        user_id = request.values["user_id"]
        set_user_override(user_id)
        res = redirect(url_for("access_control.override"))
        # Set a cookie if user override value given, else delete the cookie. This cookie value will be read in WSGI Middleware (see autoapp.py)
        actual_user = get_authenticated_user()
        if user_id == "" or user_id is None or actual_user == user_id:
            res.delete_cookie("breadbox_username_override")
            return res
        secret_key = current_app.config["SECRET_KEY"]  # type: ignore
        signed_user_val = str(Serializer(secret_key).dumps(user_id))
        res.set_cookie("breadbox_username_override", signed_user_val)
        return res

    return render_template(
        "access_control/override.html",
        current_override=get_current_user_for_access_control(),
    )
