import argparse
import sys
from pathlib import Path
from typing import Any

# Add parent directory to path to import base class
sys.path.insert(0, str(Path(__file__).parent.parent))
from base_pipeline_runner import PipelineRunner


class PreprocessingPipelineRunner(PipelineRunner):
    """Pipeline runner for preprocessing pipeline."""

    def create_argument_parser(self) -> argparse.ArgumentParser:
        """Create argument parser for preprocessing pipeline."""
        parser = argparse.ArgumentParser(
            description="Run preprocessing pipeline (Jenkins style)"
        )
        self.add_common_arguments(parser)
        parser.add_argument("--export-path", help="Export path for conseq export")
        return parser

    def get_pipeline_config(self, args: argparse.Namespace) -> dict[str, Any]:
        """Get configuration for preprocessing pipeline."""
        config = self.build_common_config(args, self.config.pipelines.preprocessing)
        config["export_path"] = args.export_path
        return config

    def get_conseq_file(self, config: dict[str, Any]) -> str:
        assert self.script_path is not None
        env_mapping = self.config.pipelines.preprocessing.env_mapping
        mapped_env = self.map_environment_name(config["env_name"], env_mapping)
        original_conseq = f"run_{mapped_env}.conseq"
        pipeline_dir = str(self.script_path.parent)
        if config.get("publish_dest"):
            conseq_file = self.create_override_conseq_file(
                pipeline_dir, original_conseq, config["publish_dest"]
            )
            print(f"Created override conseq file: {conseq_file}")
            return conseq_file
        return original_conseq

    def handle_special_features(self, config: dict[str, Any]) -> None:
        """Forget previous publish artifacts if publish_dest changed, then handle start_with."""
        if config.get("publish_dest"):
            print(
                f"Forgetting previous publish executions (publish_dest changed to: {config['publish_dest']})"
            )
            self.run_via_container("conseq forget --regex 'publish.*'", config)
        super().handle_special_features(config)

    def handle_post_run_tasks(self, config: dict[str, Any]) -> None:
        """Run conseq export if requested, then standard post-run tasks."""
        if config.get("export_path"):
            self.run_via_container(
                f"conseq export {config['conseq_file']} {config['export_path']}", config
            )
        super().handle_post_run_tasks(config)


if __name__ == "__main__":
    runner = PreprocessingPipelineRunner()
    runner.run(Path(__file__))
