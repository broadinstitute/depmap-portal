import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from base_pipeline_runner import PipelineRunner


class DataPrepPipelineRunner(PipelineRunner):
    def create_argument_parser(self):
        defaults = self.config_data["defaults"]

        parser = argparse.ArgumentParser(description="Run data prep pipeline")
        parser.add_argument("env_name", help="Name of environment")
        parser.add_argument("job_name", help="Name to use for job")
        parser.add_argument(
            "--external",
            action="store_true",
            help="Run external pipeline (default is internal)",
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
        return parser

    def get_pipeline_config(self, args):
        pipeline_cfg = self.config_data["pipelines"]["data_prep"]

        config = {
            "env_name": args.env_name,
            "job_name": args.job_name,
            "taiga_dir": args.taiga_dir,
            "creds_dir": args.creds_dir,
            "is_external": args.external,
            "image": args.image,
            "state_path": pipeline_cfg["state_path"],
            "log_destination": pipeline_cfg["log_destination"],
            "working_dir": pipeline_cfg["working_dir"],
        }

        self.check_credentials(config["creds_dir"])
        return config

    def get_conseq_file(self, config):
        """Get conseq file for data prep pipeline."""
        conseq_files = self.config_data["pipelines"]["data_prep"]["conseq_files"]

        if config["is_external"]:
            return conseq_files["external"]
        else:
            return conseq_files["internal"]

    def track_dataset_usage(self):
        """Track dataset usage from DO-NOT-EDIT-ME files and log to usage tracker."""
        pipeline_dir = Path("pipeline/data-prep-pipeline")
        version_files = list(pipeline_dir.glob("*-DO-NOT-EDIT-ME"))

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
                    break
                else:
                    raise ValueError(
                        f"Release taiga ID not found in {version_file}. Please check the file and try again."
                    )

    def handle_special_features(self, config):
        """Preprocess templates to generate DO-NOT-EDIT-ME files before run."""
        templates = self.config_data["pipelines"]["data_prep"]["templates"]

        template_key = "external" if config["is_external"] else "internal"
        template = templates[template_key]["input"]
        output = templates[template_key]["output"]

        self.run_via_container(
            f"python ../preprocess_taiga_ids.py {template} {output}", config
        )

    def handle_post_run_tasks(self, config):
        """After conseq finishes, log dataset usage."""
        self.track_dataset_usage()


if __name__ == "__main__":
    runner = DataPrepPipelineRunner()
    runner.run(Path(__file__))
