import sys
import pandas as pd

data_file = sys.argv[1]
out_file = sys.argv[2]

df = pd.read_csv(data_file, index_col="Row.name")

mean = df.mean(axis=0)  # Calculate the mean of each column
var = df.var(axis=0)  # Calculate the variance of each column
skewness = df.skew(axis=0)  # Calculate the skewness of each column
kurtosis = df.kurtosis(axis=0)  # Calculate the skewness of each column
n = (1 - kurtosis.isna()).sum()
bimodality = (skewness ** 2 + 1) / (kurtosis + 3 * (n - 1) ** 2 / ((n - 2) * (n - 3)))

moments = pd.DataFrame(
    {
        "Mean": mean,
        "Variance": var,
        "Skewness": skewness,
        "Kurtosis": kurtosis,
        "Bimodality": bimodality,
    }
)

# Insert Row.name as a column in the DataFrame
moments.insert(0, "Row.name", moments.index)

moments.to_csv(out_file, index=False)
