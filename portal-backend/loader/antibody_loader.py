import re

import pandas as pd

from depmap.antibody.models import Antibody
from depmap.gene.models import Gene
from depmap.utilities import hdf5_utils

import logging

log = logging.getLogger(__name__)


def format_index_antibody_list(rppa_file_path, allow_missing_entities=False):
    """
	:param rppa_file_path: 
	:return: a zipped list of antibody object, index 
	"""
    row_list = hdf5_utils.get_row_index(
        "", rppa_file_path
    )  # path, "" doesn't work cos it appends / to the end

    # Split gene from row name and save index so we can group by antibody
    df = pd.DataFrame(row_list, columns=["row_name"])
    df["index"] = df.index
    df["gene"] = df["row_name"].apply(lambda x: x.split(" ")[0])
    try:
        df.index = df["row_name"].apply(lambda x: x.split(" ")[1][1:-1])
    except IndexError as e:
        raise ValueError("{}".format(df["row_name"])) from e

    del df["row_name"]
    df.index.name = None

    index_antibody_list = []

    for antibody, df_group in df.groupby(lambda x: x):
        index = int(
            df_group["index"].min()
        )  # need to cast to int, otherwise a numpy int gets added to the db
        antibody_object = create_antibody_object(
            antibody, df_group["gene"], allow_missing_entities
        )
        index_antibody_list.append((index, antibody_object))

    return index_antibody_list


def create_antibody_object(antibody, gene_labels, allow_missing_entities=False):
    genes = []
    for gene in gene_labels:
        gene_obj = Gene.query.filter_by(label=gene).one_or_none()
        if gene_obj is not None:
            genes.append(gene_obj)
        elif not allow_missing_entities:
            raise AssertionError(
                "Could not find gene with label {} while loading antibody {}".format(
                    gene, antibody
                )
            )

    # whole thing starts with _p
    # repeating pattern of:
    # 	may or may not begin with an underscore
    # 	serine, threonine or tyrosine
    # 	some number of digits
    # Capture this entire repeating pattern, without the _p, which in the future we then string split by underscore
    # Currently not expanding into multiple phosphorylations since we don't seem to have the use case
    # group 1 for the first capture group. group 0 is the entire match
    phosphorylation_match = re.search("_p((?:(?:_)?[STY][\d]+)+)", antibody)
    phosphorylation = phosphorylation_match.group(1) if phosphorylation_match else None

    validation_unavailable = "_ValidationUnavailable" in antibody
    caution = "_Caution" in antibody
    protein = re.sub(
        "_p((_)?[STY][\d]+)+|_ValidationUnavailable|_Caution", "", antibody
    )  # everything not extracted

    antibody_object = Antibody(
        label="{}_p{}".format(protein, phosphorylation)
        if phosphorylation is not None
        else protein,
        gene=genes,
        protein=protein,
        phosphorylation=phosphorylation,
        is_caution=caution,
        is_validation_unavailable=validation_unavailable,
    )

    return antibody_object
