import hashlib
import importlib.util
import pathlib
import sys

PIPELINE_DIR = pathlib.Path(__file__).resolve().parent.parent


def load_script(relpath: str):
    """
    Import a standalone script (one that isn't part of a package) by its path
    relative to the pipeline directory.

    Each script is loaded under a unique module name, so scripts with the same
    file name in different directories don't collide. The script's own directory
    is put on sys.path only while it is executing, so that it can import sibling
    files, and is removed afterward.
    """
    path = (PIPELINE_DIR / relpath).resolve()
    name = f"{path.stem}_{hashlib.md5(str(path).encode()).hexdigest()[:8]}"
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)

    sys.path.insert(0, str(path.parent))
    try:
        spec.loader.exec_module(module)
    finally:
        sys.path.remove(str(path.parent))
    return module
