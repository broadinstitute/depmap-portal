from pathlib import Path
from preprocessing_pipeline_runner import PreprocessingPipelineRunner


def main():
    """Main entry point for preprocessing pipeline runner."""
    runner = PreprocessingPipelineRunner()
    runner.run(Path(__file__))


if __name__ == "__main__":
    main()
