import json
import os
import subprocess
import sys
import tempfile
import uuid
import yaml
from abc import ABC, abstractmethod
from pathlib import Path
from datetime import datetime


class PipelineRunner(ABC):
    """Base class for all pipeline runners."""

    def __init__(self):
        self.script_path = None
        self.pipeline_name = None
        self.pipeline_run_id = str(uuid.uuid4())
        self.config_data = self._load_config()

    def _load_config(self):
        """Load pipeline configuration from YAML file."""
        config_path = Path(__file__).parent / "pipeline_config.yaml"
        assert config_path.exists(), f"Config file not found: {config_path}"

        with open(config_path, "r") as f:
            config = yaml.safe_load(f)

        assert config, "Config file is empty or invalid"
        return config

    def get_git_commit_sha(self):
        """Get the current git commit SHA."""
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"], capture_output=True, text=True, check=True
        )
        return result.stdout.strip()

    def read_docker_image_name(self, script_dir):
        """Load Docker image name from image-name file."""
        image_name_file = script_dir.parent / "image-name"
        assert (
            image_name_file.exists()
        ), f"Could not find image-name file in {script_dir.parent}"

        with open(image_name_file, "r") as f:
            for line in f:
                line = line.strip()
                if line.startswith("DOCKER_IMAGE="):
                    image_name = line.split("=", 1)[1].strip("\"'")
                    return image_name

        raise ValueError(f"Could not find DOCKER_IMAGE= in {image_name_file}")

    def backup_conseq_logs(self, state_path, log_destination):
        """Copy all logs to specified directory."""
        state_dir = Path(state_path)
        if not state_dir.exists():
            return

        with tempfile.NamedTemporaryFile(mode="w", delete=False) as f:
            temp_file = f.name

        assert temp_file, "Temporary file name cannot be empty"
        assert os.path.exists(temp_file), f"Temporary file was not created: {temp_file}"

        find_commands = [
            ["find", ".", "-name", "std*.txt"],
            ["find", ".", "-name", "*.sh"],
            ["find", ".", "-name", "*.log"],
        ]

        with open(temp_file, "w") as f:
            for cmd in find_commands:
                assert cmd, "Find command cannot be empty"
                result = subprocess.run(
                    cmd, cwd=state_dir, capture_output=True, text=True, check=True
                )
                f.write(result.stdout)

        subprocess.run(
            ["rsync", "-a", state_path, log_destination, f"--files-from={temp_file}",],
            check=True,
        )

        os.unlink(temp_file)

    def check_credentials(self, creds_dir):
        """Check that required credential files exist."""
        required_files = self.config_data["credentials"]["required_files"]

        for filename in required_files:
            filepath = Path(creds_dir) / filename
            if not filepath.exists():
                raise FileNotFoundError(f"Could not find required file: {filepath}")

    def pull_docker_image(self, docker_image):
        """Pull Docker image if it has a registry path."""
        if docker_image and "/" in docker_image:
            print("Pulling Docker image...")
            env_vars = {
                **os.environ,
                "GOOGLE_APPLICATION_CREDENTIALS": "/etc/google/auth/application_default_credentials.json",
            }
            subprocess.run(["docker", "pull", docker_image], check=True, env=env_vars)

    def log_dataset_usage(self, dataset_taiga_id):
        """Print dataset usage information."""
        final_log = {
            "pipeline_run_id": self.pipeline_run_id,
            "dataset_taiga_id": dataset_taiga_id,
            "pipeline": self.pipeline_name,
            "timestamp": datetime.now().astimezone().isoformat(),
        }
        print("=" * 50)
        print(json.dumps(final_log, indent=2))
        print("=" * 50)

    def track_dataset_usage_from_conseq(self, pipeline_dir):
        """Track dataset usage from DO-NOT-EDIT-ME files and log to usage tracker."""
        import re

        pipeline_path = Path(pipeline_dir)
        version_files = list(pipeline_path.glob("*-DO-NOT-EDIT-ME"))

        if not version_files:
            raise ValueError(f"No *-DO-NOT-EDIT-ME files found in {pipeline_dir}")

        for version_file in version_files:
            assert version_file.exists(), f"Version file does not exist: {version_file}"

            with open(version_file, "r") as f:
                content = f.read()
                assert content, f"Version file is empty: {version_file}"

                release_pattern = (
                    r'"type":\s*"release_taiga_id"[^}]*"dataset_id":\s*"([^"]+)"'
                )
                match = re.search(release_pattern, content, re.DOTALL)

                if match:
                    release_taiga_id = match.group(1)
                    assert release_taiga_id, "Release taiga ID is empty"
                    self.log_dataset_usage(release_taiga_id)
                    return

        raise ValueError(
            f"Release taiga ID not found in any *-DO-NOT-EDIT-ME files in {pipeline_dir}. "
            "Please check the files and try again."
        )

    def add_common_arguments(self, parser):
        """Add common CLI arguments that all pipelines share."""
        defaults = self.config_data["defaults"]

        parser.add_argument("env_name", help="Name of environment")
        parser.add_argument("job_name", help="Name to use for job")
        parser.add_argument(
            "--taiga-dir", default=defaults["taiga_dir"], help="Taiga directory path"
        )
        parser.add_argument(
            "--creds-dir",
            default=defaults["creds_dir"],
            help="Pipeline runner credentials directory",
        )
        parser.add_argument(
            "--image", help="If set, use this docker image when running the pipeline"
        )

    def build_common_config(self, args, pipeline_name):
        """Build common configuration dictionary that all pipelines share."""
        pipeline_cfg = self.config_data["pipelines"][pipeline_name]

        config = {
            "env_name": args.env_name,
            "job_name": args.job_name,
            "taiga_dir": args.taiga_dir,
            "creds_dir": args.creds_dir,
            "image": args.image,
            "state_path": pipeline_cfg["state_path"],
            "log_destination": pipeline_cfg["log_destination"],
            "working_dir": pipeline_cfg["working_dir"],
        }

        self.check_credentials(config["creds_dir"])
        return config

    def run_via_container(self, command, config):
        """Run command inside Docker container with pipeline-specific configuration."""
        cwd = os.getcwd()
        docker_cfg = self.config_data["docker"]
        volumes = docker_cfg["volumes"]
        env_vars = docker_cfg["env_vars"]
        cred_files = self.config_data["credentials"]["required_files"]

        # Start building docker command
        docker_cmd = ["docker", "run"]

        # Add pipeline-specific options (e.g., security settings)
        pipeline_options = docker_cfg["options"].get(self.pipeline_name, {})
        if "security_opt" in pipeline_options:
            docker_cmd.extend(["--security-opt", pipeline_options["security_opt"]])

        # Add common options
        docker_cmd.extend(
            [
                "--rm",
                "-v",
                f"{cwd}:{volumes['work_dir']}",
                "-w",
                config["working_dir"],
                "-v",
                f"{config['creds_dir']}/{cred_files[0]}:{volumes['aws_keys']}",
                "-v",
                f"{config['creds_dir']}/{cred_files[1]}:{volumes['sparkles_cache']}",
                "-v",
                f"{config['creds_dir']}/{cred_files[2]}:{volumes['google_creds']}",
                "-v",
                f"{config['taiga_dir']}:{volumes['taiga']}",
                "-e",
                f"GOOGLE_APPLICATION_CREDENTIALS={env_vars['GOOGLE_APPLICATION_CREDENTIALS']}",
                "--name",
                config["job_name"],
                config["docker_image"],
                "bash",
                "-c",
                f"source {volumes['aws_keys']} && {command}",
            ]
        )

        print("=" * 50)
        print(f"{self.pipeline_name} Pipeline Runner command:")
        print(f"  {command}")
        print("=" * 50)

        return subprocess.run(docker_cmd)

    @abstractmethod
    def create_argument_parser(self):
        """Create and return the argument parser for this pipeline."""
        pass

    @abstractmethod
    def get_pipeline_config(self, args):
        """Return pipeline-specific configuration."""
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

        print(f"Pipeline run ID: {self.pipeline_run_id}")

        parser = self.create_argument_parser()
        args = parser.parse_args()

        config = self.get_pipeline_config(args)

        docker_image = config.get("image") or self.read_docker_image_name(
            self.script_path.parent
        )
        config["docker_image"] = docker_image
        config["commit_sha"] = self.get_git_commit_sha()

        self.pull_docker_image(docker_image)

        self.backup_conseq_logs(config["state_path"], config["log_destination"])
        self.handle_special_features(config)

        config["conseq_file"] = self.get_conseq_file(config)

        if config.get("manually_run_conseq"):
            conseq_args = config.get("conseq_args", [])
            print(f"executing: conseq {' '.join(conseq_args)}")
            result = self.run_via_container(
                f"conseq -D is_dev=False {' '.join(conseq_args)}", config
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

        print("Pipeline run complete")
        subprocess.run(["sudo", "chown", "-R", "ubuntu", "."], check=True)
        sys.exit(run_exit_status)

    def build_conseq_run_command(self, config):
        """Build the main conseq run command."""
        conseq_cfg = self.config_data["conseq"]
        common_args = " ".join(conseq_cfg["common_args"])

        cmd_parts = [
            f"conseq run --addlabel commitsha={config['commit_sha']}",
            f"{common_args} --maxfail {conseq_cfg['max_fail']}",
            f"-D sparkles_path={conseq_cfg['sparkles_path']}",
            "-D is_dev=False",
        ]

        # Add pipeline-specific options
        if config.get("s3_staging_url"):
            cmd_parts.append(f"-D S3_STAGING_URL={config['s3_staging_url']}")
        if config.get("publish_dest"):
            cmd_parts.append(f"-D publish_dest={config['publish_dest']}")

        conseq_args = config.get("conseq_args", [])
        cmd_parts.extend([config["conseq_file"], " ".join(conseq_args)])
        return " ".join(cmd_parts)

    def handle_post_run_tasks(self, config):
        """Handle post-run tasks like export and report generation."""
        # Default implementation - can be overridden by specific pipelines
        pass
