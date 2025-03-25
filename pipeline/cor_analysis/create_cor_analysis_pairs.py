# used to enumerate pairs of

import argparse
import json
import hashlib


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("in_filename")
    parser.add_argument("out_filename")
    args = parser.parse_args()

    with open(args.in_filename, "rt") as fd:
        inputs = json.load(fd)
        print("warning: ignoring input: ", inputs)
        # todo change this so we take the taiga IDs from inputs

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

        # compute job name based on the inputs so that we can use it as a cache key
        hasher = hashlib.sha256(json.dumps(artifact, sort_keys=True).encode("utf-8"))
        hasher.update("v4".encode("utf-8"))
        artifact["job_name"] = f"cor-pair-{hasher.hexdigest()[:10]}"

        return artifact

    pairs = [make_artifact(*pair) for pair in make_pairs()]

    with open(args.out_filename, "wt") as fd:
        json.dump({"outputs": pairs}, fd)


if __name__ == "__main__":
    main()
