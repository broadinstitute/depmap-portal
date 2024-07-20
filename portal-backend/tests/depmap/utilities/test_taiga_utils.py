from depmap.taiga_id.utils import get_taiga_id_parts


def test_get_taiga_id_parts():
    id_with_file = "dataset.1/filename"
    dataset, version, file = get_taiga_id_parts(id_with_file)
    assert dataset == "dataset"
    assert version == "1"
    assert file == "filename"

    id_no_file = "dataset.1"
    dataset, version, file = get_taiga_id_parts(id_no_file)
    assert dataset == "dataset"
    assert version == "1"
    assert file is None

    id_no_version = "dataset"
    dataset, version, file = get_taiga_id_parts(id_no_version)
    assert dataset == "dataset"
    assert version is None
    assert file is None
