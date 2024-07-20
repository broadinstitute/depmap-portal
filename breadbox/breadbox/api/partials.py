from fastapi import APIRouter, Depends

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
    # df = df.replace({np.nan: None})
    return {"cols": df.columns.tolist(), "data": df.values.tolist()}
