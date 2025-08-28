from fastapi.routing import APIRouter
from breadbox.config import get_settings

from .uploads import router as uploads_router
from .datasets import router as datasets_router
from .dataset_uploads import router as dataset_uploads_router
from .downloads import router as downloads_router
from .groups import router as groups_router
from .dimension_types import router as types_router
from .data_types import router as data_types_router
from .apis import router as apis_router
from .partials import router as partials_router
from .compute import router as compute_router
from .user import router as user_router
from .metadata import router as metadata_router
from .temp import router as temp_router
from .health_check import router as health_check_router
from breadbox.schemas.custom_http_exception import ERROR_RESPONSES

api_router = APIRouter(responses=ERROR_RESPONSES)  # type: ignore
api_router.include_router(datasets_router)
api_router.include_router(dataset_uploads_router)
api_router.include_router(uploads_router)
api_router.include_router(downloads_router)
api_router.include_router(groups_router)
api_router.include_router(types_router)
api_router.include_router(data_types_router)
api_router.include_router(apis_router)
api_router.include_router(compute_router)
api_router.include_router(partials_router)
api_router.include_router(user_router)
api_router.include_router(metadata_router)
api_router.include_router(health_check_router)
api_router.include_router(temp_router)
