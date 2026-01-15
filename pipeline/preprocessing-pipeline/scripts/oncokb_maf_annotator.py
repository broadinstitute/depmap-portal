import requests
import json
import csv
import time
import argparse
import datetime
import logging
import pandas as pd

from taigapy import create_taiga_client_v3

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("oncokb_maf_annotator")


ONCOKB_API_URL = "https://www.oncokb.org/api"
MUTATION_ANNOTATION_URL = (
    "https://www.oncokb.org/api/v1/annotate/mutations/byProteinChange"
)
REFERENCE_GENOME = "GRCh38"
ONCOKB_ANNOTATED_DATASET_FILENAME = "oncokb_annotated.csv"
ONCOKB_VERSION_FILENAME = "oncokb_dataset_version.csv"
REQUEST_TIMEOUT = 120

# TODO: At some point we want to switch over to new Taiga Client V3
tc = create_taiga_client_v3()


def validate_oncokb_token(oncokb_api_bearer_token):
    """
    Validates the oncokb token and prints the expiration date
    :params
        oncokb_api_bearer_token: A string containing the oncokb token
    :return: Nothing
    """

    if oncokb_api_bearer_token is None or not oncokb_api_bearer_token:
        log.error("Please specify your OncoKB token")
        exit()

    response = requests.get(
        ONCOKB_API_URL + "/tokens/" + oncokb_api_bearer_token, timeout=REQUEST_TIMEOUT
    )
    if response.status_code == 200:
        token = response.json()
        time_stamp = datetime.datetime.strptime(
            token["expiration"], "%Y-%m-%dT%H:%M:%SZ"
        )
        days_from_expiration = time_stamp - datetime.datetime.now()
        if days_from_expiration.days < 0:
            log.error(
                "OncoKB API token already expired. Go here:https://www.oncokb.org/account/register to request a new token."
            )
            exit()
        elif days_from_expiration.days < 10:
            log.warning(
                f"OncoKB API token will expire in {days_from_expiration} days, please be on the lookout for an OncoKB email to renew your token. Expire on "
                + str(time_stamp)
                + " UTC"
            )
        else:
            log.info(
                "Your OncoKB API token is valid and will expire on "
                + str(time_stamp)
                + " UTC"
            )
    else:
        try:
            response_json = response.json()
            reason = response_json["title"]
            if response_json["detail"]:
                reason = response_json["detail"]
        except Exception:
            reason = response.reason

        log.error("Error when validating token, " + "reason: %s" % reason)
        exit()


def get_dataset_version():
    """
    Returns the latest version of the dataset
    """
    response = requests.get(ONCOKB_API_URL + "/v1/info", timeout=REQUEST_TIMEOUT)
    if response.status_code == 200:
        api_info = response.json()
        dataset_version = api_info["dataVersion"]
        df = pd.DataFrame([dataset_version])
        return df


def dataset_preprocessing(taiga_id):
    df = tc.get(taiga_id)
    df = df[["ProteinChange", "EntrezGeneID"]]

    # Remove rows with non-float and empty string values in 'EntrezGeneID' column
    df["EntrezGeneID"] = pd.to_numeric(df["EntrezGeneID"], errors="coerce")
    df = df[~df["EntrezGeneID"].isnull()]
    df["EntrezGeneID"] = df["EntrezGeneID"].astype(int)

    # Requesting data from OncoKB's Protein change URL where these 2 columns are enough for oncogenic,
    # and mutationeffect annotations
    df["ProteinChange"] = df["ProteinChange"].str.replace("p.", "", regex=True)

    # OncoKB API expects the ProteinChange or Hgvsp_Short to not have p. e.g. L261V instead of p.L261V
    df = df.drop_duplicates()
    df = df.dropna()
    return df


def upload_dataset():
    """
    Uploads oncokb annotated dataset and the version of the dataset to taiga
    :return: Nothing
    """
    oncokb_version_taiga_id = tc.update_dataset(
        "oncokb-dataset-version-ce69",
        changes_description="Update the oncokb version number and the date of the release",
        upload_files=[
            {
                "path": f"{ONCOKB_VERSION_FILENAME}",
                "format": "TableCSV",  # or "NumericMatrixCSV" or "TableCSV"
                "encoding": "utf-8",  # optional (but recommended), will use iso-8859-1 if not provided
            }
        ],
    )
    assert oncokb_version_taiga_id is not None, f"Upload Failed"

    oncokb_annotated_dataset_taiga_id = tc.update_dataset(
        "oncokb-annotated-mutations-7e2e",
        changes_description="Omics mutations dataset annotated by oncokb",
        upload_files=[
            {
                "path": f"{ONCOKB_ANNOTATED_DATASET_FILENAME}",
                "format": "TableCSV",  # or "NumericMatrixCSV" or "TableCSV"
                "encoding": "utf-8",  # optional (but recommended), will use iso-8859-1 if not provided
            }
        ],
    )
    assert oncokb_annotated_dataset_taiga_id is not None, f"Upload Failed"


def annotate(headers, input_df, slice_size, updatedataset=False):
    """
    Annotates and writes a new csv file with OncoKB Data(Oncogenic and MutationEffect) using their API

    :params
     headers: A dictionary containing information regarding the oncokb token and content-type
     input_df: A pandas dataframe containing 2 columns using which oncokb annotates each row
     slice_size: An int purely for convenience -- shows current progress in console
     updatedataset:[Optional] A bool telling if the final csv file should be uploaded to taiga or not

    :return: Nothing
    """

    print("-----------------STARTING-----------------")
    queries = []
    count = 0
    start_time = time.time()
    with open(f"{ONCOKB_ANNOTATED_DATASET_FILENAME}", "w") as file:
        print(f"Annotating to {ONCOKB_ANNOTATED_DATASET_FILENAME}")
        writer = csv.writer(file)
        writer.writerow(
            ["EntrezGeneID", "ProteinChange", "Oncogenic", "MutationEffect"]
        )
        for entrez_gene_id, protein_change in zip(
            input_df["EntrezGeneID"], input_df["ProteinChange"]
        ):
            queries.append(
                {
                    "gene": {"entrezGeneId": int(entrez_gene_id)},
                    "alteration": protein_change,
                    "referenceGenome": REFERENCE_GENOME,
                }
            )
            if len(queries) == 200:
                response = requests.post(
                    MUTATION_ANNOTATION_URL, headers=headers, data=json.dumps(queries)
                )
                if response.status_code == 200:
                    annotations = response.json()
                    for annotation in annotations:
                        writer.writerow(
                            [
                                annotation["query"]["entrezGeneId"],
                                annotation["query"]["alteration"],
                                annotation["oncogenic"],
                                annotation["mutationEffect"]["knownEffect"],
                            ]
                        )
                    count += 1
                    queries = []
                else:
                    print(f"Error: {response.status_code}")
                print(
                    f"\r{count*200 / slice_size * 100:.2f} %", end="", flush=True,
                )
        response = requests.post(
            MUTATION_ANNOTATION_URL, headers=headers, data=json.dumps(queries)
        )
        annotations = response.json()
        for annotation in annotations:
            writer.writerow(
                [
                    annotation["query"]["entrezGeneId"],
                    annotation["query"]["alteration"],
                    annotation["oncogenic"],
                    annotation["mutationEffect"]["knownEffect"],
                ]
            )
    end_time = time.time()
    print("\n-----------------FINISHED-----------------")
    print(f"Done in: {end_time - start_time}s")
    if updatedataset:
        upload_dataset()
        print("--------------UPLOADED TO TAIGA--------------")


def main(argv):
    oncokb_token = argv.oncokb_token
    validate_oncokb_token(oncokb_token)
    df = dataset_preprocessing(argv.taiga_id)

    slice_size = len(df)
    df_slice = df[:slice_size]
    df_slice = df_slice.reset_index(drop=True)

    headers = {
        "Content-Type": "application/json",
        "Authorization": "Bearer %s" % oncokb_token,
    }
    dataset_version_df = get_dataset_version()
    dataset_version_df.to_csv(ONCOKB_VERSION_FILENAME, index=False)
    annotate(headers, df_slice, slice_size, argv.updatedataset)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("-t", "--t", dest="oncokb_token", required=True)
    parser.add_argument("-id", "--id", dest="taiga_id", type=str, required=True)
    parser.add_argument(
        "-u", "--u", dest="updatedataset", nargs="?", const="arg_not_found"
    )
    parser.set_defaults(func=main)
    args = parser.parse_args()
    args.func(args)
