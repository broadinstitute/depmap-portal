import argparse
import os
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from base_pipeline_runner import PipelineRunner


class DataPrepPipelineRunner(PipelineRunner):
    def create_argument_parser(self):
        defaults = self.config_data["defaults"]

        parser = argparse.ArgumentParser(description="Run data prep pipeline")

        # Add common arguments
        self.add_common_arguments(parser)

        # Add data-prep-specific arguments
        parser.add_argument(
            "--external",
            action="store_true",
            help="Run external pipeline (default is internal)",
        )
        return parser

    def get_pipeline_config(self, args):
        # Build common config
        config = self.build_common_config(args, "data_prep")
        # Add data-prep-specific config
        config["is_external"] = args.external

        return config

    def get_conseq_file(self, config):
        """Get conseq file for data prep pipeline."""
        conseq_files = self.config_data["pipelines"]["data_prep"]["conseq_files"]

        if config["is_external"]:
            return conseq_files["external"]
        else:
            return conseq_files["internal"]

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
        self.track_dataset_usage_from_conseq("pipeline/data-prep-pipeline")


if __name__ == "__main__":
    runner = DataPrepPipelineRunner()
    runner.run(Path(__file__))
