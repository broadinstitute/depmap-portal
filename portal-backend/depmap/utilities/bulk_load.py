from depmap.utilities.iter import estimate_line_count, progressbar, chunk_iter
import logging
from depmap.extensions import db
import json
import sqlalchemy
import csv

log = logging.getLogger(__name__)


def batch_load_from_generator(
    connection,
    table_name,
    insert_stmt,
    generator,
    expected_count,
    batch_size=1000,
    dump_name=None,
):
    with progressbar(total=expected_count) as pbar:
        for chunk in chunk_iter(generator(pbar), batch_size):
            try:
                connection.execute(insert_stmt, chunk)
            except sqlalchemy.exc.IntegrityError as ex:
                if dump_name is None:
                    dump_name = "bad_{}".format(table_name)
                dump_csv = dump_name + ".csv"
                dump_insert = dump_name + ".json"
                log.error(
                    "Got IntegrityError, dumping %s to %s and insert to %s for debugging purposes",
                    table_name,
                    dump_csv,
                    dump_insert,
                )
                _dump_table_to_csv(connection, table_name, dump_csv)
                with open(dump_insert, "wt") as fd:
                    json.dump({"statement": str(insert_stmt), "batch": chunk}, fd)
                raise ex


def _dump_table_to_csv(connection, table_name, dump_name):
    with open(dump_name, "wt") as fd:
        w = csv.writer(fd)
        result = connection.execute("select * from {}".format(table_name))
        header_written = False
        for row in result:
            if not header_written:
                w.writerow(row.keys())
                header_written = True
            w.writerow([str(x) for x in row])


def bulk_load(filename, transform_row_to_dict, table_obj):
    import csv

    line_count = estimate_line_count(filename)
    with open(filename, "rt") as fd:
        dr = csv.DictReader(fd)
        connection = db.session.connection()

        def pbar_generator(pbar):
            for row in dr:
                obj = transform_row_to_dict(row)
                if obj is None:
                    continue
                if type(obj) == list:
                    for x in obj:
                        yield x
                else:
                    yield obj
                pbar.update(1)

        batch_load_from_generator(
            connection, table_obj.name, table_obj.insert(), pbar_generator, line_count
        )
