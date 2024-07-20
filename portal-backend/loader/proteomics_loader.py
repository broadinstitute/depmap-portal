import re

import pandas as pd

from depmap.database import db
from depmap.gene.models import Gene
from depmap.proteomics.models import Protein
from depmap.utilities import hdf5_utils


def load_proteins(proteomics_file_path, allow_missing_entities=False):
    """
	:param proteomics_file_path: 
	:return: a zipped list of protein object, index 
	"""
    row_list = hdf5_utils.get_row_index("", proteomics_file_path)
    index_protein_list = [
        create_protein_object(row, allow_missing_entities) for row in row_list
    ]
    # Remove Nones in list meaning protein already exists in db
    index_protein_list = [
        protein for protein in index_protein_list if protein is not None
    ]
    db.session.add_all(index_protein_list)


def create_protein_object(protein_label, allow_missing_entities=False):
    # Columns are in format: "gene_symbol (uniprot_id)"
    gene_symbol, uniprot_id = protein_label.rstrip(")").split(" (")
    gene = Gene.query.filter_by(label=gene_symbol).one_or_none()

    if gene is None and not allow_missing_entities:
        raise AssertionError(
            "Could not find gene with label {} while loading protein {}".format(
                gene_symbol, uniprot_id
            )
        )
    protein = Protein.get_by_label(protein_label, must=False)
    # Add protein if it doesn't exist in db yet, else return None
    if protein is None:
        protein_object = Protein(label=protein_label, gene=gene, uniprot_id=uniprot_id)
        return protein_object

    return None
