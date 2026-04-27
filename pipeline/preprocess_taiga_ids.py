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


def _rewrite_stream(vars, in_name, in_lines, out_fd, dirs_to_check):
    errors = []
    fd = out_fd
    for line in in_lines:
        m = re.match('#\\s*TAIGA_PREPROCESSOR_INCLUDE\\s+"([^"]+)"\\s*', line)
        if m is not None:
            filename = m.group(1)

            filename = _find_template_file(filename, dirs_to_check, in_name)

            with open(filename, "rt") as fd_in:
                included_lines = fd_in.readlines()
                try:
                    _rewrite_stream(vars, filename, included_lines, fd, dirs_to_check)
                except UserError as user_error:
                    raise UserError(
                        f"Could not process {filename} (included from {in_name}) due to error: \n  {user_error.message}"
                    )
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


def rewrite_file(in_name, out_name, dirs_to_check):
    with open(in_name, "rt") as fd:
        lines = fd.readlines()

    vars = {}
    with open(out_name, "wt") as out_fd:
        _rewrite_stream(vars, in_name, lines, out_fd, dirs_to_check)


def _raise_could_not_find(filename: str, checked_paths: list[str], included_from=None):
    paths = "\n".join(["   " + x for x in checked_paths])
    if included_from is None:
        raise UserError(f"Could not find {filename} (checked :\n{paths})")
    else:
        raise UserError(
            f"Could not find {filename} included from {included_from} (checked :\n{paths})"
        )


def _find_template_file(filename, dirs_to_check: list[str], included_from=None):
    if included_from is not None:
        dirs_to_check.insert(0, os.path.dirname(included_from))

    checked_paths = []
    for dir in dirs_to_check:
        full_path = os.path.join(dir, filename)
        checked_paths.append(full_path)

        if os.path.exists(full_path):
            return full_path

    _raise_could_not_find(filename, checked_paths, included_from)


def _find_in_ancestor_dirs(filename: str, cur_dir: str):
    checked_paths = []
    while True:
        possible_path = os.path.join(cur_dir, filename)
        checked_paths.append(possible_path)
        if os.path.exists(possible_path):
            return possible_path
        next_dir = os.path.dirname(cur_dir)
        if next_dir == cur_dir:
            break
        cur_dir = next_dir
    _raise_could_not_find(filename, checked_paths)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "src_file",
        help="The template to read (path should be relative to one of the directories provided via --search)",
    )
    parser.add_argument("dst_file", help="Where to write the output file")
    # this is to cope with the messy situation we find ourselves in. Some of the conseq templates are in depmap-deploy and some are in the
    # corresponding pipeline directory. To make things worse: the jenkins checkout has depmap-deploy in a different place then a developer checkout.
    # So, let's just specify a list of directories (And tolerate that the directories just are in some ancestor of our current working path) to search and it can check all of them.
    parser.add_argument(
        "--search",
        action="append",
        help="A directory to search for files. This name will searched the current working dir or in any ancestor",
    )

    arg = parser.parse_args()
    dst_file = arg.dst_file
    src_file = arg.src_file

    dirs_to_check = [_find_in_ancestor_dirs(x, os.getcwd()) for x in arg.search]

    src_file = _find_template_file(src_file, dirs_to_check)

    try:
        rewrite_file(src_file, dst_file, dirs_to_check)
    except UserError as err:
        log.error(f'Got error when prococessing "{src_file}": {err.message}')
        sys.exit(1)
