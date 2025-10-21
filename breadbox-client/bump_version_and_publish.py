import subprocess
import re

from commitizen.bump import update_version_in_files

VERSION_TAG_PATTERN="breadbox-(\\d+.\\d+.\\d+)"
IGNORE_CONVENTIONAL_COMMIT_TYPES = ["build", "chore:", "ci", "docs", "style", "refactor", "perf", "test"]
PATCH_CONVENTIONAL_COMMIT_TYPES = ["fix"]
MINOR_CONVENTIONAL_COMMIT_TYPES = ["feat"]
CONVENTIONAL_COMMIT_SYNTAX= ("(?P<committype>" + ( '|'.join(IGNORE_CONVENTIONAL_COMMIT_TYPES + PATCH_CONVENTIONAL_COMMIT_TYPES + MINOR_CONVENTIONAL_COMMIT_TYPES) ) + ")\\(breadbox\\)(?P<isbreaking>!?):.*")

def main():
    bump_rules = []

    last_commit = None
    last_version = None
    for commit_hash, version, bump_rule in get_sem_versions_and_bumps():
        bump_rules.append(bump_rule)

        if last_commit is None:
            last_commit = commit_hash

        bump_rules.append(bump_rule)

        if version is not None:
            last_version = version
            break

    bump_rules.reverse()
    for bump_rule in bump_rules:
        last_version = bump_rule(*last_version)

    version_str = ".".join(last_version)
    update_version_in_files(version_str)
    tag_repo(version_str)
    publish()

def update_version_in_files(version_str):
    for filename in ["pyproject.toml", "../breadbox-client/pyproject.toml"]:
        # read file, update version, and write it back out
        with open(filename, 'r') as file:
            content = file.read()
        
        # Update version using regex
        updated_content = re.sub(r'version\s*=\s*"[^"]+"', f'version = "{version_str}"', content)
        
        # Write updated content back
        with open(filename, 'w') as file:
            file.write(updated_content)
        
        # execute 'git add' to the file
        subprocess.run(["git", "add", filename], check=True)
    
    # execute 'git commit'
    subprocess.run(["git", "commit", "-m", f"build(breadbox): bump version to {version_str}"], check=True)

def tag_repo(version_str):
    tag_name = f"breadbox-{version_str}"
    # Create an annotated tag
    subprocess.run(["git", "tag", "-a", tag_name, "-m", f"Release {version_str}"], check=True)
    # Push the tag to remote
    subprocess.run(["git", "push", "origin", tag_name], check=True)

def publish():
    # Configure poetry to use Google Artifact Registry
    subprocess.run(["poetry", "self", "add", "keyrings.google-artifactregistry-auth"], check=True)
    subprocess.run(["poetry", "config", "repositories.public-python", "https://us-central1-python.pkg.dev/cds-artifacts/public-python/"], check=True)
    
    # Build and publish the package
    subprocess.run(["poetry", "publish", "--build", "--repository", "public-python"], check=True)

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
    output = subprocess.check_output(
        ["git", "log", "--pretty=format:%H%x09%s%x09%D"],
        text=True
    )

    for line in output.splitlines():
        commit_hash, subject, refs = line.split("\t", 2)
        tags = [r.strip() for r in refs.split(",") if r.strip().startswith("tag: ")]
        tags = [t.replace("tag: ", "") for t in tags]
        
        version = to_sem_version(tags)
        bump_rule = rule_from_conventional_commit(subject)
        if bump_rule is not None:
            yield commit_hash, version, bump_rule

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
            version_tuple = tuple(map(int, version_str.split('.')))
            versions.append(version_tuple)
    
    if not versions:
        return None
    
    # Return the highest version
    return max(versions)

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
        return rule_from_conventional_commit_type(commit_type, is_breaking)
    return None

if __name__ == "__main__":
    main()
