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


if __name__ == "__main__":
    from base_pipeline_runner import create_argument_parser, load_pipeline_config

    pipeline_config = load_pipeline_config()
    parser = create_argument_parser(pipeline_config.defaults)
    args = parser.parse_args()
    runner = PreprocessingPipelineRunner(dryrun=args.dryrun)
    runner.run(Path(__file__), args)
