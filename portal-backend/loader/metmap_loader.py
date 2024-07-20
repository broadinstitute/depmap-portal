from depmap.cell_line.models import CellLine
from depmap.utilities.models import log_data_issue
from depmap.metmap.models import MetMap500
from depmap.extensions import db
from depmap.dataset.models import TabularDataset
from loader.dataset_loader.utils import add_tabular_dataset
from depmap.utilities.iter import estimate_line_count, progressbar
import csv


def load_metmap_500(file_path, taiga_id=None):
    """
    Loads metmap 500 data.
    Metmap 500 data reference is added to TabularDataset because data in tabular form
    """

    def float_or_none(x):
        if x == "":
            return None
        else:
            # Make sure data is float
            return float(x)

    def str_or_none(x):
        if x == "":
            return None
        else:
            return x

    with open(file_path, "rt") as fd:
        cell_line_tissue_seen = set()
        num_duplicates = 0
        added = 0
        cell_lines_nonexist = 0
        dr = csv.DictReader(fd)
        file_size = estimate_line_count(file_path)
        with progressbar(total=file_size) as pbar:
            for index, row in enumerate(dr):
                # Update progress bar
                pbar.update(1)
                cell_line_tissue = (row["depmap_id"], row["tissue"])
                # Cell line and tissue should supposedly be unique, if not, log as issue
                if cell_line_tissue in cell_line_tissue_seen:
                    log_data_issue(
                        "MetMap500 duplicate",
                        "depmap_id={} cell_line={} and tissue={} was duplicated".format(
                            row["depmap_id"], row["cell_line"], row["tissue"]
                        ),
                    )
                    num_duplicates += 1
                    continue
                # Check if cell line exists in our db
                if (
                    CellLine.get_by_name_or_depmap_id_for_loaders(
                        row["depmap_id"], must=False
                    )
                    is None
                ):
                    log_data_issue(
                        "MetMap500 cell line",
                        "depmap_id={} cell_line={} does not exist in the database".format(
                            row["depmap_id"], row["cell_line"]
                        ),
                    )
                    cell_lines_nonexist += 1
                    continue
                cell_line_tissue_seen.add(cell_line_tissue)

                metmap = MetMap500(
                    ci_05=float_or_none(row["CI.05"]),
                    ci_95=float_or_none(row["CI.95"]),
                    mean=float_or_none(row["mean"]),
                    penetrance=float_or_none(row["penetrance"]),
                    tissue=str_or_none(row["tissue"]),
                    depmap_id=str_or_none(row["depmap_id"]),
                )
                db.session.add(metmap)
                added += 1
    print(
        "Loaded {} metmap data, skipped {} due to duplicate cell lines and tissues, skipped {} due to nonexisting cell lines".format(
            added, num_duplicates, cell_lines_nonexist
        ),
    )

    if taiga_id is not None:
        add_tabular_dataset(
            name_enum=TabularDataset.TabularEnum.metmap.name, taiga_id=taiga_id
        )
        print("Loaded metmap data as tabular dataset")
