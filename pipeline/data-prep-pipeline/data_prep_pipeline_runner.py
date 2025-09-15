import argparse
import os
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from base_pipeline_runner import PipelineRunner


class DataPrepPipelineRunner(PipelineRunner):
    def create_argument_parser(self):
        parser = argparse.ArgumentParser(description="Run data prep pipeline")
        parser.add_argument("env_name", help="Name of environment")
        parser.add_argument("job_name", help="Name to use for job")
        parser.add_argument(
            "--external",
            action="store_true",
            help="Run external pipeline (default is internal)",
        )
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
        parser.add_argument(
            "--start-with", help="Start with existing export from GCS path"
        )
        parser.add_argument(
            "conseq_args", nargs="*", help="parameters to pass to conseq"
        )
        return parser

    def get_pipeline_config(self, args):
        config = {
            "env_name": args.env_name,
            "job_name": args.job_name,
            "conseq_args": args.conseq_args,
            "taiga_dir": args.taiga_dir,
            "creds_dir": args.creds_dir,
            "manually_run_conseq": args.manually_run_conseq,
            "start_with": args.start_with,
            "is_external": args.external,
            "image": args.image,
            "state_path": "pipeline/data-prep-pipeline/state",
            "log_destination": "data-prep-logs",
            "working_dir": "/work/pipeline/data-prep-pipeline",
        }

        self.check_credentials(config["creds_dir"])
        return config

    def get_conseq_file(self, config):
        """Get conseq file for data prep pipeline."""
        if config["is_external"]:
            return "data_prep_pipeline/run_external_data_prep.conseq"
        else:
            return "data_prep_pipeline/run_internal_data_prep.conseq"

    def run_via_container(self, command, config):
        """Run command inside Docker container with data prep specific configuration."""
        cwd = os.getcwd()

        docker_cmd = [
            "docker",
            "run",
            "--rm",
            "-v",
            f"{cwd}:/work",
            "-v",
            f"{config['creds_dir']}/broad-paquitas:/aws-keys/broad-paquitas",
            "-v",
            f"{config['creds_dir']}/sparkles:/root/.sparkles-cache",
            "-v",
            f"{config['creds_dir']}/depmap-pipeline-runner.json:/etc/google_default_creds.json",
            "-v",
            f"{config['taiga_dir']}:/root/.taiga",
            "-e",
            "GOOGLE_APPLICATION_CREDENTIALS=/etc/google_default_creds.json",
            "-w",
            config["working_dir"],
            "--name",
            config["job_name"],
            config["docker_image"],
            "bash",
            "-c",
            f"source /aws-keys/broad-paquitas && {command}",
        ]
        print("command", command)
        return subprocess.run(docker_cmd)

    def handle_special_features(self, config):
        """Handle START_WITH functionality for data prep pipeline."""
        if config["start_with"]:
            print(f"Starting with existing export: {config['start_with']}")
            # Clean out old invocation
            subprocess.run(
                ["sudo", "chown", "-R", "ubuntu", "data-prep-pipeline"], check=True
            )
            subprocess.run(["rm", "-rf", "data-prep-pipeline/state"], check=True)

            # Download the export
            subprocess.run(
                [
                    "bash",
                    "-c",
                    f"source {config['creds_dir']}/broad-paquitas && gsutil cp {config['start_with']} data-prep-pipeline/data_prep_pipeline/downloaded-export.conseq",
                ],
                check=True,
            )

            # Run the downloaded export
            self.run_via_container("conseq run downloaded-export.conseq", config)

            # Forget publish rules
            self.run_via_container("conseq forget --regex publish.*", config)
