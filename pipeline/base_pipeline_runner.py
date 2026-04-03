import argparse
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
from typing import Optional

from pipeline_config import (
    BasePipelineSpecificConfig,
    CommonConfig,
    DefaultsConfig,
    PipelineConfig,
)

import re


def load_pipeline_config() -> PipelineConfig:
    """Load pipeline configuration from the shared YAML file."""
    config_path = Path(__file__).parent / "pipeline_config.yaml"
    assert config_path.exists(), f"Config file not found: {config_path}"
    with open(config_path, "r") as f:
        raw = yaml.safe_load(f)
    assert raw, "Config file is empty or invalid"
    return PipelineConfig.model_validate(raw)


def create_argument_parser(defaults: DefaultsConfig) -> argparse.ArgumentParser:
    """Create the shared argument parser for all pipeline runners."""
    parser = argparse.ArgumentParser(description="Run pipeline")
    parser.add_argument("--deploy-name", help="Name of environment")
    parser.add_argument("--docker-job-name", help="Name to use for job")
    parser.add_argument(
        "--taiga-dir", default=defaults.taiga_dir, help="Taiga directory path"
    )
    parser.add_argument(
        "--creds-dir",
        default=defaults.creds_dir,
        help="Pipeline runner credentials directory",
    )
    parser.add_argument(
        "--image", help="If set, use this docker image when running the pipeline"
    )
    parser.add_argument(
        "--destination", help="GCS path for publishing; presence enables publishing"
    )
    parser.add_argument("--start-with", help="Start with existing export from GCS path")
    parser.add_argument(
        "--manually-run-conseq",
        action="store_true",
        help="If set, conseq_args are passed directly to conseq",
    )
    parser.add_argument("conseq_args", nargs="*", help="Parameters to pass to conseq")
    parser.add_argument("--export-path", help="Export path for conseq export")
    parser.add_argument(
        "--dryrun", action="store_true", help="Print commands instead of running them",
    )
    return parser


class PipelineRunner(ABC):
    """Base class for all pipeline runners."""

    def __init__(self, dryrun: bool, script_path: Path):
        self.dryrun = dryrun
        self.pipeline_run_id = str(uuid.uuid4())
        self.script_path = script_path
        self.config = load_pipeline_config()
        self.pipeline_name = self.script_path.parent.name

    def subprocess_run(self, cmd: list, **kwargs) -> subprocess.CompletedProcess:
        """Run a subprocess, or print the command if in dryrun mode."""
        if self.dryrun:
            print(f"[dryrun] {' '.join(str(a) for a in cmd)}")
            return subprocess.CompletedProcess(cmd, 0)
        return subprocess.run(cmd, **kwargs)

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
                result = self.subprocess_run(
                    cmd, cwd=state_dir, capture_output=True, text=True, check=True
                )
                f.write(result.stdout)

        self.subprocess_run(
            ["rsync", "-a", state_path, log_destination, f"--files-from={temp_file}"],
            check=True,
        )

        os.unlink(temp_file)

    def check_credentials(self, creds_dir):
        """Check that required credential files exist."""
        for filename in self.config.credentials.required_files:
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
            self.subprocess_run(
                ["docker", "pull", docker_image], check=True, env=env_vars
            )

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
        pipeline_path = Path(pipeline_dir)
        version_files = list(pipeline_path.glob("*-DO-NOT-EDIT-ME"))

        if not version_files:
            raise ValueError(f"No *-DO-NOT-EDIT-ME files found in {pipeline_dir}")

        for version_file in version_files:
            assert version_file.exists(), f"Version file does not exist: {version_file}"

            with open(version_file, "r") as f:
                content = f.read()
                assert content, f"Version file is empty: {version_file}"
                release_pattern = r'let RELEASE_TAIGA_ID="([^"]+)"'
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

    def build_common_config(
        self, args, pipeline_cfg: BasePipelineSpecificConfig
    ) -> CommonConfig:
        """Build common configuration that all pipelines share."""

        docker_image = args.image or self.read_docker_image_name(
            self.script_path.parent
        )
        commit_sha = self.get_git_commit_sha()

        config = CommonConfig(
            env_name=args.deploy_name,
            job_name=args.docker_job_name,
            taiga_dir=args.taiga_dir,
            creds_dir=args.creds_dir,
            image=args.image,
            docker_image=docker_image,
            commit_sha=commit_sha,
            state_path=pipeline_cfg.state_path,
            log_destination=pipeline_cfg.log_destination,
            working_dir=pipeline_cfg.working_dir,
            publish_dest=args.destination,
            start_with=args.start_with,
            manually_run_conseq=args.manually_run_conseq,
            conseq_args=args.conseq_args,
        )

        self.check_credentials(config.creds_dir)
        return config

    def run_via_container(self, command, config: CommonConfig):
        """Run command inside Docker container with pipeline-specific configuration."""
        cwd = os.getcwd()
        docker_cfg = self.config.docker
        volumes = docker_cfg.volumes
        cred_files = self.config.credentials.required_files

        # Start building docker command
        docker_cmd = ["docker", "run"]

        # Add pipeline-specific options (e.g., security settings)
        pipeline_options = docker_cfg.options.get(self.pipeline_name)
        if pipeline_options and pipeline_options.security_opt:
            docker_cmd.extend(["--security-opt", pipeline_options.security_opt])

        # Add common options
        docker_cmd.extend(
            [
                "--rm",
                "-v",
                f"{cwd}:{cwd}",
                "-w",
                cwd,
                "-v",
                f"{config.creds_dir}/{cred_files[1]}:{volumes.sparkles_cache}",
                "-v",
                f"{config.creds_dir}/{cred_files[2]}:{volumes.google_creds}",
                "-v",
                f"{config.taiga_dir}:{volumes.taiga}",
                "-e",
                f"GOOGLE_APPLICATION_CREDENTIALS={docker_cfg.env_vars.google_application_credentials}",
                "--name",
                config.job_name,
                config.docker_image,
                "bash",
                "-c",
                command,
            ]
        )

        print("=" * 50)
        print(f"{self.pipeline_name} Pipeline Runner command:")
        print(f"  {command}")
        print("=" * 50)

        return self.subprocess_run(docker_cmd)

    def map_environment_name(self, env_name: str, env_mapping: dict[str, str]) -> str:
        """Map a user-facing environment name to the name used in conseq filenames."""
        if env_name.startswith("test-"):
            return env_mapping["test-prefix"]
        return env_mapping.get(env_name, env_name)

    def create_override_conseq_file(
        self, pipeline_dir: str, original_conseq: str, publish_dest: str
    ) -> str:
        """Create an override conseq file that injects a custom publish_dest.

        Args:
            pipeline_dir: local path to the pipeline directory (host filesystem)
            original_conseq: path to the original conseq file relative to pipeline_dir
            publish_dest: the publish destination value to inject

        Returns the filename of the override file, relative to pipeline_dir.
        """
        override_name = f"{original_conseq}.patched"

        with open(original_conseq, "r") as original:
            with open(override_name, "w") as override:
                override.write(f'let publish_dest = "{publish_dest}"\n')
                for line in original:
                    if not line.strip().startswith("let publish_dest"):
                        override.write(line)

        return override_name

    @abstractmethod
    def get_pipeline_config(self, args: argparse.Namespace) -> CommonConfig:
        """Return pipeline-specific configuration."""
        pass

    def get_conseq_file(self, config: CommonConfig) -> str:
        assert self.script_path is not None
        env_mapping = self.config.pipelines.data_prep.env_mapping
        mapped_env = self.map_environment_name(config.env_name, env_mapping)
        pipeline_dir = str(self.script_path.parent)
        original_conseq = f"{pipeline_dir}/run_{mapped_env}.conseq"
        if config.publish_dest:
            conseq_file = self.create_override_conseq_file(
                pipeline_dir, original_conseq, config.publish_dest
            )
            print(f"Created override conseq file: {conseq_file}")
            return conseq_file
        return original_conseq

    def handle_special_features(self, config: CommonConfig) -> None:
        """Handle pre-run features. Subclasses should call super() after their own logic."""

        assert self.script_path is not None
        if config.start_with:
            print(f"Starting with existing export: {config.start_with}")
            self.subprocess_run(
                ["sudo", "chown", "-R", "ubuntu", str(self.script_path.parent)],
                check=True,
            )
            self.subprocess_run(
                ["rm", "-rf", str(self.script_path.parent / "state")], check=True
            )

            with tempfile.TemporaryDirectory() as temp_home:
                env_with_temp_home = {**os.environ, "HOME": temp_home}

                self.subprocess_run(
                    [
                        "gcloud",
                        "auth",
                        "activate-service-account",
                        "--key-file",
                        f"{config.creds_dir}/depmap-pipeline-runner.json",
                    ],
                    check=True,
                    env=env_with_temp_home,
                )

                self.subprocess_run(
                    [
                        "gcloud",
                        "storage",
                        "cp",
                        config.start_with,
                        str(self.script_path.parent / "downloaded-export.conseq"),
                    ],
                    check=True,
                    env=env_with_temp_home,
                )

            self.run_via_container("conseq run downloaded-export.conseq", config)
            self.run_via_container("conseq forget --regex 'publish.*'", config)

    def run(self, args: argparse.Namespace) -> None:
        """Main entry point for running the pipeline."""

        print(f"Pipeline run ID: {self.pipeline_run_id}")

        config = self.get_pipeline_config(args)

        self.pull_docker_image(config.docker_image)

        self.backup_conseq_logs(config.state_path, config.log_destination)
        self.handle_special_features(config)

        config.conseq_file = self.get_conseq_file(config)

        if config.manually_run_conseq:
            print(f"executing: conseq {' '.join(config.conseq_args)}")
            result = self.run_via_container(
                f"conseq -D is_dev=False {' '.join(config.conseq_args)}", config
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
            self.backup_conseq_logs(config.state_path, config.log_destination)

        print("Pipeline run complete")
        self.subprocess_run(["sudo", "chown", "-R", "ubuntu", "."], check=True)
        sys.exit(run_exit_status)

    def build_conseq_run_command(self, config: CommonConfig) -> str:
        """Build the main conseq run command."""
        conseq_cfg = self.config.conseq
        common_args = " ".join(conseq_cfg.common_args)

        cmd_parts = [
            f"conseq run --addlabel commitsha={config.commit_sha}",
            f"{common_args} --maxfail {conseq_cfg.max_fail}",
            f"-D sparkles_path={conseq_cfg.sparkles_path}",
            "-D is_dev=False",
        ]

        # Add pipeline-specific options
        if config.s3_staging_url:
            cmd_parts.append(f"-D S3_STAGING_URL={config.s3_staging_url}")
        if config.publish_dest:
            cmd_parts.append(f'-D publish_dest="{config.publish_dest}"')
            cmd_parts.append("-D publish_data_prep=True")

        assert (
            config.conseq_file is not None
        ), "conseq_file must be set before building run command"
        cmd_parts.extend([config.conseq_file, " ".join(config.conseq_args)])
        return " ".join(cmd_parts)

    def handle_post_run_tasks(self, config: CommonConfig) -> None:
        """Handle post-run tasks. Subclasses should call super() after their own logic."""
        self.run_via_container("conseq report html", config)
        if self.dryrun:
            print("[dryrun] skipping track_dataset_usage")
        else:
            self.track_dataset_usage_from_conseq(str(self.script_path.parent))

        if config.export_path:
            assert config.conseq_file is not None
            self.run_via_container(
                f"conseq export {config.conseq_file} {config.export_path}", config
            )
