import pytest
from depmap.compound.api import _get_structure_image
from unittest.mock import patch
from tests.factories import CompoundFactory


@pytest.fixture
def mock_compound():
    """Fixture to create a mock compound."""
    return CompoundFactory(
        smiles="CN(C)C/C=C/C(=O)Nc1cc2c(Nc3ccc(F)c(Cl)c3)ncnc2cc1O[C@H]1CCOC1"
    )


@pytest.fixture
def mock_invalid_compound():
    """Fixture to create a mock compound with no SMILES."""
    return CompoundFactory()


def test_get_structure_image_valid(empty_db_mock_downloads, mock_compound):
    """Test _get_structure_image with a valid compound."""
    with patch("depmap.compound.api.is_url_valid", return_value=True):
        structure_url = _get_structure_image(compound_id=mock_compound.compound_id)
        expected_url = "https://storage.googleapis.com/depmap-compound-images/CN%28C%29C/C%3DC/C%28%3DO%29Nc1cc2c%28Nc3ccc%28F%29c%28Cl%29c3%29ncnc2cc1O%5BC%40H%5D1CCOC1.svg"
        assert structure_url == expected_url


def test_get_structure_image_invalid(empty_db_mock_downloads, mock_invalid_compound):
    """Test _get_structure_image with a compound that has no SMILES."""
    with patch("depmap.compound.api.is_url_valid", return_value=True):
        structure_url = _get_structure_image(
            compound_id=mock_invalid_compound.compound_id
        )
        assert structure_url is None


def test_get_structure_image_invalid_url(empty_db_mock_downloads, mock_compound):
    """Test _get_structure_image with a valid compound but invalid URL."""
    with patch("depmap.compound.api.is_url_valid", return_value=False):
        structure_url = _get_structure_image(compound_id=mock_compound.compound_id)
        assert structure_url is None
