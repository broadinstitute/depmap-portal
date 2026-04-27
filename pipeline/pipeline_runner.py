import argparse
import json
import logging
import os
import subprocess
import sys
import tempfile
import uuid
from typing import Union

import yaml
from pathlib import Path
from datetime import datetime

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

from pipeline_config import (
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
    parser.add_argument("--deploy-name", help="Name of environment", required=True)
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
    parser.add_argument(
        "--working-dir",
        help="The directory where the run_XXX.conseq file is contained for the pipeline you wish to run",
        required=True,
    )
    parser.add_argument(
        "--staging-url",
        default="gs://preprocessing-pipeline-outputs/conseq/depmap",
        help="The staging directory that conseq should use for hosting CAS in the cloud",
    )
    return parser


class PipelineRunner:
    """Base class for all pipeline runners."""

    def __init__(self, dryrun: bool, script_path: Path):
        self.dryrun = dryrun
        self.pipeline_run_id = str(uuid.uuid4())
        self.script_path = script_path
        self.config = load_pipeline_config()
        self.pipeline_name = self.script_path.parent.name

    def subprocess_run(
        self, cmd: Union[str, list], **kwargs
    ) -> subprocess.CompletedProcess:
        """Run a subprocess, or print the command if in dryrun mode."""
        if isinstance(cmd, str):
            cmd = cmd.strip().split(" ")

        wd = kwargs.get("cwd", os.getcwd())

        if self.dryrun:
            cmd_str = " ".join(str(a) for a in cmd)
            log.info(f"[dryrun] in {repr(wd)} run : {cmd_str}")
            return subprocess.CompletedProcess(cmd, 0)

        return subprocess.run(cmd, **kwargs)

    def get_git_commit_sha(self):
        """Get the current git commit SHA."""
        return "temp-fake-sha"
        # result = subprocess.run(
        #     ["git", "rev-parse", "HEAD"], capture_output=True, text=True, check=True
        # )
        # return result.stdout.strip()

    def log_dataset_usage(self, dataset_taiga_id):
        """Print dataset usage information."""
        final_log = {
            "pipeline_run_id": self.pipeline_run_id,
            "dataset_taiga_id": dataset_taiga_id,
            "pipeline": self.pipeline_name,
            "timestamp": datetime.now().astimezone().isoformat(),
        }
        log.info("=" * 50)
        log.info(json.dumps(final_log, indent=2))
        log.info("=" * 50)

    def track_dataset_usage_from_conseq(self, working_dir):
        """Track dataset usage from DO-NOT-EDIT-ME files and log to usage tracker."""
        pipeline_path = Path(working_dir)
        version_files = list(pipeline_path.glob("*-DO-NOT-EDIT-ME"))

        if not version_files:
            raise ValueError(f"No *-DO-NOT-EDIT-ME files found in {working_dir}")

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
            f"Release taiga ID not found in any *-DO-NOT-EDIT-ME files in {working_dir}. "
            "Please check the files and try again."
        )

    def build_common_config(self, args) -> CommonConfig:
        """Build common configuration that all pipelines share."""

        commit_sha = self.get_git_commit_sha()
        working_dir = args.working_dir

        config = CommonConfig(
            env_name=args.deploy_name,
            commit_sha=commit_sha,
            state_path=f"{working_dir}/state",
            working_dir=working_dir,
            publish_dest=args.destination,
            s3_staging_url=args.staging_url,
            start_with=args.start_with,
            manually_run_conseq=args.manually_run_conseq,
            conseq_args=args.conseq_args,
            export_path=args.export_path,
        )

        return config

    def map_environment_name(self, env_name: str) -> str:
        """Map a user-facing environment name to the name used in conseq filenames."""

        # Environment name mapping
        env_mapping = {
            "iqa": "internal",
            "istaging": "internal",
            "internal": "internal",
            "dqa": "dmc",
            "dstaging": "dmc",
            "pstaging": "dmc",
            "peddep": "dmc",
            "xqa": "external",
            "xstaging": "external",
            "test-prefix": "iqa",  # Any env starting with "test-" maps to this
        }

        if env_name.startswith("test-"):
            return env_mapping["test-prefix"]
        return env_mapping.get(env_name, env_name)

    def create_override_conseq_file(
        self, original_conseq: str, publish_dest: str, staging_url: str
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
                override.write(f'let S3_STAGING_URL = "{staging_url}"\n')
                for line in original:
                    if not line.strip().startswith("let publish_dest"):
                        override.write(line)

        return override_name

    def get_pipeline_config(self, args: argparse.Namespace) -> CommonConfig:
        return self.build_common_config(args)

    def get_conseq_file(self, config: CommonConfig) -> str:
        assert self.script_path is not None
        mapped_env = self.map_environment_name(config.env_name)
        log.info("env_name=%s, mapped_env=%s", config.env_name, mapped_env)
        original_conseq = f"{config.working_dir}/run_{mapped_env}.conseq"
        if config.publish_dest:
            conseq_file = self.create_override_conseq_file(
                original_conseq, config.publish_dest, config.s3_staging_url
            )
            log.info("Created override conseq file: %s", conseq_file)
        else:
            conseq_file = original_conseq
        return os.path.abspath(conseq_file)

    def handle_special_features(self, config: CommonConfig) -> None:
        """Handle pre-run features. Subclasses should call super() after their own logic."""

        assert self.script_path is not None
        if config.start_with:
            log.info("Starting with existing export: %s", config.start_with)
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

            self.subprocess_run(
                "conseq run downloaded-export.conseq",
                check=True,
                cwd=str(config.working_dir),
            )
            self.subprocess_run(
                "conseq forget --regex 'publish.*'",
                check=True,
                cwd=str(config.working_dir),
            )

    def run(self, args: argparse.Namespace) -> None:
        """Main entry point for running the pipeline."""

        log.info("Pipeline run ID: %s", self.pipeline_run_id)

        config = self.get_pipeline_config(args)

        self.handle_special_features(config)

        config.conseq_file = self.get_conseq_file(config)

        if config.manually_run_conseq:
            log.info("executing: conseq %s", " ".join(config.conseq_args))
            result = self.subprocess_run(
                f"conseq -D is_dev=False {' '.join(config.conseq_args)}",
                cwd=str(config.working_dir),
            )
            run_exit_status = result.returncode
        else:
            # Clean up unused directories from past runs
            result = self.subprocess_run("conseq gc", cwd=str(config.working_dir))
            assert result.returncode == 0, "Conseq gc failed"

            # Build and run main conseq command
            conseq_run_cmd = self.build_conseq_run_command(config)
            result = self.subprocess_run(conseq_run_cmd, cwd=str(config.working_dir))
            run_exit_status = result.returncode

            # Handle post-run tasks (export, reports, etc.)
            self.handle_post_run_tasks(config)

        log.info("Pipeline run complete")
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
        self.subprocess_run(
            "conseq report html", check=True, cwd=str(config.working_dir)
        )
        if self.dryrun:
            log.info("[dryrun] skipping track_dataset_usage")
        else:
            self.track_dataset_usage_from_conseq(config.working_dir)

        if config.export_path:
            assert config.conseq_file is not None

            self.subprocess_run(
                f"conseq export {config.conseq_file} {config.export_path}",
                check=True,
                cwd=str(config.working_dir),
            )


def main():
    pipeline_config = load_pipeline_config()
    parser = create_argument_parser(pipeline_config.defaults)
    args = parser.parse_args()
    runner = PipelineRunner(dryrun=args.dryrun, script_path=Path(__file__))
    runner.run(args)


if __name__ == "__main__":
    main()
