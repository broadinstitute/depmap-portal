#!/usr/bin/env python

# Script for reformatting large CpG methlyation data file (>40GB) into a form which can be queried by (cell_line, gene)
# assumes that the file is ordered by cell_line and gene as it processes each pair in turn. (If not assertion will fail)
# To sort file, execute in bash:
# IN=/xchip/cle/portal/CpGmethAll.txt
# OUT=/xchip/datasci/pmontgom/CpGmethAll.txt
# (head -n 1 $IN && tail -n +2 $IN | sort -T /xchip/datasci/pmontgom) > $OUT

import time
import csv
import json
from zlib import decompress, compress
import sqlite3
import os
import sys


def chunk_by_gene_and_line(r):
    seen = set()
    cur_key = None
    rows = []
    for row in r:
        #    print(row)
        key = (row["gene"], row["cellLineName"])
        if cur_key is None or cur_key != key:
            if cur_key is not None:
                yield cur_key, rows
            if key in seen:
                raise Exception(
                    "Already processed {}, but got another record".format(key)
                )
            seen.add(key)
            cur_key = key
            rows = [row]
        else:
            rows.append(row)

    yield cur_key, rows


def pack_col_from_row(rows, name, reformat):
    try:
        return [reformat(row[name]) for row in rows]
    except:
        print("Error with {}".format(name))
        raise


def color_int(x):
    assert x[0] == "#"
    return int(x[1:], 16)


def pack_rows(rows):
    columns = dict(
        position=pack_col_from_row(rows, "position", int),
        methylation=pack_col_from_row(rows, "methylation", float),
        coverage=pack_col_from_row(rows, "coverage", int),
        color=pack_col_from_row(rows, "color", str),
        size=pack_col_from_row(rows, "size", float),
    )
    x = dict(chromosome=rows[0]["chromosome"], columns=columns)
    before_compress = json.dumps(x)
    after_compress = compress(before_compress)
    return after_compress


def unpack_rows(blob):
    return json.loads(decompress(blob))


def batch(sequence, size=10000):
    b = []
    for x in sequence:
        if len(b) >= size:
            yield b
            b = []
        b.append(x)
    if len(b) > 0:
        yield b


def process_rows(fd, r):
    count = 0
    size = 0
    start_time = time.time()
    for key, rows in chunk_by_gene_and_line(r):
        packed = pack_rows(rows)
        size += len(packed)
        # print(count)
        count += 1
        if (count % 100000) == 0:
            print(
                "input pos={}, records={}, output size={}, elapsed={:.2f}".format(
                    fd.tell(), count, size, time.time() - start_time
                )
            )
        yield (key[0], key[1], sqlite3.Binary(packed))


def reformat(source_file, dest_db):
    if os.path.exists(dest_db):
        os.unlink(dest_db)

    conn = sqlite3.connect(dest_db)
    c = conn.cursor()
    c.execute(
        "CREATE TABLE cpg_meth (gene TEXT, cell_line TEXT, packed_data BLOB, PRIMARY KEY (gene, cell_line))"
    )

    with open(source_file, "rt") as fd:
        r = csv.DictReader(fd, delimiter="\t")
        # gene	cellLineName	chromosome	position	methylation	coverage	color	size
        for b in batch(process_rows(fd, r)):
            c.executemany(
                "INSERT INTO cpg_meth (gene, cell_line, packed_data) VALUES (?, ?, ?)",
                b,
            )
            conn.commit()


reformat(sys.argv[1], sys.argv[2])
