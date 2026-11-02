from flask import Blueprint, redirect, render_template, request, url_for


blueprint = Blueprint(
    "resources_v3", __name__, url_prefix="/resources-v3", static_folder="../static"
)


@blueprint.route("/")
def index():
    # Old-style links looked like /resources-v3/?menu=<menu-slug>&post=<post-slug>.
    # Redirect those to /resources-v3/<post-slug>.
    post_slug = request.args.get("post")
    if post_slug:
        return redirect(url_for("resources_v3.post", post_slug=post_slug))

    return render_template("resources_v3/index.html")


@blueprint.route("/<post_slug>")
def post(post_slug):
    # The page is a React app which reads the post slug from the URL path.
    return render_template("resources_v3/index.html")
