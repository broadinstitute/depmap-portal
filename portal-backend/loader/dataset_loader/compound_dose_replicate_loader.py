from depmap.enums import DataTypeEnum
from depmap.settings.shared import DepDatasetMeta
import pandas as pd
from depmap.compound.models import CompoundDoseReplicate

from flask import current_app
from depmap.cell_line.models import CellLine
from depmap.database import db
from depmap.dataset.models import DependencyDataset
from loader.dataset_loader.utils import add_dependency_dataset
from depmap.compound.models import CompoundExperiment, DoseResponseCurve
from loader.matrix_loader import create_viablity_matrix_from_hdf5
from depmap.utilities.caching import LazyCache
from depmap.utilities.models import log_data_issue

from depmap.utilities.bulk_load import bulk_load


def _read_cell_line_index_mapping(cell_line_index_csv_file):
    cell_line_to_index = {}
    df = pd.read_csv(cell_line_index_csv_file)
    for i, row in df.iterrows():
        cell_line_to_index[row["cell_line_name"]] = row["index"]

    return cell_line_to_index


def _populate_compound_dose_replicates(perturbation_index_mapping):
    missing_cpd_exps = 0
    compound_dose_replicate_rows = []

    for key, index in perturbation_index_mapping.items():
        compound, replicate, dose, masked = key
        xref_type, xref = CompoundExperiment.split_xref_type_and_xref(compound)
        # see if compound experiment object exists, if none create compound experiment object
        compound_experiment_obj = CompoundExperiment.get_by_xref(
            xref=xref, xref_type=xref_type, must=False
        )
        if compound_experiment_obj is None:
            log_data_issue(
                "CompoundExperiment",
                "CompoundExperiment missing",
                id_type="compound experiment label",
                identifier=compound,
            )
            missing_cpd_exps += 1
        else:
            label = CompoundDoseReplicate.format_label(
                compound_experiment_obj.label,
                dose,
                replicate,
                " masked" if masked else "",
            )

            # check to see if this was already created by a different dataset
            compound_dose_replicate_obj = CompoundDoseReplicate.get_by(label=label)
            # if not, create it
            if compound_dose_replicate_obj is None:
                compound_dose_replicate_obj = CompoundDoseReplicate(
                    compound_experiment=compound_experiment_obj,
                    dose=dose,
                    replicate=replicate,
                    is_masked=masked,
                    label=label,
                )

                db.session.add(compound_dose_replicate_obj)
            compound_dose_replicate_rows.append((compound_dose_replicate_obj, index))
    return compound_dose_replicate_rows


def _read_perturbation_index_mapping(perturbation_csv_file):
    def to_bool(x):
        if isinstance(x, bool):
            return x
        if pd.isna(x) or x.upper() in ("F", "FALSE"):
            return False
        elif x.upper() in ("T", "TRUE"):
            return True
        raise Exception(f"value was neither T or F: {repr(x)}")

    perturb_to_index = {}
    df = pd.read_csv(perturbation_csv_file)
    df["masked"] = [to_bool(x) for x in df["masked"]]
    for i, row in df.iterrows():
        perturb_to_index[
            (row["compound_name"], row["replicate"], row["dose"], row["masked"])
        ] = row["index"]

    return perturb_to_index


# must load after all compound_experiments have been loaded
def load_curve_parameters_csv(filename, label):
    # each row of the file includes cell line name, compound name, ec50, slope, upper asymptote, and lower asymptote

    # use cell line name to look up the corresponding cell line in the CellLine table
    def _lookup_cell_line(cell_line_name):
        cell_line = CellLine.get_by_name_or_depmap_id_for_loaders(
            cell_line_name, must=False
        )
        if cell_line:
            return cell_line
        else:
            log_data_issue(
                "DoseResponseCurve", "Cell Line {} not found".format(cell_line_name)
            )
            return None

    lookup_cell_line = LazyCache(_lookup_cell_line)

    # use compound name (xref_type: xref) to look up the corresponding compoundExperiment
    def _lookup_compound_exp(xref_full):
        compound_exp = CompoundExperiment.get_by_xref_full(xref_full, must=False)
        if compound_exp:
            return compound_exp
        else:
            log_data_issue(
                "DoseResponseCurve",
                "CompoundExperiment for {} not found".format(xref_full),
            )
            return None

    lookup_compound_exp = LazyCache(_lookup_compound_exp)

    def row_to_model_dict(row):
        # in 25Q2 the oncref dose response file contained records with no parameters
        if row["ec50"] == "" or row["slope"] == "":
            log_data_issue(
                "DoseResponseCurve",
                f"Dose curve for {row['cell_line_name']} and {row['compound_name']} had blank parameters",
            )
            return None
        # only add to db if both cell line and compound experiment exist
        cell_line = lookup_cell_line.get(row["cell_line_name"])
        if cell_line and lookup_compound_exp.get(row["compound_name"]):
            assert row["ec50"] != float("inf"), "row {} {} has ec50 {}".format(
                row["cell_line_name"], row["compound_name"], row["ec50"]
            )
            entry_dict = dict(
                drc_dataset_label=label,
                depmap_id=cell_line.depmap_id,
                compound_exp_id=lookup_compound_exp.get(row["compound_name"]).entity_id,
                ec50=row["ec50"],
                slope=row["slope"],
                upper_asymptote=row["upper_asymptote"],
                lower_asymptote=row["lower_asymptote"],
            )
            return entry_dict
        else:
            return None

    bulk_load(filename, row_to_model_dict, DoseResponseCurve.__table__)
    return None


def load_compound_dose_replicate_dataset(
    perturbation_csv_file,
    cell_line_index_csv_file,
    hdf5_file,
    dataset_name,
    dataset_metadata: DepDatasetMeta,
    dataset_taiga_id,
    owner_id,
):
    perturb_to_index = _read_perturbation_index_mapping(perturbation_csv_file)
    cell_line_to_index = _read_cell_line_index_mapping(cell_line_index_csv_file)
    perturb_index = _populate_compound_dose_replicates(perturb_to_index)

    return _load_compound_dose_replicate_dataset(
        dataset_name,
        dataset_metadata,
        dataset_taiga_id,
        perturb_index,
        cell_line_to_index,
        hdf5_file,
        owner_id,
    )


def _load_compound_dose_replicate_dataset(
    dataset_name,
    dataset_metadata: DepDatasetMeta,
    dataset_taiga_id,
    perturb_index,
    cell_line_to_index,
    hdf5_file,
    owner_id,
):
    assert dataset_metadata.data_type == DataTypeEnum.drug_screen
    source_dir = current_app.config["WEBAPP_DATA_DIR"]

    matrix = create_viablity_matrix_from_hdf5(
        source_dir, dataset_name, perturb_index, cell_line_to_index, hdf5_file, owner_id
    )
    db.session.add(matrix)

    add_dependency_dataset(
        name_enum=DependencyDataset.DependencyEnum(dataset_name),
        display_name=dataset_metadata.display_name,
        units=dataset_metadata.units,
        data_type=dataset_metadata.data_type,
        priority=dataset_metadata.priority,
        global_priority=dataset_metadata.global_priority,
        matrix=matrix,
        taiga_id=dataset_taiga_id,
        entity_type="compound_dose_replicate",
        owner_id=owner_id,
    )

    return matrix
