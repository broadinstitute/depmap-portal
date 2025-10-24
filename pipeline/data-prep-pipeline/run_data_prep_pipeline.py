from pathlib import Path
from data_prep_pipeline_runner import DataPrepPipelineRunner


def main():
    """Main entry point for data prep pipeline runner."""
    runner = DataPrepPipelineRunner()
    runner.run(Path(__file__))


if __name__ == "__main__":
    main()
