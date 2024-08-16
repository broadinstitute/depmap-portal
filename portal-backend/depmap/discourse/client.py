import requests
from requests.adapters import HTTPAdapter, Retry
from urllib.parse import urljoin
from .utils import reformat_date


class DiscourseClient:
    def __init__(self, api_key: str, base_url: str):
        self.base_url = base_url
        self.api_key = api_key
        self.session = requests.Session()
        self.session.headers.update({"Api-Key": api_key, "Api-Username": "system"})
        retry = Retry(total=5, backoff_factor=2, status_forcelist=[429, 500])
        adapter = HTTPAdapter(max_retries=retry)
        self.session.mount("https://", adapter)

    def get(self, url, **kwargs):
        try:
            # print("getting ", url)
            r = self.session.get(urljoin(self.base_url, url), **kwargs)
            # Raises HTTPError, if one occurred.
            r.raise_for_status()
            return r
        except requests.exceptions.HTTPError as err:
            raise err
        except requests.exceptions.RequestException as err:
            print("Unexpected error orcurred:\n", err)
            raise err

    def get_category(self, category_id: int):
        res = self.get(f"/c/{category_id}/show.json")
        return res.json()["category"]

    def get_category_with_subcategories(self, category_slug: str):
        # Given the category slug, filter from list of categories the specific category that matches the slug. NOTE: This is a workaround since GET /c/{id}/show.json does not return subcategory information as far as we know
        res = self.get("/categories.json")
        categories = res.json()["category_list"]["categories"]
        category = next((c for c in categories if c["slug"] == category_slug), None)
        return category

    def get_category_topics(self, category_slug: str, category_id: int):
        # Return topics for category sorted by date
        res = self.get(f"/c/{category_slug}/{category_id}.json")
        topics = res.json()["topic_list"]["topics"]
        # NOTE: "visible": False means post is unlisted
        # Return only listed and topics not archived
        topics = [
            topic for topic in topics if (topic["visible"] and not topic["archived"])
        ]

        topics = sorted(
            topics,
            key=lambda post: (
                post["pinned"] is True,
                reformat_date(post["bumped_at"]),
            ),
            reverse=True,
        )
        return topics

    def get_topic_main_post(self, topic_id: int):
        res = self.get(f"t/{topic_id}/posts.json")
        posts = res.json()["post_stream"]["posts"]
        return posts[0]
