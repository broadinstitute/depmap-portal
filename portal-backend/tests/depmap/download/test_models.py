import pytest
from datetime import date
from depmap.download.models import (
    DownloadSettings,
    DownloadRelease,
    DownloadFile,
    ReleaseType,
    FileSource,
    FileType,
    ReleaseTerms,
    RetractedUrl,
)
from tests.factories import DependencyDatasetFactory, TaigaAliasFactory

from depmap.settings.download_settings import get_download_list


def test_sources_precedence():
    """
    Souces on a file should have the following priority:
        If sources is specified on the file, use that
        Otherwise, if specified on the release, use that
        Otherwise, default to Broad
    """
    # test not setting release, one file default and one file set
    default_release_file = DownloadRelease(
        "default release",
        ReleaseType.depmap_release,
        date(1, 1, 1),
        "",
        [
            DownloadFile("default file", FileType.genetic_dependency, "", ""),
            DownloadFile(
                "default file",
                FileType.genetic_dependency,
                "",
                "",
                sources=[FileSource.marcotte],
            ),
        ],
        terms=ReleaseTerms.achilles,
    )

    set_release_file = DownloadRelease(
        "default release",
        ReleaseType.depmap_release,
        date(1, 1, 1),
        "",
        [
            DownloadFile("default file", FileType.genetic_dependency, "", ""),
            DownloadFile(
                "default file",
                FileType.genetic_dependency,
                "",
                "",
                sources=[FileSource.marcotte],
            ),
        ],
        terms=ReleaseTerms.achilles,
        sources=[FileSource.sanger],
    )

    assert default_release_file.all_files[0].sources == [FileSource.broad]
    assert default_release_file.all_files[1].sources == [FileSource.marcotte]

    assert set_release_file.all_files[0].sources == [FileSource.sanger]
    assert set_release_file.all_files[1].sources == [FileSource.marcotte]


def test_get_sources_display_names(app):
    """
    Test that converts to display names
    """
    file_specified = get_download_list()[0].all_files[0]
    specified_expected = ["Broad Institute", "Marcotte et al."]
    assert file_specified.get_sources_display_names() == specified_expected

    file_default = get_download_list()[0].all_files[1]
    default_expected = ["Broad Institute"]
    assert file_default.get_sources_display_names() == default_expected


def test_retraction_safeguards(empty_db_mock_downloads):
    """
    Test that
    A file with RetractedUrl must have retraction_override
    """
    with pytest.raises(AssertionError):
        DownloadFile("default file", FileType.genetic_dependency, "", RetractedUrl())


def test_file_taiga_id_properties(empty_db_mock_downloads):
    virtual_taiga_id = "virtual.1/file"
    canonical_taiga_id = "canonical.1/file"
    TaigaAliasFactory(taiga_id=virtual_taiga_id, canonical_taiga_id=canonical_taiga_id)
    empty_db_mock_downloads.session.flush()

    file = DownloadFile(
        "test name",
        FileType.genetic_dependency,
        "test size",
        "test url",
        taiga_id=virtual_taiga_id,
        satisfies_db_taiga_id=virtual_taiga_id,
    )

    # test direct properties
    assert file.taiga_id == canonical_taiga_id
    assert file.satisfies_db_taiga_id == canonical_taiga_id

    # test original
    assert file.original_taiga_id == virtual_taiga_id
    assert file.original_satisfies_db_taiga_id == virtual_taiga_id

    # test that the compute properties can None
    none_taiga_id_file = DownloadFile(
        "test name",
        FileType.genetic_dependency,
        "test size",
        "test url",
        taiga_id=None,
        satisfies_db_taiga_id=None,
    )
    assert none_taiga_id_file.taiga_id == None
    assert none_taiga_id_file.satisfies_db_taiga_id == None
