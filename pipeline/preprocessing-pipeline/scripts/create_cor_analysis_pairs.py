# used to enumerate pairs of

import argparse
import json


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("in_filename")
    parser.add_argument("out_filename")
    args = parser.parse_args()

    with open(args.in_filename, "rt") as fd:
        inputs = json.load(fd)
        print("warning: ignoring input: ", inputs)
        # todo change this so we take the taiga IDs from inputs

    pairs = []

    def make_pairs():
        for mat_a in inputs["a_set"]:
            for mat_b in inputs["b_set"]:
                yield mat_a, mat_b

    def make_artifact(a, b):
        artifact = {"type": "cor_input_pair"}

        for prefix, src_artifact in [("a", a), ("b", b)]:
            for name in [
                "given_id",
                "taiga_id",
                "feature_id_format",
                "features_taiga_id",
                "compounds_taiga_id",
            ]:
                if name in src_artifact:
                    artifact[f"{prefix}_{name}"] = src_artifact[name]

        return artifact

    pairs = [make_artifact(*pair) for pair in make_pairs()]

    with open(args.out_filename, "wt") as fd:
        json.dump({"outputs": pairs}, fd)


if __name__ == "__main__":
    main()
