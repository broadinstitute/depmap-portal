import csv
import json
import pandas as pd

input = "celligner_disease_lineage_color_index.csv"
output = "../sample_data/celligner_disease_color_map.json"  #  <-- this is what is actually used in cell line selector!

csv_file = open(input, "r")
json_file = open(output, "w")

with open(input) as f:
    reader = csv.DictReader(f)
    rows = list(reader)

with open(output, "w") as f:
    json.dump(rows, f)
