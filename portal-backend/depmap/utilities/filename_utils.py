import os
from re import sub


def sanitize_filename_string(filename):
    """
    Remove characters not allowed in file names
    https://stackoverflow.com/questions/1976007/what-characters-are-forbidden-in-windows-and-linux-directory-names#31976060
    """
    safe_filename = sub(
        '[\\\|><:"/?*,]', "", filename
    )  # three slashes are needed to match the escaped \ character

    # filenames get encoded as ascii inside of gunicorn/wsgi. We have at least one case of μ being written in the filename, so convert this to a "u"
    # because it cannot be encoded as ascii.
    return safe_filename.replace(u"\u03bc", "u")


def get_base_name_without_extension(filename: str) -> str:
    return os.path.splitext(os.path.basename(filename))[0]
