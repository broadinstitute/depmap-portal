from loader import dataset_loader
import sqlite3
import sqlalchemy
import json


def test_integrity_violation_on_load(tmpdir):
    dump_name = str(tmpdir.join("dump"))
    engine = sqlalchemy.create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(sqlalchemy.text("CREATE TABLE t(x INTEGER PRIMARY KEY)"))

        connection.execute(sqlalchemy.text("INSERT INTO t (x) values (:x)"), {"x": 4})

        def generator(pbar):
            for i in range(100):
                yield {"x": i}

        try:
            dataset_loader.batch_load_from_generator(
                connection,
                "t",
                sqlalchemy.text("insert into t (x) values (:x)"),
                generator,
                100,
                batch_size=3,
                dump_name=dump_name,
            )
            raise Exception("Should not have reached here")
        except sqlalchemy.exc.IntegrityError:
            pass

        with open(dump_name + ".csv", "rt") as fd:
            assert fd.read() == "x\n0\n1\n2\n3\n4\n"

        with open(dump_name + ".json", "rt") as fd:
            x = json.load(fd)
            assert "insert into t" in x["statement"]
            assert len(x["batch"]) == 3
