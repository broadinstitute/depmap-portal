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
import numpy as np
from depmap.database import db
from depmap.dataset.models import DependencyDataset
from depmap.context.models_new import SubtypeNode
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

        # HACK until I can figure out the norm for handling PRC- prefixed compounds.
        if gene is None and compound is None:
            entity_id = row["entity_id"]
            compound = compound_cache.get(f"BRD:{entity_id}")

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

        # TODO: This commented out code will come back once subtypes officially
        # replace the context matrix.
        # context = context_cache.get(row["context_name"])

        # if context is None:
        #     skipped_context += 1
        #     log_data_issue(
        #         "ContextAnalysis",
        #         "Missing context",
        #         identifier=row["context_name"],
        #         id_type="context_name",
        #     )
        #     continue

        # TODO: Is there a better way to do this??
        dependency_dataset = row["dataset"]

        dataset_str_to_name_mapping = {
            "CRISPR": "Chronos_Combined",
            "PRISMOncRef": "Prism_oncology_AUC",
            "PRISMRepurposing": "Rep_all_single_pt",
        }

        dataset_name = DependencyDataset.DependencyEnum(
            dataset_str_to_name_mapping[dependency_dataset]
        ).value
        dataset = DependencyDataset.get_dataset_by_name(dataset_name)
        assert dataset is not None

        analysis = dict(
            # TODO: Eventually subtype_code should come from the context cache
            subtype_code=row["subtype_code"],
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


# TODO: Loading the subtype tree should probably eventually be moved to where
# Contexts are currently loaded.
def _load_subtype_tree(df):
    def get_subtype_code_from_node_name(node_name: str):
        if node_name == "" or node_name is None:
            return None

        subsetted_df = df[df["NodeName"] == node_name]

        possible_depmap_model_type = subsetted_df["DepmapModelType"].tolist()
        possible_oncotree_code = subsetted_df["OncotreeCode"].tolist()
        possible_mol_subtype_code = subsetted_df["MolecularSubtypeCode"].tolist()

        if possible_depmap_model_type[0]:
            return possible_depmap_model_type[0]
        elif possible_oncotree_code[0]:
            return possible_oncotree_code[0]
        elif possible_mol_subtype_code[0]:
            return possible_mol_subtype_code[0]

        return None

    for index, row in df.iterrows():
        oncotree_code = row["OncotreeCode"]
        depmap_model_type = row["DepmapModelType"]
        molecular_subtype_code = row["MolecularSubtypeCode"]
        subtype_code = (
            oncotree_code
            if oncotree_code
            else depmap_model_type
            if depmap_model_type
            else molecular_subtype_code
        )
        tree_type = row["TreeType"]
        node_name = row["NodeName"]
        node_level = row["NodeLevel"]

        level_0 = get_subtype_code_from_node_name(row["Level0"])

        level_1 = get_subtype_code_from_node_name(row["Level1"])

        level_2 = get_subtype_code_from_node_name(row["Level2"])

        level_3 = get_subtype_code_from_node_name(row["Level3"])

        level_4 = get_subtype_code_from_node_name(row["Level4"])

        level_5 = get_subtype_code_from_node_name(row["Level5"])

        subtype_node = SubtypeNode(
            subtype_code=subtype_code,
            oncotree_code=oncotree_code,
            depmap_model_type=depmap_model_type,
            molecular_subtype_code=molecular_subtype_code,
            tree_type=tree_type,
            node_name=node_name,
            node_level=node_level,
            level_0=level_0,
            level_1=level_1,
            level_2=level_2,
            level_3=level_3,
            level_4=level_4,
            level_5=level_5,
        )

        db.session.add(subtype_node)


def load_subtype_tree(db_file):
    df = pd.read_csv(db_file)
    df = df.replace(np.nan, None)

    _load_subtype_tree(df)
