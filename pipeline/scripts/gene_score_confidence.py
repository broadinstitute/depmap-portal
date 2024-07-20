# Note that this script caches intermediate points
# To clear the cache from previous runs, delete files that have been written: train_gene_consistency_rnai train_gene_consistency_score consistency_rnai consistency_score guide_consistency_generate_training_sets guide_consistency_agreement
import numpy as np
import pandas as pd
from scipy.stats import spearmanr, pearsonr
import os
import pickle
from taigapy import default_tc as tc
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
import argparse

np.random.seed(1)


def checkpoint(filename, callback, *args):
    if os.path.exists(filename):
        print(f"{filename} exists, load...")
        with open(filename, "rb") as fd:
            result = pickle.load(fd)

    else:
        result = callback(*args)
        with open(filename, "wb") as fd:
            pickle.dump(result, fd)
    return result


def get_metrics(A, B):
    """
    computes a bunch of agreement measures between vectors A and B, suitable for seeing
    whether two measurements of gene effect are in agreement
    """
    assert all(A.index == B.index), "misaligned indices between the two series"
    mask = A.notnull() & B.notnull()
    a = A[mask]
    b = B[mask]
    a = a.loc[b.index]
    meanA = a.mean()
    meanB = b.mean()
    mean_se = (meanA - meanB) ** 2
    mean_mean = 0.5 * (meanA + meanB)
    corr = a.corr(b)
    spearman = spearmanr(a, b)[0]
    varA = a.var()
    varB = b.var()
    var_se = np.abs(varA - varB)
    var_mean = 0.5 * (varA + varB)
    centered_SE = ((a - meanA - b + meanB) ** 2).mean()
    status_agreement = ((a < -0.5) == (b < -0.5)).mean()
    return {
        "mean_se": mean_se,
        "mean_mean": mean_mean,
        "corr": corr,
        "spearman": spearman,
        "var_se": var_se,
        "var_mean": var_mean,
        "centered_SE": centered_SE,
        "max_mean": max(meanA, meanB),
        "min_mean": min(meanA, meanB),
        "max_var": max(varA, varB),
        "min_var": min(varA, varB),
        "max_max": max(max(a), max(b)),
        "min_min": min(min(a), min(b)),
        "status_agreement": status_agreement,
    }


parser = argparse.ArgumentParser()

parser.add_argument("--achilles_lfc_taiga_id", type=str)
parser.add_argument("--achilles_guide_map_taiga_id", type=str)
parser.add_argument("--achilles_replicate_map_taiga_id", type=str)
parser.add_argument("--chronos_achilles_gene_effect_taiga_id", type=str)
parser.add_argument("--expression_taiga_id", type=str)
parser.add_argument("--common_essentials_taiga_id", type=str)
parser.add_argument("--nonessentials_taiga_id", type=str)
parser.add_argument("--Sanger_CRISPR_taiga_id", type=str)
parser.add_argument("--RNAi_merged_taiga_id", type=str)
parser.add_argument("--achilles_predictions_file_path", type=str)
parser.add_argument("--achilles_lrt_file_path", type=str)

achilles_lfc_taiga_id = parser.parse_args().achilles_lfc_taiga_id
achilles_guide_map_taiga_id = parser.parse_args().achilles_guide_map_taiga_id
achilles_replicate_map_taiga_id = parser.parse_args().achilles_replicate_map_taiga_id
gene_effect_achilles_taiga_id = (
    parser.parse_args().chronos_achilles_gene_effect_taiga_id
)
expression_taiga_id = parser.parse_args().expression_taiga_id
common_essentials_taiga_id = parser.parse_args().common_essentials_taiga_id
nonessentials_taiga_id = parser.parse_args().nonessentials_taiga_id
gene_effect_score_taiga_id = parser.parse_args().Sanger_CRISPR_taiga_id
gene_effect_rnai_taiga_id = parser.parse_args().RNAi_merged_taiga_id
achilles_predictions_file_path = parser.parse_args().achilles_predictions_file_path
achilles_lrt_file_path = parser.parse_args().achilles_lrt_file_path

# achilles_lfc_taiga_id = "internal-20q2-7f46.18/Achilles_logfold_change"
# achilles_guide_map_taiga_id = "internal-20q2-7f46.18/Achilles_guide_map"
# achilles_replicate_map_taiga_id = "internal-20q2-7f46.18/Achilles_replicate_map"
# gene_effect_achilles_taiga_id = "internal-20q2-7f46.18/Achilles_gene_effect"
# expression_taiga_id = "internal-20q2-7f46.18/CCLE_expression"
# common_essentials_taiga_id = "internal-20q2-7f46.18/common_essentials"
# nonessentials_taiga_id = "internal-20q2-7f46.18/nonessentials"
# gene_effect_score_taiga_id = "sanger-crispr-project-score--e20b.4/gene_effect"
# gene_effect_rnai_taiga_id = "demeter2-combined-dc9c.19/gene_means_proc"
# fixme last two parameters

print("=== Importing from Taiga ===")
achilles_lfc = tc.get(achilles_lfc_taiga_id)
# achilles_guide_map is needed for reagent plots
achilles_guide_map = tc.get(achilles_guide_map_taiga_id)
achilles_replicate_map = tc.get(achilles_replicate_map_taiga_id).set_index(
    "replicate_ID"
)
# gene_effect_achilles is needed for reagent plots
gene_effect_achilles = tc.get(gene_effect_achilles_taiga_id)

expression = tc.get(expression_taiga_id)
common_essentials = tc.get(common_essentials_taiga_id)["gene"]
nonessentials = tc.get(nonessentials_taiga_id)["gene"]

gene_effect_score = tc.get(gene_effect_score_taiga_id)
gene_effect_rnai = tc.get(
    gene_effect_rnai_taiga_id
).transpose()  # note transpose, putting cell lines as rows

predictions_full = pd.read_csv(achilles_predictions_file_path)
normLRT = pd.read_csv(achilles_lrt_file_path, index_col=0, squeeze=True)

# achilles_lfc_cell is needed for reagent plots
achilles_lfc_cell = achilles_lfc.groupby(
    achilles_replicate_map.DepMap_ID, axis=1
).median()

print("=== Guide Consistency ===")
print("checkpoint guide_consistency_generate_training_sets")


def guide_consistency_generate_training_sets():
    features = []
    is_same = pd.Series()
    nsamples = 5000
    genes = np.random.choice(
        achilles_guide_map.gene.dropna().unique(), size=nsamples, replace=False
    )

    for i, gene in enumerate(genes):
        if not i % 1000:
            print("%1.0f%% done" % (i * 100.0 / len(genes)))
        guides = achilles_guide_map.query('gene == "%s"' % gene).sgrna.tolist()
        if len(guides) < 2:
            continue
        np.random.shuffle(guides)

        out = get_metrics(
            achilles_lfc_cell.loc[guides[0]], achilles_lfc_cell.loc[guides[1]]
        )
        out.update({"gene": gene, "guide1": guides[0], "guide2": guides[1]})
        features.append(out)
        is_same[gene] = 1

    for i, gene in enumerate(genes):
        if not i % 1000:
            print("%1.0f%% done" % (i * 100.0 / len(genes)))
        guides = achilles_guide_map.query('gene == "%s"' % gene).sgrna.tolist()
        if len(guides) < 2:
            continue

        gene2 = gene
        while gene2 == gene or (gene + " x " + gene2) in is_same:
            gene2 = np.random.choice(genes)
            guide2 = np.random.choice(
                achilles_guide_map.query("gene == %r" % gene2).sgrna
            )

        guide1 = guides[0]
        # avoid the (unlikely) case that the two genes happen to share a guide and
        # we've chosen that guide for both genes
        while guide1 == guide2:
            guide1 = np.random.choice(guides)
        np.random.shuffle(guides)
        # a human readable name for the pair of chosen genes
        pseudogene = gene + " x " + gene2

        out = get_metrics(achilles_lfc_cell.loc[guide1], achilles_lfc_cell.loc[guide2])
        out.update({"gene": pseudogene, "guide1": guide1, "guide2": guide2})
        features.append(out)
        is_same[pseudogene] = 0

    features = pd.DataFrame(features).set_index("gene")
    return features, is_same


features, is_same = checkpoint(
    "guide_consistency_generate_training_sets", guide_consistency_generate_training_sets
)

print("Train Model")
model = RandomForestClassifier(
    20, min_impurity_decrease=0.00001, min_samples_leaf=100, max_depth=6
)

model.fit(features.drop(["guide1", "guide2"], axis=1).values, is_same.values)
in_sample = model.predict_proba(features.drop(["guide1", "guide2"], axis=1).values,)[
    :, 1
]

gene_indexed = achilles_guide_map.dropna().set_index("gene").sgrna.drop_duplicates()
print("Agreement metrics")


def guide_consistency_agreement():
    agreement = []
    features = []
    for i, gene in enumerate(gene_indexed.index.unique()):
        if not i % 1000 and i > 0:
            print("%i genes complete" % i)
        guides = gene_indexed.loc[[gene]]
        if len(guides) < 2:
            continue
        for j, guide1 in enumerate(guides[:-1]):
            for guide2 in guides[j + 1 :]:
                assert guide1 != guide2, "%r %s %s" % (guides, guide1, guide2)
                features.append(
                    get_metrics(
                        achilles_lfc_cell.loc[guide1], achilles_lfc_cell.loc[guide2]
                    )
                )
                agreement.append({"gene": gene, "guide1": guide1, "guide2": guide2})
    features = pd.DataFrame(features)
    agreement = pd.DataFrame(agreement)
    return features, agreement


print("checkpoint guide_consistency_agreement")
features, agreement = checkpoint(
    "guide_consistency_agreement", guide_consistency_agreement
)

agreement["agreement"] = model.predict_proba(features.values,)[:, 1]

max_guide_consistency = agreement.groupby("gene")["agreement"].max()
mean_guide_consistency = agreement.groupby("gene")["agreement"].mean()
unique_guides = (
    achilles_guide_map.groupby("sgrna").n_alignments.sum().loc[lambda x: x == 1].index
)

nunique = (
    achilles_guide_map[achilles_guide_map.sgrna.isin(unique_guides)]
    .groupby("gene")
    .n_alignments.count()
)

print("=== Consistency Between Achilles, Score and RNAi data ===")


def train_gene_consistency(A, B, nsamples=5000):
    overlap_genes = sorted(set(A.columns) & set(B.columns))
    assert (
        len(overlap_genes) > 0
    ), "This may suggest an incorrect transpose. A first column: {}, B first column: {}".format(
        A.columns[0], A.columns[0]
    )
    genes = np.random.choice(overlap_genes, nsamples, replace=False)
    np.random.shuffle(genes)
    is_same = pd.Series()
    features = {}

    for i, gene in enumerate(genes):
        if not i % 1000 or i == nsamples - 1:
            print("%1.f done" % (i * 100.0 / nsamples))
        a = A[gene].dropna()
        b = B[gene].dropna()
        overlap_lines = sorted(set(a.index) & set(b.index))
        features[gene] = get_metrics(a[overlap_lines], b[overlap_lines])
        is_same[gene] = 1

        if i == 0:
            gene2 = genes[-1]
        else:
            gene2 = genes[i - 1]
        b = B[gene2].dropna()
        overlap_lines = sorted(set(a.index) & set(b.index))
        pseudogene = "%s x %s" % (gene, gene2)
        features[pseudogene] = get_metrics(a[overlap_lines], b[overlap_lines])
        is_same[pseudogene] = 0

    features = pd.DataFrame(features).T.loc[is_same.index]
    model = RandomForestClassifier(
        20, min_impurity_decrease=0.00001, min_samples_leaf=100, max_depth=6
    )
    model.fit(features.values, is_same.values)
    return model, features, is_same


model_rnai, features_rnai, is_same_rnai = checkpoint(
    "train_gene_consistency_rnai",
    train_gene_consistency,
    gene_effect_achilles,
    gene_effect_rnai,
)
model_score, features_score, is_same_score = checkpoint(
    "train_gene_consistency_score",
    train_gene_consistency,
    gene_effect_achilles,
    gene_effect_score,
)

in_sample = model_rnai.predict_proba(features_rnai.values,)[:, 1]

in_sample = model_score.predict_proba(features_score.values,)[:, 1]


def evaluate_consistency(A, B, model):
    features = {}
    overlap_genes = sorted(set(A.columns) & set(B.columns))
    for i, gene in enumerate(overlap_genes):
        if not i % 1000 and i > 0:
            print("%i genes done" % i)
        a = A[gene].dropna()
        b = B[gene].dropna()
        overlap_lines = sorted(set(a.index) & set(b.index))
        features[gene] = get_metrics(a[overlap_lines], b[overlap_lines])
    features = pd.DataFrame(features).T
    agreement = model.predict_proba(features.values)[:, 1]
    return pd.Series(agreement, index=features.index)


consistency_rnai = checkpoint(
    "consistency_rnai",
    evaluate_consistency,
    gene_effect_rnai,
    gene_effect_achilles,
    model_rnai,
)
consistency_score = checkpoint(
    "consistency_score",
    evaluate_consistency,
    gene_effect_score,
    gene_effect_achilles,
    model_score,
)

print("=== Predictability ===")
predictions = predictions_full[predictions_full["model"] == "Core_omics"].set_index(
    "gene"
)
assert len(predictions) > 0

predictability = predictions["pearson"]
confounded = predictions.feature0.apply(lambda s: s.endswith("confounders"))
top_importance = predictions["feature0_importance"]


print("=== Putting Features Together ===")

# gene_confidence_features_unfilled is needed for plots
gene_confidence_features_unfilled = pd.DataFrame(
    {
        # the alignment of these series are based on their position, not the string value of the index
        "guide_consistency_mean": mean_guide_consistency,
        "guide_consistency_max": max_guide_consistency,
        "unique_guides": nunique,
        "score_consistency": consistency_score,
        "rnai_consistency": consistency_rnai,
        "normLRT": normLRT,
        "predictability": predictability,
        "top_feature_importance": top_importance,
        "top_feature_confounder": confounded,
    }
).loc[gene_effect_achilles.columns]

# fill feature nas with the median
gene_confidence_features = gene_confidence_features_unfilled.copy()
for f in gene_confidence_features:
    gene_confidence_features[f].fillna(
        gene_confidence_features[f].median(), inplace=True
    )

print("=== Creating Training Labels ===")

expression = expression.reindex(
    index=gene_effect_achilles.index, columns=gene_effect_achilles.columns
)
unexpressed = expression < 0.01

depleted = gene_effect_achilles < -0.5

unexpressed_depleted_sum = (unexpressed & depleted).sum()

unexpressed_depleted_genes = unexpressed_depleted_sum.loc[lambda x: x > 1].index

common_essentials = sorted(set(common_essentials) & set(gene_effect_achilles.columns))

essentials_not_depleted = (
    gene_effect_achilles[common_essentials].median().loc[lambda x: x > -0.25].index
)

not_consistent = sorted(
    set(consistency_score.loc[lambda x: x < 0.2].index)
    & set(consistency_rnai.loc[lambda x: x < 0.5].index)
)


rnai_agree = consistency_rnai.loc[lambda x: x > 0.7].index

nonessentials = sorted(set(nonessentials) & set(gene_effect_achilles.columns))

good_nonessentials = (
    (
        (gene_effect_achilles[nonessentials].max() < 0.6)
        & (gene_effect_achilles[nonessentials].min() > -0.6)
    )
    .loc[lambda x: x]
    .index
)

good_essentials = (
    gene_effect_achilles[common_essentials].quantile(0.9).loc[lambda x: x < -0.25].index
)

related_predictable = predictions_full[
    (predictions_full["model"] == "Related") & (predictions_full["pearson"] > 0.4)
]
related_predictable = related_predictable[
    related_predictable.feature0.apply(lambda s: s.endswith("-confounders"))
].index

consistent_guides = sorted(
    set(mean_guide_consistency.loc[lambda x: x > 0.9].index)
    & set(nunique.loc[lambda x: x >= 4].index)
)

bad_genes = (
    set(np.random.choice(unexpressed_depleted_genes, 200, replace=False))
    | set(essentials_not_depleted)
    | set(not_consistent)
)

rescued_genes = (
    set(rnai_agree)
    | set(good_nonessentials)
    | set(good_essentials)
    | set(related_predictable)
    | set(consistent_guides)
)

good_genes = sorted(set(gene_effect_achilles.columns) - set(bad_genes))

bad_genes = sorted(bad_genes - rescued_genes)

good_genes = list(np.random.choice(good_genes, size=len(bad_genes), replace=False))

print("=== Training a Model ===")
confidence_model = LogisticRegression()

confidence_model.fit(
    gene_confidence_features.loc[good_genes + bad_genes].values,
    [1] * len(good_genes) + [0] * len(bad_genes),
)
# gene_confidence is needed for plots
gene_confidence = pd.Series(
    confidence_model.predict_proba(gene_confidence_features.values)[:, 1],
    index=gene_confidence_features.index,
)
gene_confidence_features_unfilled["confidence"] = gene_confidence
gene_confidence_features_unfilled["unique_guides"].fillna(0, inplace=True)
gene_confidence_features_unfilled["gene"] = gene_confidence_features_unfilled.index
gene_confidence_features_unfilled.to_csv("gene_confidence_features_unfilled.csv")

pd.Series(
    confidence_model.coef_[0], index=gene_confidence_features.columns
) * gene_confidence_features.std()
coeffs = pd.Series(confidence_model.coef_[0], index=gene_confidence_features.columns)
coeffs.to_csv("coeffs.csv")
