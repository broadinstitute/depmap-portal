import requests
from requests.adapters import HTTPAdapter, Retry
from urllib.parse import urljoin
from .utils import reformat_date
from flask import current_app
import os
import json
from sqlitedict import SqliteDict


class DiscourseClient:
    """The client has two modes:
    1. In refresh mode, data is fetched from Discourse API and stored in a DB cache
    2. In the normal mode, stored data is read directly from the DB cache"""

    def __init__(self, api_key: str, base_url: str, refresh: bool = False):
        self.base_url = base_url
        self.api_key = api_key
        self.refresh = refresh
        self.session = self.__create_session(api_key)
        self.resources_results = current_app.config["RESOURCES_DATA_PATH"]
        self.__create_db_dir_if_needed(self.resources_results)

    def __create_session(self, api_key: str):
        session = requests.Session()
        session.headers.update({"Api-Key": api_key, "Api-Username": "system"})
        retry = Retry(total=5, backoff_factor=2, status_forcelist=[429, 500])
        adapter = HTTPAdapter(max_retries=retry)
        session.mount("https://", adapter)
        return session

    def __create_db_dir_if_needed(self, db_path):
        directory = os.path.dirname(db_path)
        if not os.path.exists(directory):
            os.mkdir(directory)

    def get(self, url, **kwargs):
        try:
            # print("getting ", url)
            r = self.session.get(urljoin(self.base_url, url), **kwargs)
            # Raises HTTPError, if one occurred.
            r.raise_for_status()
            return r.json()
        except requests.exceptions.HTTPError as err:
            raise err
        except requests.exceptions.RequestException as err:
            print("Unexpected error orcurred:\n", err)
            raise err

    def get_category(self, category_id: int):
        url = f"/c/{category_id}/show.json"

        with SqliteDict(self.resources_results) as db:
            if self.refresh:
                res = self.get(url)["category"]
                # Store response results
                db[url] = res
                db.commit()

            data = db[url]
            assert data

        return data

    def get_category_with_subcategories(self, category_slug: str):
        # Given the category slug, filter from list of categories the specific category that matches the slug. NOTE: This is a workaround since GET /c/{id}/show.json does not return subcategory information as far as we know
        url = "/categories.json"
        with SqliteDict(self.resources_results) as db:
            if self.refresh:
                res = self.get(url)
                categories = res["category_list"]["categories"]
                category = next(
                    (c for c in categories if c["slug"] == category_slug), None
                )
                # Store response results
                db[url] = category
                db.commit()

            data = db[url]
            assert data

        return data

    def get_category_topics(self, category_slug: str, category_id: int):
        # Return topics for category sorted by date
        url = f"/c/{category_slug}/{category_id}.json"

        with SqliteDict(self.resources_results) as db:
            if self.refresh:
                res = self.get(url)
                topics = res["topic_list"]["topics"]
                # NOTE: "visible": False means post is unlisted
                # Return only listed and topics not archived
                topics = [
                    topic
                    for topic in topics
                    if (topic["visible"] and not topic["archived"])
                ]

                topics = sorted(
                    topics,
                    key=lambda post: (
                        post["pinned"] is True,
                        reformat_date(post["bumped_at"]),
                    ),
                    reverse=True,
                )
                # Store response results
                db[url] = topics
                db.commit()

            data = db[url]
            assert data
        return data

    def get_topic_main_post(self, topic_id: int):
        url = f"t/{topic_id}/posts.json"

        with SqliteDict(self.resources_results) as db:
            if self.refresh:
                res = self.get(url)
                posts = res["post_stream"]["posts"]
                main_post = posts[0]
                # Store response results
                db[url] = main_post
                db.commit()

            data = db[url]
            assert data
        return data
