# We maintain a branch per released environment. This script verifies that all of those branches have their changes merged back into master

import subprocess
import re


def find_last_with_prefix(names, pattern):
    # throw out some formatting to get a simple list
    names = [x.replace("*", "").strip() for x in names]
    filtered_names = sorted([x for x in names if pattern.match(x) is not None])
    assert len(filtered_names) > 0, f"could not find {prefix} in {filtered_names}"
    return filtered_names[-1]


def get_branches_to_check():
    branches = (
        subprocess.check_output(["git", "branch", "-r"]).decode("utf8").split("\n")
    )
    return [
        "origin/qa",
        "origin/internal",
        find_last_with_prefix(branches, re.compile("origin/dmc-\\d\\dq\\d")),
        find_last_with_prefix(branches, re.compile("origin/external-\\d\\dq\\d")),
        find_last_with_prefix(branches, re.compile("origin/peddep-\\d\\dq\\d")),
    ]


def is_branch_merged_into_master(branch):
    retcode = subprocess.run(
        ["git", "merge-base", "--is-ancestor", branch, "origin/master"]
    ).returncode
    if retcode == 0:
        return True

    # if it is not merged in, print out the commits since they diverged
    #    latest_commit = subprocess.check_output(["git","rev-parse", branch]).decode('utf8').strip()
    last_common_ancestor = (
        subprocess.check_output(["git", "merge-base", "origin/master", branch])
        .decode("utf8")
        .strip()
    )

    log_cmd = ["git", "log", f"{branch}...{last_common_ancestor}"]
    print(
        f"Warning: {branch} is not merged into master. Listing the commits in {branch} that are not merged into master by running {' '.join(log_cmd)}"
    )
    log_output = subprocess.check_output(log_cmd).decode("utf8")
    print(log_output)
    print()
    return False


#    if latest_commit == last_common_anc

# git log --pretty=format:'%h' -n 1


def main():
    branches_to_check = get_branches_to_check()
    print(f"Checking branches: {branches_to_check}")
    branches_needing_merge = []
    for branch in branches_to_check:
        if not is_branch_merged_into_master(branch):
            branches_needing_merge.append(branch)

    assert (
        len(branches_needing_merge) == 0
    ), f"Branches needing merge: {branches_needing_merge}"


if __name__ == "__main__":
    main()
