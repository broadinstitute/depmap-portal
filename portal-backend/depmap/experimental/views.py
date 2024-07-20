import json
import os
import re
import uuid

import numpy
from flask import (
    Blueprint,
    Response,
    abort,
    current_app,
    render_template,
    request,
    url_for,
)

from depmap.dataset.models import BiomarkerDataset, Dataset, DependencyDataset
from depmap.extensions import csrf_protect
from depmap.utilities.hdf5_utils import open_hdf5_file

blueprint = Blueprint(
    "experimental", __name__, url_prefix="/experimental", static_folder="../static"
)


def slice_hdf5(source_dir, file_path, row_indices, col_indices):
    with open_hdf5_file(source_dir, file_path) as f:
        data = f["data"]
        dest = numpy.zeros((len(row_indices), len(col_indices)))
        for dest_ri, ri in enumerate(row_indices):
            row = data[ri, :]
            # print("x", x)
            # print("dest_ci", dest_ci)
            # print("shape", dest.shape)
            dest[dest_ri, :] = row[col_indices]
        return dest


@blueprint.route("/csv/<path:dataset_desc_id>")
def export_csv(dataset_desc_id):
    # morpheus requires the filename to end in ".csv" in order to know how to parse it
    # so we tack on .csv onto the dataset in the url. However, we need to strip it off to actually look it up
    dataset_desc_id = dataset_desc_id.split(".")[0]

    # sanity check this path before using it to ensure no attempts to reach anywhere else
    assert re.match(
        "[0-9-]+/[0-9a-z-]+", dataset_desc_id
    ), "dataset_desc_path={}".format(dataset_desc_id)

    full_dataset_desc_path = os.path.join(
        current_app.config["COMPUTE_RESULTS_ROOT"], dataset_desc_id, "datasets.json"
    )

    with open(full_dataset_desc_path, "rt") as fd:
        dataset_desc = json.load(fd)

    files = []

    all_columns = set()

    allowed_labels = set([x.lower() for x in dataset_desc["labels"]])
    if len(allowed_labels) == 0:
        allowed_labels = None

    for dataset_name in dataset_desc["datasets"]:
        # print("dataset_name", dataset_name, allowed_labels)

        dataset = Dataset.get_dataset_by_name(dataset_name, must=False)
        if dataset is None:
            abort(404)

        # pull all the data we need from the db because our db connection will not be
        # availible while streaming response
        row_index = [
            (index, label)
            for index, label in dataset.matrix.get_entity_indices_and_labels()
            if (allowed_labels is None or label.lower() in allowed_labels)
        ]
        col_index = [
            (x.index, x.cell_line.cell_line_display_name)
            for x in dataset.matrix.col_index
        ]

        # compute the union of all column labels
        all_columns.update([c for _, c in col_index])

        row_index.sort()
        col_index.sort()

        source_dir = current_app.config["WEBAPP_DATA_DIR"]
        file_path = dataset.matrix.file_path

        files.append((dataset_name, file_path, row_index, col_index))

    column_header = list(all_columns)
    column_header.sort()
    column_to_index = dict([(c, i) for i, c in enumerate(column_header)])

    def chunk_list(l, size):
        for i in range(0, len(l), size):
            yield l[i : i + size]

    def generate():
        yield ",".join([""] + column_header) + "\n"

        for dataset_name, file_path, row_index, col_index in files:
            # print("slice", dataset_name, file_path, row_index)
            hdf5_col_indices = [hdf5_col_index for hdf5_col_index, _ in col_index]

            for chunk in chunk_list(row_index, 500):
                hdf5_row_indices = [hdf5_row_index for hdf5_row_index, _ in chunk]
                # for hdf5_row_index, row_label in chunk:
                #     print("hdf5_row_index", hdf5_row_index, row_label)

                m = slice_hdf5(
                    source_dir, file_path, hdf5_row_indices, hdf5_col_indices
                )
                # print(m)
                for i, row_label in enumerate([x for _, x in chunk]):
                    row = [""] * len(column_header)
                    mrow = m[i]
                    i = 0
                    for _, column_label in col_index:
                        row[column_to_index[column_label]] = str(mrow[i])
                        i += 1
                    yield ",".join([dataset_name + " " + row_label] + row) + "\n"

    return Response(generate(), mimetype="text/csv")


from depmap.user_uploads.utils.task_utils import get_current_result_dir


def write_dataset_desc(datasets, labels):
    result_dir = os.path.join(get_current_result_dir(), str(uuid.uuid4()))
    if not os.path.exists(result_dir):
        os.makedirs(result_dir)

    dataset_desc_file = os.path.join(result_dir, "datasets.json")
    with open(dataset_desc_file, "wt") as fd:
        fd.write(json.dumps(dict(datasets=datasets, labels=labels)))

    return os.path.join(
        os.path.basename(os.path.dirname(result_dir)), os.path.basename(result_dir)
    )


@blueprint.route("/morpheus", methods=["GET", "POST"])
@csrf_protect.exempt
def morpheus():
    if not current_app.config["ENABLED_FEATURES"].morpheus:
        abort(404)

    if "dataset" not in request.values:
        datasets = [
            x.name.value
            for x in BiomarkerDataset.query.all() + DependencyDataset.query.all()
        ]

        return render_template(
            "experimental/morpheus_select_datasets.html", datasets=datasets
        )
    else:
        datasets = request.values.getlist("dataset")
        label_filter_str = request.values.get("label_filter", "")
        labels = re.findall("\\S+", label_filter_str)

        id = write_dataset_desc(datasets, labels)

        dataset_url = json.dumps(
            url_for("experimental.export_csv", dataset_desc_id=id + ".csv")
        )
        return render_template(
            "experimental/morpheus.html", dataset_url_list=dataset_url
        )


@blueprint.route("/morpheus/data_slicer", methods=["GET", "POST"])
def morpheus_data_slicer():
    if not current_app.config["ENABLED_FEATURES"].morpheus:
        abort(404)
    csv_url = request.values.get("csv_url")
    return render_template("experimental/morpheus.html", dataset_url_list=[csv_url])
