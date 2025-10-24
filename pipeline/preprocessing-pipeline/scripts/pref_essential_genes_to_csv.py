import h5py
import pandas as pd
import numpy as np
import argparse

num_top_genes = 10


def read_hdf5(filename):
    src = h5py.File(filename, "r")
    try:
        dim_0 = [x.decode("utf8") for x in src["dim_0"]]
        dim_1 = [x.decode("utf8") for x in src["dim_1"]]
        data = np.array(src["data"])
        return pd.DataFrame(index=dim_0, columns=dim_1, data=data)
    finally:
        src.close()


parser = argparse.ArgumentParser()
parser.add_argument("filename", type=str, help="filepath to the dataset")
parser.add_argument("destination", type=str, help="name of output csv")
args = parser.parse_args()

# load dataset
df = read_hdf5(args.filename)
cell_list = list(df)
gene_list = list(df.index)
gene_averages = df.mean(axis="columns")

# we want rownames to be cell lines and column names to be genes, since that makes using argsort easier
# hence the transpose
subtracted = df.subtract(gene_averages, axis="index").transpose()

# now we want to sort from lowest to highest mean-subtracted score for each gene in a cell line
mask = np.isnan(subtracted)
ma = np.ma.masked_array(subtracted, mask=mask)

# returns a matrix of indexes (corresponds to genes in gene_list) in sorted order of mean-subtracted scores
top_gene_indexes = np.argsort(ma)[:]
top_gene_indexes = pd.DataFrame(data=top_gene_indexes[0:, 0:], index=cell_list)

# translate the indexes in the data frame into gene names
top_genes = top_gene_indexes.applymap(lambda x: gene_list[x]).iloc[:, :num_top_genes]
top_genes["cell_line"] = top_genes.index

# met the df so that we get a data frame with columns for cell line, gene, and rank
final_df = pd.melt(top_genes, id_vars=["cell_line"]).rename(
    index=str, columns={"variable": "rank", "value": "gene"}
)
final_df.to_csv(args.destination)
