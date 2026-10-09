from typing import Dict, List

from sqlalchemy import select

from breadbox.db.session import SessionWithUser
from breadbox.models.table_mutation import TableMutation


def get_mutation_counts(db: SessionWithUser, table_names: List[str]) -> Dict[str, int]:
    """
    Returns how many times each of the given tables has been mutated (insert/update/delete).
    If a count differs from one fetched earlier, the table has changed in the meantime.

    This exposes no table contents, so (unlike most crud methods) it does not take a user.
    """
    rows = db.execute(
        select(TableMutation.name, TableMutation.count).where(
            TableMutation.name.in_(table_names)
        )
    ).all()
    counts = {name: count for name, count in rows}
    missing = set(table_names) - set(counts)
    assert not missing, f"No table_mutation rows for {sorted(missing)}"
    return counts
