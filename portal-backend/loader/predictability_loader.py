import os
import re
import shutil
from json import dumps as json_dumps
from typing import Dict, Match, Optional, Tuple, Union

import pandas as pd
from flask import current_app
from sqlalchemy import func

from depmap.antibody.models import Antibody
from depmap.compound.models import CompoundExperiment
from depmap.context.models_new import SubtypeContextEntity
from depmap.database import db
from depmap.dataset.models import BiomarkerDataset, Dataset, DependencyDataset
from depmap.entity.models import GenericEntity
from depmap.enums import BiomarkerEnum
from depmap.gene.models import Gene
from depmap.predictability.models import (
    PredictiveBackground,
    PredictiveFeature,
    PredictiveFeatureResult,
    PredictiveModel,
)
from depmap.predictability.utilities import DATASET_LABEL_TO_ENUM
from depmap.transcription_start_site.models import TranscriptionStartSite
from depmap.utilities.bulk_load import bulk_load
from depmap.utilities.models import log_data_issue


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
    filename: str, dataset: Dataset, model_ids: Dict[Tuple[str, str], int], next_id
):
    def lookup_entity_id(
        gene_or_compound_experiment_label: str,
    ) -> Optional[Union[Gene, CompoundExperiment]]:
        if dataset.entity_type == "gene":
            m = re.match("\S+ \\((\\d+)\\)", gene_or_compound_experiment_label)
            if m is None:
                log_data_issue(
                    "PredictiveModel",
                    "Missing gene",
                    identifier=gene_or_compound_experiment_label,
                    id_type=dataset.entity_type,
                )
                return None
            return lookup_gene(m)

        if dataset.entity_type == "compound_experiment":
            # Below is a hack for the 24Q2 release - where none of the OncRef Predictability outputs
            # were formatted with the "BRD:" prefix. This should eventually be cleaned up.
            if ":" not in gene_or_compound_experiment_label:
                gene_or_compound_experiment_label = (
                    "BRD:" + gene_or_compound_experiment_label
                )

            entity_id = lookup_compound_dose(gene_or_compound_experiment_label)
            if entity_id is None:
                log_data_issue(
                    "PredictiveModel",
                    "Missing compound experiment",
                    identifier=gene_or_compound_experiment_label,
                    id_type=dataset.entity_type,
                )
            return entity_id

        log_data_issue(
            "PredictiveModel", f"Unexpected dataset entity type {dataset.entity_type}",
        )
        return None

    # load all models
    def row_to_model_dict(row):
        model_id = next_id[0]
        next_id[0] += 1

        entity_label = row["gene"]
        model_name = row["model"]
        model_ids_key = (entity_label, model_name)

        entity_id = lookup_entity_id(entity_label)
        if entity_id is None:
            return None

        # only add to dictionary if valid entity id
        model_ids[model_ids_key] = model_id
        rec = dict(
            predictive_model_id=model_id,
            dataset_id=dataset.dataset_id,
            entity_id=lookup_entity_id(entity_label),
            label=model_name,
            pearson=float(row["pearson"]),
        )
        return rec

    assert dataset.entity_type in {"gene", "compound_experiment"}

    bulk_load(filename, row_to_model_dict, PredictiveModel.__table__)


def _load_predictive_features(
    filename: str, feature_metadata_file: str,
):
    gene_cache = {gene.entrez_id: gene.label for gene in Gene.get_all()}
    tss_cache = {tss.label: tss.label for tss in TranscriptionStartSite.get_all()}
    antibody_cache = {antibody.label: antibody.label for antibody in Antibody.get_all()}
    context_cache = {
        context.label: context.label for context in SubtypeContextEntity.get_all()
    }

    feature_metadata = pd.read_csv(
        feature_metadata_file,
        index_col="feature_id",
        dtype={"feature_id": str, "feature_name": str, "entrez_id": "Int32",},
        usecols=["feature_id", "feature_name", "dataset", "entrez_id"],
    )

    # Filter out features which are not in the top features of any model
    df = pd.read_csv(filename, usecols=[f"feature{i}" for i in range(10)])
    used_features = pd.unique(df.values.ravel("K"))
    feature_metadata = feature_metadata.filter(used_features, axis="index")

    # Filter out features which have already been loaded
    already_loaded_feature_labels = [f.feature_id for f in PredictiveFeature.get_all()]
    feature_metadata = feature_metadata.drop(
        index=already_loaded_feature_labels, errors="ignore"
    )

    unique_datasets = feature_metadata["dataset"].unique()

    datasets_by_pred_name: Dict[str, BiomarkerDataset] = {}
    for feature_dataset_name in unique_datasets:
        biomarker_dataset_enum = DATASET_LABEL_TO_ENUM[feature_dataset_name]
        datasets_by_pred_name[
            feature_dataset_name
        ] = BiomarkerDataset.get_dataset_by_name(biomarker_dataset_enum.name, must=True)

    def row_to_feature_obj(feature_id: str, row) -> Optional[PredictiveFeature]:
        feature_name = row["feature_name"]
        dataset_name = row["dataset"]
        entrez_id = row["entrez_id"]

        # Skip loading features that have already been loaded
        existing_feature = PredictiveFeature.get(feature_id, must=False)
        if existing_feature is not None:
            return None

        assert (
            dataset_name in datasets_by_pred_name
        ), f"Unexpected dataset {dataset_name}, row: {row}, default crispr enum: {DependencyDataset.get_dataset_by_data_type_priority(DependencyDataset.DataTypeEnum.crispr)}, filename: {filename}"

        dataset = datasets_by_pred_name[dataset_name]
        entity_label: Optional[str] = None
        if dataset.name in {
            BiomarkerEnum.mutations_damaging,
            BiomarkerEnum.mutations_driver,
            BiomarkerEnum.mutations_hotspot,
            BiomarkerEnum.expression,
            BiomarkerEnum.copy_number_relative,
        }:
            if pd.isnull(entrez_id):
                log_data_issue(
                    "PredictiveFeature",
                    "Gene missing entrez_id",
                    identifier=feature_name,
                    id_type="label",
                )
                entity = Gene.get_by_label(feature_name, must=False)
                if entity is not None:
                    entity_label = entity.label
            else:
                entity_label = gene_cache.get(entrez_id, None)
                if entity_label is None:
                    log_data_issue(
                        "PredictiveFeature",
                        "Missing gene",
                        identifier=str(entrez_id),
                        id_type="entrez_id",
                    )
        elif dataset.name == BiomarkerEnum.rppa:
            m = re.match(r"^(.*) \((.*)\)$", feature_name)
            if m is None:
                log_data_issue(
                    "PredictiveFeature",
                    "Malformatted antibody",
                    identifier=feature_name,
                    id_type="label",
                )
            else:
                antibody_label = m.group(2)

                entity_label = antibody_cache.get(antibody_label, None)
                if entity_label is None:
                    log_data_issue(
                        "PredictiveFeature",
                        "Missing antibody",
                        identifier=feature_name,
                        id_type="label",
                    )
        elif dataset.name == BiomarkerEnum.rrbs:
            entity_label = tss_cache.get(feature_name, None)
            if entity_label is None:
                log_data_issue(
                    "PredictiveFeature",
                    "Missing transcription start site",
                    identifier=feature_name,
                    id_type="label",
                )
        elif dataset.name == BiomarkerEnum.context:
            entity_label = context_cache.get(feature_name, None)
            if entity_label is None:
                log_data_issue(
                    "PredictiveFeature",
                    "Missing context entity",
                    identifier=feature_name,
                    id_type="label",
                )
        elif dataset.name in [
            BiomarkerDataset.BiomarkerEnum.fusions,
            BiomarkerDataset.BiomarkerEnum.ssgsea,
            BiomarkerDataset.BiomarkerEnum.metabolomics,
            BiomarkerDataset.BiomarkerEnum.crispr_confounders,
            BiomarkerDataset.BiomarkerEnum.rnai_confounders,
            BiomarkerDataset.BiomarkerEnum.rep1m_confounders,
            BiomarkerDataset.BiomarkerEnum.oncref_confounders,
            BiomarkerDataset.BiomarkerEnum.rep_all_single_pt_confounders,
        ]:
            if GenericEntity.get_by_label(feature_name, must=False) is not None:
                entity_label = feature_name
            else:
                log_data_issue(
                    "PredictiveFeature",
                    "Missing metabolite (generic entity)",
                    identifier=feature_name,
                    id_type="label",
                )
        else:
            raise ValueError(f"Unexpected dataset: {dataset.name}")

        if entity_label is not None:
            if not BiomarkerDataset.has_entity(
                dataset.name, entity_label, by_label=True
            ):
                log_data_issue(
                    "PredictiveFeature",
                    "Biomarker dataset missing entity",
                    identifier=f"{dataset.name.name} | {entity_label}",
                    id_type="biomarker_enum | entity_id",
                )
                entity_label = None

        rec = PredictiveFeature(
            feature_id=feature_id,
            feature_name=entity_label if entity_label is not None else feature_name,
            dataset_id=dataset.name.name,
        )
        return rec

    objs = [row_to_feature_obj(i, row) for i, row in feature_metadata.iterrows()]
    objs = [o for o in objs if o is not None]
    db.session.bulk_save_objects(objs)
    db.session.commit()


def load_predictive_model_csv(
    filename: str, dataset_name: str, feature_metadata_file: str
):
    dataset = Dataset.get_dataset_by_name(dataset_name, must=True)
    model_ids: Dict[Tuple[str, str], int] = {}
    next_id = [get_starting_predictive_model_id()]

    _load_predictive_models(filename, dataset, model_ids, next_id)

    _load_predictive_features(filename, feature_metadata_file)

    # Load all feature results
    def row_to_feature_result_dict(row):
        results = []
        entity_label = row["gene"]
        model_name = row["model"]
        model_ids_key = (entity_label, model_name)
        # if invalid entity id, not in dictionary
        if model_ids_key not in model_ids:
            return results

        model_id = model_ids[model_ids_key]
        # top ten features, columns are labelled e.g. feature0, feature0_importance
        for i in range(10):
            feature_label = row[f"feature{i}"]
            feature_importance = row[f"feature{i}_importance"]

            if feature_label == "":
                # may happen if there are fewer then 10 features
                continue

            feature = PredictiveFeature.get(feature_label, must=False)
            assert (
                feature is not None
            ), f"Counld not find PredictiveFeature where feature_id={feature_label}"

            rec = dict(
                predictive_model_id=model_id,
                feature_id=feature.feature_id,
                rank=i,
                importance=feature_importance,
            )
            results.append(rec)
        return results

    bulk_load(filename, row_to_feature_result_dict, PredictiveFeatureResult.__table__)

    # Copy file for download
    source_dir = current_app.config["WEBAPP_DATA_DIR"]
    path = os.path.join(
        source_dir, "predictability", f"{dataset_name}_predictability_results.csv"
    )
    os.makedirs(os.path.dirname(path), exist_ok=True)
    shutil.copy(filename, path)


def get_starting_predictive_model_id():
    """
    :return: predictive_model_id for the first newly inserted predictive model
    """
    highest_existing_id = db.session.query(
        func.max(PredictiveModel.predictive_model_id)
    ).one()[
        0
    ]  # the id, or None
    if highest_existing_id is not None:
        return highest_existing_id + 1
    else:
        return 1


def load_predictive_background_from_db(dataset_enum_name):
    dataset = Dataset.get_dataset_by_name(dataset_enum_name, must=True)
    background = [
        x
        for (x,) in db.session.query(func.max(PredictiveModel.pearson))
        .filter_by(dataset_id=dataset.dataset_id)
        .group_by("entity_id")
        .all()
    ]
    db.session.add(
        PredictiveBackground(dataset=dataset, background=json_dumps(background))
    )


def load_predictive_background_from_file(filename, dataset_enum_name):
    """
    ONLY USED FOR SAMPLE DATA LOAD
    """
    dataset = Dataset.get_dataset_by_name(dataset_enum_name, must=True)
    background = pd.read_csv(filename)["pearson"].tolist()
    db.session.add(
        PredictiveBackground(dataset=dataset, background=json_dumps(background))
    )
