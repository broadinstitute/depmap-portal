import os
import shutil
import tempfile

import h5py
import numpy as np

from depmap.partials.matrix.models import *
from depmap.utilities import hdf5_utils
from .gene_loader import get_gene
from depmap.utilities.models import log_data_issue
from loader.dataset_loader.utils import get_unique_filename
import uuid


def create_transposed_hdf5(filename):
    t = tempfile.NamedTemporaryFile(delete=False)
    t.close()

    src = h5py.File(filename, mode="r")
    dest = h5py.File(t.name, mode="w")

    dest["dim_1"] = list(src["dim_0"])
    dest["dim_0"] = list(src["dim_1"])
    t_array = np.zeros((len(src["dim_0"]), len(src["dim_1"])))
    t_array[:, :] = src["data"]
    dest["data"] = t_array.transpose()

    return t.name


# Copies file to webapp_data_dir if not already there
def create_matrix_object(
    label,
    source_file_path,
    units,
    owner_id=None,
    allow_missing_entities=False,
    index_entity_list=None,
    coptout_for_no_stable_id=False,
    non_gene_lookup=None,
):
    assert owner_id is not None

    base_name = os.path.basename(source_file_path)
    source_dir = current_app.config["WEBAPP_DATA_DIR"]
    if label is None:
        abs_dest_path = os.path.join(source_dir, base_name)
    else:
        base_name, abs_dest_path = get_unique_filename(label, source_dir)

    if os.path.abspath(source_file_path) != abs_dest_path:
        # assert not os.path.exists(abs_dest_path), "Trying to copy {} to {}, but dest exists".format(source_file_path,
        #                                                                                            abs_dest_path)
        shutil.copy(source_file_path, abs_dest_path)

    if non_gene_lookup is None:
        if coptout_for_no_stable_id:
            entity_lookup = lambda x: Gene.query.filter_by(label=x).one_or_none()
        else:
            try:
                entity_lookup = lambda x: get_gene(x, must=not allow_missing_entities)
            except AssertionError as e:
                raise AssertionError(
                    "Could not load matrix label={}, source_file_path={}".format(
                        label, source_file_path
                    )
                ) from e
    else:
        entity_lookup = non_gene_lookup

    is_row_na, is_col_na = hdf5_utils.get_non_na_rows_and_columns(source_dir, base_name)

    row_index_objects = []
    entity_set = set()
    if index_entity_list is None:
        row_list = hdf5_utils.get_row_index(source_dir, base_name)
        skipped = 0
        for index, gene_symbol in enumerate(row_list):
            entity = entity_lookup(gene_symbol)

            if entity is None:
                skipped += 1
                log_data_issue(
                    "{} Matrix".format(label),
                    "Missing entity",
                    identifier=gene_symbol,
                    id_type="symbol",
                )
                continue

            entity_id = entity.entity_id
            if entity_id in entity_set:
                skipped += 1  # NOTE: Arbitrarily skipping
                # Issues in data where different genes are assigned same entrez ids
                # Since we look up entity by entrez id, same entity is added twice
                log_data_issue(
                    "{} Matrix".format(label),
                    "Gene: {} Entity id: {} for Gene in matrix: {} is already added".format(
                        entity.label, entity_id, gene_symbol
                    ),
                    identifier=gene_symbol,
                    id_type="symbol",
                )
                print(
                    "Gene: {} Entity id: {} for Gene in matrix: {} is already added".format(
                        entity.label, entity_id, gene_symbol
                    )
                )
                continue

            if not is_row_na[index]:
                row_index_objects.append(
                    RowMatrixIndex(owner_id=owner_id, index=index, entity=entity)
                )
            else:
                skipped += 1
                log_data_issue(
                    "{} Matrix".format(label),
                    "Entire row is NA",
                    identifier=gene_symbol,
                    id_type="all_na",
                )

            entity_set.add(entity_id)
        if skipped > 0:
            print(
                "Skipped loading {} rows (out of {}) due to missing IDs, duplicate IDs or all NA rows when loading {} ({})".format(
                    skipped, len(row_list), source_file_path, abs_dest_path
                )
            )
    else:
        for index, entity in index_entity_list:
            row_index_objects.append(
                RowMatrixIndex(owner_id=owner_id, index=index, entity=entity)
            )

    col_list = hdf5_utils.get_col_index(source_dir, base_name)
    missing_cell_lines = 0
    col_index_objects = []

    for index, cell_line_name in enumerate(col_list):
        cell_line = CellLine.get_by_depmap_id(cell_line_name, must=False)

        if cell_line is None:
            cell_line = CellLine.get_by_name_or_depmap_id_for_loaders(
                cell_line_name, must=False
            )

        if cell_line is None:
            missing_cell_lines += 1
            log_data_issue(
                "{} Matrix".format(label),
                "Missing cell line",
                identifier=cell_line_name,
                id_type="cell_line_name",
            )
            continue

        if not is_col_na[index]:
            col_index_objects.append(
                ColMatrixIndex(owner_id=owner_id, index=index, cell_line=cell_line)
            )
        else:
            missing_cell_lines += 1
            log_data_issue(
                "{} Matrix".format(label),
                "Entire row is NA",
                identifier=cell_line_name,
                id_type="all_na",
            )
    if missing_cell_lines > 0:
        print(
            "Skipped loading {} columns (out of {}) due to missing cell lines or all NA columns when loading {}".format(
                missing_cell_lines, len(col_list), source_file_path
            )
        )
        assert (
            missing_cell_lines < len(col_list) * 0.5
        )  # coarse check to make sure something got loaded

    # Just make sure we found at least one row and column. That's a pretty low bar and if we don't something is
    # probably completely wrong with the dataset.
    assert len(row_index_objects) > 0
    assert len(col_index_objects) > 0

    min, max = hdf5_utils.get_values_min_max(source_dir, base_name)

    matrix = Matrix(
        file_path=base_name,
        row_index=row_index_objects,
        col_index=col_index_objects,
        min=min,
        max=max,
        units=units,
        owner_id=owner_id,
        matrix_uuid=uuid.uuid4().hex,
    )

    return matrix


def ensure_all_max_min_loaded():
    """
    Assuming that Matrix objects already exist
    :return:
    """
    for matrix in Matrix.query.all():
        if matrix.min is None or matrix.max is None:
            min, max = hdf5_utils.get_values_min_max(
                current_app.config["WEBAPP_DATA_DIR"], matrix.file_path
            )
            matrix.min = min
            matrix.max = max


def create_viablity_matrix_from_hdf5(
    source_dir, label, perturb_index, cell_line_to_index, hdf5_path, owner_id
):
    base_name, abs_dest_path = get_unique_filename(label, source_dir)
    shutil.copy(hdf5_path, abs_dest_path)

    row_index_objects = []
    for entity, index in perturb_index:
        row_index_objects.append(
            RowMatrixIndex(index=index, entity=entity, owner_id=owner_id)
        )

    col_index_objects = []
    missing_cell_lines = 0

    assert len(cell_line_to_index) > 0
    for cell_line_name, index in cell_line_to_index.items():
        cell_line = CellLine.get_by_depmap_id(cell_line_name, must=False)

        if cell_line is None:
            cell_line = CellLine.get_by_name_or_depmap_id_for_loaders(
                cell_line_name, must=False
            )

        if cell_line is None:
            missing_cell_lines += 1
            log_data_issue(
                "{} Matrix".format(label),
                "Missing cell line",
                identifier=cell_line_name,
                id_type="cell_line_name",
            )
            # assert False, "Missing cell line {}".format(cell_line_name)
            continue

        col_index_objects.append(
            ColMatrixIndex(index=index, cell_line=cell_line, owner_id=owner_id)
        )

    if missing_cell_lines > 0:
        print(
            "Skipped loading {} columns (out of {}) due to missing cell lines".format(
                missing_cell_lines, len(cell_line_to_index)
            )
        )
        assert (
            missing_cell_lines < len(cell_line_to_index) * 0.5
        )  # coarse check to make sure something got loaded

    min, max = hdf5_utils.get_values_min_max(source_dir, base_name)
    matrix = Matrix(
        file_path=base_name,
        row_index=row_index_objects,
        col_index=col_index_objects,
        min=min,
        max=max,
        units="",  # units are being pulled directly from shared.py on the frontend
        owner_id=owner_id,
        matrix_uuid=uuid.uuid4().hex,
    )

    return matrix
