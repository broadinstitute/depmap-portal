import numpy as np
import pandas as pd


def bimodality_coefficient_for_cpd_viabilities(cpd_viabilities: pd.Series) -> pd.Series:
    x = cpd_viabilities.dropna()
    num_viabilities = len(x)
    if num_viabilities > 20:
        s1 = np.mean(x)
        s2 = np.var(x)
        x_ = np.divide(np.subtract(x, s1), np.sqrt(s2))
        s3 = np.mean(np.power(x_, 3))
        s4 = np.mean(np.power(x_, 4))
        n = (1 - np.isnan(x)).sum()
        bimodality_coefficient = (np.power(s3, 2) + 1) / (
            s4 - 3 + 3 * np.power(n - 1, 2) / (np.multiply(n - 2, n - 3))
        )
    else:
        bimodality_coefficient = None

    return bimodality_coefficient
