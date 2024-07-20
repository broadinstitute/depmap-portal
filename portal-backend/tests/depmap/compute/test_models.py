from depmap.compute.models import CustomCellLineGroup


def test_add_and_get_depmap_ids(empty_db_mock_downloads):
    test_list = ["test1", "test2"]
    uuid = CustomCellLineGroup.add(test_list)
    assert CustomCellLineGroup.get_depmap_ids(uuid) == test_list
