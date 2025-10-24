#!/usr/bin/env python3
"""
Breadbox Version Bumping and Publishing Script
=============================================

This script automates the process of versioning and publishing the breadbox client package.
It performs the following steps:

1. Analyzes git history to find version tags and conventional commits
2. Determines the appropriate version bump based on conventional commit messages
3. Updates version numbers in pyproject.toml files
4. Creates a git tag for the new version
5. Publishes the package to Google Artifact Registry

The script follows semantic versioning principles:
- MAJOR version for breaking changes (indicated by '!' in commit message)
- MINOR version for new features (feat)
- PATCH version for bug fixes (fix)

Usage:
  python bump_version_and_publish.py [--dryrun] [--dry-run-if-not-branch BRANCH]

Options:
  --dryrun                     Run without making actual commits or publishing
  --dry-run-if-not-branch      Run in dry run mode if current branch is not the specified branch
"""

import subprocess
import re
import argparse


VERSION_TAG_PATTERN="breadbox-(\\d+.\\d+.\\d+)"
IGNORE_CONVENTIONAL_COMMIT_TYPES = ["build", "chore", "ci", "docs", "style", "refactor", "perf", "test"]
PATCH_CONVENTIONAL_COMMIT_TYPES = ["fix", "revert"]
MINOR_CONVENTIONAL_COMMIT_TYPES = ["feat"]
CONVENTIONAL_COMMIT_SYNTAX= ("(?P<committype>" + ( '|'.join(IGNORE_CONVENTIONAL_COMMIT_TYPES + PATCH_CONVENTIONAL_COMMIT_TYPES + MINOR_CONVENTIONAL_COMMIT_TYPES) ) + ")\\(breadbox\\)(?P<isbreaking>!?):.*")

def get_current_branch():
    """Get the name of the current git branch"""
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            text=True
        ).strip()
    except Exception as e:
        print(f"Error getting current branch: {str(e)}")
        return None

def main():
    parser = argparse.ArgumentParser(description="Bump version and publish breadbox client")
    parser.add_argument("--dryrun", action="store_true", help="Skip git commits and publishing")
    parser.add_argument("--dry-run-if-not-branch", metavar="BRANCH", help="Run in dry run mode if current branch is not BRANCH")
    args = parser.parse_args()
    
    # Determine if we should run in dry run mode
    run_dryrun = args.dryrun
    
    # Check branch condition if specified
    if args.dry_run_if_not_branch and not run_dryrun:
        current_branch = get_current_branch()
        if current_branch != args.dry_run_if_not_branch:
            run_dryrun = True
            print(f"Current branch '{current_branch}' is not '{args.dry_run_if_not_branch}', running in DRY RUN mode")
    
    if run_dryrun:
        print("Running in DRY RUN mode - no changes will be committed or published")
    
    print("Starting version bump process...")
    bump_rules = []

    last_commit = None
    last_version = None
    print("Analyzing git history for version tags and conventional commits...")
    for commit_hash, version, bump_rule, commit_subject in get_sem_versions_and_bumps():
        if bump_rule is not None:
            bump_rules.append((commit_hash, commit_subject, bump_rule))

        if last_commit is None:
            last_commit = commit_hash

        if version is not None:
            if last_version is None or last_version < version:
                last_version = version
            print(f"Found version tag: {'.'.join(map(str, version))}")
            break

    if last_version is None:
        raise AssertionError("No previous version tag found. Cannot proceed without a base version.")

    if len(bump_rules) == 0:
        print(
            f"No changes found which require updating version")
        return

    print(f"Applying {len(bump_rules)} version bump rules, starting with {last_version} to generate version for {last_commit}...")
    bump_rules.reverse()
    for commit_hash, commit_subject, bump_rule in bump_rules:
        old_version = last_version
        last_version = bump_rule(*last_version)
        print(f"  {commit_subject}: {'.'.join(map(str, old_version))} -> {'.'.join(map(str, last_version))}")

    version_str = ".".join(map(str, last_version))
    print(f"New version: {version_str}")
    
    print("Updating version in files...")
    update_version_in_files(version_str, dryrun=run_dryrun)
    
    if not run_dryrun:
        print("Tagging repository...")
        tag_repo(version_str)
        
        print("Publishing package...")
        publish()
        
        print("Version bump and publish complete!")
    else:
        print("DRY RUN: Skipping repository tagging and package publishing")
        print("DRY RUN complete - no changes were committed")

def update_version_in_files(version_str, dryrun=False):
    for filename in ["pyproject.toml", "../breadbox/pyproject.toml"]:
        print(f"  Updating version in {filename}...")
        try:
            # read file, update version, and write it back out
            with open(filename, 'r') as file:
                content = file.read()
            
            # Update version using regex
            updated_content = re.sub(r'version\s*=\s*"[^"]+"', f'version = "{version_str}"', content)
            
            # Write updated content back
            with open(filename, 'w') as file:
                file.write(updated_content)
            
            if not dryrun:
                # execute 'git add' to the file
                print(f"  Adding {filename} to git...")
                subprocess.run(["git", "add", filename], check=True)
            else:
                print(f"  DRY RUN: Would add {filename} to git")
        except Exception as e:
            print(f"Error updating {filename}: {str(e)}")
            raise
    
    if not dryrun:
        # Check if git has author information set
        print("  Checking git author configuration...")
        try:
            user_email = subprocess.check_output(["git", "config", "user.email"], text=True).strip()
            user_name = subprocess.check_output(["git", "config", "user.name"], text=True).strip()
        except subprocess.CalledProcessError:
            user_email = ""
            user_name = ""
        
        # If author info is not set, configure it for GitHub Actions
        if not user_email or not user_name:
            print("  Setting git author information for GitHub Actions...")
            subprocess.run(["git", "config", "user.email", "github-actions@github.com"], check=True)
            subprocess.run(["git", "config", "user.name", "github-actions"], check=True)
        
        # execute 'git commit'
        print("  Committing version changes...")
        subprocess.run(["git", "commit", "-m", f"build(breadbox): bump version to {version_str}"], check=True)
    else:
        print("  DRY RUN: Would commit version changes")

def tag_repo(version_str):
    tag_name = f"breadbox-{version_str}"
    print(f"  Creating git tag: {tag_name}...")
    try:
        # Create an annotated tag
        subprocess.run(["git", "tag", "-a", tag_name, "-m", f"Release {version_str}"], check=True)
        # Push the tag to remote
        print("  Pushing tag to remote...")
        subprocess.run(["git", "push", "origin", tag_name], check=True)
    except Exception as e:
        print(f"Error tagging repository: {str(e)}")
        raise

def publish():
    try:
        # Configure poetry to use Google Artifact Registry
        print("  Configuring poetry for Google Artifact Registry...")
        subprocess.run(["poetry", "self", "add", "keyrings.google-artifactregistry-auth"], check=True)
        subprocess.run(["poetry", "config", "repositories.public-python", "https://us-central1-python.pkg.dev/cds-artifacts/public-python/"], check=True)
        
        # Build and publish the package
        print("  Building and publishing package...")
        subprocess.run(["poetry", "publish", "--build", "--repository", "public-python"], check=True)
        print("  Package published successfully!")
    except Exception as e:
        print(f"Error publishing package: {str(e)}")
        raise

def rule_from_conventional_commit_type(commit_type, is_breaking):
    if is_breaking:
        return lambda major, minor, patch: (major+1,0,0)
    if commit_type in PATCH_CONVENTIONAL_COMMIT_TYPES:
        return lambda major, minor, patch: (major, minor, patch+1)
    elif commit_type in MINOR_CONVENTIONAL_COMMIT_TYPES:
        return lambda major, minor, patch: (major, minor+1, 0)
    elif commit_type in IGNORE_CONVENTIONAL_COMMIT_TYPES:
        return lambda major, minor, patch: (major, minor, patch)
    else:
        return None

def get_sem_versions_and_bumps():
    print("  Retrieving git commit history...")
    try:
        output = subprocess.check_output(
            ["git", "log", "--pretty=format:%H%x09%s%x09%D"],
            text=True
        )
    except Exception as e:
        print(f"Error retrieving git history: {str(e)}")
        raise

    for line in output.splitlines():
        commit_hash, subject, refs = line.split("\t", 2)
        tags = [r.strip() for r in refs.split(",") if r.strip().startswith("tag: ")]
        tags = [t.replace("tag: ", "") for t in tags]
        
        version = to_sem_version(tags)

        bump_rule = rule_from_conventional_commit(subject)
        if bump_rule is not None or version is not None:
            # print(f"  Found conventional commit at {commit_hash[:8]}: {subject}")
            yield commit_hash, version, bump_rule, subject

def to_sem_version(tags):
    """
    given a list of tags, extract the semantic version number using VERSION_TAG_PATTERN. If there are multiple, returns the max.
    If there are no tags or none match, returns None.
    """
    versions = []
    for tag in tags:
        match = re.match(VERSION_TAG_PATTERN, tag)
        if match:
            # Extract version number from the tag using regex group
            version_str = match.group(1)
            # Convert to tuple of integers for comparison
            try:
                version_tuple = tuple(map(int, version_str.split('.')))
                versions.append(version_tuple)
            except ValueError as e:
                print(f"    Warning: Could not parse version from tag {tag}: {str(e)}")
    
    if not versions:
        return None
    
    # Return the highest version
    highest = max(versions)
    return highest

def rule_from_conventional_commit(subject):
    """
    uses conventional commit nomeclature to determine the rule used to bump the version.
    :param subject: The commit subject line
    :return: A function that takes the current version and returns the new version
    """
    match = re.match(CONVENTIONAL_COMMIT_SYNTAX, subject)
    if match:
        commit_type = match.group('committype')
        is_breaking = bool(match.group('isbreaking'))
        rule = rule_from_conventional_commit_type(commit_type, is_breaking)
        if rule:
            bump_type = "MAJOR" if is_breaking else ("MINOR" if commit_type in MINOR_CONVENTIONAL_COMMIT_TYPES else "PATCH")
        return rule
    return None

if __name__ == "__main__":
    main()
