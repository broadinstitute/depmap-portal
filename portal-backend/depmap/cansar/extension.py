from oauthlib.oauth2 import BackendApplicationClient
from requests_oauthlib import OAuth2Session
from collections import namedtuple

CANSAR_SYNOPSIS_URL_TEMPLATE = "https://cansar.ai/target/{}/synopsis"
CANSAR_API_URL_TEMPLATE = "https://cansar.ai/api/v1/uniprot/{}/external-collaborator"
TOKEN_REQ_URL = (
    "https://cansar.ai/auth/realms/cansar-staging/protocol/openid-connect/token"
)

Protein = namedtuple(
    "Protein",
    "image bioactive_compounds druggable_structure druggable_by_ligand_based_assessment enzyme synopsis_url",
)


def _create_client(
    client_id, client_secret, token_url=TOKEN_REQ_URL, refresh_url=TOKEN_REQ_URL
):
    client = BackendApplicationClient(client_id=client_id)
    oauth = OAuth2Session(client=client)
    token = oauth.fetch_token(
        token_url=token_url, client_id=client_id, client_secret=client_secret
    )

    extra = {"client_id": client_id, "client_secret": client_secret}

    def token_saver(token):
        print("stub: token_saver({})".format(token))

    client = OAuth2Session(
        client_id,
        token=token,
        auto_refresh_url=refresh_url,
        auto_refresh_kwargs=extra,
        token_updater=token_saver,
    )
    return client


def parse_protein_response(data):
    uniprot_id = data["data"]["cansar_db"]["id"]
    features = data["data"]["cansar_db"]["features"]
    return Protein(
        image=data["data"]["cansar_db"]["image"],
        bioactive_compounds=features["bioactive_compounds"],
        druggable_structure=features["druggable_structure"],
        druggable_by_ligand_based_assessment=features[
            "druggable_by_ligand_based_assessment"
        ],
        enzyme=features["enzyme"],
        synopsis_url=CANSAR_SYNOPSIS_URL_TEMPLATE.format(uniprot_id),
    )


class CansarClient:
    def __init__(self, client_id, client_secret):
        self.client = _create_client(client_id, client_secret)

    def get_protein(self, uniprot_id):
        response = self.client.get(CANSAR_API_URL_TEMPLATE.format(uniprot_id))
        if response.status_code == 404:
            return None
        else:
            data = response.json()
            # a new transient failure from CanSAR. Consider this one same as 404
            if "error" in data and data["error"] == "server unavailable":
                return None
            return parse_protein_response(data)


class CansarExtension:
    def __init__(self, app=None):
        if app is not None:
            self.init_app(app)

    def init_app(self, app):
        self.app = app

    @property
    def client(self):
        # we want to reuse access tokens across requests, so create the client on demand -- but reuse the client across all requests.
        # this is why it is not being stored on flask.g
        if hasattr(self.app, "__cansar_client"):
            client = self.app.__cansar_client
        else:
            # NOTE: None value for dev config and target tractability tile is no-show on dev
            if self.app.config["CANSAR_CREDENTIALS"] is not None:
                client_id, client_secret = self.app.config["CANSAR_CREDENTIALS"].split(
                    ","
                )
            else:
                client_id = client_secret = None
            client = CansarClient(client_id, client_secret)
            self.app.__cansar_client = client
        return client
