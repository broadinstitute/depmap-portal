import click
from flask.cli import with_appcontext
from flask import current_app

from depmap.flask_turnstile.extension import sign_cookie_value


# the cli command here is used by depmap-post-deploy.sh in the depmap-deploy repo so that 
# the crawler can get past turnstile
@click.command("turnstile_bypass_token")
@with_appcontext
def turnstile_bypass_token():
    """
    Prints a signed PROBABLY_HUMAN cookie value if turnstile is enabled.
    """
    if current_app.config.get("TURNSTILE_SITE_KEY"):
        print(f"PROBABLY_HUMAN={sign_cookie_value(current_app)}")
