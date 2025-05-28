import re

import pandas as pd

from depmap.database import db
from depmap.gene.models import Gene
from depmap.proteomics.models import Protein
from depmap.utilities import hdf5_utils
from loader.dataset_loader.utils import add_tabular_dataset

from typing import Optional
from depmap.dataset.models import DependencyDataset, TabularDataset


def load_protein_table(protein_metadata_file: str, taiga_id: Optional[str] = None):
    if taiga_id is not None:
        add_tabular_dataset(
            name_enum=TabularDataset.TabularEnum.protein.name, taiga_id=taiga_id
        )

    df = pd.read_csv(protein_metadata_file).convert_dtypes()
    proteins = []
    missing_genes = 0
    for row in df.to_records():
        protein_label = row["Label"]
        entrez_id = row["EntrezID"]
        uniprot_id = row["UniprotID"]
        if pd.isna(entrez_id):
            gene = None
        else:
            gene = Gene.get_gene_by_entrez(entrez_id, must=False)
            if gene is None:
                missing_genes += 1

        protein = Protein(label=protein_label, gene=gene, uniprot_id=uniprot_id)
        proteins.append(protein)

    db.session.add_all(proteins)

    assert len(proteins) > 0
    print(f"Loaded {len(proteins)} proteins, {missing_genes} missing genes")


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


# def create_protein_object(protein_label, allow_missing_entities=False):
#     # Columns are in format: "gene_symbol (uniprot_id)"
#     m = re.match("\\S+\\([^)]+)\\)", protein_label)
#     if m is None:
#         assert re.match("[A-Z0-9]+", protein_label)
#         uniprot_id = protein_label
#     else:
#         gene_symbol, uniprot_id = protein_label.rstrip(")").split(" (")
#         gene = Gene.query.filter_by(label=gene_symbol).one_or_none()
#
#         if gene is None and not allow_missing_entities:
#             raise AssertionError(
#                 "Could not find gene with label {} while loading protein {}".format(
#                     gene_symbol, uniprot_id
#                 )
#             )
#     protein = Protein.get_by_label(protein_label, must=False)
#     # Add protein if it doesn't exist in db yet, else return None
#     if protein is None:
#         protein_object = Protein(label=protein_label, gene=gene, uniprot_id=uniprot_id)
#         return protein_object
#
#     return None
