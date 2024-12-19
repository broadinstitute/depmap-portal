import pandas as pd
import numpy as np
from termcolor import colored
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from datetime import datetime

from upload_to_taiga import update_taiga

##################################################
### Get the data dictionary from Google Sheets ###
##################################################

SERVICE_ACCOUNT_CREDENTIALS = "depmap-gumbo-pull-sa.json"
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

# Load the credentials from the service account key file and build the service
credentials = Credentials.from_service_account_file(
    SERVICE_ACCOUNT_CREDENTIALS, scopes=SCOPES
)
service = build("sheets", "v4", credentials=credentials)

# Spreadsheet ID and range
SPREADSHEET_ID = "1nFDxMh08XFLdCBNLyydVlG4WqGC0Kf4XNrYbv80Tme0"
RANGE_NAME = "Gumbo/Release Dictionary!A1:Z500"

# Call the Sheets API and fetch the data
sheet = service.spreadsheets()
result = sheet.values().get(spreadsheetId=SPREADSHEET_ID, range=RANGE_NAME).execute()
values = result.get("values", [])

# Convert the data to a Pandas DataFrame
if values:
    data_dictionary_df = pd.DataFrame(values[1:], columns=values[0])
    print(colored("Data dictionary successfully loaded.", "green"))
else:
    print(colored("No data found in data dictionary", "red"))


# drop rows where 'release_column_name' is NaN or None
data_dictionary_df = data_dictionary_df.dropna(subset=["release_column_name"])

# Filter out empty strings
data_dictionary_df = data_dictionary_df[data_dictionary_df["release_column_name"] != ""]

# Replace empty strings with NaN in order to fill the NaN values in 'table_name'
data_dictionary_df["table_name"] = data_dictionary_df["table_name"].replace("", np.nan)
data_dictionary_df["table_name"] = data_dictionary_df["table_name"].fillna(
    method="ffill"
)

current_datetime = datetime.now().strftime("%Y%m%d_%H%M%S")
table_name_in_taiga = f"DataDictionary_{current_datetime}"

update_taiga(
    data_dictionary_df,
    "Updated Data Dictionary",
    "predictability-76d5",
    table_name_in_taiga,
    "csv_table",
)
