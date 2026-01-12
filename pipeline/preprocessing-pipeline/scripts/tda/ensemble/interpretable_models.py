import argparse
import os
import re

import numpy as np
import pandas as pd
from sklearn.tree import DecisionTreeRegressor, export_graphviz


def keep_features(
    summary_row, max_features=3, min_importance=0.01, min_start_importance=0.1
):
    """Select features supplied to interpretable models"""
    return [
        summary_row["feature%i" % i]
        for i in range(max_features)
        if summary_row["feature%i_importance" % i] > min_importance
    ]


def interpretable_models(
    summary: pd.DataFrame,
    X: pd.DataFrame,
    y: pd.DataFrame,
    tree_model: DecisionTreeRegressor,
):
    """
    Parameters:
        summary : ensemble prediction summary for a specific model and gene.
        X : feature matrix indexed by cell line.  
        y : observed viability response indexed by cell line for the same gene. Listed features
                        must be present in X.
        tree_model
    Returns:
        DOT-formatted graph of the decision tree model. 
    """
    features = keep_features(summary)

    stump = DecisionTreeRegressor(max_depth=1)

    # copy of selected features
    x = X[features].dropna(how="any", axis=0)

    shared = sorted(set(x.index) & set(y.index))
    x = x.loc[shared]
    y = y.loc[shared]

    mask = pd.notnull(y) & pd.notnull(x).all(axis=1)
    if sum(mask) < 20:
        raise ValueError(
            "Too few nonull values in common between features and label to train model for %s"
            % y.name
        )

    tree_model.fit(x.values[mask], y[mask])

    # select features that look continuous
    continuous = x.nunique().loc[lambda x: x > 2].index
    # binarize them
    for v in continuous:
        stump.fit(x[[v]].values[mask], y.values[mask])
        threshold = np.round(stump.tree_.threshold[0], 2)
        x[v] = x[v] > threshold
        ind = list(x.columns).index(v)
        # rename for labeling nodes in graph
        x.columns = (
            list(x.columns[:ind])
            + [v + " > %1.2f" % threshold]
            + list(x.columns[ind + 1 :])
        )
    tree_model.fit(x.values[mask], y.values[mask])

    tree = None
    nfeatures = len(set(tree_model.tree_.feature) - set([-2]))
    if nfeatures > 0:
        tree = export_graphviz(
            tree_model,
            None,
            feature_names=x.columns,
            label=y.name,
            filled=True,
            rounded=True,
        )
    return tree


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("summary_path", type=str)
    parser.add_argument("X_path", type=str)
    parser.add_argument("Y_path", type=str)
    args = parser.parse_args()

    summary = (
        pd.read_csv(args.summary_path)
        .query("best")
        .query("feature0 != 'SSMD_Confounders'")
        .query("pearson > .4")
        .query("feature0_importance > .1")
        .drop("model", axis=1)
        .set_index("gene")
    )
    X = pd.read_feather(args.X_path)
    X = X.set_index(X.columns[0])
    Y = pd.read_feather(args.Y_path)
    Y = Y.set_index(Y.columns[0])

    std = Y.stack().std()
    tree_model = DecisionTreeRegressor(
        max_depth=4, min_impurity_decrease=std / 50, min_samples_leaf=5
    )

    interpretable = {
        gene: interpretable_models(summary.loc[gene], X, Y[gene], tree_model)
        for gene in summary.index
    }

    df = pd.DataFrame(list(interpretable.items()), columns=["gene_label", "dot_graph"])
    df = df.dropna()
    df.to_csv("interpretable_model_dot_files.csv", index=False)
