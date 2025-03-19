import logging
import os
import re
import tempfile
from dataclasses import asdict
from operator import itemgetter
from typing import Callable, List
from dataclasses import dataclass
import time
import httpx

from depmap.dataset.models import TabularDataset

import click
import pandas as pd
from flask import current_app
from flask.cli import with_appcontext

from depmap.access_control import PUBLIC_ACCESS_GROUP, all_records_visible
from depmap.access_control.utils.initialize_current_auth import assume_user
from depmap.app import enable_access_controls, setup_logging
from depmap.database import checkpoint, transaction
from depmap.dataset.models import Dataset, DependencyDataset
from depmap.enums import BiomarkerEnum, DependencyEnum
from depmap.extensions import db
from depmap.interactive.nonstandard.models import PrivateDatasetMetadata
from depmap.settings.dev import additional_dev_metadata
from depmap.settings.shared import (
    DATASET_METADATA,
    DataLoadConfig,
    DatasetLabel,
    DepDatasetMeta,
)
from depmap.taiga_id.models import TaigaAlias
from depmap.taiga_id.utils import get_taiga_client
from depmap.user_uploads.tasks import _upload_transient_csv
from depmap.user_uploads.utils import (
    delete_private_datasets,
    get_user_upload_records,
)
from depmap.utilities.filename_utils import get_base_name_without_extension
from depmap.utilities.hdf5_utils import csv_to_hdf5, df_to_hdf5
from loader import (
    association_loader,
    cell_line_loader,
    celligner_loader,
    compound_loader,
    constellation_loader,
    data_page_loader,
    dataset_loader,
    depmap_model_loader,
    gene_loader,
    proteomics_loader,
    global_search_loader,
    match_related_loader,
    nonstandard_loader,
    nonstandard_private_loader,
    str_profile_loader,
    taiga_id_loader,
    tda_loader,
    compound_dashboard_loader,
    transcription_start_site_loader,
    metmap_loader,
    context_explorer_loader,
)
from loader.matrix_loader import ensure_all_max_min_loaded
from loader.predictability_loader import (
    load_predictive_background_from_db,
    load_predictive_background_from_file,
    load_predictive_model_csv,
)
from loader.gcs import GCSCache
import subprocess

log = logging.getLogger(__name__)

pd.set_option("mode.use_inf_as_na", True)

from depmap.enums import DataTypeEnum
from depmap.extensions import breadbox
from depmap.cell_line.models_new import DepmapModel
from depmap.gene.models import Gene
from depmap.public.resources import refresh_all_category_topics, read_forum_api_key
from depmap.discourse.client import DiscourseClient
from breadbox_facade import BBClient, BreadboxException, ColumnMetadata, AnnotationType


def _get_relabel_updates():
    def _mk_updates(display_name, new_type):
        return [
            f"""UPDATE nonstandard_private_dataset_metadata_write_only 
                    set data_type = '{new_type}',
                    priority = 1000 
                    where display_name = '{display_name}'""",
            f"""update nonstandard_matrix_write_only 
                    set data_type = '{new_type}' 
                    where nonstandard_dataset_id in (
                        select uuid 
                        from nonstandard_private_dataset_metadata_write_only 
                        where display_name = '{display_name}')
            """,
        ]

    statements = []
    statements.extend(
        _mk_updates("Olink Proteomics", DataTypeEnum.protein_expression.name)
    )
    statements.extend(
        _mk_updates(
            "ATAC Pseudobulk Gene Accessibility 23Q4",
            DataTypeEnum.gene_accessibility.name,
        )
    )
    statements.extend(_mk_updates("Paralogs 23Q4", DataTypeEnum.crispr.name))
    return statements


def _relabel_new_datasets_hack():
    statements = _get_relabel_updates()

    for statement in statements:
        log.info("Executing: %s", statement)
        db.session.execute(statement)


def _recreate_td_predictive_model():
    # recreate the table because the fk is created wrong by sqlalchemy
    statements = [
        "drop table td_predictive_model",
        """CREATE TABLE td_predictive_model (
        predictive_model_id INTEGER NOT NULL,
        dataset_label INTEGER NOT NULL,
        entity_id INTEGER NOT NULL,
        label VARCHAR NOT NULL,
        pearson FLOAT NOT NULL,
        top_feature_label VARCHAR NOT NULL,
        top_feature_type VARCHAR NOT NULL,
        PRIMARY KEY (predictive_model_id),
        FOREIGN KEY(entity_id) REFERENCES entity (entity_id)
        )""",
        "CREATE INDEX ix_td_predictive_model_dataset_id ON td_predictive_model (dataset_label)",
        "CREATE INDEX ix_td_predictive_model_entity_id ON td_predictive_model (entity_id)",
    ]
    for statement in statements:
        log.info("Executing: %s", statement)
        db.session.execute(statement)


def _setup_logging():
    from depmap.app import setup_logging

    setup_logging(current_app.config["LOG_CONFIG"])


def db_create_all():
    from depmap.app import create_filtered_views

    db.create_all()
    create_filtered_views()


@click.command("recreate_dev_db")
@with_appcontext
@click.option("-c", "--load_celligner", is_flag=True, default=False)
@click.option("-n", "--load_nonstandard", is_flag=True, default=False)
@click.option("-d", "--load_full_constellation", is_flag=True, default=False)
@click.option("-t", "--load_tda_predictability", is_flag=True, default=False)
@click.option("--sync-only", is_flag=True, default=False)
def recreate_dev_db(
    load_celligner,
    load_nonstandard,
    load_full_constellation,
    load_tda_predictability,
    sync_only,
):
    """
    Deletes and recreates db
    Loads sample data
    :return:
    """
    assert current_app.config["ENV"] == "dev", "this command should only be run on dev"
    if not os.path.exists(current_app.config["NONSTANDARD_DATA_DIR"]):
        os.makedirs(current_app.config["NONSTANDARD_DATA_DIR"])
        # WEBAPP_DATA_DIR is part of NONSTANDARD_DATA_DIR and should be created with it, but just making sure in case that ever chanegs
        assert os.path.exists(current_app.config["WEBAPP_DATA_DIR"])

    if not os.path.exists(current_app.config["COMPUTE_RESULTS_ROOT"]):
        os.makedirs(current_app.config["COMPUTE_RESULTS_ROOT"])

    if not sync_only:
        if os.path.isfile(current_app.config["DB_PATH"]):
            os.remove(current_app.config["DB_PATH"])

        db_create_all()

        setup_logging(current_app.config["LOG_CONFIG"])

        with all_records_visible():
            load_sample_data(
                load_celligner=load_celligner,
                load_nonstandard=load_nonstandard,
                load_full_constellation=load_full_constellation,
                load_tda_predictability=load_tda_predictability,
            )

        # now set up the breadbox. Assumes breadbox isn't running already
        # first, tell breadbox to create an empty database
        subprocess.run(
            ["poetry", "run", "./bb", "recreate-dev-db"], check=True, cwd="../breadbox"
        )

    # run the sync'ing process to make sure the breadbox metadata matches
    # what's in the portal's DB.

    sync_metadata_to_breadbox_with_retry(5)

    # now shutdown the breadbox process


def sync_metadata_to_breadbox_with_retry(max_attempts):
    sync_attempt = 0
    while True:
        try:
            sync_metadata_to_breadbox()
            break
        except httpx.ConnectError as ex:
            # Now, this might fail a few times while BB comes up, but don't sweat
            # and just try, try again.
            sync_attempt += 1
            if sync_attempt > max_attempts:
                raise Exception(
                    "Too many attempts to sync_metadata_to_breadbox() failed"
                ) from ex

            print(
                f"Got exception trying to sync_metadata_to_breadbox(), but will retry: {ex}"
            )
            time.sleep(2)


@click.command("recreate_full_db")
@click.option("--stopat", default=None)
@click.option("--rerun", default=None)
@click.option("--skip", default=None)
@click.option("--no-recordskip/--recordskip", default=True)
@click.option(
    "--load-taiga-aliases/--no-load-taiga-aliases",
    default=False,
    help="This parameter name is depreciated and replaced by --process-downloads",
)
@click.option(
    "--process-downloads/--no-process-downloads",
    default=False,
    help="When set, do the steps that depend on having the downloads config accessible",
)
@click.option("--skip", default=None)
@click.option(
    "--srcdata",
    default=None,
    help="the gcs path to read files from (example: gs://preprocessing-pipeline-outputs/depmap-pipeline/dev)",
)
@with_appcontext
def recreate_full_db(
    stopat, rerun, skip, no_recordskip, srcdata, load_taiga_aliases, process_downloads
):
    """
    Loads production data
    """
    import flask

    recordskip = not no_recordskip

    checkpoints_to_force = []
    if rerun is not None:
        checkpoints_to_force = rerun.split(",")

    _setup_logging()
    db_path = flask.current_app.config["DB_PATH"]
    db_parent_dir = os.path.dirname(db_path)
    if not os.path.exists(db_parent_dir):
        os.makedirs(db_parent_dir)
    db_create_all()
    _setup_logging()

    if srcdata is not None:
        m = re.match("gs://([^/]+)/(.*)", srcdata)
        assert m is not None, f"Could not parse {srcdata} as a gcs path"
        gcsc_depmap = GCSCache(m.group(1), m.group(2), "gcscache")
    else:
        gcsc_depmap = GCSCache(
            "preprocessing-pipeline-outputs", current_app.config["S3_DIR"], "gcscache"
        )
    gcsc_conseq_depmap = GCSCache(
        "preprocessing-pipeline-outputs", "conseq/depmap", "gcscache"
    )

    data_load_config = current_app.config["DATA_LOAD_CONFIG"]

    from depmap.extensions import db

    sqlite3_memory_in_kb = 1024 * 1024  # allow sqlite to use 1GB
    db.session.connection().execute(
        "PRAGMA cache_size = -{}".format(sqlite3_memory_in_kb)
    )

    # load_taiga_aliases is an old name for the same option
    process_downloads = process_downloads or load_taiga_aliases

    def load():
        with all_records_visible():
            load_real_data(
                gcsc_depmap=gcsc_depmap,
                gcsc_conseq_depmap=gcsc_conseq_depmap,
                stop_at=stopat,
                checkpoints_to_force=checkpoints_to_force,
                skip_prefix=skip,
                record_skip=recordskip,
                data_load_config=data_load_config,
                process_downloads=process_downloads,
            )

    load()


@click.command("export_cell_lines")
@with_appcontext
def export_cell_lines():
    """Exports the table of cell name info for putting onto the portal as a download."""
    import csv

    from depmap.cell_line.models import CellLine

    filename = os.path.join(
        current_app.config["WEBAPP_DATA_DIR"], "celllines-export.csv"
    )
    log.info("Exporting cell line metadata to %s", filename)

    with open(filename, "wt") as fd:
        w = csv.writer(fd)
        w.writerow(
            [
                "ModelID",
                "CCLE_Name",
                "Aliases",
                "COSMIC_ID",
                "Sanger ID",
                "Primary Disease",
                "Subtype Disease",
                "Gender",
                "Source",
            ]
        )

        def _name_or_blank(n):
            if n is None:
                return ""
            return n.name

        for cell_line in CellLine.query.all():
            aliases = [a.alias for a in cell_line.cell_line_alias]
            w.writerow(
                [
                    cell_line.depmap_id,
                    cell_line.cell_line_name,
                    ";".join(aliases),
                    cell_line.cosmic_id,
                    cell_line.wtsi_master_cell_id,
                    _name_or_blank(cell_line.primary_disease),
                    _name_or_blank(cell_line.disease_subtype),
                    cell_line.gender,
                    cell_line.source,
                ]
            )
    open(filename).read().replace("\n", "")


def load_real_data(
    gcsc_depmap: GCSCache,
    gcsc_conseq_depmap: GCSCache,
    stop_at: str,
    checkpoints_to_force: List[str],
    skip_prefix: str,
    record_skip: bool,
    data_load_config: DataLoadConfig,
    process_downloads: bool,
):
    class AbortBeforeCheckpoint(Exception):
        pass

    def checkpoint_or_abort(label):
        # hack to allow us to cleanly exit
        if label == stop_at:
            raise AbortBeforeCheckpoint()

        skip = False
        if skip_prefix is not None:
            skip = label.startswith(skip_prefix)

        return checkpoint(
            label,
            force=label in checkpoints_to_force,
            skip=skip,
            record_skip=record_skip,
        )

    try:
        return _load_real_data(
            gcsc_depmap,
            gcsc_conseq_depmap,
            data_load_config,
            checkpoint_or_abort,
            process_downloads,
        )
    except AbortBeforeCheckpoint:
        print("Hit checkpoint marked as our stopping point. Aborting...")
    except:
        log.exception("aborting load_real_data")
        raise


def _getitem_w_dbg(d, k):
    if k not in d:
        raise Exception(
            f"Could not find {k} in dictionary with keys { ', '.join(d.keys()) }"
        )
    return d[k]


def _load_real_data(
    gcsc_depmap: GCSCache,
    gcsc_conseq_depmap: GCSCache,
    data_load_config: DataLoadConfig,
    checkpoint: Callable,
    process_downloads: bool,
):
    enable_access_controls()

    taiga_client = get_taiga_client()

    if process_downloads:
        with transaction():
            print("Loading in-memory taiga ids")
            taiga_id_loader.load_in_memory_taiga_ids()

    with checkpoint("gene-data") as needed:
        if needed:
            log.info("Adding gene data")
            genes_hgnc_taiga_id = gcsc_depmap.read_json("metadata/hgnc-snapshot.json")[
                "in"
            ]["dataset_id"]
            hgnc_file = taiga_client.download_to_cache(genes_hgnc_taiga_id, "csv_table")
            assert hgnc_file is not None

            gene_loader.load_hgnc_genes(hgnc_file, taiga_id=genes_hgnc_taiga_id)

    with checkpoint("proteins-from-taiga") as needed:
        if needed:
            log.info("Adding protein table")

            protein_metadata_taiga_id = (
                "harmonized-public-proteomics-02cc.2/uniprot_hugo_entrez_id_mapping"
            )
            protein_metadata_file = taiga_client.download_to_cache(
                protein_metadata_taiga_id, "csv_table"
            )
            assert protein_metadata_file is not None

            proteomics_loader.load_protein_table(
                protein_metadata_file, taiga_id=protein_metadata_taiga_id
            )

    with checkpoint("compounds") as needed:
        if needed:
            log.info("Adding compounds")
            compound_file = gcsc_depmap.download_to_cache(
                gcsc_depmap.read_json("metadata/merged-drug-metadata.json")["metadata"][
                    "filename"
                ]
            )
            compound_loader.load_compounds(compound_file)

    dep_matrices = gcsc_depmap.read_json("metadata/dep-matrices.json")
    dep_datasets = [
        DependencyDataset.DependencyEnum(x["label"]) for x in dep_matrices["dep"]
    ]
    if DependencyDataset.DependencyEnum.Repurposing_secondary_dose in dep_datasets:
        with checkpoint("compound-doses") as needed:
            if needed:
                log.info("Adding compound doses")
                filename = [
                    x["filename"]
                    for x in dep_matrices["dep"]
                    if x["label"]
                    == DependencyDataset.DependencyEnum.Repurposing_secondary_dose.name
                ][0]
                score_file_path = gcsc_depmap.download_to_cache(filename)
                compound_loader.load_repurposing_compound_doses(score_file_path)

    with checkpoint("cell-line-data") as needed:
        if needed:
            # csv should contain metadata for all cell lines
            log.info("Adding cell line data")
            filename = gcsc_conseq_depmap.download_to_cache(
                gcsc_depmap.read_json("metadata/cell-line-metadata.json")["metadata"][
                    "filename"
                ]
            )
            cell_line_loader.load_cell_lines_metadata(filename)

            log.info("Adding models data")
            model_metadata_dict = gcsc_depmap.read_json("metadata/models-metadata.json")
            filename = gcsc_conseq_depmap.download_to_cache(
                model_metadata_dict["metadata"]["filename"]
            )
            taiga_id = model_metadata_dict["metadata"]["sample_info_id"]
            depmap_model_loader.load_depmap_model_metadata(filename, taiga_id)

    with checkpoint("str_profile") as needed:
        if needed:
            log.info("Adding str profile data")
            filename = taiga_client.download_to_cache(
                "str-profile-v1-c34b.2/DEPMAP STR 10-8-19", "csv_table"
            )
            str_profile_loader.load_str_profiles(filename)

    with checkpoint("metmap_500_data") as needed:
        if needed:
            log.info("Adding metmap 500 data")
            taiga_id = current_app.config["METMAP_500_TAIGA_ID"]
            metmap_file = taiga_client.download_to_cache(taiga_id, "csv_table")
            assert metmap_file is not None

            metmap_loader.load_metmap_500(metmap_file, taiga_id)

    for dep_dataset_enum in dep_datasets:
        with checkpoint("dataset-{}".format(dep_dataset_enum.name)) as needed:
            if needed:
                log.info("Adding dataset data...")

                assert isinstance(dep_dataset_enum, DependencyDataset.DependencyEnum)
                dataset_meta = DATASET_METADATA[dep_dataset_enum]
                assert isinstance(dataset_meta, DepDatasetMeta)

                log.info("Adding dataset: %s", dep_dataset_enum)

                scores_by_enum = {x["label"]: x for x in dep_matrices["dep"]}

                scores = _getitem_w_dbg(scores_by_enum, dep_dataset_enum.name)

                score_file_path = gcsc_depmap.download_to_cache(scores["filename"])
                taiga_id = scores["orig_dataset_id"]
                transpose = False

                dataset_dict = {
                    "score_file_path": score_file_path,
                    "transpose": transpose,
                    "taiga_id": taiga_id,
                    **asdict(dataset_meta),
                }
                dataset_loader.load_single_input_file_dependency_dataset(
                    dep_dataset_enum, dataset_dict, PUBLIC_ACCESS_GROUP
                )

    if current_app.config["ENABLED_FEATURES"].target_discovery_app:
        with checkpoint("load-td-models") as needed:
            if needed:
                _recreate_td_predictive_model()

                avana_file = taiga_client.download_to_cache(
                    "predictability-0eda.1/Avana-ensemble-classify", "csv_table"
                )
                rnai_file = taiga_client.download_to_cache(
                    "predictability-0eda.1/RNAi-ensemble-classify", "csv_table"
                )
                tda_loader.load_td_predictive_models(
                    rnai_file, DependencyDataset.DependencyEnum.RNAi_merged.name
                )
                tda_loader.load_td_predictive_models(
                    avana_file,
                    DependencyDataset.DependencyEnum.Avana.name,  # the TD app will stay as old avana until regenerated, it uses static files as inputs
                )

    for (
        dose_replicate_level_dataset_enum
    ) in data_load_config.dose_replicate_level_datasets:
        with checkpoint(
            "dose-replicate-level-dataset-{}".format(
                dose_replicate_level_dataset_enum.name
            )
        ) as needed:
            if needed:
                log.info("Adding dose-replicate-level data...")
                assert isinstance(
                    dose_replicate_level_dataset_enum, DependencyDataset.DependencyEnum
                )
                dataset_meta = DATASET_METADATA[dose_replicate_level_dataset_enum]
                assert isinstance(dataset_meta, DepDatasetMeta)
                dose_csvs = gcsc_depmap.read_json(
                    "metadata/dose-replicate-level-{}.json".format(
                        dose_replicate_level_dataset_enum.name
                    )
                )
                perturbations_file_path = gcsc_depmap.download_to_cache(
                    dose_csvs["metadata"]["perturbations"]
                )
                cell_lines_file_path = gcsc_depmap.download_to_cache(
                    dose_csvs["metadata"]["cell_lines_filename"]
                )
                hdf5_file_path = gcsc_depmap.download_to_cache(
                    dose_csvs["metadata"]["hdf5_filename"]
                )

                dataset_loader.load_compound_dose_replicate_dataset(
                    perturbations_file_path,
                    cell_lines_file_path,
                    hdf5_file_path,
                    dose_replicate_level_dataset_enum.name,
                    dataset_meta,
                    dose_csvs["metadata"]["orig_dataset_id"],
                    PUBLIC_ACCESS_GROUP,
                )

    with checkpoint("dose-response-curve") as needed:
        if needed:
            curve_json = gcsc_depmap.read_json("metadata/dose-response-curve.json")
            for curve in curve_json["dep"]:
                curve_params_file_path = gcsc_depmap.download_to_cache(
                    curve["filename"]
                )
                dataset_loader.load_curve_parameters_csv(curve_params_file_path)

    def get_subtype_context_file():
        metadata = gcsc_depmap.read_json("metadata/subtype_context_matrix_out.json")[
            "in"
        ]
        full_path = metadata["filename"]
        return gcsc_conseq_depmap.download_to_cache(full_path)

    with checkpoint("subtype-context-data") as needed:
        if needed:
            depmap_model_loader.load_subtype_contexts(
                get_subtype_context_file(), must=False
            )

    def get_subtype_tree_file():
        metadata = gcsc_depmap.read_json("metadata/subtype_tree_out.json")["in"]
        full_path = metadata["filename"]
        return gcsc_conseq_depmap.download_to_cache(full_path)

    with checkpoint("subtype-tree-data") as needed:
        if needed:
            context_explorer_loader.load_subtype_tree(get_subtype_tree_file())

    def get_oncokb_annotated_maf_file_and_taiga_id():
        metadata = gcsc_depmap.read_json("metadata/oncokb-annotated.json")["in"]
        full_path = metadata["filename"]
        taiga_id = metadata["orig_dataset_id"]
        return gcsc_conseq_depmap.download_to_cache(full_path), taiga_id

    def get_data_availability_file():
        metadata = gcsc_depmap.read_json("metadata/data-avail.json")["in"]
        full_path = metadata["filename"]
        return gcsc_conseq_depmap.download_to_cache(full_path)

    def get_context_analysis_file():
        metadata = gcsc_depmap.read_json("metadata/context_analysis.json")["in"]
        full_path = metadata["filename"]
        return gcsc_conseq_depmap.download_to_cache(full_path)

    if current_app.config["ENABLED_FEATURES"].context_explorer:
        with checkpoint("context-explorer") as needed:
            if needed:
                context_explorer_loader.load_context_explorer(
                    get_data_availability_file()
                )
                log.info(
                    "Adding context explorer ingroup/outgroup analyses to ContextAnalysis"
                )
                context_explorer_loader.load_context_explorer_context_analysis(
                    get_context_analysis_file()
                )

    def get_all_data_availability_file():
        metadata = gcsc_depmap.read_json("metadata/all-data-avail.json")["in"]
        full_path = metadata["filename"]
        return gcsc_conseq_depmap.download_to_cache(full_path)

    if current_app.config["ENABLED_FEATURES"].data_page:
        with checkpoint("data_page") as needed:
            if needed:
                data_page_loader.load_data_page(get_all_data_availability_file())

    with checkpoint("mutations") as needed:
        if needed:
            log.info("loading oncokb dataset version")
            oncokb_dataset_version_taiga_id = gcsc_depmap.read_json(
                "metadata/oncokb-dataset-version.json"
            )["in"]["dataset_id"]
            oncokb_dataset_version_file = taiga_client.download_to_cache(
                oncokb_dataset_version_taiga_id, "csv_table"
            )
            dataset_loader.load_oncokb_dataset_version_date(oncokb_dataset_version_file)

            log.info("loading mutations")
            (
                mutations_file,
                mutations_taiga_id,
            ) = get_oncokb_annotated_maf_file_and_taiga_id()
            dataset_loader.load_mutations(mutations_file, mutations_taiga_id)

    with checkpoint("translocations") as needed:
        if needed:
            log.info("loading translocations")
            translocations_taiga_id = gcsc_depmap.read_json(
                "metadata/translocations-dataset-id.json"
            )["in"]["dataset_id"]
            translocations_file = taiga_client.download_to_cache(
                translocations_taiga_id, "csv_table"
            )
            dataset_loader.load_translocations(
                translocations_file, translocations_taiga_id
            )

    with checkpoint("fusions") as needed:
        if needed:
            log.info("loading fusions")
            fusions_taiga_id = gcsc_depmap.read_json(
                "metadata/fusions-dataset-id.json"
            )["in"]["dataset_id"]
            fusions_file = taiga_client.download_to_cache(fusions_taiga_id, "csv_table")
            dataset_loader.load_fusions(fusions_file, fusions_taiga_id)

    with checkpoint("transcription-start-sites") as needed:
        if needed:
            log.info("loading transcription start sites")
            tss_taiga_id = gcsc_depmap.read_json("metadata/rrbs-metadata.json")["in"][
                "dataset_id"
            ]
            tss_file = taiga_client.download_to_cache(tss_taiga_id, "csv_table")
            transcription_start_site_loader.load_transcription_start_sites(tss_file)

    biomarker_matrix_artifacts = gcsc_depmap.read_json("metadata/biom-matrices.json")[
        "in"
    ]
    for biomarker_artifact in biomarker_matrix_artifacts:
        biomarker_category, biomarker_dataset_id, biomarker_filename = itemgetter(
            "category", "source_dataset_id", "filename"
        )(biomarker_artifact)
        assert all(
            v is not None
            for v in [biomarker_category, biomarker_dataset_id, biomarker_filename]
        )
        with checkpoint(f"biomarker-matrix-{biomarker_category}") as needed:
            if needed:
                biomarker_enum, dataset_meta = next(
                    (e, m)
                    for (e, m) in DATASET_METADATA.items()
                    if isinstance(e, BiomarkerEnum)
                    and isinstance(m, DatasetLabel)
                    and m.s3_json_name == biomarker_category
                )

                log.info(f"Adding biomarker matrix: {biomarker_enum.name}")

                log.info(f"Downloading artifact_file {biomarker_filename}")
                file_path = gcsc_depmap.download_to_cache(biomarker_filename)

                biomarker_obj = dict(
                    **asdict(dataset_meta), taiga_id=biomarker_dataset_id,
                )

                try:
                    dataset_loader.load_biomarker_dataset(
                        biomarker_enum,
                        biomarker_obj,
                        file_path,
                        PUBLIC_ACCESS_GROUP,
                        allow_missing_entities=True,
                    )
                except:
                    log.error(
                        "load_biomarker_dataset threw exception. Some details to aid debugging: biomarker_enum=%s, biomarker_obj=%s, metadata=%s",
                        biomarker_enum,
                        biomarker_obj,
                        biomarker_artifact,
                    )
                    raise  # continue with the exception

    # This goes after biomarker dataset is loaded since the hdf5 files and matrix are also created then
    log.info(f"Adding mutation priority matrix")
    with checkpoint("mutations-prioritized") as needed:
        if needed:
            try:
                dataset_loader.load_mutations_prioritized_biomarker_dataset(
                    current_app.config["WEBAPP_DATA_DIR"],
                    taiga_id_loader.create_derived_taiga_id(),
                )
            except:
                log.error("create_mutation_priority threw exception")
                raise  # continue with the exception

    # this goes after the loads of all Datasets and TabularDatasets, and loading taiga alias, but as early as possible to fail earlier
    log.info("Checking dataset versions")
    db.session.commit()
    dataset_loader.check_dataset_versions_up_to_date()

    with checkpoint("gene-executive") as needed:
        if needed:
            log.info("Loading gene executive info")
            # gene dep summary
            gene_dep_summary_s3_path = gcsc_depmap.read_json(
                "metadata/gene-dep-summary.json"
            )["in"]["filename"]
            gene_dep_summary_file_path = gcsc_conseq_depmap.download_to_cache(
                gene_dep_summary_s3_path
            )

            # genes that were dropped in the transition from avana ceres to chronos
            # we always load this, even of the default is not chronos. the webapp takes care of not showing it if so
            dropped_by_chronos_taiga_id = gcsc_depmap.read_json(
                "metadata/dropped-by-chronos-dataset-id.json"
            )["in"]["dataset_id"]
            dropped_by_chronos_file = taiga_client.download_to_cache(
                dropped_by_chronos_taiga_id, "csv_table"
            )
            gene_loader.load_gene_executive_info(
                gene_dep_summary_file_path, dropped_by_chronos_file,
            )

    associations = gcsc_depmap.read_json("metadata/correlations.json")["in"]
    for association in associations:
        with checkpoint(
            "association-cor-{}-{}".format(
                association["label"], association["category"]
            )
        ) as needed:
            if needed:
                assoc_db = gcsc_conseq_depmap.download_to_cache(association["db"])
                association_loader.load_correlations(
                    assoc_db, association["label"], association["category"]
                )

    with checkpoint("matrix-min-max") as needed:
        if needed:
            ensure_all_max_min_loaded()

    with checkpoint("celligner") as needed:
        if needed:
            celligner_artifact = gcsc_depmap.read_json(
                "metadata/annotated-celligner-output.json"
            )["in"]
            alignment_file = gcsc_depmap.download_to_cache(
                celligner_artifact["alignment"]
            )
            distances_file = gcsc_depmap.download_to_cache(
                celligner_artifact["distances"]
            )
            celligner_loader.load_celligner_data(alignment_file, distances_file)

    if current_app.config["ENABLED_FEATURES"].constellation_app:
        with checkpoint("constellation") as needed:
            if needed:
                constellation_loader.load_constellation_files()

    if not os.path.exists(current_app.config["COMPUTE_RESULTS_ROOT"]):
        os.makedirs(current_app.config["COMPUTE_RESULTS_ROOT"])

    # This has no checkpoint for a few reasons
    # It lets us correct existing nonstandard datasets or add new ones without rebuilding the rest of the db
    # It also creates the nonstandard data dir. Google buckets do not have empty dirs, thus no dir will be created if it is empty
    _load_nonstandard_noncustom_datasets(
        current_app.config["GET_NONSTANDARD_DATASETS"]()
    )

    # Needs to be after dep, biomarker, and nonstandard datasets
    pred_models_json = gcsc_depmap.read_json("metadata/pred-models.json")
    metadata_list = sorted(pred_models_json["in"], key=lambda x: x["dataset"])
    feature_metadata_list = pred_models_json["feature_metadata"]
    for metadata in metadata_list:
        dataset_name = metadata["dataset"]
        with checkpoint(f"predictability-{dataset_name}") as needed:
            if needed:
                log.info(f"Loading {dataset_name} predictability")
                file_path = gcsc_conseq_depmap.download_to_cache(metadata["filename"])
                feature_metadata_path = gcsc_conseq_depmap.download_to_cache(
                    next(
                        fm
                        for fm in feature_metadata_list
                        if fm["label"] == dataset_name
                    )["filename"]
                )
                dataset_enum = DependencyDataset.DependencyEnum(dataset_name)
                load_predictive_model_csv(
                    file_path, dataset_enum.name, feature_metadata_path
                )
                load_predictive_background_from_db(dataset_enum.name)

    with checkpoint("match-related") as needed:
        if needed:
            df = taiga_client.get(current_app.config["MATCH_RELATED_TAIGA_ID"])
            match_related_loader.load_match_related(df)

    if current_app.config["ENABLED_FEATURES"].target_discovery_app:
        with checkpoint("tda") as needed:
            if needed:
                log.info("Adding TDA data")
                filename = gcsc_conseq_depmap.download_to_cache(
                    gcsc_depmap.read_json("metadata/tda-table.json")["in"]["filename"]
                )
                tda_loader.load_tda(filename)

    if current_app.config["ENABLED_FEATURES"].compound_dashboard_app:
        with checkpoint("compound-dashoard-summary") as needed:
            if needed:
                compound_summaries = gcsc_depmap.read_json(
                    "metadata/compound-summary.json"
                )["in"]
                for summary in compound_summaries:
                    summary_table = pd.read_csv(
                        gcsc_depmap.download_to_cache(summary["filename"])
                    )
                    compound_dashboard_loader.load_compound_summary(
                        DependencyEnum(summary["dataset"]), summary_table
                    )

    with checkpoint("canary-custom-dataset") as needed:
        if needed:
            # THIS IS ONLY FOR DEVELOPMENT WARNING PURPOSES
            # THERE SHOULD BE NO LOADING OF CUSTOM DATASETS
            # custom datasets are provided by users after app deploy
            # this is just here to alert us of access control leakage
            log.info("Loading canary custom dataset")
            load_canary_custom_dataset()

    # load taiga aliases for everything else. this needs to happen after Datasets, TabularDatasets, and NonstandardDatasets are loaded
    db.session.commit()  # flush first, anything previously added

    if current_app.config["ENABLED_FEATURES"].private_datasets:
        synchronize_private_datasets(checkpoint)

    with checkpoint("relabel-new-datasets") as needed:
        if needed:
            _relabel_new_datasets_hack()

    # process taiga_ids after private datasets have been loaded
    if process_downloads:
        with transaction():
            taiga_id_loader.assert_loaded_db_taiga_ids_are_canonical()
            taiga_id_loader.load_interactive_canonical_taiga_ids()

    with transaction():
        dataset_display_names = gcsc_depmap.read_json(
            "metadata/dataset-display-names.json"
        )["in"]
        for dataset_display_name in dataset_display_names:
            set_display_name(
                taiga_client,
                dataset_display_name["label"],
                dataset_display_name["dataset_id"],
                dataset_display_name["display_name"],
            )

    with transaction():
        with assume_user("anonymous"):
            global_search_loader.load_global_search_index()
            if process_downloads:
                global_search_loader.load_file_search_index()


def set_display_name(taiga_client, dataset_name, taiga_id, display_name):
    if taiga_client:
        # canonicalize taiga ID because pipeline scripts aren't doing this. Maybe they should?
        taiga_id = taiga_client.get_canonical_id(taiga_id)
        assert taiga_id, f"Could not find canonical taiga ID for {taiga_id}"

    ds = Dataset.get_dataset_by_name(dataset_name, must=False)
    if ds is None:
        print(f"Couldn't find {dataset_name}, skipping...")
    else:
        assert (
            ds.taiga_id == taiga_id
        ), f"When trying to update display_label of {dataset_name} to {display_name}, taiga_ids did not match expected value (datset taiga id was {ds.taiga_id} but expected {taiga_id})"
        ds.display_name = display_name


def synchronize_private_datasets(checkpoint):
    private_datasets_map_df = get_user_upload_records()
    # Delete datasets that have been deleted by a user since the db build
    # This is needed if we are doing a deploy without a clean build
    all_private_dataset_metadata = PrivateDatasetMetadata.get_all()
    dataset_ids_to_keep = [x.dataset_id for x in private_datasets_map_df]
    dataset_ids_to_delete = [
        pdm.dataset_id
        for pdm in all_private_dataset_metadata
        if pdm.dataset_id not in dataset_ids_to_keep
    ]
    if len(dataset_ids_to_delete) > 0:
        log.info(f"Deleting private datasets {dataset_ids_to_delete}")
        delete_private_datasets(dataset_ids_to_delete)
    for row in private_datasets_map_df:
        with checkpoint(f"private-{row.dataset_id}") as needed:
            if needed:
                log.info("Adding private dataset: %s", row.display_name)
                private_dataset_metadata = PrivateDatasetMetadata.get_by_dataset_id(
                    row.dataset_id, must=False
                )
                if private_dataset_metadata is None:
                    nonstandard_private_loader.load_private_dataset_from_df_row(row)

    with transaction():
        with assume_user("anonymous"):
            global_search_loader.load_global_search_index()


def _load_nonstandard_noncustom_datasets(nonstandard_datasets):
    if not os.path.exists(current_app.config["NONSTANDARD_DATA_DIR"]):
        os.makedirs(current_app.config["NONSTANDARD_DATA_DIR"])
    log.info("Checking nonstandard (interactive only) datasets")
    taiga_client = get_taiga_client()

    # delete any invalid datasets
    with transaction():
        for taiga_id in nonstandard_datasets:
            nonstandard_loader.delete_cache_if_invalid_exists(
                taiga_id, nonstandard_datasets[taiga_id]
            )

    # attempt to add. split from deleting invalid so that errors in add so that we can trigger a cache delete by changing the transpose (which will probably break the add)
    with transaction():
        for taiga_id in nonstandard_datasets:
            if not nonstandard_loader.dataset_index_exists(taiga_id):
                try:
                    df = taiga_client.get(taiga_id)
                except Exception as e:
                    # this needs to be a generic exception, because taigapy code raises a generic exception
                    raise Exception("Could not download {}".format(taiga_id)) from e

                with tempfile.NamedTemporaryFile(
                    prefix=taiga_id.replace("/", "-"), suffix=".hdf5"
                ) as temp_hdf5:
                    df_to_hdf5(df, temp_hdf5.name)
                    nonstandard_loader.add_nonstandard_matrix(
                        taiga_id, temp_hdf5.name, PUBLIC_ACCESS_GROUP
                    )


@click.command("fixup_dataset_names")
@with_appcontext
@click.argument("version")
def fixup_dataset_names(version):
    print("Warning: This command is deprecated and no longer does anything")


def load_sample_data(
    dep_datasets_config=None,
    load_genes=True,
    load_taiga_dependencies=True,
    load_celligner=False,
    load_nonstandard=False,
    load_full_constellation=False,
    load_tda_predictability=False,
):
    """
    Split off from initializing the db so that tests can use this too
    :param load_taiga_dependencies: this option is available so that travis can test
        this (minus the taiga parts, which is currently only nonstandard and celligner)
    :return:
    """
    enable_access_controls()

    if dep_datasets_config is None:
        dep_datasets_config = [
            # when adding a dataset, check if it should be added to association_deps and additional_dev_metadata as well
            DependencyEnum.Chronos_Combined,
            DependencyEnum.Chronos_Achilles,
            DependencyEnum.Chronos_Score,
            DependencyEnum.Sanger_CRISPR,
            DependencyEnum.GeCKO,
            DependencyEnum.RNAi_Ach,
            DependencyEnum.RNAi_Nov_DEM,
            DependencyEnum.RNAi_merged,
            DependencyEnum.GDSC1_AUC,
            DependencyEnum.GDSC1_IC50,
            DependencyEnum.GDSC2_AUC,
            DependencyEnum.GDSC2_IC50,
            DependencyEnum.CTRP_AUC,
            DependencyEnum.Repurposing_secondary_AUC,
            DependencyEnum.Repurposing_secondary_dose,
            DependencyEnum.Rep1M,
            DependencyEnum.Rep_all_single_pt,
            DependencyEnum.Prism_oncology_AUC,
            DependencyEnum.Prism_oncology_IC50,
        ]

    if load_taiga_dependencies:
        taiga_client = get_taiga_client()
    else:
        taiga_client = None

    data_load_config = current_app.config["DATA_LOAD_CONFIG"]
    with transaction():
        loader_data_dir = current_app.config["LOADER_DATA_DIR"]

        # load taiga aliases for dataset versions. this needs to happen before datasets are attempted to be load, and thus before check_dataset_versions_up_to_date
        dev_taiga_alias_cache_path = os.path.join(
            current_app.config["WEBAPP_DATA_DIR"], "dev_taiga_alias_cache.csv"
        )
        dev_only_read_cache_to_taiga_alias_table(dev_taiga_alias_cache_path)
        db.session.commit()  # flush first, anything previously added
        taiga_id_loader.load_in_memory_taiga_ids()
        db.session.flush()  # do we need this flush?
        # cache the progress we have made so far in resolving taiga ids, in case a later load step fails
        dev_only_write_taiga_alias_table_to_cache(dev_taiga_alias_cache_path)

        if load_genes:
            # standalone models first
            log.info("Adding gene data")
            gene_loader.load_hgnc_genes(
                os.path.join(loader_data_dir, "gene/hgnc-database-1a29.1.csv")
            )
            gene_loader.load_hgnc_genes(
                os.path.join(
                    loader_data_dir, "interactive/small-hgnc-2a89.2_without_MED1.csv"
                )
            )

            proteomics_loader.load_protein_table(
                os.path.join(loader_data_dir, "protein.csv"),
                taiga_id="fake-protein-taiga-id.1/file",
            )

        log.info("Adding compounds")
        compound_loader.load_compounds("sample_data/compound/compounds.csv")

        if (
            DependencyDataset.DependencyEnum.Repurposing_secondary_dose
            in dep_datasets_config
        ):
            compound_loader.load_repurposing_compound_doses(
                "sample_data/dataset/repurposing-secondary-dose_score.hdf5"
            )

        # csv should contain metadata for all cell lines
        log.info("Adding cell line data")
        cell_line_loader.load_cell_lines_metadata(
            os.path.join(loader_data_dir, "cell_line/cell_line_metadata.csv")
        )

        depmap_model_loader.load_depmap_model_metadata(
            os.path.join(loader_data_dir, "cell_line/models_metadata.csv")
        )

        # TODO: This should eventually completely rreplace the old cell_line_loader.load_contexts
        depmap_model_loader.load_subtype_contexts(
            os.path.join(loader_data_dir, "cell_line/subtype_contexts.csv")
        )

        str_profile_loader.load_str_profiles(
            os.path.join(loader_data_dir, "str_profile/sample_str_profile.csv")
        )

        dataset_loader.load_translocations(
            os.path.join(loader_data_dir, "dataset/translocations.csv"),
            "placeholder-taiga-id.1",
        )
        dataset_loader.load_fusions(
            os.path.join(loader_data_dir, "dataset/fusions.csv"),
            "placeholder-taiga-id.1",
        )
        dataset_loader.load_oncokb_dataset_version_date(
            os.path.join(loader_data_dir, "dataset/oncokb_dataset_version.csv")
        )
        dataset_loader.load_mutations(
            os.path.join(loader_data_dir, "dataset/mutations.csv"),
            "placeholder-taiga-id.1",
        )
        transcription_start_site_loader.load_transcription_start_sites(
            os.path.join(loader_data_dir, "transcription_start_site/rrbs_tss_info.csv")
        )

        log.info(f"Adding dataset data: {dep_datasets_config}")
        for dataset_enum in dep_datasets_config:
            # fixme we have two variables named the same thing, with different capitalization
            # add units and display_name from what we're using for real, i.e production in shared.py
            dataset_metadata = dict(
                **additional_dev_metadata[dataset_enum],
                **asdict(DATASET_METADATA[dataset_enum]),
            )
            dataset_loader.load_single_input_file_dependency_dataset(
                dataset_enum, dataset_metadata, PUBLIC_ACCESS_GROUP
            )

        log.info("Adding dose data")
        for (
            dose_replicate_level_dataset_enum
        ) in data_load_config.dose_replicate_level_datasets:
            dataset_metadata = additional_dev_metadata[
                dose_replicate_level_dataset_enum
            ]
            real_dataset_def = DATASET_METADATA[dose_replicate_level_dataset_enum]

            dataset_loader.load_compound_dose_replicate_dataset(
                os.path.join(
                    loader_data_dir, dataset_metadata["perturbation_csv_file"]
                ),
                os.path.join(
                    loader_data_dir, dataset_metadata["cell_line_index_csv_file"]
                ),
                os.path.join(loader_data_dir, dataset_metadata["hdf5_file"]),
                dose_replicate_level_dataset_enum.name,
                real_dataset_def,
                dataset_metadata["taiga_id"],
                PUBLIC_ACCESS_GROUP,
            )

        log.info("adding dose response curve parameter data")
        dataset_loader.load_curve_parameters_csv(
            "sample_data/compound/ctd2_per_curve.csv"
        )
        dataset_loader.load_curve_parameters_csv(
            "sample_data/compound/gdsc1_per_curve.csv"
        )
        dataset_loader.load_curve_parameters_csv(
            "sample_data/compound/gdsc2_per_curve.csv"
        )
        dataset_loader.load_curve_parameters_csv(
            "sample_data/compound/repurposing_secondary_per_curve.csv"
        )
        dataset_loader.load_curve_parameters_csv(
            "sample_data/compound/prism_oncology_per_curve.csv"
        )
    with transaction():
        log.info("Adding biomarker data")

        biomarker_datasets = [
            BiomarkerEnum.expression,
            BiomarkerEnum.copy_number_absolute,
            BiomarkerEnum.copy_number_relative,
            BiomarkerEnum.mutation_pearson,
            BiomarkerEnum.mutations_hotspot,
            BiomarkerEnum.mutations_damaging,
            BiomarkerEnum.mutations_driver,
            BiomarkerEnum.context,
            BiomarkerEnum.rppa,
            BiomarkerEnum.rrbs,
            BiomarkerEnum.proteomics,
            BiomarkerEnum.sanger_proteomics,
            BiomarkerEnum.ssgsea,
            BiomarkerEnum.fusions,
            BiomarkerEnum.metabolomics,
            BiomarkerEnum.crispr_confounders,
            BiomarkerEnum.rnai_confounders,
            BiomarkerEnum.rep1m_confounders,
            BiomarkerEnum.oncref_confounders,
            BiomarkerEnum.rep_all_single_pt_confounders,
        ]

        for dataset_enum in biomarker_datasets:
            dataset_metadata = dict(
                **additional_dev_metadata[dataset_enum],
                **asdict(DATASET_METADATA[dataset_enum]),
            )

            file_path = os.path.join(
                current_app.config["LOADER_DATA_DIR"],
                "dataset",
                dataset_enum.name + ".hdf5",
            )
            dataset_loader.load_biomarker_dataset(
                dataset_enum, dataset_metadata, file_path, PUBLIC_ACCESS_GROUP
            )

        # This goes after biomarker dataset is loaded since the hdf5 files and matrix are also created then
        log.info(f"Adding mutation priority matrix")
        data_dir = current_app.config["LOADER_DATA_DIR"]
        dataset_loader.load_mutations_prioritized_biomarker_dataset(
            data_dir, "placeholder-taiga-id.1"
        )

        # this goes after the loads of all Datasets and TabularDatasets, but as early as possible to fail earlier
        log.info("Checking dataset versions")
        db.session.flush()
        dataset_loader.check_dataset_versions_up_to_date()

        # Download from Taiga, add depmap_id, and add csv to file system
        log.info("Adding Celligner data")
        if load_taiga_dependencies and load_celligner:
            celligner_loader.load_celligner_sample_data()

        log.info("Adding constellation data")
        if load_full_constellation and load_taiga_dependencies:
            constellation_loader.load_constellation_files()
        else:
            constellation_loader.load_sample_constellation_files()

        log.info("Loading gene guide map")
        gene_loader.load_guide_gene_map(
            os.path.join(
                current_app.config["LOADER_DATA_DIR"], "gene", "guide_gene_map.csv",
            )
        )

        log.info("loading achilles lfc cell file")
        gene_loader.load_achilles_lfc_cell_file(
            os.path.join(
                current_app.config["LOADER_DATA_DIR"],
                "dataset",
                "achilles_lfc_cell.hdf5",
            )
        )

        log.info("loading metmap 500 data")
        metmap_loader.load_metmap_500(
            os.path.join(loader_data_dir, "metmap/metmap500.csv")
        )

        default_crispr_dataset = DependencyDataset.get_dataset_by_data_type_priority(
            DependencyDataset.DataTypeEnum.crispr
        )
        assert default_crispr_dataset
        default_crispr_enum = default_crispr_dataset.name

        gene_loader.load_gene_executive_info(
            os.path.join(loader_data_dir, "gene/dep_summary.csv"),
            os.path.join(loader_data_dir, "gene/dropped_by_chronos.csv"),
        )

        # Associations
        association_deps = [
            ("Chronos_Combined", DependencyEnum.Chronos_Combined.name),
            ("GeCKO", DependencyEnum.GeCKO.name),
            ("RNAi_Ach", DependencyEnum.RNAi_Ach.name),
            ("RNAi_Nov_DEM", DependencyEnum.RNAi_Nov_DEM.name),
            ("RNAi_merged", DependencyEnum.RNAi_merged.name),
            # deliberately dont load correlations for chronos achilles, chronos score, sanger crispr, gdsc and ctrp in dev because we                               can't be bothered to make the sample data
            # we don't actually want to load correlations in these, for dev
            # But we're still stuck with the historical baggage that enrichment loads from these, so we need these for enrichment to                               load correctly
            # So we have special cases hardcoded in load sample data. All this could be organized better.
            (
                "Repurposing_secondary_AUC",
                DependencyEnum.Repurposing_secondary_AUC.name,
            ),
            ("Chronos_Achilles", DependencyEnum.Chronos_Achilles.name),
            ("Chronos_Score", DependencyEnum.Chronos_Score.name),
            ("Sanger_CRISPR", DependencyEnum.Sanger_CRISPR.name),
            ("GDSC1_AUC", DependencyEnum.GDSC1_AUC.name),
            ("GDSC2_AUC", DependencyEnum.GDSC2_AUC.name),
            ("ctd2_drug_auc", DependencyEnum.CTRP_AUC.name),
            ("prism_oncology_auc", DependencyEnum.Prism_oncology_AUC.name)
            # ('ctd2_drug_dose_replicate_level', DependencyEnum.CTRP_dose_replicate.name)
        ]
        association_bioms = [  # remember to add to sample_data/subset_files/calc_sample_data_assoc.py as well
            ("expression", BiomarkerEnum.expression.name),
            ("copy_number_absolute", BiomarkerEnum.copy_number_absolute.name),
            ("mutation_pearson", BiomarkerEnum.mutation_pearson.name),
            ("copy_number_relative", BiomarkerEnum.copy_number_relative.name),
            ("mutations_damaging", BiomarkerEnum.mutations_damaging.name),
            ("mutations_driver", BiomarkerEnum.mutations_driver.name),
            ("mutations_hotspot", BiomarkerEnum.mutations_hotspot.name),
        ]
        get_assoc_db_file = lambda x: os.path.join(
            loader_data_dir, "association/{}.db".format(x)
        )
        for file_name_root, enum_name in association_deps:
            if enum_name not in [
                DependencyDataset.DependencyEnum.Chronos_Score.name,
                DependencyDataset.DependencyEnum.Chronos_Achilles.name,
                DependencyDataset.DependencyEnum.GDSC1_AUC.name,
                DependencyDataset.DependencyEnum.GDSC2_AUC.name,
                DependencyDataset.DependencyEnum.CTRP_AUC.name,
                DependencyDataset.DependencyEnum.Sanger_CRISPR.name,
                DependencyDataset.DependencyEnum.Prism_oncology_AUC.name,
            ]:
                association_loader.load_dep_dep_correlation(
                    get_assoc_db_file("{}_dep_cor".format(file_name_root)), enum_name
                )

        for dep_file_name_root, dep_enum_name in association_deps:
            for (biom_file_name_root, biom_enum_name,) in association_bioms:
                if dep_enum_name not in [
                    DependencyDataset.DependencyEnum.Chronos_Score.name,
                    DependencyDataset.DependencyEnum.Chronos_Achilles.name,
                    DependencyDataset.DependencyEnum.GDSC1_AUC.name,
                    DependencyDataset.DependencyEnum.GDSC2_AUC.name,
                    DependencyDataset.DependencyEnum.CTRP_AUC.name,
                    DependencyDataset.DependencyEnum.Sanger_CRISPR.name,
                    DependencyDataset.DependencyEnum.Prism_oncology_AUC.name,
                ]:
                    association_loader.load_dep_biom_correlation(
                        get_assoc_db_file(
                            "{}_{}_cor".format(dep_file_name_root, biom_file_name_root)
                        ),
                        dep_enum_name,
                        biom_enum_name,
                    )

        ensure_all_max_min_loaded()

        if current_app.config["ENABLED_FEATURES"].private_datasets:
            print("Adding private datasets")
            private_datasets_map_df = get_user_upload_records()
            for row in private_datasets_map_df:
                if "canary" not in row.display_name.lower():
                    print(
                        f"Skipping {row.display_name} because it doesn't have the word canary in it (so probably not a test upload)"
                    )
                    continue
                nonstandard_private_loader.load_private_dataset_from_df_row(row)

        # create a canary custom dataset for dev
        # just as a warning of custom dataset leakage
        if load_nonstandard:
            print("Adding custom canary dataset")
            load_canary_custom_dataset()

        if load_taiga_dependencies and load_nonstandard:
            # Nonstandard datasets used only in interactive
            for taiga_id in current_app.config["GET_NONSTANDARD_DATASETS"]():
                nonstandard_loader.delete_cache_if_invalid_exists(
                    taiga_id, current_app.config["GET_NONSTANDARD_DATASETS"]()[taiga_id]
                )
                if not nonstandard_loader.dataset_index_exists(taiga_id):
                    try:
                        cache_path = taiga_client.download_to_cache(
                            taiga_id, "csv_matrix"
                        )

                    except Exception as e:
                        # this needs to be a generic exception, because taigapy code raises a generic exception
                        raise Exception("Could not download {}".format(taiga_id)) from e

                    csv_name = get_base_name_without_extension(cache_path)
                    with tempfile.NamedTemporaryFile(
                        prefix=csv_name, suffix=".hdf5"
                    ) as temp_hdf5:
                        csv_to_hdf5(cache_path, temp_hdf5.name)
                        nonstandard_loader.add_nonstandard_matrix(
                            taiga_id, temp_hdf5.name, PUBLIC_ACCESS_GROUP
                        )

        log.info("Loading predictability")
        for (dep_enum_name, pred_path, feature_metadata_path, background_path) in [
            (
                default_crispr_enum.name,
                "predictive_models_{}.csv".format(default_crispr_enum.name),
                "predictive_models_feature_metadata_{}.csv".format(
                    default_crispr_enum.name
                ),
                "CRISPR_fit_distribution.csv",
            ),
            (
                DependencyDataset.DependencyEnum.RNAi_merged.name,
                "rnai_predictive_models.csv",
                "rnai_predictive_models_feature_metadata.csv",
                "RNAi_fit_distribution.csv",
            ),
            (
                DependencyDataset.DependencyEnum.Rep1M.name,
                "rep1m_predictive_models.csv",
                "rep1m_predictive_models_feature_metadata.csv",
                "rep1m_fit_distribution.csv",
            ),
            # NOTE: Set predictability data to be same as repurposing primary so don't need to generate sample data since script subset_predictive_models_and_features.py to do so isn't working
            (
                DependencyDataset.DependencyEnum.Rep_all_single_pt.name,
                "prism_primary_predictive_models_{}.csv".format(
                    default_crispr_enum.name
                ),
                "prism_primary_predictive_models_feature_metadata_{}.csv".format(
                    default_crispr_enum.name
                ),
                "PRISM_fit_distribution.csv",
            ),
        ]:
            load_predictive_model_csv(
                os.path.join(
                    current_app.config["LOADER_DATA_DIR"], "predictability", pred_path,
                ),
                dep_enum_name,
                os.path.join(
                    current_app.config["LOADER_DATA_DIR"],
                    "predictability",
                    feature_metadata_path,
                ),
            )
            # load fake sample background, so that the dev figure looks more realistic
            load_predictive_background_from_file(
                os.path.join(
                    current_app.config["LOADER_DATA_DIR"],
                    "predictability",
                    background_path,
                ),
                dep_enum_name,
            )

        log.info("Loading match related")
        path = os.path.join(current_app.config["LOADER_DATA_DIR"], "match_related.csv")
        match_related_loader.load_match_related(pd.read_csv(path))

        if current_app.config["ENABLED_FEATURES"].target_discovery_app:
            log.info("Adding TDA summary data")
            _recreate_td_predictive_model()

            # NOTE: Sample data should now reflect entrez_id as int since it is being directly loaded from conseq
            # instead of Taiga where it was a string
            tda_summary_raw_data = pd.read_csv(
                "sample_data/tda/sample_tda_table.csv", dtype={"entrez_id": int},
            )
            tda_loader.load_tda_summary(tda_summary_raw_data)

            # Needs to be after predictability
            log.info("Adding TDA interpretablity")
            tda_loader.load_interpretable_model(
                os.path.join(
                    current_app.config["LOADER_DATA_DIR"],
                    "predictability",
                    "CRISPR_interpretable_models.csv",
                ),
                default_crispr_enum.name,
            )

            if load_taiga_dependencies and load_tda_predictability:
                log.info("Adding TDA predictability")

                taiga_client = get_taiga_client()
                avana_file = taiga_client.download_to_cache(
                    "predictability-0eda.1/Avana-ensemble-classify", "csv_table"
                )
                rnai_file = taiga_client.download_to_cache(
                    "predictability-0eda.1/RNAi-ensemble-classify", "csv_table"
                )
                tda_loader.load_td_predictive_models(rnai_file, "RNAi_merged")
                tda_loader.load_td_predictive_models(avana_file, "Avana")

        if current_app.config["ENABLED_FEATURES"].compound_dashboard_app:
            log.info("Adding compound summary data")
            compound_summary_primary_csv = pd.read_csv(
                "sample_data/compound_dashboard/compound_summary_primary.csv"
            )

            compound_dashboard_loader.load_compound_summary(
                DependencyEnum.Rep_all_single_pt, compound_summary_primary_csv
            )

            compound_summary_oncref_csv = pd.read_csv(
                "sample_data/compound_dashboard/compound_summary_oncref.csv"
            )

            compound_dashboard_loader.load_compound_summary(
                DependencyEnum.Prism_oncology_AUC, compound_summary_oncref_csv
            )

        if current_app.config["ENABLED_FEATURES"].context_explorer:
            log.info("Adding context explorer data availability info")
            context_explorer_data_avail = pd.read_csv(
                "sample_data/context_explorer/sample_data_avail.csv"
            )
            context_explorer_loader.load_context_explorer_summary(
                current_app.config["WEBAPP_DATA_DIR"], context_explorer_data_avail
            )
            log.info(
                "Adding context explorer ingroup/outgroup analyses to ContextAnalysis"
            )
            context_explorer_loader.load_context_explorer_context_analysis(
                os.path.join(
                    loader_data_dir, "context_explorer/context_analysis_v2.csv"
                )
            )

        if current_app.config["ENABLED_FEATURES"].data_page:
            log.info("Adding data page all data availability info")
            data_page_all_data_avail = pd.read_csv(
                "sample_data/data_page/sample_all_data_avail.csv"
            )
            data_page_loader.load_data_page_summary(
                current_app.config["WEBAPP_DATA_DIR"], data_page_all_data_avail,
            )

        # load taiga aliases. this needs to happen after the loads of Datasets and TabularDatasets, and interactive config
        # DO NOT skip this for dev. we have a caching mechanism instead, to save time in recreating dev db
        dev_taiga_alias_cache_path = os.path.join(
            current_app.config["WEBAPP_DATA_DIR"], "dev_taiga_alias_cache.csv"
        )

        db.session.commit()  # flush first, anything previously added
        taiga_id_loader.assert_loaded_db_taiga_ids_are_canonical()
        taiga_id_loader.load_interactive_canonical_taiga_ids()
        db.session.flush()  # not sure if need this flush?
        dev_only_write_taiga_alias_table_to_cache(dev_taiga_alias_cache_path)

        global_search_loader.load_global_search_index()


def load_canary_custom_dataset():
    """
    Production environments also have access to sample data
    :return:
    """

    label = "Canary custom dataset"
    units = "chirps"
    is_transpose = True
    fn = os.path.join(current_app.config["SAMPLE_DATA_DIR"], "dataset/canary.csv")
    _upload_transient_csv(None, label, units, is_transpose, fn, False, False)


def dev_only_read_cache_to_taiga_alias_table(cache_path):
    """
    This is built specifically for dev
        When recreating dev db, it's annoying that a lot of time is spent hitting the taiga api to resolve the taiga ids for the all the downloads
        At the same time, we don't want to just skip the taiga id aliasing. This is because it can cause unexpected bugs, so we really want to be able to dev on this locally
    Thus, we write to a csv the taiga aliases that have previously been resolved
    """
    assert current_app.config["ENV"] in ["dev", "test-dev"]

    # if cache path doesn't exist, don't do anything
    if os.path.exists(cache_path):
        df = pd.read_csv(cache_path, index_col=0)
        for _, row in df.iterrows():
            db.session.add(
                TaigaAlias(
                    taiga_id=row["taiga_id"],
                    canonical_taiga_id=row["canonical_taiga_id"],
                )
            )


def dev_only_write_taiga_alias_table_to_cache(cache_path):
    assert current_app.config["ENV"] in ["dev", "test-dev"]

    query = TaigaAlias.query
    df = pd.read_sql(query.statement, query.session.connection())
    df.to_csv(cache_path)


@dataclass
class SyncedMetadataType:
    type_name: str
    portal_data_model: type
    id_column: str
    label_column: str
    axis: str


def sync_metadata_to_breadbox():
    from depmap.access_control import assume_user

    # the sync process must be run with a user with admin access
    with assume_user("admin"):
        _sync_metadata_to_breadbox()


def _sync_metadata_to_breadbox():
    """
    Check if breadbox metadata is in sync with the portal's database. If not,
    overwrite breadbox's metadata with values from the legacy database.
    If the taiga id is defined in the portal, use that to compare (more efficient). Otherwise use a hash of the data.
    """
    metadata_data_type = "User upload"

    synced_dimension_types = [
        SyncedMetadataType(
            type_name="depmap_model",
            portal_data_model=DepmapModel,
            id_column="depmap_id",
            label_column="cell_line_name",
            axis="sample",
        ),
        SyncedMetadataType(
            type_name="gene",
            portal_data_model=Gene,
            id_column="entrez_id",
            label_column="label",
            axis="feature",
        ),
    ]

    data_types = breadbox.client.get_data_types()
    if metadata_data_type not in [x.name for x in data_types]:
        breadbox.client.add_data_type(metadata_data_type)

    dim_type_by_name = {
        dim_type.name: dim_type for dim_type in breadbox.client.get_dimension_types()
    }

    for dimension_type in synced_dimension_types:
        # Load info about the dimension from both the portal and breadbox
        portal_metadata_info = TabularDataset.get_by_name(
            dimension_type.type_name, must=False
        )
        breadbox_taiga_id = None

        dim_type = dim_type_by_name.get(dimension_type.type_name)
        if dim_type is not None:
            metadata_dataset_id = dim_type.metadata_dataset_id
            metadata_dataset = breadbox.client.get_dataset(metadata_dataset_id)
            breadbox_taiga_id = metadata_dataset.taiga_id

        # If the portal taiga id exists and matches what's in breadbox, skip to the next metadata type
        portal_taiga_id = (
            portal_metadata_info.taiga_id if portal_metadata_info else None
        )
        if portal_taiga_id and portal_taiga_id == breadbox_taiga_id:
            log.info(
                f"Breadbox {dimension_type.type_name} taiga_id already up-to-date. Skipping metadata sync."
            )
        else:
            # load the data from the portal
            all_entities = dimension_type.portal_data_model.query.all()

            metadata_df = pd.DataFrame(
                {
                    dimension_type.id_column: [
                        str(getattr(entity, dimension_type.id_column))
                        if getattr(entity, dimension_type.id_column)
                        else None
                        for entity in all_entities
                    ],
                    "label": [
                        getattr(entity, dimension_type.label_column)
                        for entity in all_entities
                    ],
                }
            )
            # Filter out rows which have null ids or labels (ex. some genes have null entrez ids)
            metadata_df = metadata_df.dropna()

            if not dim_type:
                # if the type does not exist, create it
                breadbox.client.add_dimension_type(
                    name=dimension_type.type_name,
                    display_name=dimension_type.type_name,
                    id_column=dimension_type.id_column,
                    axis=dimension_type.axis,
                )

            log.info(
                f"Updating {dimension_type.type_name} metadata type in breadbox..."
            )

            _add_dimension_type_metadata(
                breadbox.client,
                dimension_type.id_column,
                dimension_type.type_name,
                metadata_data_type,
                metadata_df,
            )


def _add_dimension_type_metadata(
    client, id_column_name, name, data_type, df, taiga_id=None
):
    # print("head of table")
    # print(df.head)

    columns_metadata = {
        "label": ColumnMetadata(col_type=AnnotationType("text")),
        id_column_name: ColumnMetadata(col_type=AnnotationType("text")),
    }

    assert columns_metadata is not None

    # now that we have a feature type, we can create a table indexed by that feature type
    result = client.add_table_dataset(
        name=f"{name} metadata",
        group_id=client.PUBLIC_GROUP_ID,
        index_type=name,
        data_df=df,
        data_type=data_type,
        columns_metadata=columns_metadata,
        taiga_id=taiga_id,
    )

    # todo: fix client to not return a dict
    dataset_id = result["datasetId"]

    # now associate the data table with the dimension type
    client.update_dimension_type(
        name=name, metadata_dataset_id=dataset_id, properties_to_index=["label"],
    )


@click.command("reload_resources")
@with_appcontext
def reload_resources():
    forum_api_key_value = current_app.config["FORUM_API_KEY"]
    forum_url = current_app.config["FORUM_URL"]
    resources_data_path = current_app.config["RESOURCES_DATA_PATH"]

    if forum_api_key_value is None or forum_url is None or resources_data_path is None:
        raise Exception(
            "Missing forum_api_key_value or forum_url values or resources_data_path!"
        )

    discourse_api_key = read_forum_api_key(forum_api_key_value)

    client = DiscourseClient(discourse_api_key, forum_url, resources_data_path, True)
    refresh_all_category_topics(client, current_app.config["FORUM_RESOURCES_CATEGORY"])
