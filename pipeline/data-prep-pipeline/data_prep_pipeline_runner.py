import argparse
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).parent.parent))
from base_pipeline_runner import PipelineRunner


class DataPrepPipelineRunner(PipelineRunner):
    def get_pipeline_config(self, args: argparse.Namespace) -> dict[str, Any]:
        return self.build_common_config(args, self.config.pipelines.data_prep)

    def get_conseq_file(self, config: dict[str, Any]) -> str:
        assert self.script_path is not None
        env_mapping = self.config.pipelines.data_prep.env_mapping
        mapped_env = self.map_environment_name(config["env_name"], env_mapping)
        original_conseq = f"data_prep_pipeline/run_{mapped_env}.conseq"
        pipeline_dir = str(self.script_path.parent)
        if config.get("publish_dest"):
            conseq_file = self.create_override_conseq_file(
                pipeline_dir, original_conseq, config["publish_dest"]
            )
            print(f"Created override conseq file: {conseq_file}")
            return conseq_file
        return original_conseq


if __name__ == "__main__":
    runner = DataPrepPipelineRunner()
    runner.run(Path(__file__))
