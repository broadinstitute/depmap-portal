def index_error_msg(obj) -> str:
    return f"{type(obj).__name__} {obj.given_id} has no index - this should not happen for matrix dataset features/samples"
