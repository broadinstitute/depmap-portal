import zlib
import json
import sqlite3
import os

from flask import _app_ctx_stack as stack  # type: ignore
from flask import current_app


class MethylationDbExtension:
    def __init__(self, app=None):
        self.app = app
        if app is not None:
            self.init_app(app)

    def init_app(self, app):
        if hasattr(app, "teardown_appcontext"):
            app.teardown_appcontext(self.teardown)
        else:
            app.teardown_request(self.teardown)

    def teardown(self, exception):
        ctx = stack.top
        if hasattr(ctx, "methylation_db"):
            ctx.methylation_db.close()

    def connect(self):
        return open_db(current_app.config["METHYLATION_DATABASE"])

    @property
    def connection(self):
        ctx = stack.top
        if ctx is not None:
            if not hasattr(ctx, "methylation_db"):
                ctx.methylation_db = self.connect()
            return ctx.methylation_db


class MethylationDb:
    def __init__(self, c):
        self.c = c
        self.cursor = c.cursor()

    def close(self):
        self.c.close()

    def get(self, gene, cell_line):
        self.cursor.execute(
            "select packed_data from cpg_meth where gene = ? and cell_line = ?",
            (gene, cell_line.cell_line_name),
        )
        records = self.cursor.fetchall()
        if len(records) == 0:
            return None

        assert len(records) == 1
        result = unpack(records[0][0])
        result["gene"] = gene
        result["cell_line"] = cell_line.cell_line_display_name
        return result


def open_db(filename):
    assert os.path.exists(filename)

    c = sqlite3.connect(filename)
    return MethylationDb(c)


def unpack(blob):
    return json.loads(zlib.decompress(blob).decode("utf8"))
