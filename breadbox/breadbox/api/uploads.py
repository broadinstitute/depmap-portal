import shutil
from fastapi import APIRouter, Depends, UploadFile
from pydantic import BaseModel
from breadbox.config import get_settings, Settings
from itsdangerous.url_safe import URLSafeSerializer
import os

from breadbox.service.upload import _ensure_parent_dir_exists, _get_temp_filename

router = APIRouter(prefix="/uploads")  # , tags=["uploads"])


def get_itsdangerous_serializer(settings: Settings = Depends(get_settings)):
    return URLSafeSerializer(settings.breadbox_secret)


def get_compute_results_location(settings: Settings = Depends(get_settings)):
    return settings.compute_results_location


class UploadFileResponse(BaseModel):
    file_id: str


@router.post("/file", operation_id="upload_file", response_model=UploadFileResponse)
def upload_file(
    file: UploadFile,
    serializer: URLSafeSerializer = Depends(get_itsdangerous_serializer),
    compute_results_location: str = Depends(get_compute_results_location),
):

    filename = _get_temp_filename()
    full_path = os.path.join(compute_results_location, filename)
    _ensure_parent_dir_exists(full_path)

    # copy from the uploaded file into the temp path
    with open(full_path, "wb") as dst_fd:
        shutil.copyfileobj(file.file, dst_fd)

    # report back the path (signed) as the file_id
    return UploadFileResponse(file_id=str(serializer.dumps(filename)))


# example of how to use `construct_file_from_ids`
# class ExampleRequest(BaseModel):
#    file_ids: List[str]
#    md5: Optional[str]
#
# @router.post("/example", operation_id="file_example", serializer=Depends(get_itsdangerous_serializer))
# def file_example(request: ExampleRequest):
#    "Given a file (as a set of file_ids), download the file"
#
#    filename = construct_file_from_ids(request.file_ids, request.md5, serializer, compute_results_location)
#    return FileResponse(
#        filename, media_type="application/octet-stream", filename="concatenated"
#    )
