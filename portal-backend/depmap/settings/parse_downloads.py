import os
from flask import current_app
from datetime import date
import yaml
from typing import Any, Dict, List, Tuple, Union, Optional

from depmap.download.models import (
    BucketUrl,
    DmcBucketUrl,
    DownloadFile,
    DownloadRelease,
    ExternalBucketUrl,
    FileSource,
    FileSubtype,
    FileType,
    ReleaseTerms,
    ReleaseType,
    RetractedUrl,
    SummaryStats,
    SummaryStatsDict,
    TaigaOnly,
)

from typing import Dict
from dataclasses import dataclass


@dataclass
class DownloadInfoFromConfig:
    releases: List[DownloadRelease]
    display_names_by_taiga_ids: Dict[str, str]
    release_by_filename: Dict[str, DownloadRelease]


_parse_cache: Dict[str, Tuple[float, DownloadInfoFromConfig]] = {}


def parse_yaml(yaml_str: str) -> Dict[str, List[Dict[str, Union[List, str, Dict]]]]:
    parsed_yaml = yaml.load(yaml_str, Loader=yaml.SafeLoader)
    return parsed_yaml


def get_sources(sources: Dict[str, Any]) -> List[FileSource]:
    if sources == None:
        return None

    final_sources: List[FileSource] = []
    for s in sources:
        final_sources.append(FileSource(s))

    if len(final_sources) <= 0:
        return None
    else:
        return final_sources


def get_summary_stats(stats: List[Dict[str, Any]]) -> SummaryStats:
    if stats == None:
        return None

    stats_dict_list: List[SummaryStatsDict] = []
    for s in stats:
        if s.get("label", None) and s.get("value", None):
            single_stat = SummaryStatsDict(
                {"value": s.get("value", None), "label": s.get("label", None)}
            )
            stats_dict_list.append(single_stat)

    return SummaryStats(stats_dict_list)


def get_bucket(url: dict):
    if url.get("bucket", "") == DmcBucketUrl.BUCKET:
        return DmcBucketUrl(url.get("file_name", ""), dl_name=url.get("dl_name", ""))
    else:
        return BucketUrl(
            url.get("bucket", ""),
            url.get("file_name", ""),
            dl_name=url.get("dl_name", ""),
        )


def get_proper_url_format(url):
    if url is None:
        return ""

    if isinstance(url, dict):
        return get_bucket(url)
    elif url == "TaigaOnly()":
        return TaigaOnly()
    elif url == "RetractedUrl":
        return RetractedUrl()
    else:
        return url


def make_file(file: Dict[str, Any], subtype_mapping_w_positions: dict) -> DownloadFile:
    # Required for DownloadFile
    name = file.get("name", "")
    type = FileType(file.get("type", ""))

    sub_type_code = file.get("sub_type")
    sub_type = subtype_mapping_w_positions.get(sub_type_code)

    size = file.get("size", "")

    taiga_id = file.get("taiga_id", None)
    canonical_taiga_id = file.get("canonical_taiga_id", None)

    url: Union[
        ExternalBucketUrl, TaigaOnly, DmcBucketUrl, RetractedUrl, str, Any
    ] = get_proper_url_format(file.get("url", ""))

    # Everything below this point is optional for DownloadFile
    sources: List[FileSource] = get_sources(file.get("sources", []))
    description = file.get("description", "")
    is_main_file = file.get("is_main_file", False)

    # Not sure what this is or if I need it
    satisfies_db_taiga_id = file.get("satisfies_db_taiga_id", None)

    # year, month, day
    date_override: date = file.get("date_override", None)
    terms_override_str = file.get("terms_override", None)
    terms_override: Optional[ReleaseTerms] = None
    if terms_override_str is not None:
        terms_override = ReleaseTerms(terms_override_str)

    retraction_override: Union[RetractedUrl, str] = file.get(
        "retraction_override", None
    )
    summary_stats: SummaryStats = get_summary_stats(file.get("summary_stats", None))

    md5_hash = file.get("md5_hash", "")
    display_label = file.get("display_label")

    return DownloadFile(
        name=name,
        type=type,
        size=size,
        url=url,
        taiga_id=taiga_id,
        canonical_taiga_id=canonical_taiga_id,
        sources=sources,
        description=description,
        is_main_file=is_main_file,
        satisfies_db_taiga_id=satisfies_db_taiga_id,
        date_override=date_override,
        terms_override=terms_override,
        retraction_override=retraction_override,
        summary_stats=summary_stats,
        md5_hash=md5_hash,
        display_label=display_label,
        sub_type=sub_type,
    )


def get_citation_html(citation: List[dict]) -> str:
    citation_html = ""
    for item in citation:
        if isinstance(item, str):
            return citation
        title = item.get("title")
        html = item.get("html")
        if title:
            citation_html = citation_html + f"<strong>{title}</strong>"
        if html:
            citation_html = citation_html + f"<p>{html}</p>"

    return citation_html


def make_downloads_release_from_parsed_yaml(release: Dict[str, Any]) -> DownloadRelease:

    name = release.get("name", "")
    type = ReleaseType(release.get("type", ""))
    release_date: date = release.get("release_date", "")
    description = release.get("description", "")
    funding = release.get("funding")
    version_group = release.get("version_group", None)
    terms = ReleaseTerms(release["terms"])
    citation = release.get("citation")

    # Yaml files should say null instead of [] if
    # citation is empty so that the React component renders
    # the proper message: "This is an unpublished, priority access dataset."
    # This is a temporary fix until all yaml files with citation: [] switched to None
    if citation == []:
        citation = None

    if citation is not None and citation is not isinstance(citation, str):
        citation = get_citation_html(citation)

    group = release.get("group", None)

    sources: List[FileSource] = get_sources(release.get("sources", None))

    owner_group_display_name = release.get("owner_group_display_name", "Public")

    files_preparse = release.get("files", "")

    virtual_dataset_id = release.get("virtual_dataset_id")

    subtype_mapping = release.get("subtypes")
    subtype_mapping_w_positions = {}

    if subtype_mapping is not None:
        for index, subtype in enumerate(subtype_mapping):
            subtype_mapping_w_positions[subtype["code"]] = FileSubtype(
                code=subtype["code"], label=subtype["label"], position=index
            )

    files: List[DownloadFile] = [
        make_file(file, subtype_mapping_w_positions) for file in files_preparse
    ]

    final_release = DownloadRelease(
        name,
        type,
        release_date,
        description,
        files,
        version_group,
        funding,
        terms,
        citation,
        group,
        sources,
        owner_group_display_name,
        virtual_dataset_id=virtual_dataset_id,
    )

    return final_release


def parse_downloads_file(filepath: str):
    with open(filepath) as fp:
        yaml_file = fp.read()

    parsed_yaml: Dict[str, List[Dict[str, Union[List, str, Dict]]]] = parse_yaml(
        yaml_file
    )

    try:
        final_downloads = make_downloads_release_from_parsed_yaml(parsed_yaml)
    except Exception as ex:
        raise Exception(f"An exception occurred while parsing {filepath}") from ex

    return final_downloads


def get_downloads_file_paths(index_yaml: str) -> List[str]:
    with open(index_yaml) as fp:
        index_yaml_content = fp.read()

    parsed_yaml: Dict[str, Any] = parse_yaml(index_yaml_content)

    downloads: List[str] = parsed_yaml.get("downloads", [])
    if downloads is None or len(downloads) == 0:
        return []

    downloads_dir = os.path.dirname(index_yaml)
    downloads_file_paths: List[str] = [
        f"{downloads_dir}/{download}.yaml" for download in downloads
    ]

    return downloads_file_paths


def get_list_of_file_paths(download_dir_paths: List[str]) -> List[str]:
    file_paths = []

    for download_dir_path in download_dir_paths:
        index_file_path = os.path.join(download_dir_path, "index.yaml")
        file_paths.extend(get_downloads_file_paths(index_file_path))

    return file_paths


# specific_release should be the file name of 1 of the 2 release in config/dev/downloads:
# (1) dev_only_downloads, (2) dev_only_no_taiga_downloads. This is used in depmap/settings/download_settings.py
# so that, if taiga is available, we can simulate datasets without downloads (so they can link directly to taiga)
def get_dev_downloads(
    downloads_path: str, specific_release: str
) -> List[DownloadRelease]:
    downloads_releases: List[DownloadRelease] = [
        parse_downloads_file(f"{downloads_path}/{specific_release}.yaml")
    ]

    return downloads_releases


# Used to get virtual_dataset_id and release for depmap/settings/downloads/{internal/dmc/public}/latest.py
def get_virtual_dataset_id_by_yaml_file_name(file_name,) -> Tuple[str, DownloadRelease]:
    release = parse_downloads_unsafe().release_by_filename[file_name]
    return release.virtual_dataset_id, release


def _parse_releases(
    downloads_paths: List[str],
) -> Tuple[List[DownloadRelease], Dict[str, DownloadRelease]]:
    file_paths: List[str] = get_list_of_file_paths(downloads_paths)

    release_by_filename: Dict[str, DownloadRelease] = {}
    downloads_releases: List[DownloadRelease] = []
    for file_path in file_paths:
        release = parse_downloads_file(file_path)
        release_by_filename[os.path.basename(file_path)] = release
        downloads_releases.append(release)

    return downloads_releases, release_by_filename


def _parse_downloads(downloads_paths: List[str]) -> DownloadInfoFromConfig:
    downloads_releases, release_by_filename = _parse_releases(downloads_paths)

    display_names_by_taiga_ids = {}

    # build index of taiga_id -> display names
    for release in downloads_releases:
        for file in release.all_files:
            if file.display_label:
                display_names_by_taiga_ids[file.taiga_id] = file.display_label

    return DownloadInfoFromConfig(
        releases=downloads_releases,
        display_names_by_taiga_ids=display_names_by_taiga_ids,
        release_by_filename=release_by_filename,
    )


def _parse_downloads_with_caching(downloads_paths: List[str]) -> DownloadInfoFromConfig:
    """
    Checks to see if the index files in any of the given paths have changed. If it has, it will re-parse the files
    """
    timestamp = None
    for downloads_path in downloads_paths:
        index_path = os.path.join(downloads_path, "index.yaml")

        assert os.path.exists(
            index_path
        ), f"Downloads index does not exist: {index_path}"
        _timestamp = os.path.getmtime(index_path)

        # find the newest timestamp of all the index files
        if timestamp is None or _timestamp > timestamp:
            timestamp = _timestamp

    # if we have a cache entry and the timestamp of the newest file hasn't changed, return the value
    # from last time
    cache_key = str(downloads_paths)
    cache_entry = _parse_cache.get(cache_key)
    if cache_entry is not None:
        prev_timestamp, prev_value = cache_entry
        if prev_timestamp == timestamp:
            return prev_value
    assert timestamp is not None

    # otherwise, parse all the files and cache the result
    value = _parse_downloads(downloads_paths)
    _parse_cache[cache_key] = (timestamp, value)
    return value


# Used by data loaded to get taiga IDs from downloads so that we can look up and
# store the canonicalized version in each. Unlike the other functions that use
# downloads information, this one doesn't do any caching, however it should only be
# called in one place, so that shouldn't be a problem.
def get_taiga_ids_from_all_downloads():
    taiga_ids = set()

    downloads_paths = current_app.config["DOWNLOADS_PATHS"]  # pyright: ignore
    assert isinstance(downloads_paths, list)
    if len(downloads_paths) == 0:
        downloads_releases = []
    else:
        downloads_releases, _ = _parse_releases(downloads_paths)

    # If we have this config parameter set, then we need to treat this list of releases
    # the same as downloads that we took from the release. See also
    # _get_download_list_for_env_unsafe in download_settings.py. These both need to return a consistent
    # set of releases.
    download_list_for_tests = current_app.config.get("DOWNLOAD_LIST_FOR_TESTS")
    if download_list_for_tests is not None:
        downloads_releases = downloads_releases + download_list_for_tests

    for release in downloads_releases:
        for file in release.all_files:
            if file.original_satisfies_db_taiga_id:
                taiga_ids.add(file.original_satisfies_db_taiga_id)
            if file.original_taiga_id:
                taiga_ids.add(file.original_taiga_id)

    return taiga_ids


# Used in download_settings.py get_download_list and _get_download_list_for_env to load downloads into the portal.
# If this is called directly, it WILL BYPASS ACCESS CONTROLS. For access controls use get_download_list
def parse_downloads_unsafe() -> DownloadInfoFromConfig:
    downloads_paths = current_app.config["DOWNLOADS_PATHS"]  # pyright: ignore
    assert isinstance(downloads_paths, list)
    if len(downloads_paths) == 0:
        return DownloadInfoFromConfig(
            releases=[], display_names_by_taiga_ids={}, release_by_filename={}
        )
    return _parse_downloads_with_caching(downloads_paths)


# These are taiga IDs that are used by tests. Let's just ignore them for purposes of display names
TEST_TAIGA_IDS = {"no-version.1", "has-version.1"}
