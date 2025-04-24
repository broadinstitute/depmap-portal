from enum import Enum
import re
import os
from flask import current_app
import shutil

import numpy as np
import pandas as pd
from typing import Optional

from depmap.gene.models import *
from depmap.entity.models import *
from depmap.extensions import db
from depmap.utilities.models import log_data_issue
from depmap.dataset.models import DependencyDataset, TabularDataset
from depmap.cell_line.models import CellLine
from depmap.utilities import hdf5_utils
from depmap.utilities.iter import estimate_line_count, progressbar, chunk_iter
from depmap.utilities.caching import LazyCache
from depmap.utilities.bulk_load import bulk_load
from loader.dataset_loader.utils import add_tabular_dataset


MISSING_ID_PATTERN = re.compile("\\S+ \\(nan\\)")
ENSEMBL_ID_PATTERN = re.compile("\\S+ \\((ENSG\\d+)\\)")
ENSEMBL_ID_PATTERN_2 = re.compile("(ENSG\\d+)")
ENTREZ_ID_PATTERN = re.compile("\\S+ \\((\\d+)\\)")
MISSING_ID_PATTERN_2 = re.compile("\\S+ \\(([^)]+)\\)")
UNIPROT_ID_PATTERN = re.compile("[A-Z][A-Z0-9]+")
MISSING_ID_PATTERN_3 = re.compile("\\S+")

GENE_SCORE_CONFIDENCE_COEFFS_FILE = "gene_score_confidence_coeffs.csv"
from depmap.gene.models import ACHILLES_LFC_CELL_HDF5


def _get_entrez_id_from_gene_symbol(gene_symbol: str) -> Optional[int]:
    m = ENTREZ_ID_PATTERN.match(gene_symbol)
    if m is not None:
        entrez_id = int(m.group(1))
        return entrez_id
    return None


def get_gene(gene_symbol, must=True):
    """
    Temp fix for and target data not having stable IDs
    Delete this function once those data do.
    """
    _entrez_ids = {"MAP4K4": 9448, "MED1": 5469, "NRAS": 4893}

    entrez_id = _get_entrez_id_from_gene_symbol(gene_symbol)
    if entrez_id is not None:
        gene = Gene.query.filter_by(entrez_id=entrez_id).one_or_none()
        if must:
            assert gene is not None, "Could not find gene with entrez_id {}, {}".format(
                entrez_id, gene_symbol
            )
        return gene

    m = ENSEMBL_ID_PATTERN.match(gene_symbol)
    if m is not None:
        id = m.group(1)
        gene = Gene.query.filter_by(ensembl_id=id).one_or_none()
        if must:
            assert (
                gene is not None
            ), "Could not find gene with ensembl_id {}, {}".format(id, gene_symbol)
        return gene

    m = ENSEMBL_ID_PATTERN_2.match(gene_symbol)
    if m is not None:
        id = m.group(1)
        gene = Gene.query.filter_by(ensembl_id=id).one_or_none()
        if must:
            assert (
                gene is not None
            ), "Could not find gene with ensembl_id {}, {}".format(id, gene_symbol)
        return gene

    m = MISSING_ID_PATTERN.match(gene_symbol)
    if m is not None:
        if must:
            raise AssertionError("Missing ID for {}".format(gene_symbol))
        return None

    m = MISSING_ID_PATTERN_2.match(gene_symbol)
    if m is not None:
        if must:
            raise AssertionError("Missing ID for {}".format(gene_symbol))
        return None

    m = MISSING_ID_PATTERN_3.match(gene_symbol)
    if m is not None:
        if must:
            raise AssertionError("Missing ID for {}".format(gene_symbol))
        return None

    # nothing matches
    raise AssertionError("No pattern match for gene_symbol {}".format(gene_symbol))


class GeneIdType(Enum):
    entrez = "entrez"
    ensembl = "ensembl"


def get_gene_from_custom_entity_match(
    gene_symbol_with_id, custom_entity_match, must=True
):
    """
    Parses the row name from an input matrix, extracts the stable ID and uses this to get the entity id 
    """
    m = re.compile(custom_entity_match["regex"]).match(gene_symbol_with_id)
    if m is not None:
        gene_id_type = GeneIdType(custom_entity_match["id_type"])
        if gene_id_type == GeneIdType.entrez:
            id = int(m.group(1))
            gene = Gene.query.filter_by(entrez_id=id).one_or_none()
        elif gene_id_type == GeneIdType.ensembl:
            id = m.group(1)
            gene = Gene.query.filter_by(ensembl_id=id).one_or_none()
        else:
            raise ValueError(
                "No query implemented for GeneIdType {}".format(gene_id_type)
            )

        if gene is None:
            assert not must, "Could not find gene with {} id {}, {}".format(
                gene_id_type, id, gene_symbol_with_id
            )
            return None
        else:
            return gene


def load_hgnc_genes(hgnc_csv: str, taiga_id: Optional[str] = None):
    """
    Loads gene models
    """

    def split_by_pipe(string_or_nan):
        return [] if pd.isnull(string_or_nan) else str(string_or_nan).split("|")

    import csv

    with open(hgnc_csv, "rt") as fd:
        dr = csv.DictReader(fd)
        duplicate_ids = 0
        entrez_ids_seen = set()
        ensembl_ids_seen = set()

        added = 0
        for index, row in enumerate(dr):
            if row["status"] != "Approved":
                continue

            aliases = set(split_by_pipe(row["alias_symbol"]))
            aliases.update(split_by_pipe(row["prev_symbol"]))
            # drop any empty string aliases
            aliases = set([x for x in aliases if x != ""])
            alias_objects = [EntityAlias(alias=alias) for alias in aliases]

            def int_or_none(x):
                if x == "":
                    return None
                else:
                    if x.endswith(".0"):
                        # clean up some bad ids which were accidently stored as floats
                        x = x[:-2]
                    return int(x)

            def str_or_none(x):
                if x == "":
                    return None
                else:
                    return x

            if (row["entrez_id"] != "" and row["entrez_id"] in entrez_ids_seen) or (
                row["ensembl_gene_id"] != ""
                and row["ensembl_gene_id"] in ensembl_ids_seen
            ):
                log_data_issue(
                    "Gene",
                    "entrez_id={} or ensembl_gene_id={} was duplicated".format(
                        row["entrez_id"], row["ensembl_gene_id"]
                    ),
                )
                duplicate_ids += 1
                continue

            entrez_ids_seen.add(row["entrez_id"])
            ensembl_ids_seen.add(row["ensembl_gene_id"])

            uniprot_ids_str = row["uniprot_ids"]
            if uniprot_ids_str != "":
                assert (
                    UNIPROT_ID_PATTERN.match(uniprot_ids_str) != None
                ), "Invalid uniprot ID: {}".format(repr(uniprot_ids_str))
            else:
                uniprot_ids_str = None

            gene = Gene(
                entity_alias=alias_objects,
                label=row["symbol"],
                name=row["name"],
                description="",
                entrez_id=int_or_none(row["entrez_id"]),
                ensembl_id=str_or_none(row["ensembl_gene_id"]),
                hgnc_id=row["hgnc_id"],
                locus_type=row["locus_type"],
                uniprot_ids_str=uniprot_ids_str,
            )
            db.session.add(gene)
            added += 1

    if taiga_id is not None:
        add_tabular_dataset(
            name_enum=TabularDataset.TabularEnum.gene.name, taiga_id=taiga_id
        )

    print(
        "Loaded {} genes, skipped {} due to duplicate IDs".format(added, duplicate_ids)
    )


def load_gene_executive_info(dep_summary_csv, dropped_by_chronos_csv):
    dep_summary = format_dep_summary_csv(dep_summary_csv)
    dropped_by_chronos = format_dropped_by_chronos(dropped_by_chronos_csv)
    merged_gene_executive_info = _merge_gene_executive_info(
        dep_summary, dropped_by_chronos
    )
    _load_gene_executive_info(merged_gene_executive_info)


def _merge_gene_executive_info(dep_summary, dropped_by_chronos):
    """
    Split into a separate function for testing
    """
    # the entrez id column might be a mix of numbers and bad ids like "ZNF765-ZNF761&ZNF761 (110116772&388561)"
    dep_summary = dep_summary.astype({"entrez_id": "str"})
    dropped_by_chronos = dropped_by_chronos.astype({"entrez_id": "str"})
    merged_gene_executive_info = pd.merge(
        dep_summary, dropped_by_chronos, how="outer", on=["entrez_id", "dataset"],
    )
    return merged_gene_executive_info


def _load_gene_executive_info(merged_gene_executive_info):
    skipped = 0
    added = 0

    def _lookup_gene(entrez_id):
        return Gene.get_gene_by_entrez(entrez_id, must=False)

    lookup_gene = LazyCache(_lookup_gene)

    with progressbar(total=merged_gene_executive_info.shape[0]) as pbar:
        for index, row in merged_gene_executive_info.iterrows():
            pbar.update(1)
            entrez_id = row["entrez_id"]
            gene = lookup_gene.get(entrez_id)
            if gene is not None:
                # TEMP HACK
                if row["dataset"] not in DependencyDataset.DependencyEnum.values():
                    continue
                dataset = DependencyDataset.DependencyEnum(row["dataset"])
                num_dependent_cell_lines = (
                    row["dep_lines"] if not pd.isna(row["dep_lines"]) else None
                )
                num_lines_with_data = (
                    row["lines_with_data"]
                    if not pd.isna(row["lines_with_data"])
                    else None
                )
                is_strongly_selective = True if row["is_strongly_selective"] else None
                is_common_essential = (
                    row["is_common_essential"]
                    if not pd.isna(row["is_common_essential"])
                    else None
                )
                is_dropped_by_chronos = (
                    row["is_dropped_by_chronos"]
                    if not pd.isna(row["is_dropped_by_chronos"])
                    else None
                )
                db.session.add(
                    GeneExecutiveInfo(
                        gene=gene,
                        dataset=dataset,
                        num_dependent_cell_lines=num_dependent_cell_lines,
                        num_lines_with_data=num_lines_with_data,
                        is_strongly_selective=is_strongly_selective,
                        is_common_essential=is_common_essential,
                        is_dropped_by_chronos=is_dropped_by_chronos,
                    )
                )
                added += 1
            else:
                log_data_issue(
                    "GeneExecutiveInfo",
                    "Gene entrez id {} not found".format(entrez_id),
                )
                skipped += 1

    print(
        "Loaded {} GeneExecutiveInfo from, skipped {} due to missing genes".format(
            added, skipped
        )
    )


def format_dep_summary_csv(dep_summary_csv: str) -> pd.DataFrame:
    """
    Set gene_id (entrez is) as index
    """
    df = pd.read_csv(dep_summary_csv)
    df.rename(columns={"gene_id": "entrez_id"}, inplace=True)
    df.rename(columns={"label": "dataset"}, inplace=True)
    # df.set_index("gene_id", drop=True, inplace=True)
    return df


def format_dropped_by_chronos(dropped_by_chronos_csv: str) -> pd.DataFrame:
    df = pd.read_csv(dropped_by_chronos_csv, header=0)
    df["entrez_id"] = df["gene"].map(_get_entrez_id_from_gene_symbol)
    assert (
        not df["gene"].isnull().values.any()
    ), "this is a hardcoded list that should not change, and it does not have data issues"

    # df.set_index("entrez_id", inplace=True)
    df["is_dropped_by_chronos"] = True
    default_crispr = DependencyDataset.get_dataset_by_data_type_priority(
        DependencyDataset.DataTypeEnum.crispr
    ).name
    df["dataset"] = default_crispr.name
    del df["gene"]
    return df


def load_gene_score_confidence_coeffs(coeffs_file: str):
    srs = pd.read_csv(coeffs_file, index_col=0, header=None, squeeze=True)

    gene_score_confidence_coefficient = GeneScoreConfidenceCoefficient(
        guide_consistency_mean=srs.guide_consistency_mean,
        guide_consistency_max=srs.guide_consistency_max,
        unique_guides=srs.unique_guides,
        sanger_crispr_consistency=srs.score_consistency,  # note name change from pipeline output to db model
        rnai_consistency=srs.rnai_consistency,
        normLRT=srs.normLRT,
        predictability=srs.predictability,
        top_feature_importance=srs.top_feature_importance,
        top_feature_confounder=srs.top_feature_confounder,
    )
    db.session.add(gene_score_confidence_coefficient)


def load_achilles_lfc_cell_file(file: str):
    """Download achilles logfold change cell and create col and row indexes"""
    source_dir = current_app.config["WEBAPP_DATA_DIR"]
    path = os.path.join(source_dir, ACHILLES_LFC_CELL_HDF5)
    shutil.copyfile(file, path)

    row_index = hdf5_utils.get_row_index(source_dir, ACHILLES_LFC_CELL_HDF5)
    sgrna_index_objects = [
        AchillesLogfoldChangeCellRowIndex(sgrna=sgrna, index=i)
        for i, sgrna in enumerate(row_index)
    ]
    db.session.bulk_save_objects(sgrna_index_objects)

    missing_cell_lines = 0
    col_index = hdf5_utils.get_col_index(source_dir, ACHILLES_LFC_CELL_HDF5)
    for i, cell_line_name in enumerate(col_index):
        cell_line = CellLine.get_by_name_or_depmap_id_for_loaders(
            cell_line_name, must=False
        )

        if cell_line is None:
            missing_cell_lines += 1
            log_data_issue(
                "Achilles LFC Cell cell lines",
                "Missing cell line",
                identifier=cell_line_name,
                id_type="cell_line_name",
            )
        db.session.add(
            AchillesLogfoldChangeCellColIndex(depmap_id=cell_line.depmap_id, index=i)
        )


def load_guide_gene_map(guide_gene_map_filename: str):
    def _lookup_gene(gene_name):
        gene = Gene.get_gene_from_rowname(gene_name, must=False)
        if gene:
            return gene
        else:
            log_data_issue("GuideGeneMap", "Gene for {} not found".format(gene_name))
            return None

    lookup_gene = LazyCache(_lookup_gene)

    def row_to_model_dict(row):
        # only add to db if both gene exists
        if lookup_gene.get(row["gene"]):
            entry_dict = dict(
                gene_id=lookup_gene.get(row["gene"]).entity_id,
                sgrna=row["sgrna"],
                genome_alignment=row["genome_alignment"],
                num_alignments=row["n_alignments"],
            )
            return entry_dict
        else:
            return None

    bulk_load(guide_gene_map_filename, row_to_model_dict, GuideGeneMap.__table__)
    return None
