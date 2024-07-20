try:
    from . import _color_palette as color_palette
except ImportError:
    raise Exception(
        "Could not import color_palette. You may need to run ./install_prereqs.sh to generate this file."
    )
