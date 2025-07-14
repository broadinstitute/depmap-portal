from depmap.compound.models import Compound
from depmap.compound.new_dose_curves_utils import get_dose_response_curves_per_model
from depmap.compound.views.index import is_url_valid
from flask_restplus import Namespace, Resource
from flask import request
import urllib.parse


namespace = Namespace("compound", description="View compound data in the portal")


@namespace.route("/dose_curve_data")
class DoseCurveData(Resource):
    def get(self):
        compound_id = request.args.get("compound_id")
        drc_dataset_label = request.args.get("drc_dataset_label")
        replicate_dataset_name = request.args.get("replicate_dataset_name")

        dose_curve_info = get_dose_response_curves_per_model(
            compound_id=compound_id,
            drc_dataset_label=drc_dataset_label,
            replicate_dataset_name=replicate_dataset_name,
        )

        return dose_curve_info


@namespace.route("/structure_image/<compound_id>")
class StructureImage(Resource):
    def get(self, compound_id):
        compound = Compound.get_by_compound_id(compound_id)

        # Only allowing this to be none because that's what the old structure and detail
        # tile did. We must not have images for every compound.
        # Generate the structure URL
        structure_url = (
            "https://storage.googleapis.com/depmap-compound-images/{}.svg".format(
                urllib.parse.quote(
                    compound.smiles
                )  # Encode a compound SMILES string such as
                # "CN(C)C/C=C/C(=O)Nc1cc2c(Nc3ccc(F)c(Cl)c3)ncnc2cc1O[C@H]1CCOC1" to
                # "CN%28C%29C/C%3DC/C%28%3DO%29Nc1cc2c%28Nc3ccc%28F%29c%28Cl%29c3%29ncnc2cc1O%5BC%40H%5D1CCOC1"
            )
            if compound
            else None
        )

        # Validate the structure URL
        if structure_url and not is_url_valid(structure_url):
            structure_url = None

        return structure_url
