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

    def make_functional_with_biomarker_pairs():
        for mat_a in inputs["a_set"]:
            for mat_b in inputs["b_set"]:
                yield mat_a, mat_b

    def make_functional_self_pairs():
        for mat_a in inputs["a_set"]:
            yield mat_a, mat_a

    def make_drug_vs_genetic():
        by_given_id = {artifact["given_id"]: artifact for artifact in inputs["a_set"]}
        for drug_given_id in [
            "PRISMOncologyReferenceLog2AUCMatrix",
            "PRISMOncologyReferenceSeqLog2AUCMatrix",
            "Prism_oncology_viability",
            "REPURPOSING_log2AUC_collapsed",
            "CTRP_log2AUC_collapsed",
            "GDSC1_log2AUC_collapsed",
            "GDSC2_log2AUC_collapsed",
        ]:
            for genetic_perturbation_given_id in ["Chronos_Combined", "RNAi_merged"]:
                yield by_given_id[drug_given_id], by_given_id[
                    genetic_perturbation_given_id
                ]
                yield by_given_id[genetic_perturbation_given_id], by_given_id[
                    drug_given_id
                ]

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
        hasher.update("v6".encode("utf-8"))
        artifact["job_name"] = f"cor-pair-{hasher.hexdigest()[:10]}"

        return artifact

    pairs = (
        list(make_functional_with_biomarker_pairs())
        + list(make_functional_self_pairs())
        + list(make_drug_vs_genetic())
    )

    artifacts = [make_artifact(*pair) for pair in pairs]

    with open(args.out_filename, "wt") as fd:
        json.dump({"outputs": artifacts}, fd, indent=2)


if __name__ == "__main__":
    main()
