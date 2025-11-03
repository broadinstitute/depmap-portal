import pandas as pd
from merge_cpd_data import (
    parse_shared_drugs,
    parse_sanger,
    parse_ctd2,
    Mapping,
    parse_repurposing,
)


def test_mapping():
    m = Mapping()
    m.add("a", "b", "p1")
    m.add("c", "d", "p1")
    m.add("e", "f", "p1")
    m.add("f", "a", "p2")

    assert len(m.unique()) == 2
    assert set(m.get("a").ids.keys()) == set(["a", "b", "f", "e"])
    assert set(m.get("c").ids.keys()) == set(["d", "c"])

    assert m.get("a").ids["b"] == set(["p1"])
    assert m.get("a").ids["f"] == set(["p2", "p1"])
    assert m.get("a").ids["a"] == set(["p1", "p2"])


def test_parse_repurposing():
    df = pd.read_csv("test_data/repurposing_metadata.csv")
    result = parse_repurposing(df)
    result = pd.DataFrame(result)
    result.to_csv("repurposing-out.csv")
    print(result)


def test_parse_shared_drugs():
    df = pd.read_csv("test_data/shared_drugs_mapping_file.csv")
    result = parse_shared_drugs(df)
    result = pd.DataFrame(result)
    result.to_csv("shared-out.csv")
    print(result)


def test_parse_sanger():
    df = pd.read_csv("test_data/sanger_drug_metadata.csv")
    result = parse_sanger(df)
    result = pd.DataFrame(result)
    result.to_csv("sanger-out.csv")
    print(result)


def test_parse_ctd2():
    df = pd.read_csv("test_data/ctd2_drug_metadata.csv")
    result = parse_ctd2(df)
    result = pd.DataFrame(result)
    result.to_csv("ctd2-out.csv")
    print(result)
