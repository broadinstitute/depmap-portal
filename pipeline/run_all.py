import subprocess
import sys


def run(cmd):
    print(f"Executing {' '.join(cmd)}")
    subprocess.run(cmd, check=True)


# run the two pipelines passing all args to them
run([sys.executable, "data-prep-pipeline/data_prep_pipeline_runner.py", sys.argv[1:]])
run(
    [
        sys.executable,
        "preprocessing-pipeline/preprocessing_pipeline_runner.py",
        sys.argv[1:],
    ]
)
