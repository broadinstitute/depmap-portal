import os

from depmap.database import db
from depmap.dataset.models import (
    DependencyDataset,
    BiomarkerDataset,
    TabularDataset,
)
from loader.taiga_id_loader import _ensure_canonical_id_stored


def add_dependency_dataset(
    name_enum,
    display_name,
    units,
    data_type,
    priority,
    global_priority,
    matrix,
    taiga_id,
    entity_type,
    owner_id,
):
    assert units is not None
    assert data_type is not None
    canonical_taiga_id = _ensure_canonical_id_stored(taiga_id)
    display_name_full = display_name

    db.session.add(
        DependencyDataset(
            name=name_enum,
            display_name=display_name_full,
            units=units,
            data_type=data_type,
            priority=priority,
            global_priority=global_priority,
            matrix=matrix,
            taiga_id=canonical_taiga_id,
            entity_type=entity_type,
            owner_id=owner_id,
        )
    )


def add_biomarker_dataset(
    name_enum,
    display_name,
    units,
    data_type,
    priority,
    global_priority,
    matrix,
    taiga_id,
    entity_type,
    owner_id,
):
    canonical_taiga_id = _ensure_canonical_id_stored(taiga_id)

    db.session.add(
        BiomarkerDataset(
            name=name_enum,
            display_name=display_name,
            units=units,
            data_type=data_type,
            priority=priority,
            global_priority=global_priority,
            matrix=matrix,
            taiga_id=canonical_taiga_id,
            entity_type=entity_type,
            owner_id=owner_id,
        )
    )


def add_tabular_dataset(name_enum, taiga_id):
    canonical_taiga_id = _ensure_canonical_id_stored(taiga_id)
    db.session.add(TabularDataset(name=name_enum, taiga_id=canonical_taiga_id))


def get_unique_filename(label, dest_dir, suffix=".hdf5"):
    # use label to construct a meaningful name, but add an index to avoid colliding with existing file
    for i in range(100):
        base_name = f"{label}-{i}.{suffix}"
        abs_dest_path = os.path.join(dest_dir, base_name)
        if not os.path.exists(abs_dest_path):
            break

    return base_name, abs_dest_path
