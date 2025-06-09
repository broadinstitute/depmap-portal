from fastapi import APIRouter, Depends
import pandas as pd

from breadbox.db.session import SessionWithUser
from ..config import Settings, get_settings
from .dependencies import get_db_with_user
from ..crud import partial as partial_crud

router = APIRouter(prefix="/partials", tags=["partials"])


@router.get(
    "/data_table/cell_line_selector_lines", operation_id="get_cell_line_selector_lines"
)
def get_cell_line_selector_lines(
    db: SessionWithUser = Depends(get_db_with_user),
    settings: Settings = Depends(get_settings),
):
    df = partial_crud.get_cell_line_selector_lines(db)
    assert isinstance(
        df, pd.DataFrame
    ), "Expected DataFrame from get_cell_line_selector_lines"
    df = df.replace({"nan": None})  # SQLALchemy 2.0 returns np.nan as 'nan'
    return {"cols": df.columns.tolist(), "data": df.values.tolist()}
