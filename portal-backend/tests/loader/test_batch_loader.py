from loader import dataset_loader
import sqlite3
import sqlalchemy
import json


def test_integrity_violation_on_load(tmpdir):
    dump_name = str(tmpdir.join("dump"))
    engine = sqlalchemy.create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute("CREATE TABLE t(x INTEGER PRIMARY KEY)")

        # insert a record which will result in a pk conflict after a few batches
        connection.execute("INSERT INTO t (x) values (4)")

        def generator(pbar):
            for i in range(100):
                yield (i,)

        try:
            dataset_loader.batch_load_from_generator(
                connection,
                "t",
                "insert into t (x) values (?)",
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
            assert x["statement"] == "insert into t (x) values (?)"
            assert len(x["batch"]) == 3
