"""Loader for STRProfile model."""
import csv

from depmap.cell_line.models import CellLine, STRProfile
from depmap.database import db
from sqlalchemy.orm.exc import NoResultFound
from depmap.utilities.models import log_data_issue


def load_str_profiles(str_csv):
    """Loads STRProfiles from csv."""
    skipped_depmap_ids = []
    num_inserted = 0

    with open(str_csv) as csvfile:
        for row in csv.DictReader(csvfile, delimiter=","):
            depmap_id = row["Reg ID"]
            if depmap_id.endswith("-01"):
                depmap_id = depmap_id[:-3]  # strip -01 derived id
            assert depmap_id == "" or len(depmap_id) == 10

            try:
                cell_line = CellLine.get_by_depmap_id(depmap_id, must=True)
            except NoResultFound:
                log_data_issue(
                    "STRProfile",
                    "Couldn't find cell line",
                    identifier=depmap_id,
                    id_type="Depmap ID",
                )
                skipped_depmap_ids.append(depmap_id)
                continue
            db.session.add(
                STRProfile(
                    cell_line=cell_line,
                    notation=row["Annotation"],
                    d3s1358=row["D3S1358"],
                    th01=row["TH01"],
                    d21s11=row["D21S11"],
                    d18s51=row["D18S51"],
                    penta_e=row["Penta E"],
                    d5s818=row["D5S818"],
                    d13s317=row["D13S317"],
                    d7s820=row["D7S820"],
                    d16s539=row["D16S539"],
                    csf1po=row["CSF1PO"],
                    penta_d=row["Penta D"],
                    vwa=row["vWA"],
                    d8s1179=row["D8S1179"],
                    tpox=row["TPOX"],
                    fga=row["FGA"],
                    amel=row["AMEL"],
                    mouse=row["Mouse"],
                )
            )
            num_inserted += 1

    assert (
        num_inserted / (num_inserted + len(skipped_depmap_ids)) > 0.6
    ), "Error: >40% of STR profiles were skipped because a cell line could not be found. Inserted {}, skipped{}. Skipped profiles: {}".format(
        num_inserted, len(skipped_depmap_ids), skipped_depmap_ids
    )
