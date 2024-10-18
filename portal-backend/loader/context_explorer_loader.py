from cmath import nan
import os
from depmap.compound.models import CompoundExperiment
from depmap.context.models import Context
from depmap.context_explorer.models import ContextAnalysis
from depmap.gene.models import Gene
from depmap.utilities.caching import LazyCache
from depmap.utilities.models import log_data_issue
from loader.dataset_loader.biomarker_loader import _batch_load
import pandas as pd
from depmap.dataset.models import DependencyDataset
from flask import current_app


def load_context_explorer_summary(webapp_data_dir, df: pd.DataFrame):
    source_dir = webapp_data_dir
    dest_path = os.path.join(source_dir, "context_explorer_summary", "data_avail.csv")
    parent_dir = os.path.dirname(dest_path)
    if not os.path.exists(parent_dir):
        os.makedirs(parent_dir)
    df.to_csv(dest_path, index=False)


def load_context_explorer(filename):
    df = pd.read_csv(filename)
    source_dir = current_app.config["WEBAPP_DATA_DIR"]
    dest_path = os.path.join(source_dir, "context_explorer_summary", "data_avail.csv")
    parent_dir = os.path.dirname(dest_path)
    if not os.path.exists(parent_dir):
        os.makedirs(parent_dir)
    df.to_csv(dest_path, index=False)


def _read_context_analyses(dr, pbar, gene_cache, cell_line_cache):
    gene_cache = LazyCache(lambda name: Gene.get_gene_from_rowname(name, must=False))
    context_cache = LazyCache(lambda name: Context.get_by_name(name, must=False))
    compound_cache = LazyCache(
        lambda xref: CompoundExperiment.get_by_xref_full_return_none_if_invalid_id(
            xref, must=False
        )
    )

    skipped_entity = 0
    skipped_context = 0
    loaded = 0

    def _to_nan(num_value):
        if num_value == "" or num_value == "NA":
            return nan
        else:
            return num_value

    for row in dr:
        gene = gene_cache.get(row["entity_id"])
        compound = compound_cache.get(row["entity_id"])

        if gene is None and compound is None:
            skipped_entity += 1
            log_data_issue(
                "ContextAnalysis",
                "Missing entity",
                identifier=row["entity_id"],
                id_type="entity",
            )
            continue

        entity_id = None
        if gene is not None:
            entity_id = gene.entity_id
        else:
            entity_id = compound.entity_id

        context = context_cache.get(row["context_name"])

        if context is None:
            skipped_context += 1
            log_data_issue(
                "ContextAnalysis",
                "Missing context",
                identifier=row["context_name"],
                id_type="context_name",
            )
            continue

        # TODO: Better way to do this???
        dependency_dataset = row["dataset"]
        dataset_str_to_name_mapping = {
            "CRISPR": "Chronos_Combined",
            "PRISMOncRef": "Prism_oncology_AUC",
            "PRISMRepurposing": "Rep_all_single_pt",
        }
        dataset = DependencyDataset.get_dataset_by_name(
            dataset_str_to_name_mapping[dependency_dataset]
        )

        analysis = dict(
            context_name=context.name,
            entity_id=entity_id,
            dependency_dataset_id=dataset.dependency_dataset_id,
            out_group=row["out_group"],
            t_pval=float(_to_nan(row["t_pval"])),
            mean_in=float(_to_nan(row["mean_in"])),
            mean_out=float(_to_nan(row["mean_out"])),
            effect_size=float(_to_nan(row["effect_size"])),
            t_qval=float(_to_nan(row["t_qval"])),
            t_qval_log=float(_to_nan(row["t_qval_log"])),
            n_dep_in=float(_to_nan(row["n_dep_in"])),
            n_dep_out=float(_to_nan(row["n_dep_out"])),
            frac_dep_in=float(_to_nan(row["frac_dep_in"])),
            frac_dep_out=float(_to_nan(row["frac_dep_out"])),
            selectivity_val=float(_to_nan(row["selectivity_val"])),
        )

        yield analysis
        loaded += 1
        pbar.update(1)

    print(
        "Loaded {} context analysis records ({} missing genes/compounds, {} missing context)".format(
            loaded, skipped_entity, skipped_context
        )
    )


def load_context_explorer_context_analysis(db_file):
    _batch_load(db_file, _read_context_analyses, ContextAnalysis.__table__)


def load_context_explorer_context_analysis_dev(db_file):
    _batch_load(db_file, _read_context_analyses, ContextAnalysis.__table__)
