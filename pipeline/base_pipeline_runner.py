import json
import os
import subprocess
import sys
import tempfile
import time
import uuid
from abc import ABC, abstractmethod
from pathlib import Path
from datetime import datetime


class PipelineRunner(ABC):
    """Base class for all pipeline runners."""

    def __init__(self):
        self.script_path = None
        self.pipeline_name = None
        self.pipeline_run_id = str(uuid.uuid4())
        self.log_dir = None
        self.dataset_log_file = None
        self.version_log_file = None

    def get_git_commit_sha(self):
        """Get the current git commit SHA."""
        try:
            result = subprocess.run(
                ["git", "rev-parse", "HEAD"], capture_output=True, text=True, check=True
            )
            return result.stdout.strip()
        except subprocess.CalledProcessError:
            return "unknown"

    def read_docker_image_name(self, script_dir):
        """Load Docker image name from image-name file."""
        # Try current directory first
        image_name_file = script_dir / "image-name"

        # If not found, try one level up
        if not image_name_file.exists():
            image_name_file = script_dir.parent / "image-name"

        if not image_name_file.exists():
            raise FileNotFoundError(
                f"Could not find image-name file in {script_dir} or {script_dir.parent}"
            )

        # Parse the file to get DOCKER_IMAGE variable
        with open(image_name_file, "r") as f:
            for line in f:
                line = line.strip()
                if line.startswith("DOCKER_IMAGE="):
                    return line.split("=", 1)[1].strip("\"'")

        raise ValueError(f"DOCKER_IMAGE not found in {image_name_file}")

    def backup_conseq_logs(self, state_path, log_destination):
        """Copy all logs to specified directory."""
        state_dir = Path(state_path)
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
                    state_path,
                    log_destination,
                    f"--files-from={temp_file}",
                ],
                check=True,
            )

        finally:
            os.unlink(temp_file)

    def check_credentials(self, creds_dir):
        """Check that required credential files exist."""
        required_files = ["broad-paquitas", "sparkles", "depmap-pipeline-runner.json"]

        for filename in required_files:
            filepath = Path(creds_dir) / filename
            if not filepath.exists():
                raise FileNotFoundError(f"Could not find required file: {filepath}")

    def pull_docker_image(self, docker_image):
        """Pull Docker image if it has a registry path."""
        if "/" in docker_image:
            print("Pulling Docker image...")
            env_vars = {
                **os.environ,
                "GOOGLE_APPLICATION_CREDENTIALS": "/etc/google/auth/application_default_credentials.json",
            }
            subprocess.run(["docker", "pull", docker_image], check=True, env=env_vars)

    def fix_permissions(self):
        """Fix file permissions after Docker execution."""
        import platform

        if platform.system() == "Linux":
            subprocess.run(["sudo", "chown", "-R", "ubuntu", "."], check=True)
        else:
            print("Skipping permission fix (not needed on macOS)")

    def setup_logging(self):
        """Set up logging directory and files for this pipeline run."""
        # Create logging directory
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.log_dir = Path(
            f"logs/{self.pipeline_name}_{timestamp}_{self.pipeline_run_id[:8]}"
        )
        self.log_dir.mkdir(parents=True, exist_ok=True)

        # Set up log file paths
        self.dataset_log_file = self.log_dir / "dataset_usage.jsonl"
        self.version_log_file = (
            self.log_dir / f"{self.pipeline_name}_version_snapshot.txt"
        )

        print(f"Pipeline run ID: {self.pipeline_run_id}")
        print(f"Logs will be written to: {self.log_dir}")

    def copy_version_files(self):
        """Copy version and input template files before pipeline run."""
        pipeline_dir = self.script_path.parent
        version_files = list(pipeline_dir.glob("*-DO-NOT-EDIT-ME"))
        print(f"Copying {len(version_files)} version files to {self.version_log_file}")
        print(f"Version files: {version_files}")

        if version_files:
            with open(self.version_log_file, "w") as f:
                f.write(f"Pipeline: {self.pipeline_name}\n")
                f.write(f"Run ID: {self.pipeline_run_id}\n")
                f.write(f"Timestamp: {datetime.now().isoformat()}\n")
                f.write(f"Git Commit: {self.get_git_commit_sha()}\n")
                f.write("=" * 50 + "\n\n")

                for version_file in version_files:
                    f.write(f"=== {version_file.name} ===\n")
                    with open(version_file, "r") as vf:
                        f.write(vf.read())
                    f.write("\n" + "=" * 50 + "\n\n")

            print(
                f"Copied {len(version_files)} version files to {self.version_log_file}"
            )
        else:
            print("No version files found to copy")

    def log_dataset_usage(self, dataset_taiga_id, release_taiga_id=None):
        """Log usage of a dataset during pipeline execution."""
        if not self.dataset_log_file:
            return

        log_entry = {
            "pipeline_run_id": self.pipeline_run_id,
            "release_taiga_id": release_taiga_id,
            "dataset_taiga_id": dataset_taiga_id,
            "pipeline": self.pipeline_name,
            "timestamp": time.time(),
        }

        # Append to JSON file
        with open(self.dataset_log_file, "a") as f:
            f.write(json.dumps(log_entry) + "\n")

    def finalize_dataset_log(self):
        """Convert individual log entries to final JSON format."""
        if not self.dataset_log_file or not self.dataset_log_file.exists():
            return

        # Read all entries
        entries = []
        with open(self.dataset_log_file, "r") as f:
            for line in f:
                if line.strip():
                    entries.append(json.loads(line.strip()))

        if not entries:
            return

        # Group by pipeline run and create final format
        datasets_used = []
        release_taiga_id = entries[0].get("release_taiga_id")

        for entry in entries:
            datasets_used.append(
                {
                    "timestamp": entry["timestamp"],
                    "dataset_taiga_id": entry["dataset_taiga_id"],
                }
            )

        final_log = {
            "pipeline_run_id": self.pipeline_run_id,
            "release_taiga_id": release_taiga_id,
            "pipeline": self.pipeline_name,
            "datasets_used": datasets_used,
        }

        # Write final JSON file
        final_json_file = self.log_dir / "dataset_usage.json"
        with open(final_json_file, "w") as f:
            json.dump(final_log, f, indent=2)

        print(f"Finalized dataset usage log: {final_json_file}")

    def upload_logs_to_gcs(self, bucket_name="dpp-sparkles"):
        """Upload log files to Google Cloud Storage."""
        if not self.log_dir or not self.log_dir.exists():
            print("No log directory found, skipping GCS upload")
            return

        try:
            # Upload version log file
            if self.version_log_file and self.version_log_file.exists():
                version_gcs_path = f"gs://{bucket_name}/{self.pipeline_name}/{self.pipeline_run_id[:8]}/{self.version_log_file.name}"
                subprocess.run(
                    [
                        "gcloud",
                        "storage",
                        "cp",
                        str(self.version_log_file),
                        version_gcs_path,
                    ],
                    check=True,
                )
                print(f"Uploaded version log to: {version_gcs_path}")

            # Upload dataset usage log (JSON format)
            dataset_json_file = self.log_dir / "dataset_usage.json"
            if dataset_json_file.exists():
                dataset_gcs_path = f"gs://{bucket_name}/{self.pipeline_name}/{self.pipeline_run_id[:8]}/dataset_usage.json"
                subprocess.run(
                    [
                        "gcloud",
                        "storage",
                        "cp",
                        str(dataset_json_file),
                        dataset_gcs_path,
                    ],
                    check=True,
                )
                print(f"Uploaded dataset log to: {dataset_gcs_path}")

        except subprocess.CalledProcessError as e:
            print(f"Warning: Failed to upload logs to GCS: {e}")
        except Exception as e:
            print(f"Warning: Error during GCS upload: {e}")

    @abstractmethod
    def create_argument_parser(self):
        """Create and return the argument parser for this pipeline."""
        pass

    @abstractmethod
    def get_pipeline_config(self, args):
        """Return pipeline-specific configuration."""
        pass

    @abstractmethod
    def run_via_container(self, command, config):
        """Run command inside Docker container with pipeline-specific configuration."""
        pass

    @abstractmethod
    def get_conseq_file(self, config):
        """Get the conseq file to use for this pipeline."""
        pass

    @abstractmethod
    def handle_special_features(self, config):
        """Handle pipeline-specific features like START_WITH, override files, etc."""
        pass

    def run(self, script_file_path):
        """Main entry point for running the pipeline."""
        self.script_path = Path(script_file_path)
        self.pipeline_name = self.script_path.parent.name

        # Set up logging system
        self.setup_logging()
        self.copy_version_files()

        parser = self.create_argument_parser()
        args = parser.parse_args()

        config = self.get_pipeline_config(args)

        try:
            # Load Docker image and get commit SHA
            if config.get("image"):
                docker_image = config["image"]
            else:
                docker_image = self.read_docker_image_name(self.script_path.parent)
            config["docker_image"] = docker_image
            config["commit_sha"] = self.get_git_commit_sha()

            self.pull_docker_image(docker_image)

            self.backup_conseq_logs(config["state_path"], config["log_destination"])
            self.handle_special_features(config)

            conseq_file = self.get_conseq_file(config)
            config["conseq_file"] = conseq_file

            if config.get("manually_run_conseq"):
                print(f"executing: conseq {' '.join(config['conseq_args'])}")
                result = self.run_via_container(
                    f"conseq -D is_dev=False {' '.join(config['conseq_args'])}", config
                )
                run_exit_status = result.returncode
            else:
                # Clean up unused directories from past runs
                result = self.run_via_container("conseq gc", config)
                assert result.returncode == 0, "Conseq gc failed"

                # Build and run main conseq command
                conseq_run_cmd = self.build_conseq_run_command(config)
                result = self.run_via_container(conseq_run_cmd, config)
                run_exit_status = result.returncode

                # Handle post-run tasks (export, reports, etc.)
                self.handle_post_run_tasks(config)

                # Copy the latest logs
                self.backup_conseq_logs(config["state_path"], config["log_destination"])

            # Finalize and upload logs
            self.finalize_dataset_log()
            self.upload_logs_to_gcs()

            print("Pipeline run complete")
            self.fix_permissions()
            sys.exit(run_exit_status)

        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
            # Still try to upload logs on failure
            self.finalize_dataset_log()
            self.upload_logs_to_gcs()
            sys.exit(1)

    def build_conseq_run_command(self, config):
        """Build the main conseq run command."""
        cmd_parts = [
            f"conseq run --addlabel commitsha={config['commit_sha']}",
            "--no-reattach --maxfail 20 --remove-unknown-artifacts",
            "-D sparkles_path=/install/sparkles/bin/sparkles",
            "-D is_dev=False",
        ]

        # Add pipeline-specific options
        if config.get("s3_staging_url"):
            cmd_parts.append(f"-D S3_STAGING_URL={config['s3_staging_url']}")
        if config.get("publish_dest"):
            cmd_parts.append(f"-D publish_dest={config['publish_dest']}")

        cmd_parts.extend([config["conseq_file"], " ".join(config["conseq_args"])])
        return " ".join(cmd_parts)

    def handle_post_run_tasks(self, config):
        """Handle post-run tasks like export and report generation."""
        # Default implementation - can be overridden by specific pipelines
        pass
