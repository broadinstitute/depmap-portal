import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from base_pipeline_runner import PipelineRunner
from pipeline_config import CommonConfig


class DataPrepPipelineRunner(PipelineRunner):
    def get_pipeline_config(self, args: argparse.Namespace) -> CommonConfig:
        return self.build_common_config(args, self.config.pipelines.data_prep)


if __name__ == "__main__":
    from base_pipeline_runner import create_argument_parser, load_pipeline_config

    pipeline_config = load_pipeline_config()
    parser = create_argument_parser(pipeline_config.defaults)
    args = parser.parse_args()
    runner = DataPrepPipelineRunner(dryrun=args.dryrun, script_path=Path(__file__))
    runner.run(args)
