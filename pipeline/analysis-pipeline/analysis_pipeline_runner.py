import argparse
import os
import subprocess
import sys
from pathlib import Path

# Add parent directory to path to import base class
sys.path.insert(0, str(Path(__file__).parent.parent))
from base_pipeline_runner import PipelineRunner


class AnalysisPipelineRunner(PipelineRunner):
    """Pipeline runner for analysis pipeline."""

    def create_argument_parser(self):
        """Create argument parser for analysis pipeline."""
        parser = argparse.ArgumentParser(description="Run analysis pipeline")
        parser.add_argument("--env", help="Name of environment")
        parser.add_argument(
            "--job-name", default="run-pipeline", help="Name to use for job"
        )
        parser.add_argument("--export-path", help="Export path (optional)")
        parser.add_argument(
            "--manually-run-conseq",
            action="store_true",
            help="If set args will be passed directly to conseq",
        )
        parser.add_argument("--taiga-dir", default=f"{os.environ['HOME']}/.taiga")
        parser.add_argument(
            "--sparkles-cache", default=f"{os.environ['HOME']}/.sparkles-cache"
        )
        parser.add_argument(
            "--image", help="If set, use this docker image when running the pipeline",
        )
        parser.add_argument("--publish-dest", required=True, help="Publish destination")
        parser.add_argument(
            "conseq_args", nargs="*", help="parameters to pass to conseq"
        )
        return parser

    def get_pipeline_config(self, args):
        """Get configuration for analysis pipeline."""
        gcp_creds_file = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        if not gcp_creds_file:
            raise ValueError(
                "environment variable GOOGLE_APPLICATION_CREDENTIALS must be set"
            )

        config = {
            "env_name": args.env,
            "job_name": args.job_name,
            "conseq_args": args.conseq_args,
            "taiga_dir": args.taiga_dir,
            "sparkles_cache": args.sparkles_cache,
            "manually_run_conseq": args.manually_run_conseq,
            "publish_dest": args.publish_dest,
            "export_path": args.export_path,
            "gcp_creds_file": gcp_creds_file,
            "image": args.image,
            "state_path": "pipeline/analysis-pipeline/state",
            "log_destination": "predictability-logs",
            "s3_staging_url": "gs://preprocessing-pipeline-outputs/conseq/depmap",
        }
        return config

    def get_conseq_file(self, config):
        return f"run_{config['env_name']}_analysis.conseq"

    def run_via_container(self, command, config):
        """Run command inside Docker container with analysis specific configuration."""
        cwd = os.getcwd()
        work_root = os.path.abspath(os.path.join(cwd, "../.."))
        rel_cwd = os.path.relpath(cwd, work_root)

        docker_cmd = [
            "docker",
            "run",
            "--rm",
            "-v",
            f"{work_root}:/work",
            "-w",
            os.path.join("/work", rel_cwd),
            "-v",
            f"{config['sparkles_cache']}:/root/.sparkles-cache",
            "-v",
            f"{config['taiga_dir']}:/root/.taiga",
            "-v",
            f"{config['gcp_creds_file']}:/etc/google/auth/application_default_credentials.json",
            "-e",
            "GOOGLE_APPLICATION_CREDENTIALS=/etc/google/auth/application_default_credentials.json",
            "-e",
            f"HOST_WORKSPACE_PATH={cwd}",
            "-v",
            "/var/run/docker.sock:/var/run/docker.sock",
            "--name",
            config["job_name"],
            config["docker_image"],
            "bash",
            "-c",
            command,
        ]
        print("command", command)
        return subprocess.run(docker_cmd)

    def track_dataset_usage_from_templates(self, config):
        """Track dataset usage from template files for analysis pipeline."""
        # Get the release taiga ID from config
        release_taiga_id = config.get(
            "release_taiga_id", f'analysis-pipeline-{config["env_name"]}'
        )

        # Look for DO-NOT-EDIT-ME files that contain dataset IDs
        pipeline_dir = Path("pipeline/analysis-pipeline")
        version_files = list(pipeline_dir.glob("*-DO-NOT-EDIT-ME"))

        for version_file in version_files:
            try:
                with open(version_file, "r") as f:
                    content = f.read()
                    # Extract dataset IDs from version file
                    import re

                    # "dataset_id": "some-taiga-id.version/name"
                    dataset_pattern = r'"dataset_id":\s*"([^"]+)"'
                    dataset_ids = re.findall(dataset_pattern, content)

                    # Log each unique dataset usage
                    for dataset_id in set(dataset_ids):
                        if "/" in dataset_id and "." in dataset_id:
                            # Basic validation - should look like taiga ID
                            if len(dataset_id.split("/")[0]) > 5:
                                self.log_dataset_usage(dataset_id, release_taiga_id)
                                print(f"Tracked dataset usage: {dataset_id}")

            except Exception as e:
                print(
                    f"Warning: Could not track dataset usage from {version_file}: {e}"
                )

    def handle_special_features(self, config):
        """Handle any special features for analysis pipeline."""
        # Track dataset usage from template files
        self.track_dataset_usage_from_templates(config)

        # Analysis pipeline doesn't have other special features like START_WITH
        pass
