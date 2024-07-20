import argparse
from taigapy import TaigaClient

tc = TaigaClient()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("treatment_taiga_id")
    parser.add_argument("output_filename")
    args = parser.parse_args()

    # 11502 rows
    Repurposing_23Q2_Treatment_Meta_Data = tc.get(args.treatment_taiga_id)
    # 766 dmso rows, 11502-766 = 10736 non dmso
    no_dmso = Repurposing_23Q2_Treatment_Meta_Data[
        ~(Repurposing_23Q2_Treatment_Meta_Data["broad_id"] == "DMSO")
    ]
    # 386 None rows, 11502-386 = 11116 non-None rows; 10736-386 = 10350 non-None and non-DMSO rows
    no_null_broad_ids = no_dmso[~(no_dmso["broad_id"].isnull())]
    # Drop duplicates of compound-dose pairs; 1600 rows
    no_dups = no_null_broad_ids.drop_duplicates(subset=["broad_id", "dose"])
    # Keep compound and dose columns
    cpd_dose_df = no_dups[["broad_id", "dose"]]

    cpd_dose_df = cpd_dose_df.rename(columns={"broad_id": "BroadID", "dose": "Dose"})
    cpd_dose_df.to_csv(args.output_filename, index=False)


if __name__ == "__main__":
    main()
