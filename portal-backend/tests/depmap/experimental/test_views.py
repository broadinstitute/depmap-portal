from depmap.experimental.views import slice_hdf5, write_dataset_desc
import h5py
import numpy
from flask import url_for

from depmap.dataset.models import BiomarkerDataset
from tests.factories import (
    BiomarkerDatasetFactory,
    MatrixFactory,
    GeneFactory,
    CellLineFactory,
)


def test_slice(tmpdir):
    hdf5_file = str(tmpdir.join("t.hdf5"))

    with h5py.File(hdf5_file, "w") as f:
        f["data"] = numpy.array(range(3 * 4)).reshape((3, 4))

    s = slice_hdf5(str(tmpdir), "t.hdf5", [0, 2], [1, 2, 3])

    assert (s[0, :] == numpy.array([1, 2, 3])).all()
    assert (s[1, :] == numpy.array([9, 10, 11])).all()


def test_export_csv(app, empty_db_mock_downloads):
    with app.test_client() as c:
        gene1 = GeneFactory(label="G1")
        gene2 = GeneFactory(label="G2")
        cell_line = CellLineFactory(cell_line_display_name="C")

        BiomarkerDatasetFactory(
            name=BiomarkerDataset.BiomarkerEnum.expression,
            matrix=MatrixFactory(
                entities=[gene1, gene2], cell_lines=[cell_line], data=[[1], [2]]
            ),
        )
        empty_db_mock_downloads.session.flush()

        # write out description
        id = write_dataset_desc(["expression"], ["G1", "G2"])

        resp = c.get(url_for("experimental.export_csv", dataset_desc_id=id + ".csv"))
        assert resp.status_code == 200
        assert resp.data == b",C\nexpression G1,1.0\nexpression G2,2.0\n"

        # now, filter to only G2
        id = write_dataset_desc(["expression"], ["G2"])

        resp = c.get(url_for("experimental.export_csv", dataset_desc_id=id + ".csv"))
        assert resp.status_code == 200
        assert resp.data == b",C\nexpression G2,2.0\n"
