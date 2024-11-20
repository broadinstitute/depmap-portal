from sqlalchemy import and_

from breadbox.db.session import SessionWithUser
from ..models.dataset import TabularColumn, TabularCell, DimensionType
import pandas as pd


def get_cell_line_selector_lines(db: SessionWithUser):
    """
    DEPRECATED: this can be removed once the Elara downloads page is updated to use newer functionality.
    """
    cols = [
        "cell_line_name",
        "primary_disease",
        "lineage_1",
        "lineage_2",
        "lineage_3",
        "depmap_id",
        "cell_line_display_name",
    ]
    depmap_model_sample_type = (
        db.query(DimensionType).filter(DimensionType.name == "depmap_model").one()
    )

    query = (
        db.query(TabularCell)
        .join(TabularColumn)
        .filter(
            and_(
                TabularColumn.dataset_dimension_type == "depmap_model",
                TabularColumn.given_id.in_(cols),
                TabularColumn.dataset_id == depmap_model_sample_type.dataset_id,
            )
        )
        .with_entities(
            TabularCell.value, TabularCell.dimension_given_id, TabularColumn.given_id,
        )
    )
    query_df = pd.read_sql(query.statement, query.session.connection())

    df = query_df.pivot(index="dimension_given_id", columns="given_id")["value"]
    df["depmap_id"] = df.index
    # Return with cols in same order as above
    return df[cols]
