import traceback
from . import private_util_functions


def register_access_control_functions(connection):
    """
     register __owned_by_is_visible into sqlite
    :param connection:
    """
    connection.create_function("owned_by_is_visible", 1, __owned_by_is_visible)


def __owned_by_is_visible(db_row_owner_id: int):
    """
    This is the function being registered into the DB.

    :param db_row_owner_id: From the owner_id column of each table in database. Should be a value from access_control.models.*GROUP
    :return: 1 if the current user should be able to see something owned by db_row_owner_id or 0 if objects owned by db_row_owner_id should be hidden
    """
    try:
        ca = private_util_functions._get_access_control_obj()

        if db_row_owner_id in ca.allowed or ca.is_everything_visible:
            return 1
        else:
            return 0
    except:
        # explictly printing stack trace because sqlite will report an error occurred in the function
        # but the trace is lost by then
        traceback.print_exc()
        raise
