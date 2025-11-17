import numpy as np
import scipy.stats as stats
import numpy.ma as ma
import pandas as pd


def lin_associations_wrapper(features, profile, profile_is_dependent):
    """
    Wraps the linear association functions and performs various indexing tasks
    @param features: (numpy array or Pandas DataFrame) Set of features (generally biomarkers) for fitting. Shape: (n,m). NaN allowed.
    @param profile: (numpy array or Pandas DataFrame) Dependency profile for fitting. Shape: (n,1). NaN allowed.
    @param profile_is_dependent: (bool) True when the profile is the dependent variable and false otherwise
    @return: (Pandas DataFrame) Fit results filtered based on various criteria
    """
    profile = pd.Series(
        data=profile, name="COL_0", index=["ROW_" + str(i) for i in range(len(profile))]
    )
    features = pd.DataFrame(
        data=features,
        columns=["COL_" + str(i) for i in range(features.shape[1])],
        index=["ROW_" + str(i) for i in range(len(features))],
    )

    full_output = lin_associations_with_ind_flag(
        features, profile, A_is_independent=profile_is_dependent
    )
    df = full_output
    if profile_is_dependent:
        valid_var_cols = features.std(axis=0) > 0.001
        outmask = pd.Series(data=df["mask"].to_numpy(), index=valid_var_cols.index)
        outmask = outmask & valid_var_cols
        df = df[pd.Index(outmask)]
        df["Index"] = df.index
    else:
        valid_var_cols = features.std(axis=0) > 0.001
        outmask = pd.Series(data=df["mask"].to_numpy(), index=valid_var_cols.index)
        outmask = outmask & valid_var_cols
        df = df[pd.Index(outmask)]
        df["Index"] = df.index
    df["dep.var"] = np.nan
    df["ind.var"] = np.nan
    return df


def lin_associations_with_ind_flag(A, B, A_is_independent):
    """
    Switches the profile and feature set depending on which is considered the independent variable
    @param A: The featureset
    @param B: The profile
    @param A_is_independent: indicates that the profile is dependent and the featureset is independent
    @return: Fit parameters as defined in robust_linear_model
    """
    if A_is_independent:
        out = robust_linear_model(A.to_numpy(), B.to_numpy())
    else:
        out = robust_linear_model(B.to_numpy(), A.to_numpy())
    return out


def robust_linear_model(X, y, W=None):
    """
    Uses "robust" linear modeling to arrive at a moderated p-value compared to the default
    :param X: NumPy array. Observations of independent variable. nxm (m=number of features)
    :param y: NumPy array. Observations of dependent variable. nx1
    :param W: NumPy array. Confounders. nxp (p=number of confounders)
    :return: Dict with output statistics:
        betahat: estimated linear coefficient controlled for W.
        sebetahat: standard error for the estimate of beta.
        NegativeProb: null, not used (holdover from prior version)
        PositiveProb: null, not used (holdover from prior version)
        lfsr: null, not used (holdover from prior version)
        svalue: null, not used (holdover from prior version)
        lfdr: null, not used (holdover from prior version)
        qvalue: q-values for the effect size estimates.
        PosteriorMean: identical to betahat (holdover from prior version)
        PosteriorSD: identical to sebetahat (holdover from prior version)
        dep.var: null, not used (holdover from prior version)
        ind.var: null, not used (holdover from prior version)
    """
    d = 2
    assert type(X) == np.ndarray, "X must be a numpy array"
    assert type(y) == np.ndarray, "y must be a numpy array"
    X = ma.array(X, mask=~np.isfinite(X))
    y = ma.array(y, mask=~np.isfinite(y))
    if W:
        assert type(W) == np.ndarray, "W must be a numpy array"
        assert np.isfinite(W.to_numpy()).all(), "W cannot have any null values"
        # add intercept column
        W = np.hstack((np.ones(W.shape[0], 1), W))
        # Frisch-Waugh-Lovell matrix
        H = np.eye(W.shape[0]) - W.dot(np.linalg.solve(W.T.dot(W), W.T))
        X = H.dot(X)
        y = H.dot(y)
        d = W.shape[1] + 1

    # define S and related statistics
    assert (len(y.shape) == 1 or len(X.shape) == 1) or (
        y.shape[1] == 1 or X.shape[1] == 1
    ), "one entry must be a single column"
    if len(y.shape) == 1 or y.shape[1] == 1:
        if len(y.shape) == 1:
            y = y[:, None]
        X = X - X.mean(axis=0)
        yc = y - ma.array(
            np.broadcast_to(y, X.shape), mask=(np.isnan(y) | X.mask)
        ).mean(axis=0)
    else:
        if len(X.shape) == 1:
            X = X[:, None]
        X = X - ma.array(np.broadcast_to(X, y.shape), mask=(np.isnan(X) | y.mask)).mean(
            axis=0
        )
        yc = y - y.mean(axis=0)

    # filter columns vased on variance
    varthresh = 0.001
    X.mask = (X.std(axis=0) <= varthresh).data[None, :] | X.mask

    S = X * yc

    n = (~np.isnan(S.data)).sum(axis=0)
    muS = S.mean(axis=0) * n / (n - 1)
    sigmaS = np.sqrt(((S - muS) ** 2).mean(axis=0))
    X.mask = X.mask | ~np.isfinite(S)
    yc.mask = yc.mask | ~np.isfinite(S)
    varX = np.var(X, axis=0, ddof=1)
    varY = np.var(yc, axis=0, ddof=1)

    # fit parameters and p-val
    beta = muS / varX
    beta_se = np.sqrt(varX * varY - muS ** 2) / (n * varX)
    rho = muS / np.sqrt(varX * varY)
    p_val = 2 * stats.t.sf(np.abs(np.sqrt(n - d) * muS / sigmaS), n - d)
    p_val_homoskedastic = 2 * stats.t.sf(
        (np.sqrt((n - d) / (1 / (rho ** 2) - 1))), n - d
    )

    q_val = stats.false_discovery_control(p_val)
    q_val_homoskedastic = stats.false_discovery_control(p_val_homoskedastic)

    # generate robustness score
    _S = S / np.nansum(S, axis=0)
    _S = np.take_along_axis(_S, np.argsort(_S, axis=0), axis=0)[::-1, :]
    _S = np.nancumsum(_S, axis=0) < 1
    ns = _S.sum(axis=0) + 1

    out = {
        "rho": rho.data,
        "beta": beta.data,
        "beta_se": beta_se.data,
        "p_val": p_val,
        "p_val_homoskedastic": p_val_homoskedastic,
        "q_val": q_val,
        "q_val_homoskedastic": q_val_homoskedastic,
        "n": n,
        "ns": ns.data,
        "muS": muS.data,
        "sigmaS": sigmaS.data,
        "varX": varX.data,
        "varY": varY.data,
    }
    outmask = ~(rho.mask | (n - 2 < 4))
    out = {
        "betahat": beta.data,
        "sebetahat": beta_se.data,
        "NegativeProb": np.full(beta.data.shape, np.nan),
        "PositiveProb": np.full(beta.data.shape, np.nan),
        "lfsr": np.full(beta.data.shape, np.nan),
        "svalue": np.full(beta.data.shape, np.nan),
        "lfdr": np.full(beta.data.shape, np.nan),
        "qvalue": q_val_homoskedastic,
        "p.val": p_val_homoskedastic,
        # "qvalue_rob": q_val,
        # "p.val_rob": p_val,
        "PosteriorMean": beta.data,
        "PosteriorSD": beta_se.data,
        "mask": outmask,
    }
    return pd.DataFrame.from_dict(out)
