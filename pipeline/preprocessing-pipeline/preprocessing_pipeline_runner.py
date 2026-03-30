import argparse
import sys
from pathlib import Path
from typing import Any

# Add parent directory to path to import base class
sys.path.insert(0, str(Path(__file__).parent.parent))
from base_pipeline_runner import PipelineRunner


class PreprocessingPipelineRunner(PipelineRunner):
    """Pipeline runner for preprocessing pipeline."""

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


if __name__ == "__main__":
    from base_pipeline_runner import create_argument_parser, load_pipeline_config

    pipeline_config = load_pipeline_config()
    parser = create_argument_parser(pipeline_config.defaults)
    args = parser.parse_args()
    runner = PreprocessingPipelineRunner(dryrun=args.dryrun)
    runner.run(Path(__file__), args)
