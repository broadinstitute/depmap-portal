import pandas as pd

genes = [
    "SWI5 (375757)",
    "TRIL (9865)",
    "TENC1 (23371)",
    "UNC93B1 (81622)",
    "PSG7 (5676)",
    "KDM7A (80853)",
    "F8A1 (8263)",
    "MIR3613 (100500908)",
    "ANOS1 (3730)",
    "HNF1B (6928)",
    "SOX10 (6663)",  # representative full-feature example. this should have all data types
    "AMY1A (276)",
    "NRAS (4893)",
    "MAP4K4 (9448)",
    "MED1 (5469)",
    "C1orf74 (148304)",
]


def main():
    results = pd.read_csv("sample_data.csv")
    contexts = [
        "Ewings_sarcoma",
        "bone",
        "osteosarcoma",
        "lung",
        "lung_adenocarcinoma",
        "lung_NSC",
        "lung_squamous",
        "melanoma",
        "skin",
        "colorectal",
        "Merkel",
        "urinary_tract",
        "leukemia",
        "AML",
    ]

    mapper = {
        "Ewing Sarcoma": "Ewings_sarcoma",
        "Bone": "bone",
        "Osteosarcoma": "osteosarcoma",
        "Lung": "lung",
        "Lung Adenocarcinoma": "lung_adenocarcinoma",
        "Lung NSC": "lung_NSC",
        "Lung Squamous": "lung_squamous",
        "Melanoma": "melanoma",
        "Skin": "skin",
        "Colorectal": "colorectal",
        "Merkel": "Merkel",
        "Bladder/Urinary Tract": "urinary_tract",
        "Leukemia": "leukemia",
        "AML": "AML",
    }
    results = results.replace(mapper)
    df = results[results["context_name"].isin(contexts)]
    subsetted_df = df[df["entity_id"].isin(genes) | ~(df["dataset"] == "CRISPR")]
    subsetted_df.to_csv("context_analysis_v2_2.csv", index=False)


if __name__ == "__main__":
    main()
