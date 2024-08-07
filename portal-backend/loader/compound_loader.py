import csv
from collections import defaultdict
from depmap.compound.models import Compound, CompoundExperiment, CompoundDose
from depmap.entity.models import EntityAlias
from depmap.gene.models import Gene
from depmap.extensions import db
from depmap.utilities import hdf5_utils
from depmap.utilities.models import log_data_issue
import re


def load_compounds(filename):
    """
    Loads compound metadata
    """
    aliases = defaultdict(lambda: set())

    # first pass, merge all aliases
    with open(filename, "rt") as fd:
        dr = csv.DictReader(fd)
        for row in dr:
            name = row["CompoundName"]
            a = aliases[name]

            synonyms = [x.strip() for x in re.split("[,;]", row["Synonyms"])]
            a.update(synonyms)

    # now create compounds and compound experiments
    created_compounds = {}
    seen_compound_experiment_labels = (
        set()
    )  # this is just used to enforce unique constrain and log data issue

    with open(filename, "rt") as fd:
        dr = csv.DictReader(fd)
        duplicate_ids = 0
        name_seen = set()

        added = 0
        for index, row in enumerate(dr):
            if row["CompoundName"] in name_seen:
                duplicate_ids += 1
                log_data_issue(
                    "Compound",
                    "CompoundName={} was duplicated".format(row["CompoundName"]),
                )
                continue

            compound_name = row["CompoundName"]
            units = row["DoseUnit"]
            if compound_name in created_compounds:
                compound = created_compounds[compound_name]
            else:
                alias_objects = [EntityAlias(alias=x) for x in aliases[compound_name]]
                compound = Compound(
                    label=compound_name,
                    entity_alias=alias_objects,
                    compound_id=row["CompoundID"],
                    target_or_mechanism=row["TargetOrMechanism"],
                    target_gene=get_target_genes(row["GeneSymbolOfTargets"]),
                    smiles=row["SMILES"],
                    inchikey=row["InChIKey"],
                    units=units,
                )
                db.session.add(compound)
                created_compounds[compound_name] = compound

            ids = [x.strip() for x in row["SampleIDs"].split(";")]
            for id in ids:
                if id in seen_compound_experiment_labels:
                    log_data_issue(
                        "CompoundExperiment", "id={} was duplicated".format(id)
                    )
                    duplicate_ids += 1
                else:
                    seen_compound_experiment_labels.add(id)
                    xref_type, xref = CompoundExperiment.split_xref_type_and_xref(id)
                    if xref_type in [
                        "GDSC1",
                        "GDSC2",
                        "CTRP",
                        "BRD",
                    ]:  # TODO: Need to change?
                        compound_experiment = CompoundExperiment(
                            label="{} ({})".format(compound_name, id),
                            compound=compound,
                            xref=xref,
                            xref_type=xref_type,
                        )
                        name_seen.add(row["CompoundName"])

                        db.session.add(compound_experiment)
                    # else:
                    # print("skipping", id)
                    added += 1
    print(
        "Loaded {} compounds, skipped {} due to duplicate IDs".format(
            added, duplicate_ids
        )
    )


def get_target_genes(gene_name_of_targets):
    labels = [
        x.strip() for x in re.split("[,;]", gene_name_of_targets) if x.strip() != ""
    ]
    genes = []
    for label in labels:
        gene = Gene.get_by_label(label, must=False)
        if gene is None:
            log_data_issue(
                "CompoundTarget", "Missing gene", identifier=label, id_type="gene"
            )
        else:
            genes.append(gene)
    return genes


def load_repurposing_compound_doses(hdf5_file_with_dose_rows):
    """
    Specifically assuming the format of the repurposing dose data
    Expected format is <broad id>::<dose>::<screen id> or
                       <broad id>::<dose>::<screen id>::PROS001_PR500
    e.g. BRD-A57886255-001-01-1::0.15625::HTS002
    """
    doses = hdf5_utils.get_row_index(
        source_dir=".", file_path=hdf5_file_with_dose_rows
    )  # the function just wants the path split
    input_list = []
    for dose in doses:
        broad_id, dose = dose.split("::")[:2]
        input_list.append((broad_id, dose))

    load_compound_doses(input_list, "BRD")


def load_compound_doses(input_list, xref_type):
    """
    :param input_list: list of (xref, dose) tuples
    :return:
    """
    num_missing_experiments = 0

    for xref, dose in input_list:
        compound_experiment = CompoundExperiment.get_by_xref(
            xref, xref_type, must=False
        )
        if not compound_experiment:
            log_data_issue(
                "CompoundDose",
                "CompoundExperiment for {}:{} not found".format(xref_type, xref),
            )
            num_missing_experiments += 1
            pass
        else:
            label = CompoundDose.format_label(compound_experiment.label, dose)
            db.session.add(
                CompoundDose(
                    label=label, compound_experiment=compound_experiment, dose=dose
                )
            )

    num_loaded = len(input_list) - num_missing_experiments
    assert num_loaded > num_missing_experiments

    print(
        "Loaded {} compound doses, skipped {} due to missing compound experiments".format(
            num_loaded, num_missing_experiments
        )
    )
