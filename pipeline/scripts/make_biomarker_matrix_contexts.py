import argparse
from pipeline.scripts.hdf5_utils import write_hdf5


def main(subtype_context_taiga_id):
    from taigapy import create_taiga_client_v3

    tc = create_taiga_client_v3()
    one_hot_encoded_context_matrix = tc.get(subtype_context_taiga_id)
    bool_matrix = one_hot_encoded_context_matrix.astype(bool)
    bool_matrix.set_index("cell_line", inplace=True)
    write_hdf5(bool_matrix.transpose(), "temp-out.hdf5")
    bool_matrix.to_csv("out.csv")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("subtype_context_taiga_id")
    args = parser.parse_args()
    main(args.subtype_context_taiga_id)
