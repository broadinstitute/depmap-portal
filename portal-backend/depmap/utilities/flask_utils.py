from flask import jsonify


def make_error(status_code: int, message: str):
    response = jsonify({"status": status_code, "message": message,})
    response.status_code = status_code
    return response
