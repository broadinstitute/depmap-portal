import io
from typing import Union

from fastapi import UploadFile
from starlette.datastructures import Headers
import typing


def create_upload_file(
    *,
    filename: str,
    file: Union[io.BytesIO, typing.BinaryIO],
    content_type: str = "text/csv"
):
    # an adapter to cope with the signature of UploadFile changes with new version of fastapi
    return UploadFile(
        filename=filename, file=file, headers=Headers({"Content-Type": content_type})
    )
