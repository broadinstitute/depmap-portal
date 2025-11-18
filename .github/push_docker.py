#!/usr/bin/env python

import subprocess
import sys
import re
import os

ARTIFACT_REGISTRY_REPO = sys.argv[1]
IMAGE_TAG = sys.argv[2]
BRANCH_NAME = sys.argv[3]

quarterly_release_branch_match = re.match(
    "(dmc|external|peddep)-(\\d\\d.\\d)", BRANCH_NAME
)
test_deploy_branch_match = re.match("test-(.*)", BRANCH_NAME)
dest_tags = set()

# figure out what the tag on the docker image should be. If nothing than don't bother pushing this build
if (
    BRANCH_NAME == "master"
    or BRANCH_NAME == "internal"
    or BRANCH_NAME == "qa"
    or BRANCH_NAME == "artifact-migration-25q3"  # Remove after migration
    or test_deploy_branch_match is not None
    or quarterly_release_branch_match is not None
):
    dest_tags.add(BRANCH_NAME)

if quarterly_release_branch_match is not None:
    env_name = quarterly_release_branch_match.group(1)
    # find the last branch with this prefix, because and only tag builds for the "latest" one
    # that is, if we are if the repo contains dmc-20q4 and dmc-21q1, only push an image when we're
    # building dmc-21q1, not dmc-20q4
    all_branch_names = (
        subprocess.check_output(
            "git for-each-ref --format '%(refname:lstrip=3)'", shell=True
        )
        .decode("utf8")
        .split("\n")
    )
    matching_branch_names = sorted(
        [x for x in all_branch_names if x.startswith(env_name + "-")]
    )
    last_release_branch = matching_branch_names[-1]

    if BRANCH_NAME == last_release_branch:
        dest_tags.add(env_name)


def run_each(text):
    statements = [x.strip() for x in text.split("\n") if x.strip() != ""]
    for statement in statements:
        print(f"Executing: {statement}")
        subprocess.check_call(statement, shell=True)


if "master" in dest_tags:
    # use latest tag for master branch builds as well because that's what people usually grab
    dest_tags.add("latest")

for dest_tag in dest_tags:
    # Push to Artifact Registry
    run_each(
        f"""
        docker tag {IMAGE_TAG} {ARTIFACT_REGISTRY_REPO}:{dest_tag}
        docker push {ARTIFACT_REGISTRY_REPO}:{dest_tag}
        """
    )
