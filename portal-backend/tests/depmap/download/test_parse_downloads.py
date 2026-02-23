import datetime
from depmap.download.models import (
    BucketUrl,
    DmcBucketUrl,
    DownloadRelease,
    DownloadFile,
    FileSubtype,
    InternalBucketUrl,
    ReleaseType,
    FileSource,
    FileType,
    ReleaseTerms,
    SummaryStats,
)
from typing import List

from depmap.settings.parse_downloads import get_list_of_file_paths, parse_downloads_file

expected_downloads = [
    DownloadRelease(
        name="TEST DATA",
        version_group="TEST RELEASE GROUP",
        type=ReleaseType.other_crispr,
        release_date=datetime.date(2018, 5, 8),
        description="This dataset contains long text description",
        terms=ReleaseTerms.depmap,
        citation="This is a fake dev citation",
        all_files=[
            DownloadFile(
                name="test_internal_bucket.csv",
                type=FileType.genetic_dependency,
                sub_type=FileSubtype(
                    code="crispr_screen", label="CRISPR Screen", position=0
                ),
                size="MB",
                url=InternalBucketUrl("test/test_internal_bucket.csv"),
                taiga_id="small-chronos-combined-e82b.2/chronos_combined_score",
            ),
            DownloadFile(
                name="gene_effect.csv",
                type=FileType.genetic_dependency,
                sub_type=FileSubtype(
                    code="crispr_screen", label="CRISPR Screen", position=0
                ),
                size="MB",
                url=DmcBucketUrl("test/gene_effect.csv"),
                taiga_id="small-chronos-combined-e82b.2/chronos_combined_score",
                summary_stats=SummaryStats(
                    [
                        {"value": 1, "label": "genes"},
                        {"value": 1, "label": "cell lines"},
                        {"value": 1, "label": "primary diseases"},
                        {"value": 1, "label": "lineages"},
                    ]
                ),
            ),
            DownloadFile(
                name="drug.csv",
                type=FileType.drug_sensitivity,
                size="MB",
                url="https://link.to/figshare/drug",
                taiga_id="placeholder-taiga-id.1",
                description="This is the file description.",
                is_main_file=True,
                satisfies_db_taiga_id="placeholder-gdsc-id.1",
                summary_stats=SummaryStats(
                    [
                        {"value": 1, "label": "genes"},
                        {"value": 1, "label": "cell lines"},
                        {"value": 1, "label": "primary diseases"},
                        {"value": 1, "label": "lineages"},
                    ]
                ),
            ),
            DownloadFile(
                name="drugctrp.csv",
                type=FileType.drug_sensitivity,
                size="MB",
                url="https://link.to/figshare/drugctrp",
                taiga_id="placeholder-ctrp-id.1",
            ),
            DownloadFile(
                name="copy_number.csv",
                type=FileType.omics,
                size="MB",
                url="https://link.to/figshare/copy_number",
                taiga_id="placeholder-taiga-id.1",
                sources=[FileSource.broad, FileSource.sanger],
                summary_stats=SummaryStats(
                    [
                        {"value": 1, "label": "genes"},
                        {"value": 1, "label": "cell lines"},
                        {"value": 1, "label": "primary diseases"},
                        {"value": 1, "label": "lineages"},
                    ]
                ),
            ),
            DownloadFile(
                name="rnai.csv",
                type=FileType.genetic_dependency,
                size="MB",
                url="https://link.to/figshare/rnai",
                taiga_id="small-rnai-d0ad.1",
                sources=[FileSource.broad, FileSource.novartis, FileSource.marcotte,],
                summary_stats=SummaryStats(
                    [
                        {"value": 1, "label": "genes"},
                        {"value": 1, "label": "cell lines"},
                        {"value": 1, "label": "primary diseases"},
                        {"value": 1, "label": "lineages"},
                    ]
                ),
            ),
            DownloadFile(
                name="fusion.csv",
                type=FileType.omics,
                size="MB",
                url="https://link.to/figshare/fusion",
                taiga_id="placeholder-taiga-id.1",
                sources=[FileSource.broad, FileSource.novartis, FileSource.marcotte,],
                summary_stats=SummaryStats(
                    [
                        {"value": 1, "label": "genes"},
                        {"value": 1, "label": "cell lines"},
                        {"value": 1, "label": "primary diseases"},
                        {"value": 1, "label": "lineages"},
                    ]
                ),
            ),
        ],
    )
]


def assert_releases_are_equal(
    expected_download: DownloadRelease,
    sample_downloads_releases: List[DownloadRelease],
    i: int,
):
    assert expected_download.name == sample_downloads_releases[i].name
    assert expected_download.type == sample_downloads_releases[i].type
    assert expected_download.get_release_date(None) == sample_downloads_releases[
        i
    ].get_release_date(None)
    assert expected_download.description == sample_downloads_releases[i].description
    assert expected_download.funding == sample_downloads_releases[i].funding
    assert expected_download.get_terms(None) == sample_downloads_releases[i].get_terms(
        None
    )
    assert expected_download.citation == sample_downloads_releases[i].citation
    assert expected_download.group == sample_downloads_releases[i].group
    assert expected_download._sources == sample_downloads_releases[i]._sources


def assert_files_are_equal(
    expected_file: DownloadFile,
    sample_downloads_releases: List[DownloadRelease],
    release_index: int,
    file_index: int,
):
    sample_file = sample_downloads_releases[release_index].all_files[file_index]
    assert expected_file.name == sample_file.name
    if sample_file.name == "gene_effect.csv":
        assert sample_file.sub_type is not None
        assert sample_file.sub_type.code == "crispr_screen"
        assert sample_file.sub_type.label == "CRISPR Screen"
    assert expected_file.type == sample_file.type
    assert expected_file.size == sample_file.size
    assert expected_file.sources == sample_file.sources
    assert expected_file.sub_type == sample_file.sub_type
    assert expected_file.description == sample_file.description
    assert expected_file.is_main_file == sample_file.is_main_file
    assert expected_file.date_override == sample_file.date_override
    assert expected_file.terms_override == sample_file.terms_override
    assert expected_file.retraction_override == sample_file.retraction_override
    if expected_file.summary_stats:
        for i, expected_stat in enumerate(expected_file.summary_stats.stats):
            assert expected_stat == sample_file.summary_stats.stats[i]
    assert expected_file.md5_hash == sample_file.md5_hash


def test_parse_download_file(
    file_path="tests/depmap/download/test_download_release.yaml",
):
    observed_downloads_release = parse_downloads_file(file_path)
    assert len(observed_downloads_release.all_files) == 7

    assert repr(observed_downloads_release.all_files[0]._url) == repr(
        InternalBucketUrl("test/test_internal_bucket.csv")
    )
    assert repr(observed_downloads_release.all_files[1]._url) == repr(
        DmcBucketUrl("test/gene_effect.csv")
    )
    assert observed_downloads_release.all_files[0].satisfies_db_taiga_id == None

    for i, expected_download in enumerate(expected_downloads):
        assert_releases_are_equal(expected_download, [observed_downloads_release], i)
        for j, expected_file in enumerate(expected_download.all_files):
            assert_files_are_equal(expected_file, [observed_downloads_release], i, j)


# test getting a list of paths from an index.yaml file: index_file_path = f"{downloads_path}/index.yaml"
def test_get_list_of_file_paths(app):
    downloads_path = "tests/depmap/download"
    with app.app_context():
        path_list = get_list_of_file_paths([downloads_path])

        expected_path_list = [
            "tests/depmap/download/test_first.yaml",
            "tests/depmap/download/test_a.yaml",
            "tests/depmap/download/test_b.yaml",
            "tests/depmap/download/test_c.yaml",
            "tests/depmap/download/test_d.yaml",
        ]

        assert expected_path_list == [path for path in path_list]


def test_get_list_of_file_paths_with_complex_ordering(app):
    # make sure that if we don't specify any priorities, then make sure we respect the order of entries in the files
    with app.app_context():
        path_list = get_list_of_file_paths(
            ["tests/depmap/download/dir-1", "tests/depmap/download/dir-2"]
        )

        expected_path_list = [
            "dir1_a.yaml",
            "dir1_b.yaml",
            "dir1_c.yaml",
            "dir1_d.yaml",
            "dir2_a.yaml",
            "dir2_b.yaml",
            "dir2_c.yaml",
            "dir2_d.yaml",
        ]

        def _simplify(items):
            return [x.split("/")[-1] for x in items]

        assert expected_path_list == _simplify(path_list)

        # now flip the file order and make sure the files flip
        path_list = get_list_of_file_paths(
            ["tests/depmap/download/dir-2", "tests/depmap/download/dir-1"]
        )

        expected_path_list = [
            "dir2_a.yaml",
            "dir2_b.yaml",
            "dir2_c.yaml",
            "dir2_d.yaml",
            "dir1_a.yaml",
            "dir1_b.yaml",
            "dir1_c.yaml",
            "dir1_d.yaml",
        ]

        assert expected_path_list == _simplify(path_list)
