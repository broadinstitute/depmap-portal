from taigapy import TaigaClient
from google.cloud import storage

import pandas as pd
from rdkit import Chem
from rdkit.Chem import Draw

# from rdkit import RDLogger

from tqdm import tqdm
import tempfile
import argparse
import click

# RDLogger.DisableLog('rdApp.*') # To suppress parse error messages

# Global variables
BUCKET_NAME = "depmap-compound-images"
BAD_SMILES_FILE = "bad_smiles.txt"

storage_client = storage.Client()
bucket = storage_client.get_bucket(BUCKET_NAME)


def setup_bad_smiles_file():
    """
        Create a file to store bad smiles
    """
    with open(BAD_SMILES_FILE, "w") as f:
        f.write("BAD SMILES\n\n")


def get_compound_data(taiga_id: str) -> pd.DataFrame:
    """Fetch compound data from Taiga

    Args:
        taiga_id (str): Taiga ID for the compound data

    Returns:
        DataFrame: A dataframe containing the compound data
    """
    tc = TaigaClient()
    return tc.get(taiga_id)


def smile_exists(blob_name: str) -> bool:
    """Check if a smile image exists in the bucket

    Args:
        blob_name (str): The name of the blob

    Returns:
        bool: True if the blob exists, False otherwise
    """

    blob = bucket.blob(blob_name)

    return blob.exists()


def parse_smiles(smiles: str) -> list[str]:
    """Parse one or multiple smile strings separated by , or ;

    Args:
        smiles (str): A string of one or multiple smiles separated by , or ; (e.g. "CC, CO;CCO"

    Returns:
        list: A list of parsed smiles
    """
    smiles_list = []
    # There are cases such as "CC, CO;CCO" where both , and ; exists
    # Replace ';' with ', ' if both separators are present
    if ";" in smiles:
        smiles = smiles.replace(";", ", ")

    for smile in smiles.split(", "):
        if smile.strip():
            smiles_list.append(smile)

    return smiles_list


def is_valid_smile(smile: str) -> bool:
    """Check if a smile string is valid

    Args:
        smile (str): A smile string

    Returns:
        bool: True if the smile is valid, False otherwise
    """
    mol = Chem.MolFromSmiles(smile)

    if mol is None:
        return False

    return True


def generate_and_upload_svg(smile: str) -> None:
    """Generate and upload an svg image to Google Cloud Storage

    Args:
        smile (str): A smile string

    Returns:
        None
    """

    mol = Chem.MolFromSmiles(smile)
    svg_data = Draw._moltoSVG(
        mol, sz=(200, 200), kekulize=True, legend=None, highlights=None
    )

    # Create a temporary file
    with tempfile.NamedTemporaryFile(mode="w", suffix=".svg", delete=True) as temp_file:
        temp_filename = temp_file.name
        temp_file.write(svg_data)

        # Upload the temporary file with the SMILES name
        try:
            blob = bucket.blob(f"{smile}.svg")
            blob.upload_from_filename(temp_filename)
            print(f"Successfully uploaded '{smile}.svg' to bucket '{BUCKET_NAME}'")
        except Exception as e:
            raise Exception(
                f"Failed to upload '{smile}.svg' to bucket '{BUCKET_NAME}'"
            ) from e


@click.command()
@click.option(
    "--taiga_id",
    type=str,
    default="compound-metadata-de37.17/compound_metadata_expanded",
    help="Taiga ID for the compound metadata",
)
def main(taiga_id):
    setup_bad_smiles_file()
    df = get_compound_data(taiga_id)
    assert df is not None and len(df) > 0, "Downloaded data frame is empty!"

    smiles_list = df["SMILES"][:]
    bad_smiles = (
        set()
    )  # This is helpful to see what smiles are bad. However, this can be commented out.
    new_upload_count = 0  # Keeps a count of how many new smiles were uploaded to the bucket in this run

    for smiles in tqdm(smiles_list):
        if smiles is None:
            continue
        for smile in parse_smiles(smiles):
            if is_valid_smile(smile):
                valid_smile = smile
                if smile_exists(f"{valid_smile}.svg"):
                    print(
                        f"Skipping! Smile '{valid_smile}' already exists in bucket '{BUCKET_NAME}'"
                    )
                    continue
                generate_and_upload_svg(valid_smile)
                new_upload_count += 1
            else:
                bad_smiles.add(smile)
                print(f"Skipping! Invalid smile '{smile}'")
                with open("bad_smiles.txt", "a") as f:
                    f.write(f"{smile}\n\n")

    print(
        f"Successfully uploaded {new_upload_count} new smiles to bucket '{BUCKET_NAME}'"
    )


if __name__ == "__main__":
    main()
    # argparser = argparse.ArgumentParser()
    # argparser.add_argument('--taiga_id',
    #                        type=str,
    #                        default='compound-metadata-de37.17/compound_metadata_expanded',
    #                        dest='taiga_id',
    #                        help='Taiga ID for the compound metadata'
    #                        )
    # argparser.set_defaults(func=main)
    # args = argparser.parse_args()
    # args.func(args)


# "compound-metadata-de37.17/compound_metadata_expanded"
