import pytest

from depmap.data_access.response_parsing import (
    is_breadbox_id_format,
    parse_breadbox_slice_id,
)


def test_parse_breadbox_slice_id():
    # Validate that an exception is thrown when the id is malformed
    slice_with_malformed_prefix = "boxbread/dataset/feature"
    slice_with_no_ids = "breadbox/"
    with pytest.raises(AssertionError):
        parse_breadbox_slice_id(slice_with_malformed_prefix)
    with pytest.raises(AssertionError):
        parse_breadbox_slice_id(slice_with_no_ids)

    # Validate that data is parsed as expected
    parsed1 = parse_breadbox_slice_id("breadbox/dataset-foo/feature-foo")
    assert parsed1.dataset_id == "dataset-foo"
    assert parsed1.feature_id == "feature-foo"

    parsed2 = parse_breadbox_slice_id("breadbox/dataset-only")
    assert parsed2.dataset_id == "dataset-only"
    assert parsed2.feature_id is None


def test_is_breadbox_id():
    legacy_id = "some_dataset"
    breadbox_id = "breadbox/dataset-id-foo"

    assert not is_breadbox_id_format(legacy_id)
    assert is_breadbox_id_format(breadbox_id)
