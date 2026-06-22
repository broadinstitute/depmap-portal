from types import SimpleNamespace

from loader.dataset_loader.biomarker_loader import _read_fusion


class _FakePbar:
    def __init__(self):
        self.updates = 0

    def update(self, n):
        self.updates += n


def _fusion_row(model_id="ACH-1", is_default="Yes"):
    row = {
        "ModelID": model_id,
        "Gene1": "GENE1",
        "Gene2": "GENE2",
        "CanonicalFusionName": "GENE1--GENE2",
        "TotalReadsSupportingFusion": "10",
        "TotalFusionCoverage": "20",
        "FFPM": "1.5",
        "SplitReads1": "3",
        "SplitReads2": "4",
        "DiscordantMates": "2",
    }
    if is_default is not None:
        row["IsDefaultEntryForModel"] = is_default
    return row


def _caches():
    gene_cache = {"GENE1": SimpleNamespace(entity_id=1), "GENE2": SimpleNamespace(entity_id=2)}
    cell_line_cache = {"ACH-1": SimpleNamespace(depmap_id="ACH-1")}
    return gene_cache, cell_line_cache


def test_read_fusion_skips_non_default_entries():
    gene_cache, cell_line_cache = _caches()
    rows = [
        _fusion_row(is_default="Yes"),
        _fusion_row(is_default="No"),
    ]
    pbar = _FakePbar()

    records = list(_read_fusion(iter(rows), pbar, gene_cache, cell_line_cache))

    # only the default entry is yielded, but the progress bar advances for both
    assert len(records) == 1
    assert records[0]["fusion_name"] == "GENE1--GENE2"
    assert pbar.updates == 2


def test_read_fusion_keeps_rows_when_column_absent():
    gene_cache, cell_line_cache = _caches()
    # no IsDefaultEntryForModel column at all -> backward compatible, keep the row
    rows = [_fusion_row(is_default=None)]
    pbar = _FakePbar()

    records = list(_read_fusion(iter(rows), pbar, gene_cache, cell_line_cache))

    assert len(records) == 1
