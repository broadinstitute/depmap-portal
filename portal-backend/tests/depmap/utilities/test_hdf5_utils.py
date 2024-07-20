from depmap.utilities import hdf5_utils
import numpy as np
import pandas as pd
from tests.factories import MatrixFactory, create_hdf5

file_path = "tests/depmap/partials/test_matrix.hdf5"


def test_get_row_of_values(app):
    """
    We test the equality of the resulting series because I can't figure out how to construct the 'nan' (type numpy.float64) value retrieved from the hdf5 file to test equality of the direct list. Constructing a pandas series either coerces things/has a better equality checker that we can test equality
    
    I.e., 
    assert values == expected
    does not work for the direct lists
    
    type(float64('nan'))) -> numpy.float64
    type(NaN) or type(np.nan) -> float
    None of these will == values[1] (type numpy.float64) 
    """
    values = hdf5_utils.get_row_of_values(app.config["PROJECT_ROOT"], file_path, 1)

    expected = [
        2.0,
        np.NaN,
        32.0,
        47.0,
        62.0,
        77.0,
        92.0,
        107.0,
        122.0,
        137.0,
        152.0,
        167.0,
        182.0,
        197.0,
        212.0,
        227.0,
        242.0,
        257.0,
        272.0,
    ]

    assert pd.Series(expected).equals(pd.Series(values))


def test_get_col_of_values(app):
    values = hdf5_utils.get_col_of_values(app.config["PROJECT_ROOT"], file_path, 0)
    assert values == [
        1.0,
        2.0,
        3.0,
        4.0,
        5.0,
        6.0,
        7.0,
        8.0,
        9.0,
        10.0,
        11.0,
        12.0,
        13.0,
        14.0,
        15.0,
    ]


def test_get_df_of_values(tmpdir):
    """
    Test that
        Only the appropriate rows and cols are retrieved
        The rows and cols are retrieved in the order of the index passed in, even if the index is not sorted (e.g. pass in [1, 4, 2]
        The rows and cols names are the value and order of the indices passed in, and not reset
    """
    """
    Creates the following dataframe
        asymmetric
        each value is the sum of its two index values
               0  1  2  3
            0  0  1  2  3
            1  1  2  3  4
            2  2  3  4  5
            3  3  4  5  6
            4  4  5  6  7
            5  5  6  7  8
    """
    file_path = str(tmpdir.join("test_file.hdf5"))
    source_df = pd.DataFrame(
        [
            [0, 1, 2, 3],
            [1, 2, 3, 4],
            [2, 3, 4, 5],
            [3, 4, 5, 6],
            [4, 5, 6, 7],
            [5, 6, 7, 8],
        ]
    )
    # dim_0 and dim_1 are not used by get_df_of_values
    fake_row_list = ["", "", "", "", "", ""]
    fake_col_list = ["", "", "", ""]

    create_hdf5(file_path, fake_row_list, fake_col_list, data=np.array(source_df))

    row_indices = [4, 5, 2]  # has holes, and in the wrong order
    col_indices = [0, 2]

    """
    expect
           0  2
        4  4  6
        5  5  7
        2  2  4
    """
    expected_df = pd.DataFrame(
        [[4, 6], [5, 7], [2, 4]], columns=col_indices, index=row_indices
    )

    df = hdf5_utils.get_df_of_values("", file_path, row_indices, col_indices)
    assert df.equals(expected_df)


def test_get_df_of_values_transpose(tmpdir):
    """
    Test that
        transpose option works correctly
    """
    """
    We store the following hdf5 dataframe
           0  1
        0  0  1
        1  1  2
        2  2  3

    Whereas mentally, we have the following transposed dataframe
           0  1  2
        0  0  1  2
        1  1  2  3
    """
    file_path = str(tmpdir.join("test_file.hdf5"))
    hdf5_df = pd.DataFrame([[0, 1], [1, 2], [2, 3]])
    # dim_0 and dim_1 are not used by get_df_of_values
    fake_row_list = ["", "", ""]
    fake_col_list = ["", ""]

    create_hdf5(file_path, fake_row_list, fake_col_list, data=np.array(hdf5_df))

    # test still works if we assume the underlying hdf5 file is transposed
    row_indices = [1]
    col_indices = [0, 1, 2]

    """
    expect
           0  1  2
        1  1  2  3
    """
    expected_df = pd.DataFrame([[1, 2, 3]], columns=col_indices, index=row_indices)

    # transpose true
    df = hdf5_utils.get_df_of_values(
        "", file_path, row_indices, col_indices, is_transpose=True
    )
    assert df.equals(expected_df)


def test_get_row_means(app):
    means = hdf5_utils.get_row_means(app.config["PROJECT_ROOT"], file_path)
    sums = [
        2568,
        2586,
        2604,
        2622,
        2640,
        2658,
        2676,
        2694,
        2712,
        2730,
        2748,
        2766,
        2784,
        2802,
        2820,
    ]
    expected = [x / 18 for x in sums]
    assert means.tolist() == expected


def test_get_row_col_index(app):
    row_index = hdf5_utils.get_row_index(app.config["PROJECT_ROOT"], file_path)
    row_index_transposed = hdf5_utils.get_row_index(
        app.config["PROJECT_ROOT"], file_path, is_transpose=True
    )
    col_index = hdf5_utils.get_col_index(app.config["PROJECT_ROOT"], file_path)
    col_index_transposed = hdf5_utils.get_col_index(
        app.config["PROJECT_ROOT"], file_path, is_transpose=True
    )

    expected_row_index = [
        "SWI5 (375757)",
        "TRIL (9865)",
        "TNS2 (ENSG00000111077)",
        "UNC93B1 (81622)",
        "PSG7 (5676)",
        "KDM7A (80853)",
        "F8A1 (8263)",
        "MIR3613 (100500908)",
        "ANOS1 (3730)",
        "HNF1B (6928)",
        "SOX10 (6663)",
        "AMY1A (276)",
        "NRAS (4893)",
        "MAP4K4 (9448)",
        "MED1 (5469)",
    ]
    expected_col_index = [
        "HS294T_SKIN",
        "A673_BONE",
        "EWS502_BONE",
        "HT29_LARGE_INTESTINE",
        "A2058_SKIN",
        "C32_SKIN",
        "143B_BONE",
        "CADOES1_BONE",
        "CJM_SKIN",
        "COLO679_SKIN",
        "EKVX_LUNG",
        "EPLC272H_LUNG",
        "UACC62_SKIN",
        "SKMEL30_SKIN",
        "WM88_SKIN",
        "PETA_SKIN",
        "TC32_BONE",
        "WM115_SKIN",
        "SH4_SKIN",
    ]
    assert row_index == expected_row_index
    assert row_index_transposed == expected_col_index
    assert col_index == expected_col_index
    assert col_index_transposed == expected_row_index


def test_get_values_min_max(empty_db_mock_downloads, app):
    """
    Impliclty tested through call in MatrixFactory
    Test that min and max are correct, even when NaN is present
    """
    df = pd.DataFrame(
        {"col1": [-10, 2, 4, np.NaN], "col2": [1, 2, 4, 50]}, index=[0, 1, 2, 3]
    )
    matrix = MatrixFactory(data=df.values)
    empty_db_mock_downloads.session.flush()

    assert type(matrix.min) is float  # and not numpy dtype
    assert type(matrix.max) is float

    assert matrix.min == -10
    assert matrix.max == 50
