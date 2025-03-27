import argparse
from hdf5_utils import write_hdf5


def main(subtype_context_taiga_id, out_hdf5_filename, out_filename):
    from taigapy import create_taiga_client_v3

    tc = create_taiga_client_v3()
    one_hot_encoded_context_matrix = tc.get(subtype_context_taiga_id)

    write_hdf5(one_hot_encoded_context_matrix.transpose(), out_hdf5_filename)
    one_hot_encoded_context_matrix.to_csv(out_filename)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("subtype_context_taiga_id")
    parser.add_argument("out_hdf5_filename")
    parser.add_argument("out_filename")
    args = parser.parse_args()
    main(args.subtype_context_taiga_id, args.out_hdf5_filename, args.out_filename)
