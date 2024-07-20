from flask import current_app, url_for
from depmap.settings.download_settings import get_download_list

"""
This file just contains code that is written for the sake of the interactive module
Download views does not use this code
"""


def get_download_url(taiga_id, endpoint="download.view_all"):
    """
    Utility function for linking to datasets to downloads
    Used by
        interactive
        cell line page
        compound page availability tile
    :param taiga_id: taiga id. this should be canonical, e.g.
            dataset as stored in the database
            data_access.get_dataset_taiga_id(dataset_id)
            DownloadFile.taiga_id
    """
    taiga_id_to_download_url = __get_taiga_id_to_download_url(endpoint)

    if taiga_id in taiga_id_to_download_url:
        return taiga_id_to_download_url[taiga_id]
    else:
        return None


def __get_taiga_id_to_download_url(endpoint="download.view_all"):
    """
    Cached function for get_download_url
    Cached on current app, since it has dependencies on current app
    Hashes by satisfies_db_taiga_id if available
    """
    taiga_id_to_download_url = getattr(
        current_app, "_depmap_taiga_id_to_download_url", None
    )

    if taiga_id_to_download_url is None:
        downloads = get_download_list()
        # this lookup feels lame because at worst we're looking through everything
        # but if we just accept it, it works, it's a finite set of downloads, and we only execute this method once because the result is caches
        taiga_id_to_download_url = {}
        for release in downloads:
            for file in release.all_files:
                taiga_id = (
                    file.satisfies_db_taiga_id
                    if file.satisfies_db_taiga_id is not None
                    else file.taiga_id
                )
                if taiga_id is not None:
                    taiga_id_to_download_url[taiga_id] = url_for(
                        endpoint, release=release.name, file=file.name
                    )

        taiga_id_to_download_url = (
            current_app._depmap_taiga_id_to_download_url
        ) = taiga_id_to_download_url

    return taiga_id_to_download_url
