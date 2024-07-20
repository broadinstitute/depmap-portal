import collections
import pandas as pd
import sys
import h5py

master_file = sys.argv[1]
hdf5_output_file = sys.argv[2]
csv_output_file = sys.argv[3]


def write_hdf5(df, file_path):
    print("c", df.columns)
    dest = h5py.File(file_path, "w")

    dest["dim_0"] = [x.encode("utf-8") for x in df.index]
    dest["dim_1"] = [x.encode("utf-8") for x in df.columns]
    dest["data"] = df.applymap(lambda x: 1 if x else 0)


master = master_df = pd.read_csv(master_file, encoding="ISO-8859-1")
lineage_columns = ["lineage_1", "lineage_2", "lineage_3", "lineage_4"]

haematopoietic_and_lymphoid_lineages = [
    "Lymphoid",
    "Myeloid",
]
non_solid_and_non_haematopoietic_and_lymphoid_lineages = ["Fibroblast", "Normal"]

# verify that these strings still exist in the data, and that the categorization hasn't changed
assert all(
    [
        lineage in set(master_df[lineage_columns[0]])
        for lineage in haematopoietic_and_lymphoid_lineages
        + non_solid_and_non_haematopoietic_and_lymphoid_lineages
    ]
)

unique_arxspan_ids = list(set(master["arxspan_id"]))
lineage_to_cell_lines = collections.defaultdict(lambda: set())
for lineage_column in lineage_columns:
    for cell_line, lineage in zip(master["arxspan_id"], master[lineage_column]):
        if not pd.isnull(lineage):
            lineage_to_cell_lines[lineage].add(cell_line)

            if lineage_column == lineage_columns[0]:
                if lineage in haematopoietic_and_lymphoid_lineages:
                    lineage_to_cell_lines["Haematopoietic_and_Lymphoid"].add(cell_line)
                elif (
                    lineage
                    not in non_solid_and_non_haematopoietic_and_lymphoid_lineages
                ):
                    lineage_to_cell_lines["Solid"].add(cell_line)

lineage_names = list(lineage_to_cell_lines.keys())
lineage_names.sort()
membership_per_lineage = []
for lineage in lineage_names:
    lineage_cell_lines = lineage_to_cell_lines[lineage]
    membership_per_lineage.append([x in lineage_cell_lines for x in unique_arxspan_ids])

#        if cell_line in unique_ccle_names:
#            print("Found duplicate cell line: {}, dropping row".format(cell_line))
#            continue
#
print("cell_line", unique_arxspan_ids)
items = [("cell_line", unique_arxspan_ids)] + list(
    zip(lineage_names, membership_per_lineage)
)
bool_matrix = pd.DataFrame.from_dict(collections.OrderedDict(items))
bool_matrix.set_index("cell_line", inplace=True)

write_hdf5(bool_matrix.transpose(), hdf5_output_file)
bool_matrix.to_csv(csv_output_file)
# print(bool_matrix)
