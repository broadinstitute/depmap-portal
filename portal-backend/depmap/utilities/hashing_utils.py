import hashlib
import pandas as pd
from pandas import RangeIndex
from pandas.core.util.hashing import hash_pandas_object


def hash_df(df):
    if isinstance(df.columns, RangeIndex):
        raise NotImplementedError(
            "Unclear what to do with a range index. Ints cannot be encoded, and forcing to a string could conflate with dfs where the column name is a string that is also a number"
        )

    hash = hashlib.sha256()
    hash.update(bytes(hash_pandas_object(df, index=True).values))

    # the order of update changes the hash value, so this is fine
    for col in df.columns:
        hash.update(col.encode())

    return hash.hexdigest()
