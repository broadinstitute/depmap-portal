from pathlib import Path
from analysis_pipeline_runner import AnalysisPipelineRunner


def main():
    """Main entry point for analysis pipeline runner."""
    runner = AnalysisPipelineRunner()
    runner.run(Path(__file__))


if __name__ == "__main__":
    main()
