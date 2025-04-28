from depmap.download.models import DownloadRelease
from typing import List, cast

from flask import current_app
from depmap.access_control import get_visible_owner_id_configs
from depmap.settings.parse_downloads import (
    get_dev_downloads,
    parse_downloads_unsafe,
)
from depmap.extensions import in_memory_cache

# All access to download files _must_ pass through this method. Bypassing this will result in
# bypassing access control checks!
def get_download_list() -> List[DownloadRelease]:
    download_releases: List[DownloadRelease] = _get_download_list_for_env_unsafe()

    # now these releases may include things that the current user is not allowed to see, so filter the list
    owner_ids = set(get_visible_owner_id_configs().keys())

    # TODO: not sure what an access controlled release would be? I assume I don't need to worry about this?
    releases: List[DownloadRelease] = [
        release for release in download_releases if release.owner_id in owner_ids
    ]

    return releases


@in_memory_cache.memoize(timeout=0)
def _get_download_list_for_env_unsafe() -> List[DownloadRelease]:
    if current_app.config["ENV"] == "test":
        # if we're in a test config, check if our app config has a hardcoded list, use that. This is only intended for making it
        # easier for tests to override the download list
        f = cast(
            List[DownloadRelease], current_app.config.get("DOWNLOAD_LIST_FOR_TESTS")
        )
    else:
        f = parse_downloads_unsafe().releases

        if current_app.config["ENV"] == "dev":
            f = f + get_dev_downloads(
                current_app.config["DEV_DOWNLOADS_PATH"], "dev_only_downloads"
            )  # always show these in dev

            # if taiga is available, we want to simulate datasets without downloads (so they can link directly to taiga)
            # if it is not, the code expects all datasets to have downloads
            if not current_app.config["SHOW_TAIGA_IN_DOWNLOADS"]:
                f = f + get_dev_downloads(
                    current_app.config["DEV_DOWNLOADS_PATH"],
                    "dev_only_no_taiga_downloads",
                )
    return f
