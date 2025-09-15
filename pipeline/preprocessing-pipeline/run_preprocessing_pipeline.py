#!/usr/bin/env python3
"""
Pipeline runner script - Python version of jenkins-run-pipeline.sh
Runs preprocessing pipeline using Docker containers with proper credential mounting.
"""

import argparse
import os
import subprocess
import sys
import tempfile
from pathlib import Path


def get_git_commit_sha():
    """Get the current git commit SHA."""
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"], capture_output=True, text=True, check=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError:
        return "unknown"


def read_docker_image_name():
    """Load Docker image name from image-name file."""
    script_dir = Path(__file__).parent

    # Try current directory first
    image_name_file = script_dir / "image-name"

    # If not found, try one level up
    if not image_name_file.exists():
        image_name_file = script_dir.parent / "image-name"

    if not image_name_file.exists():
        raise FileNotFoundError(
            f"Could not find image-name file in {script_dir} or {script_dir.parent}"
        )

    # Source the file to get DOCKER_IMAGE variable
    # Since we can't source in Python, we'll parse it manually
    with open(image_name_file, "r") as f:
        for line in f:
            line = line.strip()
            if line.startswith("DOCKER_IMAGE="):
                return line.split("=", 1)[1].strip("\"'")

    raise ValueError(f"DOCKER_IMAGE not found in {image_name_file}")


def backup_conseq_logs():
    """Copy all logs to preprocess-logs directory."""
    state_dir = Path("pipeline/state")
    if not state_dir.exists():
        return

    # Create temporary file list
    with tempfile.NamedTemporaryFile(mode="w", delete=False) as f:
        temp_file = f.name

    try:
        # Find log files
        find_commands = [
            ["find", ".", "-name", "std*.txt"],
            ["find", ".", "-name", "*.sh"],
            ["find", ".", "-name", "*.log"],
        ]

        with open(temp_file, "w") as f:
            for cmd in find_commands:
                result = subprocess.run(
                    cmd, cwd=state_dir, capture_output=True, text=True, check=True
                )
                f.write(result.stdout)

        # Use rsync to copy files
        subprocess.run(
            [
                "rsync",
                "-a",
                "pipeline/state",
                "preprocess-logs",
                f"--files-from={temp_file}",
            ],
            check=True,
        )

    finally:
        os.unlink(temp_file)


def check_credentials(creds_dir):
    """Check that required credential files exist."""
    required_files = ["broad-paquitas", "sparkles", "depmap-pipeline-runner.json"]

    for filename in required_files:
        filepath = Path(creds_dir) / filename
        if not filepath.exists():
            raise FileNotFoundError(f"Could not find required file: {filepath}")


def create_override_conseq_file(env_name, publish_dest):
    """Create an overridden conseq file with custom publish_dest."""
    original_conseq = f"run_{env_name}.conseq"
    override_conseq = f"overriden-{original_conseq}"

    # Write new publish_dest line
    with open(f"pipeline/{override_conseq}", "w") as f:
        f.write(f'let publish_dest = "{publish_dest}"\n')

    # Append original file content except for publish_dest lines
    with open(f"pipeline/{original_conseq}", "r") as original:
        with open(f"pipeline/{override_conseq}", "a") as override:
            for line in original:
                if not line.strip().startswith("let publish_dest"):
                    override.write(line)

    return override_conseq


def run_via_container(command, job_name, docker_image, taiga_dir, creds_dir):
    """Run command inside Docker container with proper volume mounts (preprocessing style)."""
    cwd = os.getcwd()

    docker_cmd = [
        "docker",
        "run",
        # security option needed after dev.cds.team upgrade
        "--security-opt",
        "seccomp=unconfined",
        # delete this container upon completion
        "--rm",
        # mount the current working directory as /work
        "-v",
        f"{cwd}:/work",
        # set working directory inside container
        "-w",
        "/work/pipeline",
        # mount AWS keys for broad-paquitas
        "-v",
        f"{creds_dir}/broad-paquitas:/aws-keys/broad-paquitas",
        # mount sparkles cache
        "-v",
        f"{creds_dir}/sparkles:/root/.sparkles-cache",
        # mount depmap pipeline runner credentials
        "-v",
        f"{creds_dir}/depmap-pipeline-runner.json:/etc/google_default_creds.json",
        # mount taiga directory
        "-v",
        f"{taiga_dir}:/root/.taiga",
        # set google credentials environment variable
        "-e",
        "GOOGLE_APPLICATION_CREDENTIALS=/etc/google_default_creds.json",
        # set the docker container name
        "--name",
        job_name,
        # the docker image to use
        docker_image,
        # run the command with AWS credentials sourced
        "bash",
        "-c",
        f"source /aws-keys/broad-paquitas && {command}",
    ]
    print("command", command)
    return subprocess.run(docker_cmd)


def main():
    parser = argparse.ArgumentParser(
        description="Run preprocessing pipeline (Jenkins style)"
    )
    parser.add_argument("env_name", help="Name of environment")
    parser.add_argument("job_name", help="Name to use for job")
    parser.add_argument("--publish-dest", help="S3/GCS path override for publishing")
    parser.add_argument("--export-path", help="Export path for conseq export")
    parser.add_argument(
        "--manually-run-conseq",
        action="store_true",
        help="If set args will be passed directly to conseq",
    )
    parser.add_argument(
        "--taiga-dir",
        default="/data2/depmap-pipeline-taiga",
        help="Taiga directory path",
    )
    parser.add_argument(
        "--creds-dir",
        default="/etc/depmap-pipeline-runner-creds",
        help="Pipeline runner credentials directory",
    )
    parser.add_argument(
        "--image", help="If set, use this docker image when running the pipeline",
    )
    parser.add_argument("--start-with", help="Start with existing export from GCS path")
    parser.add_argument("conseq_args", nargs="*", help="parameters to pass to conseq")

    args = parser.parse_args()

    # Set up paths and variables
    env_name = args.env_name
    job_name = args.job_name
    conseq_args = args.conseq_args
    taiga_dir = args.taiga_dir
    creds_dir = args.creds_dir
    manually_run_conseq = args.manually_run_conseq
    start_with = args.start_with
    publish_dest = args.publish_dest
    export_path = args.export_path

    # Set conseq file - with override logic if publish_dest provided
    if publish_dest:
        conseq_file = create_override_conseq_file(env_name, publish_dest)
        print(f"Created override conseq file: {conseq_file}")
    else:
        conseq_file = f"run_{env_name}.conseq"
        print("No S3 path override specified")

    try:
        # Check credentials exist
        check_credentials(creds_dir)

        # Load Docker image and get commit SHA
        if args.image:
            docker_image = args.image
        else:
            docker_image = read_docker_image_name()
        commit_sha = get_git_commit_sha()

        # Pull Docker image
        if "/" in docker_image:
            print("Pulling Docker image...")
            subprocess.run(
                ["docker", "pull", docker_image],
                check=True,
                env={
                    **os.environ,
                    "GOOGLE_APPLICATION_CREDENTIALS": "/etc/google/auth/application_default_credentials.json",
                },
            )

        # Backup logs before running
        backup_conseq_logs()

        # Handle START_WITH functionality
        if start_with:
            print(f"Starting with existing export: {start_with}")
            # Clean out old invocation
            subprocess.run(["sudo", "chown", "-R", "ubuntu", "pipeline"], check=True)
            subprocess.run(["rm", "-rf", "pipeline/state"], check=True)

            # Use gcloud storage cp with temporary service account activation
            with tempfile.TemporaryDirectory() as temp_home:
                env_with_temp_home = {**os.environ, "HOME": temp_home}

                # Activate service account
                subprocess.run(
                    [
                        "gcloud",
                        "auth",
                        "activate-service-account",
                        "--key-file",
                        f"{creds_dir}/depmap-pipeline-runner.json",
                    ],
                    check=True,
                    env=env_with_temp_home,
                )

                # Download the export
                subprocess.run(
                    [
                        "gcloud",
                        "storage",
                        "cp",
                        start_with,
                        "pipeline/downloaded-export.conseq",
                    ],
                    check=True,
                    env=env_with_temp_home,
                )

            # Run the downloaded export
            run_via_container(
                "conseq run downloaded-export.conseq",
                job_name,
                docker_image,
                taiga_dir,
                creds_dir,
            )

            # Forget publish rules
            run_via_container(
                "conseq forget --regex 'publish.*'",
                job_name,
                docker_image,
                taiga_dir,
                creds_dir,
            )

        if manually_run_conseq:
            print(f"executing: conseq {' '.join(conseq_args)}")
            result = run_via_container(
                f"conseq {' '.join(conseq_args)}",
                job_name,
                docker_image,
                taiga_dir,
                creds_dir,
            )
            run_exit_status = result.returncode
        else:
            # Clean up unused directories from past runs
            result = run_via_container(
                "conseq gc", job_name, docker_image, taiga_dir, creds_dir,
            )
            assert result.returncode == 0

            # Kick off new run
            conseq_run_cmd = (
                f"conseq run --addlabel commitsha={commit_sha} --no-reattach --maxfail 20 "
                f"--remove-unknown-artifacts -D sparkles_path=/install/sparkles/bin/sparkles "
                f"{conseq_file} {' '.join(conseq_args)}"
            )

            result = run_via_container(
                conseq_run_cmd, job_name, docker_image, taiga_dir, creds_dir,
            )
            run_exit_status = result.returncode

            # Generate export (this pipeline actually does export)
            if export_path:
                run_via_container(
                    f"conseq export {conseq_file} {export_path}",
                    job_name,
                    docker_image,
                    taiga_dir,
                    creds_dir,
                )

            # Generate report (this pipeline actually generates reports)
            run_via_container(
                "conseq report html", job_name, docker_image, taiga_dir, creds_dir,
            )

            # Copy the latest logs
            backup_conseq_logs()

        print("Pipeline run complete")

        # Fix permissions (docker container writes files as root)
        subprocess.run(["sudo", "chown", "-R", "ubuntu", "."], check=True)

        sys.exit(run_exit_status)

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
