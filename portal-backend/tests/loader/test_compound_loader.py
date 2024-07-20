import pytest
from depmap.compound.models import CompoundExperiment


@pytest.mark.parametrize(
    "compound_id, expected_xref_type, expected_xref",
    [
        ("PRC-008632586-537-09", "BRD", "PRC-008632586-537-09"),
        ("BRD:PRC-008632586-537-09", "BRD", "PRC-008632586-537-09"),
        ("BRD:BRD-K01234567", "BRD", "BRD-K01234567"),
        ("BRD:BRD-K01234567-003-09-6", "BRD", "BRD-K01234567-003-09-6"),
        ("GDSC1:4", "GDSC1", "4"),
        ("CTRP:22", "CTRP", "22"),
    ],
)
def test_get_xref_type_and_xref(compound_id, expected_xref_type, expected_xref):
    assert CompoundExperiment.split_xref_type_and_xref(compound_id) == (
        expected_xref_type,
        expected_xref,
    )
