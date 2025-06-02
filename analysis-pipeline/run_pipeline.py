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


def run_via_container(command, job_name, docker_image, taiga_dir, creds_dir):
    """Run command inside Docker container with proper volume mounts."""
    cwd = os.getcwd()
    
    docker_cmd = [
        "docker", "run",
        "--rm",
        "-v", f"{cwd}:/work",
        "-v", f"{creds_dir}/sparkles:/root/.sparkles-cache",
        "-v", f"{creds_dir}/depmap-pipeline-runner.json:/etc/google_default_creds.json",
        "-v", f"{taiga_dir}:/root/.taiga",
        "-v", "/etc/google/auth/application_default_credentials.json:/etc/google/auth/application_default_credentials.json",
        "-e", "GOOGLE_APPLICATION_CREDENTIALS=/etc/google/auth/application_default_credentials.json",
        "-e", f"HOST_WORKSPACE_PATH={cwd}",
        "-v", "/var/run/docker.sock:/var/run/docker.sock",
        "-w", "/work/analysis-pipeline",
        "--name", job_name,
        docker_image,
        "bash", "-c", f"gcloud auth configure-docker us.gcr.io && {command}"
    ]
    
    return subprocess.run(docker_cmd)


def main():
    parser = argparse.ArgumentParser(description="Run analysis pipeline")
    parser.add_argument("env_name", help="Name of environment")
    parser.add_argument("job_name", help="Name to use for job")
    parser.add_argument("export_path", nargs="?", help="Export path (optional)")
    
    args = parser.parse_args()
    
    # Set up paths and variables
    conseq_file = f"predictability/run_{args.env_name}_analysis.conseq"
    
    if args.export_path:
        export_path = args.export_path
        print(f"Using export path: {export_path}")
    else:
        export_path = f"gs://preprocessing-pipeline-outputs/analysis-pipeline/{args.env_name}/export"
        print(f"Using default export path: {export_path}")
    
    # Get environment variables with defaults
    taiga_dir = os.environ.get("TAIGA_DIR", "/data2/depmap-pipeline-taiga")
    creds_dir = os.environ.get("PIPELINE_RUNNER_CREDS_DIR", "/etc/depmap-pipeline-runner-creds")
    manually_run_conseq = os.environ.get("MANUALLY_RUN_CONSEQ") == "true"
    conseq_args = os.environ.get("CONSEQ_ARGS", "")
    
    try:
        # Load Docker image and get commit SHA
        docker_image = load_docker_image()
        commit_sha = get_git_commit_sha()
        
        # Check credentials
        check_credentials(creds_dir)
        
        # Pull Docker image
        print("Pulling Docker image...")
        subprocess.run([
            "docker", "pull", docker_image
        ], check=True, env={**os.environ, "GOOGLE_APPLICATION_CREDENTIALS": "/etc/google/auth/application_default_credentials.json"})
        
        # Backup logs before running
        backup_conseq_logs()
        
        if manually_run_conseq:
            print(f"executing: conseq {conseq_args}")
            result = run_via_container(
                f"conseq -D is_dev=False {conseq_args}",
                args.job_name, docker_image, taiga_dir, creds_dir
            )
            run_exit_status = result.returncode
        else:
            # Clean up unused directories from past runs
            run_via_container(
                "conseq gc",
                args.job_name, docker_image, taiga_dir, creds_dir
            )
            
            # Kick off new run
            conseq_run_cmd = (
                f"conseq run --addlabel commitsha={commit_sha} --no-reattach --maxfail 20 "
                f"--remove-unknown-artifacts -D sparkles_path=/install/sparkles/bin/sparkles "
                f"-D is_dev=False {conseq_file} {conseq_args}"
            )
            
            result = run_via_container(
                conseq_run_cmd,
                args.job_name, docker_image, taiga_dir, creds_dir
            )
            run_exit_status = result.returncode
            
            # Generate export (commented out in original)
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
