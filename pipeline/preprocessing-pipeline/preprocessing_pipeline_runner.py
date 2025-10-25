import argparse
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

# Add parent directory to path to import base class
sys.path.insert(0, str(Path(__file__).parent.parent))
from base_pipeline_runner import PipelineRunner


class PreprocessingPipelineRunner(PipelineRunner):
    """Pipeline runner for preprocessing pipeline."""

    def map_environment_name(self, env_name):
        """Map environment names to actual conseq file names."""
        env_mapping = self.config_data["pipelines"]["preprocessing"]["env_mapping"]

        # Handle test- prefix
        if env_name.startswith("test-"):
            return env_mapping["test-prefix"]

        mapped_name = env_mapping.get(env_name, env_name)
        assert mapped_name, "Mapped environment name cannot be empty"
        return mapped_name

    def create_argument_parser(self):
        """Create argument parser for preprocessing pipeline."""
        defaults = self.config_data["defaults"]

        parser = argparse.ArgumentParser(
            description="Run preprocessing pipeline (Jenkins style)"
        )
        parser.add_argument("env_name", help="Name of environment")
        parser.add_argument("job_name", help="Name to use for job")
        parser.add_argument(
            "--publish-dest", help="S3/GCS path override for publishing"
        )
        parser.add_argument("--export-path", help="Export path for conseq export")
        parser.add_argument(
            "--manually-run-conseq",
            action="store_true",
            help="If set args will be passed directly to conseq",
        )
        parser.add_argument(
            "--taiga-dir", default=defaults["taiga_dir"], help="Taiga directory path",
        )
        parser.add_argument(
            "--creds-dir",
            default=defaults["creds_dir"],
            help="Pipeline runner credentials directory",
        )
        parser.add_argument(
            "--image", help="If set, use this docker image when running the pipeline",
        )
        parser.add_argument(
            "--start-with", help="Start with existing export from GCS path"
        )
        parser.add_argument(
            "conseq_args", nargs="*", help="parameters to pass to conseq"
        )
        return parser

    def get_pipeline_config(self, args):
        """Get configuration for preprocessing pipeline."""
        pipeline_cfg = self.config_data["pipelines"]["preprocessing"]

        config = {
            "env_name": args.env_name,
            "job_name": args.job_name,
            "conseq_args": args.conseq_args,
            "taiga_dir": args.taiga_dir,
            "creds_dir": args.creds_dir,
            "manually_run_conseq": args.manually_run_conseq,
            "start_with": args.start_with,
            "publish_dest": args.publish_dest,
            "export_path": args.export_path,
            "image": args.image,
            "state_path": pipeline_cfg["state_path"],
            "log_destination": pipeline_cfg["log_destination"],
            "working_dir": pipeline_cfg["working_dir"],
        }

        # Check credentials
        self.check_credentials(config["creds_dir"])
        return config

    def create_override_conseq_file(self, env_name, publish_dest):
        """Create an overridden conseq file with custom publish_dest."""
        mapped_env = self.map_environment_name(env_name)
        original_conseq = f"run_{mapped_env}.conseq"
        override_conseq = f"overriden-{original_conseq}"

        # Write new publish_dest line
        with open(f"pipeline/preprocessing-pipeline/{override_conseq}", "w") as f:
            f.write(f'let publish_dest = "{publish_dest}"\n')

        # Append original file content except for publish_dest lines
        with open(
            f"pipeline/preprocessing-pipeline/{original_conseq}", "r"
        ) as original:
            with open(
                f"pipeline/preprocessing-pipeline/{override_conseq}", "a"
            ) as override:
                for line in original:
                    if not line.strip().startswith("let publish_dest"):
                        override.write(line)

        return override_conseq

    def get_conseq_file(self, config):
        if config["publish_dest"]:
            conseq_file = self.create_override_conseq_file(
                config["env_name"], config["publish_dest"]
            )
            print(f"Created override conseq file: {conseq_file}")
            return conseq_file
        else:
            mapped_env = self.map_environment_name(config["env_name"])
            print("No S3 path override specified")
            return f"run_{mapped_env}.conseq"

    def run_via_container(self, command, config):
        """Run command inside Docker container with preprocessing specific configuration."""
        cwd = os.getcwd()
        docker_cfg = self.config_data["docker"]
        volumes = docker_cfg["volumes"]
        env_vars = docker_cfg["env_vars"]
        cred_files = self.config_data["credentials"]["required_files"]

        docker_cmd = [
            "docker",
            "run",
            "--security-opt",
            docker_cfg["options"]["preprocessing"]["security_opt"],
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
        print("=" * 50)
        print("Preprocessing Pipeline Runner command:", docker_cmd)
        print("=" * 50)
        return subprocess.run(docker_cmd)

    def track_dataset_usage_from_conseq(self):
        """Track dataset usage from DO-NOT-EDIT-ME files and log to usage tracker."""
        pipeline_dir = Path("pipeline/preprocessing-pipeline")
        version_files = list(pipeline_dir.glob("*-DO-NOT-EDIT-ME"))

        for version_file in version_files:
            with open(version_file, "r") as f:
                content = f.read()

                release_pattern = (
                    r'"type":\s*"release_taiga_id"[^}]*"dataset_id":\s*"([^"]+)"'
                )
                match = re.search(release_pattern, content, re.DOTALL)

                if match:
                    release_taiga_id = match.group(1)
                    assert release_taiga_id, "Release taiga ID is empty"
                    self.log_dataset_usage(release_taiga_id)
                    break

    def handle_special_features(self, config):
        """Handle START_WITH functionality for preprocessing pipeline."""
        if config["start_with"]:
            print(f"Starting with existing export: {config['start_with']}")
            subprocess.run(
                ["sudo", "chown", "-R", "ubuntu", "pipeline/preprocessing-pipeline"],
                check=True,
            )
            subprocess.run(
                ["rm", "-rf", "pipeline/preprocessing-pipeline/state"], check=True
            )

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
                        f"{config['creds_dir']}/depmap-pipeline-runner.json",
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
                        config["start_with"],
                        "pipeline/preprocessing-pipeline/downloaded-export.conseq",
                    ],
                    check=True,
                    env=env_with_temp_home,
                )

            self.run_via_container("conseq run downloaded-export.conseq", config)
            self.run_via_container("conseq forget --regex 'publish.*'", config)

    def handle_post_run_tasks(self, config):
        """Handle export and report generation for preprocessing pipeline."""
        if config["export_path"]:
            self.run_via_container(
                f"conseq export {config['conseq_file']} {config['export_path']}", config
            )
        self.run_via_container("conseq report html", config)
        self.track_dataset_usage_from_conseq()


if __name__ == "__main__":
    runner = PreprocessingPipelineRunner()
    runner.run(Path(__file__))
