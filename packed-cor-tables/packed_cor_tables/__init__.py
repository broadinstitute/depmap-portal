import struct
import zlib
import sqlite3
import pandas as pd
import numpy as np

from dataclasses import dataclass


@dataclass
class InputMatrixDesc:
    given_ids: list[str]
    taiga_id: str
    name: str


ROW_BYTE_SIZE = 4 + 4 + 4  # 32 bit int, 32 bit float, 32 bit float


def write_dim_labels(cursor, dim_i, given_ids):
    cursor.execute(
        f"create table dim_{dim_i}_given_id (dim_{dim_i} integer, given_id varchar)"
    )
    cursor.executemany(
        f"insert into dim_{dim_i}_given_id (dim_{dim_i} , given_id ) values (?, ?)",
        list(enumerate(given_ids)),
    )


def write_cor_df(
    df: pd.DataFrame,
    dim_0_desc: InputMatrixDesc,
    dim_1_desc: InputMatrixDesc,
    filename: str,
):
    """Writes a sqlite3 table which packs the correlations for a given feature into a single compressed blob"""
    assert set(df.columns) == set(["dim_0", "dim_1", "cor", "log10qvalue"])

    rows = []

    for dim_0, group in df.groupby("dim_0"):
        # sort indices to reduce the amount of entropy in the column and compress better
        # the other columns are floats, so they'll compress poorly regardless
        sorted_group = group.copy().sort_values("dim_1")

        buf = bytearray()
        buf.extend(sorted_group["dim_1"].values.astype("int32").tobytes())
        buf.extend(sorted_group["cor"].values.astype("float32").tobytes())
        buf.extend(sorted_group["log10qvalue"].values.astype("float32").tobytes())

        cbuf = zlib.compress(buf)
        rows.append((dim_0, cbuf))

    # create file and write out everything
    conn = sqlite3.connect(filename)
    conn.execute("create table correlation (dim_0 int primary key, cbuf blob)")
    conn.executemany("insert into correlation(dim_0, cbuf) values (?, ?)", rows)

    write_dim_labels(conn, 0, dim_0_desc.given_ids)
    write_dim_labels(conn, 1, dim_1_desc.given_ids)

    pd.DataFrame(
        dict(
            dim_index=[0, 1],
            taiga_id=[dim_0_desc.taiga_id, dim_1_desc.taiga_id],
            dataset_given_id=[dim_0_desc.name, dim_1_desc.name],
        )
    ).to_sql("dataset", conn, if_exists="replace", index=False)

    print(f"Building indices...")
    for dim_i in [0, 1]:
        conn.execute(
            f"CREATE INDEX dim_{dim_i}_given_id_idx_1 ON dim_{dim_i}_given_id (given_id)"
        )
        conn.execute(
            f"CREATE INDEX dim_{dim_i}_given_id_idx_2 ON dim_{dim_i}_given_id (dim_{dim_i})"
        )

    conn.commit()
    conn.close()


def read_cor_for_given_id(filename, feature_id):
    conn = sqlite3.connect(filename)

    # fetch the blob for the given feature
    cursor = conn.cursor()
    cursor.execute(
        "select c.dim_0, c.cbuf from correlation c join dim_0_given_id f on f.dim_0=c.dim_0 where f.given_id = ?",
        [feature_id],
    )
    row = cursor.fetchone()
    if row is None:
        return pd.DataFrame(
            {
                "dim_0": [],
                "dim_1": [],
                "cor": [],
                "log10qvalue": [],
                "feature_given_id_0": [],
                "dataset_given_id_0": [],
                "feature_given_id_1": [],
                "dataset_given_id_1": [],
            }
        )
    index, cbuf = row
    # now unpack the value
    buf = zlib.decompress(cbuf)
    row_count = len(buf) // ROW_BYTE_SIZE
    start = 0
    end = 4 * row_count
    dim_1 = np.frombuffer(buf[start:end], dtype="int32")
    start = end
    end += 4 * row_count
    cor = np.frombuffer(buf[start:end], dtype="float32")
    start = end
    end += 4 * row_count
    log10qvalue = np.frombuffer(buf[start:end], dtype="float32")

    df = pd.DataFrame(
        {"dim_0": index, "dim_1": dim_1, "cor": cor, "log10qvalue": log10qvalue}
    )

    def map_dim_index_to_given_ids(dim_i, positions):
        indices = list(set(positions))
        param_str = ",".join(["?"] * len(indices))
        cursor.execute(
            f"select given_id, dim_{dim_i} from dim_{dim_i}_given_id where dim_{dim_i} in ({ param_str })",
            indices,
        )
        position_to_label = {i: given_id for given_id, i in cursor.fetchall()}
        return [position_to_label[position] for position in positions]

    cursor.execute("select dim_index, dataset_given_id from dataset")
    given_id_by_dataset_index = {
        dim_index: given_id for dim_index, given_id in cursor.fetchall()
    }

    df["feature_given_id_0"] = map_dim_index_to_given_ids(0, df["dim_0"])
    df["feature_given_id_1"] = map_dim_index_to_given_ids(1, df["dim_1"])
    df["dataset_given_id_0"] = given_id_by_dataset_index[0]
    df["dataset_given_id_1"] = given_id_by_dataset_index[1]

    cursor.close()
    conn.close()

    return df.drop(columns=["dim_0", "dim_1"])
