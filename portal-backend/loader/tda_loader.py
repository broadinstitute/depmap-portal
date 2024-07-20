import os
import numpy as np
import pandas as pd
import re
import logging
from matplotlib.colors import LinearSegmentedColormap
from flask import current_app

from depmap.database import db
from depmap.utilities.models import log_data_issue
from depmap.tda.views import get_expected_columns_in_tda_table, TDA_SUMMARY_FILE

from depmap.dataset.models import Dataset
from depmap.gene.models import Gene
from depmap.predictability.models import PredictiveModel
from depmap.tda.models import TDAInterpretableModel
from depmap.predictability.models import TDPredictiveModel
from depmap.utilities.bulk_load import bulk_load

log = logging.getLogger(__name__)

GENE_CARD_URL_TEMPLATE = "https://www.genecards.org/cgi-bin/carddisp.pl?gene={}"
color_scale_min = -1.5
color_scale_max = 1


cdict = {
    "red": [(0, 0.8, 0.8), (0.6, 1, 1), (1, 0.3, 0.3)],
    "green": [(0, 0.3, 0.3), (0.6, 1, 1), (1, 0.4, 0.4)],
    "blue": [(0, 0.1, 0.1), (0.6, 1, 1), (1, 0.8, 0.8)],
}

tree_cmap = LinearSegmentedColormap("DepTree", cdict)


def load_tda_summary(tda_summary_raw_table):
    """Download TDA summary and add entity ID"""
    df = _format_tda_summary(tda_summary_raw_table)
    source_dir = current_app.config["WEBAPP_DATA_DIR"]
    path = os.path.join(source_dir, TDA_SUMMARY_FILE)
    df.to_csv(path, index=False)


def load_tda(filename):
    "Load TDA data from file"
    df = pd.read_csv(filename)
    df = _format_tda_summary(df)
    source_dir = current_app.config["WEBAPP_DATA_DIR"]
    path = os.path.join(source_dir, TDA_SUMMARY_FILE)
    df.to_csv(path, index=False)


def _format_tda_summary(df):
    # At this moment, this entrez_id column comes as an int64 dtype from conseq preprocessing pipeline.
    # However, I am keeping the old code to convert to and check for string dtype in case the dtype changes in the future.
    all_entrez_ids = [str(gene.entrez_id) for gene in Gene.get_all()]
    df["entrez_id"] = df["entrez_id"].astype(str)
    assert (
        type(df["entrez_id"].values[0]) == str
    ), "Entrez ID is not a string; if this has changed, please change this code and sample data"

    # defined as a variable for reuse in logging data issues
    index_of_rows_with_found_entrez_ids = df["entrez_id"].isin(all_entrez_ids)

    # save issues_df and log before we overwrite df
    issues_df = df[~index_of_rows_with_found_entrez_ids]

    # log data issues for symbols that did not match
    for _, row in issues_df.iterrows():
        log_data_issue(
            "tda_summary",
            "Entrez id not found",
            identifier="symbol: {}, entrez_id: {}".format(
                row["symbol"], row["entrez_id"]
            ),
            id_type="entrez_id",
        )

    # forms df with only entrez ids found in Gene
    df = df[index_of_rows_with_found_entrez_ids]
    # converts column to numeric
    df["entrez_id"] = pd.to_numeric(df["entrez_id"])

    return df


def load_interpretable_model(file_path, dataset_name):
    dataset = Dataset.get_dataset_by_name(dataset_name, must=True)

    dots_df = pd.read_csv(file_path)

    for _, row in dots_df.iterrows():
        gene = Gene.get_gene_from_rowname(row["gene_label"], must=False)
        if gene is None:
            log_data_issue(
                "PredictiveModel",
                "Missing gene",
                identifier=row["gene_label"],
                id_type="label",
            )
            continue
        predictive_model = PredictiveModel.get_top_model(
            dataset.dataset_id, gene.entity_id
        )
        db.session.add(
            TDAInterpretableModel(
                predictive_model=predictive_model,
                gene=gene,
                dot_graph=_edit_dot_data(row["dot_graph"]),
            )
        )


def _edit_dot_data(dot_data):
    def clamp(x):
        return max(0, min(x, 255))

    def hexcolor(r, g, b, alpha=1):
        if all([s <= 1.0 for s in (r, g, b)]):
            r = int(r * 256)
            g = int(g * 256)
            b = int(b * 256)
        return "#{0:02x}{1:02x}{2:02x}".format(clamp(r), clamp(g), clamp(b))

    def gene_label_responder(x):
        if x > 0.8:
            return "Strong Dependency"
        elif x > 0.5:
            return "Dependency"
        elif x > 0.15:
            return "Ambiguous"
        else:
            return "Not Dependent"

    def rename_label(s):
        feature_type_full_names = {
            "MutDam": "Damaging mutation",
            "MutDrv": "Driver mutation",
            "MutHot": "Hotspot mutation",
            "RRBS": "RRBS",
            "RPPA": "RPPA",
            "RNAseq": "Expression",
            "metabolomics": "Metabolomics",
        }

        feature_name = None
        feature_type = None

        for k in feature_type_full_names:
            if k in s:
                feature_name = s.split("_" + k)[0]
                feature_type = feature_type_full_names[k] + s.split(k)[1]
                break

        if feature_name is None:
            return s

        r = r".* \(\d*\)"
        m = re.match(r, feature_name)
        if m:
            feature_name = feature_name.split(" (")[0]
        else:
            feature_name = feature_name[:20] + "..."
        return "\\n".join([feature_name, feature_type])

    def split_label(s, split_char="_", length=15):
        """make long labels multiline"""
        if len(s) <= length:
            return s
        possible_splits = s.split(split_char)
        rows = []
        row = None
        for split in possible_splits:
            if not row:
                row = split
                continue
            if len(row) < length:
                row = "_".join([row, split])
            else:
                rows.append(row)
                row = split
        rows.append(row)
        return "\\n".join(rows)

    lines = dot_data.split("\n")
    lines.insert(1, "graph [bgcolor=transparent] ;")
    first = True
    for i in range(2, len(lines) - 1):
        line = lines[i]
        if "->" in line:
            if "False" in line:
                lines[i] = line.replace("False", "True")
            else:
                lines[i] = line.replace("True", "False")
            continue

        elif line.startswith("node") or line.startswith("edge"):
            continue

        # node_core: contains graph node aesthetic
        node_core = line.split("[")[1].split("]")[0].split(", ")
        node_core = dict([v.split('="') for v in node_core])
        rows = node_core["label"].replace('"', "").strip().split("\\n")
        mean = float(rows[-1])

        # recolor node
        r, g, b, a = tree_cmap(
            np.clip(
                (mean - color_scale_min) / (color_scale_max - color_scale_min), 0, 1
            )
        )
        color = hexcolor(r, g, b, a)
        node_core["fillcolor"] = color
        if (r * 256 * 0.299 + g * 256 * 0.587 + b * 256 * 0.114) < 150:
            # https://stackoverflow.com/questions/3942878/how-to-decide-font-color-in-white-or-black-depending-on-background-color/3943023
            node_core["fontcolor"] = "white"

        # add label to leaf nodes
        if len(rows) < 4:
            rows.insert(0, gene_label_responder(mean))

        # remove inequality statement from branch (for space)
        if "<=" in rows[0]:
            rows[0] = rows[0].split("<=")[0]
        # for long feature names, split them into multiple rows
        rows[0] = rename_label(rows[0])
        rows[0] = split_label(rows[0])

        # more verbose labeling for the first node in the tree
        if first:
            rows[2] = "{} ({})".format(round(mean, 2), int(rows[2]))

        # put it back together
        node_core["label"] = "\\n".join([rows[2], rows[0].strip()])
        lines[i] = (
            line.split("[")[0]
            + "["
            + ", ".join('%s="%s"' % tup for tup in node_core.items())
            + "]"
            + line.split("]")[1]
        )

    return "\n".join(lines)


def _parse_feature(feature):
    m = re.match("^(.*)_([^_]+)$", feature)
    name, type = m.groups()
    m = re.match("(\S+) \\((\\d+)\\)", name)
    if m is not None:
        entity = Gene.get_gene_by_entrez(m.group(2), must=False)
        if entity:
            name = entity.label
        else:
            name = m.group(1)

    return name, type


def load_td_predictive_models(filename, dataset_name):
    def lookup_entity_id(gene_or_compound_dose_label):
        def lookup_gene(m):
            entrez_id = m.group(1)

            entity = Gene.get_gene_by_entrez(entrez_id, must=False)
            if entity:
                return entity.entity_id

            return None

        m = re.match("\S+ \\((\\d+)\\)", gene_or_compound_dose_label)
        if m is not None:
            return lookup_gene(m)

        log_data_issue(
            "PredictiveModel",
            "Gene or compound dose label {} not found".format(
                gene_or_compound_dose_label
            ),
        )
        return None

    # load all models
    def row_to_model_dict(row):
        entity_id = lookup_entity_id(row["gene"])
        if entity_id:
            top_feature_label, top_feature_type = _parse_feature(row["feature0"])
            rec = dict(
                dataset_label=str(dataset_name),
                entity_id=entity_id,
                label=row["model"],
                pearson=float(row["pearson"]),
                top_feature_label=top_feature_label,
                top_feature_type=top_feature_type,
            )
            return rec
        else:
            # raise Exception(f"unknown {row}")
            return None

    bulk_load(filename, row_to_model_dict, TDPredictiveModel.__table__)
