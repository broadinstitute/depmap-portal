from depmap.enums import DataTypeEnum
from werkzeug.datastructures import FileStorage

from flask_restplus import Namespace, Resource, fields, reqparse, Api
from depmap.celery_task.utils import task_response_model
from flask import (
    request,
    current_app,
    abort,
)
from werkzeug.utils import secure_filename

from depmap.access_control import (
    get_current_user_for_access_control,
    PUBLIC_ACCESS_GROUP,
)
from depmap.user_uploads.tasks import upload_private
from depmap.celery_task.utils import format_task_status
from depmap.user_uploads.utils.task_utils import write_upload_to_local_file

namespace = Namespace("upload", description="Upload private datasets to the portal")

upload_parser = reqparse.RequestParser()
upload_parser.add_argument(
    "uploadFile", location="files", type=FileStorage, required=True
)


@namespace.route("/private")
@namespace.expect(upload_parser)
class Private(
    Resource
):  # the flask url_for endpoint is automagically the snake case of the namespace prefix plus class name
    @namespace.doc(
        description='This API returns a task id that should be used to query /api/task/{id}. When the task state returns SUCCESS, "result" has the structure {"downloadUrl": string}, where the string is the URL at which to download the file. For this task, percentComplete will always return null.',
        params={
            "displayName": {
                "description": "Descriptive name which will show up in selectors",
                "type": "string",
                "required": True,
            },
            "units": {
                "description": "Text to describe the units of values in dataset.",
                "type": "string",
                "required": True,
            },
            "ownerId": {
                "description": "The group that should own this data.",
                "type": "number",
                "required": True,
            },
            "transposed": {
                "description": "True if the matrix is transposed.",
                "type": "boolean",
                "required": False,
                "default": False,
            },
        },
    )
    @namespace.marshal_with(namespace.model("Task", task_response_model))
    def post(self):

        # Note: docstrings to restplus methods end up in the swagger documentation.
        # DO NOT put a docstring here that you would not want exposed to users of the API. Use # for comments instead
        """
        Upload a custom private dataset
        """
        if not current_app.config["ENABLED_FEATURES"].private_datasets:
            abort(404)
        display_name = request.args.get("displayName")
        units = request.args.get("units")
        owner_id = int(request.args.get("ownerId"))
        upload_file = request.files.get("uploadFile")
        transposed = request.args.get("transposed").lower() == "true"
        data_type = request.args.get("dataType")

        data_type_for_upload = (
            DataTypeEnum.user_upload if data_type is None else DataTypeEnum(data_type)
        )

        return upload(
            display_name,
            units,
            owner_id,
            upload_file,
            transposed,
            data_type_for_upload.name,
        )


def upload(
    display_name, units, owner_id, upload_file: FileStorage, transposed, data_type: str,
):
    if not current_app.config["ENABLED_FEATURES"].private_datasets:
        abort(404)

    user_id = get_current_user_for_access_control()

    csv_path = write_upload_to_local_file(upload_file)
    uploaded_filename = secure_filename(upload_file.filename)

    result = upload_private.delay(
        display_name,
        units,
        csv_path,
        uploaded_filename,
        upload_file.content_type,
        transposed,
        user_id,
        owner_id,
        data_type_for_upload=data_type,
    )
    response = format_task_status(result)

    return response
