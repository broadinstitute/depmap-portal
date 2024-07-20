import pytest
from sqlalchemy.exc import IntegrityError

from depmap.database import db
from depmap.dataset.models import DependencyDataset


def test_foreign_key_constraint_enabled(empty_db_mock_downloads):
    db.session.add(
        DependencyDataset(
            name=DependencyDataset.DependencyEnum.Avana.name,
            display_name="test",
            type="test",
            taiga_id="test",
            download_file="test",
            matrix_id=0,
        )
    )

    with pytest.raises(IntegrityError):
        db.session.commit()
