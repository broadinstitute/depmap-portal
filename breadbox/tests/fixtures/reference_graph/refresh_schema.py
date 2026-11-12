"""
Regenerate schema.json from a running Breadbox.

    python tests/fixtures/reference_graph/refresh_schema.py [BASE_URL]

schema.json is the input to the cross-language reference-graph contract test
(see tests/api/test_types.py and AnnotationSelect/__tests__/referenceGraphContract.test.ts).
It keeps only what affects the graph: dimension types, tabular datasets, and
each table's reference columns plus a few ordinary columns. Only datasets
visible to an anonymous caller are kept, matching what Delphi's service
account sees. After refreshing, regenerate reachable.json:

    UPDATE_CONTRACT_FIXTURES=1 pytest tests/api/test_types.py -k contract
"""
import json
import sys
import urllib.request
from pathlib import Path

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
OUT = Path(__file__).parent / "schema.json"
PLAIN_COLUMNS_KEPT = 3

# The contract needs representative cases, not the whole schema. Each root is
# kept together with everything it references, so every reference resolves.
#   screen_pair                       doors (two arms), supplemental start tables,
#                                     multi-hop chain, several routes to depmap_model
#   transcript                        reaches a hub two ways (directly and via protein)
#   antibody_v2                       list-valued reference
#   gene_pair                         three references to one type
#   sanger_combination_combo_fit_feature
#                                     two references to one type, then a chain
#   generic                           a type with no primary table
ROOT_TYPES = [
    "screen_pair",
    "transcript",
    "antibody_v2",
    "gene_pair",
    "sanger_combination_combo_fit_feature",
    "generic",
]


def get(path):
    request = urllib.request.Request(
        BASE_URL + path, headers={"X-Forwarded-Email": "anyone@example.com"}
    )
    with urllib.request.urlopen(request) as response:
        return json.load(response)


def main():
    all_types = get("/types/dimensions")
    all_datasets = [d for d in get("/datasets/") if d["format"] == "tabular_dataset"]

    kept = set()
    pending = list(ROOT_TYPES)
    while pending:
        name = pending.pop()
        if name in kept:
            continue
        kept.add(name)
        for d in all_datasets:
            if d["index_type_name"] == name:
                pending.extend(
                    m["references"]
                    for m in d["columns_metadata"].values()
                    if m.get("references")
                )

    dimension_types = [
        {
            "name": t["name"],
            "display_name": t["display_name"],
            "id_column": t["id_column"],
            "axis": t["axis"],
            "metadata_dataset_id": t["metadata_dataset_id"],
        }
        for t in sorted(all_types, key=lambda t: t["name"])
        if t["name"] in kept
    ]

    datasets = []
    for d in all_datasets:
        if d["index_type_name"] not in kept:
            continue
        columns = d["columns_metadata"]
        refs = sorted(c for c, m in columns.items() if m.get("references"))
        plain = sorted(c for c in columns if c not in refs)[:PLAIN_COLUMNS_KEPT]
        datasets.append(
            {
                "id": d["id"],
                "given_id": d["given_id"],
                "name": d["name"],
                "format": "tabular_dataset",
                "index_type_name": d["index_type_name"],
                "columns_metadata": {
                    c: {
                        "col_type": columns[c]["col_type"],
                        "references": columns[c].get("references"),
                    }
                    for c in sorted(refs + plain)
                },
            }
        )
    datasets.sort(key=lambda d: (d["index_type_name"], d["name"], d["id"]))

    OUT.write_text(
        json.dumps(
            {"dimension_types": dimension_types, "tabular_datasets": datasets},
            indent=1,
            sort_keys=True,
        )
        + "\n"
    )
    print(f"{len(dimension_types)} types, {len(datasets)} tables -> {OUT}")


main()
