from dataclasses import dataclass
from typing import Set, List
import scipy.stats
import statsmodels.stats.multitest
import numpy as np
import pandas as pd
import csv
import collections


@dataclass
class Geneset:
    term: str
    term_short: str
    genes: Set[str]


def single_test(hits: Set[str], geneset: Set[str], number_of_genes: int):
    x = len(hits.intersection(geneset)) - 1
    M = number_of_genes
    N = len(hits)
    n = len(geneset)
    return scipy.stats.hypergeom.sf(x, M, n, N)


def overrepresentation_test(
    hits: Set[str], genesets: List[Geneset], p_adjust_method="BH", number_of_genes=None
):
    all_genes = set()
    for gs in genesets:
        all_genes.update(gs.genes)
    hits = hits.intersection(all_genes)

    if number_of_genes is None:
        number_of_genes = len(all_genes)

    overlap = np.zeros(len(genesets))
    geneset_size = np.zeros(len(genesets))
    geneset_genes: List[List[str]] = [None] * len(genesets)
    terms: List[str] = [None] * len(genesets)
    term_shorts: List[str] = [None] * len(genesets)
    for i, geneset in enumerate(genesets):
        terms[i] = geneset.term
        term_shorts[i] = geneset.term_short
        overlap[i] = len(hits.intersection(geneset.genes))
        geneset_size[i] = len(geneset.genes)
        geneset_genes[i] = list(geneset.genes)

    p_vals = scipy.stats.hypergeom.sf(
        overlap - 1, number_of_genes, geneset_size, len(hits)
    )
    np.nan_to_num(p_vals, copy=False, nan=1.0)
    _, adj_p_vals, _, _ = statsmodels.stats.multitest.multipletests(
        p_vals, alpha=0.05, method="fdr_bh"
    )
    df = pd.DataFrame(
        dict(
            term_short=term_shorts,
            term=terms,
            term_size=geneset_size,
            hits_size=len(hits),
            p_value=p_vals,
            p_adjust=adj_p_vals,
            intersect_size=overlap,
            geneset_genes=geneset_genes,
        )
    )
    return df.sort_values("p_adjust")


def read_genesets(filename, delimiter="\t"):
    by_term = collections.defaultdict(lambda: set())
    with open(filename, "rt") as fd:
        r = csv.DictReader(fd, delimiter=delimiter)
        for row in r:
            term = row["term"]
            if term in by_term:
                gs = by_term[term]
            else:
                gs = Geneset(
                    term=row["term"], term_short=row["term_short"], genes=set()
                )
                by_term[term] = gs
            gs.genes.add(row["gene"])
    return list(by_term.values())


def calculate_overrepresentation(hits, gene_sets, number_of_genes=None):
    up_genes = hits[hits["effect"] > 0].sort_values("effect")["feature"]
    down_genes = hits[hits["effect"] < 0].sort_values("effect")["feature"]
    up = overrepresentation_test(
        set(up_genes), gene_sets, number_of_genes=number_of_genes
    )
    down = overrepresentation_test(
        set(down_genes), gene_sets, number_of_genes=number_of_genes
    )

    def reformat(df, type):
        return pd.DataFrame(
            dict(
                type=type,
                term=df["term"],
                term_short=df["term_short"],
                n=df["intersect_size"],
                neg_log_p=-np.log10(df["p_adjust"]),
                p_value=df["p_value"],
                rank=range(df.shape[0]),
                genes=df["geneset_genes"],
            )
        ).head(10)

    return reformat(up, "gene_set_up"), reformat(down, "gene_set_down")
