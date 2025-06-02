#!/usr/bin/env python3
"""
Pipeline runner script - Python version of jenkins-run-pipeline.sh
Runs analysis pipeline using Docker containers with proper credential mounting.
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
            ["git", "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError:
        return "unknown"


def load_docker_image():
    """Load Docker image name from image-name file."""
    script_dir = Path(__file__).parent
    image_name_file = script_dir / "image-name"
    
    if not image_name_file.exists():
        raise FileNotFoundError(f"Could not find {image_name_file}")
    
    # Source the file to get DOCKER_IMAGE variable
    # Since we can't source in Python, we'll parse it manually
    with open(image_name_file, 'r') as f:
        for line in f:
            line = line.strip()
            if line.startswith('DOCKER_IMAGE='):
                return line.split('=', 1)[1].strip('"\'')
    
    raise ValueError("DOCKER_IMAGE not found in image-name file")


def backup_conseq_logs():
    """Copy all logs to predictability-logs directory."""
    state_dir = Path("analysis-pipeline/state")
    if not state_dir.exists():
        return
    
    # Create temporary file list
    with tempfile.NamedTemporaryFile(mode='w', delete=False) as f:
        temp_file = f.name
    
    try:
        # Find log files
        find_commands = [
            ["find", ".", "-name", "std*.txt"],
            ["find", ".", "-name", "*.sh"],
            ["find", ".", "-name", "*.log"]
        ]
        
        with open(temp_file, 'w') as f:
            for cmd in find_commands:
                result = subprocess.run(
                    cmd,
                    cwd=state_dir,
                    capture_output=True,
                    text=True,
                    check=True
                )
                f.write(result.stdout)
        
        # Use rsync to copy files
        subprocess.run([
            "rsync", "-a", "analysis-pipeline/state", "predictability-logs",
            f"--files-from={temp_file}"
        ], check=True)
        
    finally:
        os.unlink(temp_file)


def check_credentials(creds_dir):
    """Check that required credential files exist."""
    required_files = [
        "broad-paquitas",
        "sparkles", 
        "depmap-pipeline-runner.json"
    ]
    
    for filename in required_files:
        filepath = Path(creds_dir) / filename
        if not filepath.exists():
            raise FileNotFoundError(f"Could not find required file: {filepath}")


def run_via_container(command, job_name, docker_image, taiga_dir, sparkles_cache, gcp_creds_file):
    """Run command inside Docker container with proper volume mounts."""
    cwd = os.getcwd()
    work_root = os.path.abspath(os.path.join(cwd, "../.."))
    rel_cwd = os.path.relpath(cwd, work_root)
    
    docker_cmd = [
        "docker", "run",
        
        # delete this container upon completion
        "--rm",

        # Next two lines mount the current working directory as /work and set that as 
        # the current dir on start of the container
        "-v", f"{work_root}:/work",
        "-w", os.path.join("/work",rel_cwd),

        # mount in files needed for running sparkles
        "-v", f"{sparkles_cache}:/root/.sparkles-cache",
        
        # mount in files needs fro using taiga
        "-v", f"{taiga_dir}:/root/.taiga",

        # next two lines are setting up google credentials to use. inside constainer should use the following credentials
        "-v", f"{gcp_creds_file}:/etc/google/auth/application_default_credentials.json",
        "-e", "GOOGLE_APPLICATION_CREDENTIALS=/etc/google/auth/application_default_credentials.json",

        # I don't recall what is using this environment variable. Can we delete it?
        "-e", f"HOST_WORKSPACE_PATH={cwd}",

        # Allow docker containers to be run inside the container
        "-v", "/var/run/docker.sock:/var/run/docker.sock",

        # set the docker container name
        "--name", job_name,

        # the docker image to use which has conseq etc installed
        docker_image,

        # and run the command, applying shell expansion
        "bash", "-c", f"{command}"
    ]
    print("command", command)
    return subprocess.run(docker_cmd)


def main():
    parser = argparse.ArgumentParser(description="Run analysis pipeline")
    parser.add_argument("--env", help="Name of environment")
    parser.add_argument("--job-name", default="run-pipeline", help="Name to use for job")
    parser.add_argument("--export-path", help="Export path (optional)")
    parser.add_argument("--manually-run-conseq", action="store_true", help="If set args will be passed directly to conseq")
    parser.add_argument("--taiga-dir", default=f"{os.environ['HOME']}/.taiga")
    parser.add_argument("--sparkles-cache", default=f"{os.environ['HOME']}/.sparkles-cache")
    parser.add_argument("conseq_args", nargs="*", help="parameters to pass to conseq") 

    args = parser.parse_args()
    
    # Set up paths and variables
    env_name = args.env    
    job_name = args.job_name
    conseq_args = args.conseq_args
    taiga_dir = args.taiga_dir
    manually_run_conseq = args.manually_run_conseq
    sparkles_cache = args.sparkles_cache
    gcp_creds_file = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    assert gcp_creds_file, "environment variable GOOGLE_APPLICATION_CREDENTIALS must be set"

    conseq_file = f"predictability/run_{env_name}_analysis.conseq"

    try:
        # Load Docker image and get commit SHA
        docker_image = load_docker_image()
        commit_sha = get_git_commit_sha()
        
        # Pull Docker image
        print("Pulling Docker image...")
        subprocess.run([
            "docker", "pull", docker_image
        ], check=True)
        
        # Backup logs before running
        backup_conseq_logs()
        
        if manually_run_conseq:
            print(f"executing: conseq {conseq_args}")
            result = run_via_container(
                f"conseq -D is_dev=False {conseq_args}",
                job_name, docker_image, taiga_dir, sparkles_cache, gcp_creds_file
            )
            run_exit_status = result.returncode
        else:
            # Clean up unused directories from past runs
            result = run_via_container(
                "conseq gc",
                job_name, docker_image, taiga_dir, sparkles_cache, gcp_creds_file
            )
            assert result.returncode == 0
            
            # Kick off new run
            conseq_run_cmd = (
                f"conseq run --addlabel commitsha={commit_sha} --no-reattach --maxfail 20 "
                f"--remove-unknown-artifacts -D sparkles_path=/install/sparkles/bin/sparkles "
                f"-D is_dev=False {conseq_file} {' '.join(conseq_args)}"
            )
            
            result = run_via_container(
                conseq_run_cmd,
                job_name, docker_image, taiga_dir, sparkles_cache, gcp_creds_file
            )
            run_exit_status = result.returncode
            
            # Generate export (commented out in original)
            # if args.export_path:
            #     export_path = args.export_path
            #     print(f"Using export path: {export_path}")
            # else:
            #     export_path = f"gs://preprocessing-pipeline-outputs/analysis-pipeline/{args.env_name}/export"
            #     print(f"Using default export path: {export_path}")
            # run_via_container(f"conseq export {conseq_file} {export_path}", ...)
            
            # Generate report (commented out in original)  
            # run_via_container("conseq report html", ...)
            
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
