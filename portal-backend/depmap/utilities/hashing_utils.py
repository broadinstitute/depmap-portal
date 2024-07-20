import hashlib
import pandas as pd


def hash_df(df):
    if isinstance(df.columns, pd.core.indexes.range.RangeIndex):
        raise NotImplementedError(
            "Unclear what to do with a range index. Ints cannot be encoded, and forcing to a string could conflate with dfs where the column name is a string that is also a number"
        )

    hash = hashlib.sha256()
    # this has_pandas_object doesn't hash column data
    hash.update(pd.util.hash_pandas_object(df, index=True).values)

    # the order of update changes the hash value, so this is fine
    for col in df.columns:
        hash.update(col.encode())

    return hash.hexdigest()
