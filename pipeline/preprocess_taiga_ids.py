import sys
import re
from taigapy import create_taiga_client_v3
import json
import os
import logging
import argparse

log = logging.getLogger(__name__)


class UserError(Exception):
    def __init__(self, message) -> None:
        super().__init__(message)
        self.message = message


# this script exists to rewrite any Taiga IDs into their canonical form. (This allows conseq to recognize when data files are the same by just comparing taiga IDs)
#
# as a secondary concern, all these taiga IDs must exist in a file that this processes, so this also handles a "TAIGA_PREPROCESSOR_INCLUDE" statement to merge multiple files
# into one while the taiga IDs are being processed

tc = create_taiga_client_v3()

latest_cache = {}


def _resolve_versioned_dataset_id(taiga_permaname):
    if "." in taiga_permaname:
        return taiga_permaname
    if taiga_permaname not in latest_cache:
        latest_cache[taiga_permaname] = tc.get_latest_version_id(taiga_permaname)
    return latest_cache[taiga_permaname]


def _rewrite_stream(vars, in_name, in_lines, out_fd):
    errors = []
    fd = out_fd
    for line in in_lines:
        m = re.match('#\\s*TAIGA_PREPROCESSOR_INCLUDE\\s+"([^"]+)"\\s*', line)
        if m is not None:
            filename = m.group(1)
            filename = os.path.join(os.path.dirname(in_name), filename)
            with open(filename, "rt") as fd_in:
                included_lines = fd_in.readlines()
                _rewrite_stream(vars, filename, included_lines, fd)
            continue

        m = re.match('#\\s*SET_TAIGA_PREPROCESSOR\\s+(\\S+)\\s+"([^"]+)"\\s*', line)
        if m is not None:
            variable_name = m.group(1)
            value = m.group(2)
            vars[variable_name] = value
            continue

        m = re.match("(.*)PREPROCESS_VAR\\(([^)]+)\\)(.*)", line, re.DOTALL)
        if m is not None:
            line_prefix = m.group(1)
            var_name = m.group(2)
            line_suffix = m.group(3)
            line = line_prefix + '"' + vars[var_name] + '"' + line_suffix

        m = re.match("(.*)PREPROCESS_FORMAT_STR\\(([^ ,]+)\\)(.*)", line, re.DOTALL)
        if m is not None:
            line_prefix = m.group(1)
            template = m.group(2)
            line_suffix = m.group(3)
            line = line_prefix + repr(json.loads(template.format(**vars))) + line_suffix

        m = re.match("(.*)PREPROCESS_TAIGA_ID\\(([^ ,]+)\\)(.*)", line, re.DOTALL)
        if m is not None:
            line_prefix = m.group(1)
            orig_taiga_dataset_var_name = m.group(2)
            line_suffix = m.group(3)
            taiga_permaname = vars[orig_taiga_dataset_var_name]
            taiga_dataset_id_with_latest_version = _resolve_versioned_dataset_id(
                taiga_permaname
            )
            line = (
                line_prefix
                + '"'
                + taiga_dataset_id_with_latest_version
                + '"'
                + line_suffix
            )

        m = re.match(
            '(.*)PREPROCESS_TAIGA_ID\\(([^ ,]+), "([^"]+)"\\)(.*)', line, re.DOTALL
        )
        if m is not None:
            orig_taiga_dataset_var_name = m.group(2)
            line_prefix = m.group(1)
            line_suffix = m.group(4)

            taiga_filename = m.group(3)
            taiga_permaname = vars[orig_taiga_dataset_var_name]
            taiga_dataset_id_with_latest_version = _resolve_versioned_dataset_id(
                taiga_permaname
            )
            taiga_id = taiga_dataset_id_with_latest_version + "/" + taiga_filename
            try:
                canonical = tc.get_canonical_id(taiga_id)
            except:
                errors.append(
                    f"failed to get data from canonical taiga id for {taiga_id}"
                )
                continue
            line = line_prefix + '"' + canonical + '"' + line_suffix
        fd.write(line)

    if len(errors) > 0:
        errors_str = "\n".join(errors)
        raise Exception(
            f"Got the following errors while trying to run preprocess_taiga_ids.py:\n{errors_str}"
        )


def rewrite_file(in_name, out_name):
    with open(in_name, "rt") as fd:
        lines = fd.readlines()

    vars = {}
    with open(out_name, "wt") as out_fd:
        _rewrite_stream(vars, in_name, lines, out_fd)


def search_ancestors(filename):
    ancestor_dir = os.getcwd()
    checked_paths = []
    while True:
        possible_path = os.path.join(ancestor_dir, filename)
        checked_paths.append(possible_path)
        if os.path.exists(possible_path):
            return possible_path
        next_dir = os.path.dirname(ancestor_dir)
        if next_dir == ancestor_dir:
            raise Exception(
                f"Could not find {filename} (checked {', '.join(checked_paths)})"
            )
        ancestor_dir = next_dir


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("src_file")
    parser.add_argument("dst_file")
    parser.add_argument(
        "--search-ancestors",
        help="if set, looks for src_file in an ancestor folder",
        action="store_true",
    )

    arg = parser.parse_args()
    dst_file = arg.dst_file
    src_file = arg.src_file
    if arg.search_ancestors:
        src_file = search_ancestors(src_file)

    try:
        rewrite_file(src_file, dst_file)
    except UserError as err:
        log.error(err.message)
        sys.exit(1)
