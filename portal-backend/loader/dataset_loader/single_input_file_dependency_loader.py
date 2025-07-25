import os
from typing import Dict
from depmap.enums import DependencyEnum

from flask import current_app
from depmap.compound.models import CompoundExperiment
from loader.matrix_loader import create_matrix_object, create_transposed_hdf5
from loader.dataset_loader.utils import add_dependency_dataset


def load_single_input_file_dependency_dataset(
    dataset_enum, dataset_metadata: Dict, owner_id
):
    """
    This is used for loading things in the config that are in the dep_datasets list
    These include CRISPR and RNAi datasets with gene entities, and AUC and IC50 datasets with compound experiment entities
    This is NOT used for loading e.g. compound dose replicate datasets, even though they have a DependencyDataset enum
    """
    if "matrix_file_name_root" in dataset_metadata:
        score_file_path = dataset_metadata["matrix_file_name_root"] + "_score.hdf5"
        score_abs_file_path = os.path.join(
            current_app.config["LOADER_DATA_DIR"], score_file_path
        )
    else:
        score_abs_file_path = dataset_metadata["score_file_path"]

    if dataset_metadata.get("transpose", False):
        score_abs_file_path = create_transposed_hdf5(score_abs_file_path)

    def compound_experiment_lookup(x):
        xref_type, xref = CompoundExperiment.split_xref_type_and_xref(x)
        # must=False because some compounds could not be loaded due to duplicate names. The compound failing to load
        #            prevents the CompoundExperiment to fail to load, which prevents us from finding it here.
        #            The duplicates in turn largely seem to come from not being able to match CTRP up with repurposing
        #            compounds.
        return CompoundExperiment.get_by_xref(xref, xref_type, must=False)

    if DependencyEnum.is_compound_experiment_enum(dataset_enum):
        entity_lookup = compound_experiment_lookup
        entity_type = "compound_experiment"
    else:
        entity_lookup = None
        entity_type = "gene"

    score_matrix = create_matrix_object(
        dataset_enum.name,
        score_abs_file_path,
        dataset_metadata["units"],
        owner_id,
        allow_missing_entities=True,
        non_gene_lookup=entity_lookup,
    )

    add_dependency_dataset(
        name_enum=dataset_enum,
        display_name=dataset_metadata["display_name"],
        units=dataset_metadata["units"],
        data_type=dataset_metadata["data_type"],
        priority=dataset_metadata["priority"],
        global_priority=dataset_metadata["global_priority"],
        matrix=score_matrix,
        taiga_id=dataset_metadata["taiga_id"],
        entity_type=entity_type,
        owner_id=owner_id,
    )
