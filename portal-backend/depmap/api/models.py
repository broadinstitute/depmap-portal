from flask import url_for, current_app
from flask_restplus import Api


class ApiWithUrlScheme(Api):
    @property
    def specs_url(self):
        """Monkey patch for HTTPS"""
        return url_for(
            self.endpoint("specs"),
            _external=True,
            _scheme=current_app.config["PREFERRED_URL_SCHEME"],
        )
