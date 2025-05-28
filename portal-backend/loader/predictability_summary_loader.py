import os
import re
import shutil
from typing import Any, Dict, Match, Optional, Tuple, Union, cast

import pandas as pd
from flask import current_app
from sqlalchemy import func

from depmap.compound.models import CompoundExperiment
from depmap.database import db
from depmap.gene.models import Gene
from depmap.predictability_prototype.models import (
    PrototypePredictiveFeature,
    PrototypePredictiveFeatureResult,
    PrototypePredictiveModel,
)
from depmap.utilities.bulk_load import bulk_load
from depmap.utilities.models import log_data_issue
import re
from depmap.taiga_id.utils import get_taiga_client
import os
import json

# this script exists to rewrite any Taiga IDs into their canonical form. (This allows conseq to recognize when data files are the same by just comparing taiga IDs)
#
# as a secondary concern, all these taiga IDs must exist in a file that this processes, so this also handles a "TAIGA_PREPROCESSOR_INCLUDE" statement to merge multiple files
# into one while the taiga IDs are being processed

# tc = get_taiga_client()
MODEL_SEQUENCE = ["CellContext", "DriverEvents", "GeneticDerangement", "DNA", "RNASeq"]


def lookup_gene(m: Match):
    entrez_id = m.group(1)

    entity = Gene.get_gene_by_entrez(entrez_id, must=False)
    if entity:
        return entity.entity_id

    return None


def lookup_compound_dose(xref_full: str):
    entity = CompoundExperiment.get_by_xref_full(xref_full, must=False)

    if entity:
        return entity.entity_id

    return None


def _load_predictive_models(
    ensemble_csv_path: str,
    model_ids: Dict[Tuple[str, str], int],
    entity_type: str,
    next_id,
    screen_type: str,
    model_configs: dict,
):
    def lookup_entity_id(gene_or_compound_experiment_label: str,) -> Optional[int]:
        if entity_type == "gene":
            m = re.match("\S+ \\((\\d+)\\)", gene_or_compound_experiment_label)
            if m is None:
                log_data_issue(
                    "PrototypePredictiveModel",
                    "Missing gene",
                    identifier=gene_or_compound_experiment_label,
                    id_type=entity_type,
                )
                return None
            return lookup_gene(m)

        if entity_type == "compound_experiment":
            # Below is a hack for the 24Q2 release - where none of the OncRef Predictability outputs
            # were formatted with the "BRD:" prefix. This should eventually be cleaned up.
            if ":" not in gene_or_compound_experiment_label:
                gene_or_compound_experiment_label = (
                    "BRD:" + gene_or_compound_experiment_label
                )

            entity_id = lookup_compound_dose(gene_or_compound_experiment_label)
            if entity_id is None:
                log_data_issue(
                    "PrototypePredictiveModel",
                    "Missing compound experiment",
                    identifier=gene_or_compound_experiment_label,
                    id_type=entity_type,
                )
            return entity_id

        log_data_issue(
            "PrototypePredictiveModel", f"Unexpected dataset entity type {entity_type}",
        )
        return None

    # load all models
    def row_to_model_dict(row):
        model_id = next_id[0]
        next_id[0] += 1

        entity_label = row["target_variable"]
        model_name = row["model"]
        model_ids_key = (entity_label, model_name)

        entity_id = lookup_entity_id(entity_label)
        if entity_id is None:
            return None

        # only add to dictionary if valid entity id
        model_ids[model_ids_key] = model_id

        tc = get_taiga_client()
        predictions_dataset_taiga_id = model_configs[model_name]["output"][
            "prediction_matrix_taiga_id"
        ]
        predictions_dataset_taiga_id = tc.get_canonical_id(predictions_dataset_taiga_id)

        rec = dict(
            predictive_model_id=model_id,
            entity_id=lookup_entity_id(entity_label),
            label=model_name,
            predictions_dataset_taiga_id=predictions_dataset_taiga_id,
            pearson=float(row["pearson"]),
            screen_type=screen_type,
        )
        return rec

    assert entity_type in {"gene", "compound_experiment"}

    bulk_load(ensemble_csv_path, row_to_model_dict, PrototypePredictiveModel.__table__)


def _load_predictive_features(model_configs: dict, ensemble_csv_path: str):
    tc = get_taiga_client()
    feature_metadata_taiga_id = model_configs["CellContext"]["output"][
        "feature_metadata_taiga_id"
    ]

    feature_metadata = tc.get(feature_metadata_taiga_id)

    # Filter out features which are not in the top features of any model
    df = pd.read_csv(ensemble_csv_path, usecols=[f"feature{i}" for i in range(10)])
    used_features = pd.unique(df.values.ravel("K"))
    feature_metadata = feature_metadata.loc[
        feature_metadata["feature_name"].isin(used_features)
    ]

    # Filter out features which have already been loaded
    already_loaded_feature_labels = [
        f.feature_name for f in PrototypePredictiveFeature.get_all()
    ]

    dropIndex = feature_metadata[
        feature_metadata["feature_name"].isin(already_loaded_feature_labels)
    ].index

    feature_metadata = feature_metadata.drop(dropIndex)
    feature_metadata = feature_metadata.drop_duplicates(subset=["feature_name"])

    def row_to_feature_obj(
        feature_id: str, row
    ) -> Optional[PrototypePredictiveFeature]:
        feature_name = row["feature_name"]
        feature_label = row["feature_label"]

        taiga_id = row["taiga_id"]
        tc = get_taiga_client()
        taiga_id = tc.get_canonical_id(taiga_id)
        assert taiga_id, f"Could not find canonical taiga ID for {taiga_id}"

        dim_type = row["dim_type"]
        given_id = row["given_id"]

        existing_feature = PrototypePredictiveFeature.get(feature_name, must=False)

        if existing_feature is not None:
            return None

        rec = PrototypePredictiveFeature(
            feature_name=feature_name,
            feature_label=feature_label,
            dim_type=dim_type,
            taiga_id=taiga_id,
            given_id=str(given_id),
            feature_id=feature_name,
        )

        return rec

    objs = [row_to_feature_obj(i, row) for i, row in feature_metadata.iterrows()]
    objs = [o for o in objs if o is not None]

    db.session.bulk_save_objects(objs)
    db.session.commit()


def _load_predictability_screen(
    screen_type: str, screen_model_configs: dict,
):
    tc = get_taiga_client()

    for model_name in MODEL_SEQUENCE:
        ensemble_csv_taiga_id = screen_model_configs[model_name]["output"][
            "ensemble_taiga_id"
        ]

        ensemble_csv_path = tc.download_to_cache(
            ensemble_csv_taiga_id, requested_format="csv_table"
        )

        model_ids: Dict[Tuple[str, str], int] = {}
        next_id = [get_starting_predictive_model_id()]

        _load_predictive_models(
            ensemble_csv_path,
            model_ids,
            "gene",
            next_id,
            screen_type,
            screen_model_configs,
        )

        _load_predictive_features(screen_model_configs, ensemble_csv_path)

        # Load all feature results
        def row_to_feature_result_dict(row):
            results = []
            entity_label = row["target_variable"]
            model_name = row["model"]
            model_ids_key = (entity_label, model_name)
            # if invalid entity id, not in dictionary
            if model_ids_key not in model_ids:
                return results

            model_id = model_ids[model_ids_key]
            # top ten features, columns are labelled e.g. feature0, feature0_importance
            for i in range(10):
                feature_name = row[f"feature{i}"]
                feature_importance = row[f"feature{i}_importance"]

                feature = PrototypePredictiveFeature.get_by_feature_name(feature_name)

                if feature is None:
                    continue
                assert (
                    feature is not None
                ), f"Counld not find PredictiveFeature where feature_name={feature_name}"

                rec = dict(
                    predictive_model_id=model_id,
                    feature_id=feature.feature_id,
                    screen_type=screen_type,
                    rank=i,
                    importance=feature_importance,
                )
                results.append(rec)
            return results

        bulk_load(
            ensemble_csv_path,
            row_to_feature_result_dict,
            PrototypePredictiveFeatureResult.__table__,
        )

        # Copy file for download
        assert isinstance(current_app.config, dict)
        source_dir = current_app.config.get("WEBAPP_DATA_DIR")

        assert source_dir is not None
        path = os.path.join(
            source_dir,
            "predictability_prototype",
            f"{model_name}_{screen_type}_predictability_results.csv",
        )
        os.makedirs(os.path.dirname(path), exist_ok=True)
        shutil.copy(ensemble_csv_path, path)


def load_predictability_prototype(model_config_file_path: str):
    with open(model_config_file_path, "r") as file:
        model_configs = json.load(file)

    screen_types = model_configs.keys()

    for screen_type in screen_types:
        _load_predictability_screen(
            screen_type=screen_type, screen_model_configs=model_configs[screen_type],
        )


def get_starting_predictive_model_id():
    """
    :return: predictive_model_id for the first newly inserted predictive model
    """
    highest_existing_id = db.session.query(
        func.max(PrototypePredictiveModel.predictive_model_id)
    ).one()[
        0
    ]  # the id, or None
    if highest_existing_id is not None:
        return highest_existing_id + 1
    else:
        return 1
