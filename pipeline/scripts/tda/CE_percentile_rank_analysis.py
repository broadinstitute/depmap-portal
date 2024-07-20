import sys
import pandas as pd
import importlib

# Import the necessary matplotlib plotting module natively(at this moment without this import the density
# function calculation causes a matplotlib import error)
importlib.import_module("pandas.plotting._matplotlib")

data_file = sys.argv[1]
out_file = sys.argv[2]

data = pd.read_csv(data_file, index_col="Row.name")

# Rank the data across rows (axis=1), treating NA/null values as lowest rank resulting in those NA data points having
# the highest values. e.g. [1, 2, NA, NA] -> [1, 2, 3, 3].
# However, in R's case(from the previous R script) the example would become [1, 2, 3, 4]
rank_data = data.rank(axis=1, method="min", na_option="bottom")

# Divide by the number of non-NA values for each row to normalize
rank_data = rank_data.div(data.notna().sum(axis=1), axis=0)

# Compute the 90th percentile for each column in the DataFrame
percentile = rank_data.quantile(q=0.9)

# Calculate the density function of the 90th percentile values
dens = pd.Series(percentile).plot.density(bw_method=0.3).get_lines()[0].get_xydata()
dens_df = pd.DataFrame(dens, columns=["x", "y"])

# Filter out the values that are not between 0.1 and 0.9
df_range = dens_df[(dens_df["x"] > 0.1) & (dens_df["x"] < 0.9)]

# Find the x value that corresponds to the minimum y value in the filtered DataFrame
threshold = df_range.loc[df_range["y"].idxmin(), "x"]
ce_list = pd.DataFrame(
    {"Row.name": percentile.index, "CE_percentile": percentile.values}
)

# Add a boolean column to the DataFrame that indicates whether the CE_percentile value is <= to the threshold
ce_list["Common_Essential"] = ce_list["CE_percentile"] <= threshold

ce_list.to_csv(out_file, index=False)
