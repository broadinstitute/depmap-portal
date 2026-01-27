import sys
import re
from taigapy import create_taiga_client_v3
import json
import os

# this script exists to rewrite any Taiga IDs into their canonical form. (This allows conseq to recognize when data files are the same by just comparing taiga IDs)
#
# as a secondary concern, all these taiga IDs must exist in a file that this processes, so this also handles a "TAIGA_PREPROCESSOR_INCLUDE" statement to merge multiple files
# into one while the taiga IDs are being processed

tc = create_taiga_client_v3()

_resolve_versioned_dataset_id_cache = {}


def _resolve_versioned_dataset_id(taiga_permaname):
    if "." in taiga_permaname:
        return taiga_permaname
    if taiga_permaname in _resolve_versioned_dataset_id_cache:
        latest = _resolve_versioned_dataset_id_cache[taiga_permaname]
    else:
        latest = tc.get_latest_version_id(taiga_permaname)
        _resolve_versioned_dataset_id_cache[taiga_permaname] = latest
    return latest


def _rewrite_stream(vars, in_name, in_lines, out_fd):
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
                print(f"failed to get data from canonical taiga id for {taiga_id}")
            line = line_prefix + '"' + canonical + '"' + line_suffix
        fd.write(line)


def rewrite_file(in_name, out_name):
    with open(in_name, "rt") as fd:
        lines = fd.readlines()

    vars = {}
    with open(out_name, "wt") as out_fd:
        _rewrite_stream(vars, in_name, lines, out_fd)


if __name__ == "__main__":
    print("starting preprocessing-pipeline")
    rewrite_file(sys.argv[1], sys.argv[2])
    print("complete preprocessing-pipeline")
