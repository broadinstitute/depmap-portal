from depmap.dataset.models import DependencyDataset, BiomarkerDataset, Dataset
from depmap.enums import DependencyEnum, BiomarkerEnum
from depmap.extensions import db
from depmap.correlation.models import CorrelatedDataset
import os
from loader.dataset_loader.utils import get_unique_filename
import shutil


def get_labels_to_dataset_enum_name():
    # sometimes underscores are used in labels, and sometime dashes. Accept either
    yield "ctd2_drug_auc", DependencyEnum.CTRP_AUC
    for v in list(DependencyEnum) + list(BiomarkerEnum):
        yield v.name, v.name
        yield v.name.replace("_", "-"), v.name


pipeline_label_to_dataset = dict(get_labels_to_dataset_enum_name())


def load_correlations(assoc_db: str, label: str, category: str):
    dep_enum_name = pipeline_label_to_dataset[label]
    if category == "dep":
        load_dep_dep_correlation(assoc_db, dep_enum_name)
    else:
        biom_enum_name = pipeline_label_to_dataset[category]
        load_dep_biom_correlation(assoc_db, dep_enum_name, biom_enum_name)


def get_start_association_id():
    query = "select max(association_id) from association"
    max_existing_id = list(db.session.connection().execute(query))[0][0]
    if max_existing_id is None:
        max_existing_id = 0
    return max_existing_id + 1


def load_dep_dep_correlation(db_file, dep_enum_name):
    """
    must=True, otherwise we throw NoneType has no property dataset_id
    """
    dataset_id = DependencyDataset.get_dataset_by_name(
        dep_enum_name, must=True
    ).dataset_id
    load_correlation(db_file, dataset_id, dataset_id)


def load_dep_biom_correlation(db_file, dep_enum_name, biom_enum_name):
    """
    must=True, otherwise we throw NoneType has no property dataset_id
    """
    dep_dataset_id = DependencyDataset.get_dataset_by_name(
        dep_enum_name, must=True
    ).dataset_id
    biom_dataset_id = BiomarkerDataset.get_dataset_by_name(
        biom_enum_name, must=True
    ).dataset_id
    load_correlation(db_file, dep_dataset_id, biom_dataset_id)


from flask import current_app


def load_correlation(db_file, association_dataset_id, association_feature_dataset_id):
    association_dataset = Dataset.get_dataset_by_id(association_dataset_id)
    association_feature_dataset = Dataset.get_dataset_by_id(
        association_feature_dataset_id
    )

    assert isinstance(
        association_dataset.name, DependencyDataset.DependencyEnum
    ) or isinstance(association_dataset.name, BiomarkerDataset.BiomarkerEnum)
    assert isinstance(
        association_feature_dataset.name, DependencyDataset.DependencyEnum
    ) or isinstance(association_feature_dataset.name, BiomarkerDataset.BiomarkerEnum)

    assert os.path.exists(db_file), "{} does not exist".format(db_file)

    association_dataset_name = str(association_dataset.name)
    association_feature_dataset_name = str(association_feature_dataset.name)
    dest_name, abs_dest_name = get_unique_filename(
        f"{association_dataset_name}-{association_feature_dataset_name}-cor",
        current_app.config["WEBAPP_DATA_DIR"],
        suffix=".sqlite3",
    )
    shutil.copy(db_file, abs_dest_name)

    correlated_dataset = CorrelatedDataset(
        dataset_1_id=association_dataset_id,
        dataset_2_id=association_feature_dataset_id,
        filename=dest_name,
    )
    db.session.add(correlated_dataset)
