from typing import List
from dataclasses import dataclass

import requests
import html_sanitizer
from html_sanitizer import Sanitizer
from urllib.parse import urljoin


@dataclass
class Post:
    html: str


@dataclass
class Topic:
    topic_title: str
    posts: List[Post]


# The discourse api returns non-image attachments with ONLY relative urls.
# Example: /uploads/short-url/random_letters_and_numbers.pdf
# This function adds a prefix equal to the url of the relevant forum (DMC vs public).
def _rewrite_html_with_converted_relative_urls(forum_url: str, html: str):
    from bs4 import BeautifulSoup

    # html.parser must be used to avoid automatically adding <html> and <body>
    # tags to the post html
    soup = BeautifulSoup(str(html), features="html.parser")
    for a in soup.findAll("a", href=True):
        if str(a["href"]).startswith("/"):
            short_link = str(a["href"])
            a["href"] = f"https://{forum_url}{short_link}"

    return str(soup)


def _get(url, headers=None, data=None):
    resp = requests.get(url, headers=headers, data=data)

    return resp


def fetch_staff_topics(forum_url, api_key):
    headers = {}
    if api_key:
        headers.update({"Api-Key": api_key, "Api-Username": "system"})

    # TODO: The url used for this get will probably need to change for the final product depending on what
    # topic we define as the portal resources page topic.
    resp = _get(f"https://{forum_url}/c/staff/3.json", headers=headers)
    data = resp.json()

    return data


def fetch_posts(topic_id, forum_url, api_key):
    headers = {}
    if api_key:
        headers.update({"Api-Key": api_key, "Api-Username": "system"})

    resp = _get(f"https://{forum_url}/t/{topic_id}/posts.json", headers=headers)
    data = resp.json()

    return data


def pull_resource_topics_from_forum(discourse_api_key: str) -> List[Topic]:
    url = "forum.depmap.org"
    # Allow img tags
    new_settings = dict(html_sanitizer.sanitizer.DEFAULT_SETTINGS)
    new_settings["tags"].add("img")
    new_settings["empty"].add("img")
    new_settings["attributes"].update({"img": ("src", "width", "height")})

    sanitizer = Sanitizer(settings=new_settings)

    # TODO: Once we move beyond a prototype, we'll need to figure out for sure what topic will
    # be use for the portal resources page. For this prototype, I just use the public forum's Staff topic.
    topics_data = fetch_staff_topics(url, discourse_api_key)
    topics = topics_data["topic_list"]["topics"]

    topic_objs = []
    for topic in topics:
        topic_title = topic["title"]

        posts_resp = fetch_posts(topic["id"], url, discourse_api_key)
        posts = posts_resp["post_stream"]["posts"]

        post_objs = []
        for post in posts:
            # TODO: If posts length is more than 1, the 0th index holds the initial post, and the
            # subsequent indexes hold the replies. Currently, in this prototype, there is nothing visually
            # differentiating the initial post from the replies. We will need to consider what this
            # should look like during the design phase of this project.
            post_html = post["cooked"]

            # A lot of random tags and attributes come along for the ride in the "cooked" field, so santizie this.
            sanitized_html = sanitizer.sanitize(post_html)

            html_full_urls = _rewrite_html_with_converted_relative_urls(
                url, sanitized_html
            )

            post_objs.append(Post(html=html_full_urls))

        topic_objs.append(Topic(topic_title=topic_title, posts=post_objs))

    return topic_objs
