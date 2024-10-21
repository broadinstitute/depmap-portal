from typing import List, Optional
from dataclasses import dataclass
from ..discourse.client import DiscourseClient
from ..discourse.utils import reformat_date
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import html_sanitizer
from html_sanitizer import Sanitizer
import os


@dataclass
class Topic:
    id: int
    slug: str  # topic slug is used as identifier to route to specific post on resources prototype
    title: str
    post_content: str  # first post
    creation_date: str
    update_date: str


@dataclass
class Subcategory:
    id: int
    slug: str
    title: str
    topics: List[Topic]


@dataclass
class RootCategory:
    title: str
    subcategories: List[Subcategory]
    default_topic: Optional[Topic] = None


def create_sanitizer() -> Sanitizer:
    new_settings = dict(html_sanitizer.sanitizer.DEFAULT_SETTINGS)
    new_settings["tags"].add("div")
    new_settings["tags"].add("img")
    new_settings["tags"].add("table")
    new_settings["tags"].add("thead")
    new_settings["tags"].add("tr")
    new_settings["tags"].add("th")
    new_settings["tags"].add("td")
    new_settings["tags"].add("tbody")
    new_settings["tags"].add("code")
    new_settings["tags"].add("blockquote")

    new_settings["empty"].add("img")
    new_settings["attributes"].update(
        {"img": ("src", "width", "height"), "code": ["class"], "div": ["class"]}
    )

    return Sanitizer(settings=new_settings)


# The discourse api returns non-image attachments with ONLY relative urls.
# Example: /uploads/short-url/random_letters_and_numbers.pdf
# This function adds a prefix equal to the url of the relevant forum (DMC vs public).
def expand_forum_relative_urls(forum_url: str, html: str):
    # html.parser must be used to avoid automatically adding <html> and <body>
    # tags to the post html
    soup = BeautifulSoup(str(html), features="html.parser")
    for a in soup.findAll("a", href=True):
        if str(a["href"]).startswith("/"):
            short_link = str(a["href"])
            a["href"] = urljoin(forum_url, short_link)
        # add attribute to open links in new tab
        a["target"] = "_blank"
    return str(soup)


def add_forum_link_to_html(
    forum_url: str, topic_id: int, topic_slug: str, topic_html: str
):
    soup = BeautifulSoup(str(topic_html), features="html.parser")
    link_p = soup.new_tag("p")
    link_tag = soup.new_tag("a")
    link_tag.attrs.update(
        {
            "href": urljoin(forum_url, f"/t/{topic_slug}/{topic_id}"),
            "target": "_blank",
            "style": "float:right; padding-top: 50px; padding-bottom: 20px; font-weight: bold",
        }
    )
    link_tag.string = "View Post in Forum"
    link_p.append(link_tag)
    last_element = soup.find_all()[-1]
    last_element.insert_after(link_p)
    return str(soup)


def remove_img_link(topic_html: str):
    soup = BeautifulSoup(str(topic_html), features="html.parser")
    img_divs = soup.find_all("div", class_="lightbox-wrapper")
    for img_div in img_divs:
        img_link_div = img_div.find("div", class_="meta")
        if img_link_div:
            img_link_div.decompose()

    return str(soup)


def modify_html(
    sanitizer: Sanitizer,
    topic_id: int,
    topic_slug: str,
    topic_html: str,
    forum_url: str,
):
    sanitized_html = sanitizer.sanitize(topic_html)
    modified_urls_html = expand_forum_relative_urls(forum_url, sanitized_html)
    added_forum_link_html = add_forum_link_to_html(
        forum_url, topic_id, topic_slug, modified_urls_html
    )
    img_links_removed_html = remove_img_link(added_forum_link_html)
    return img_links_removed_html


def get_root_category_subcategory_topics(
    client: DiscourseClient,
    sanitizer: Sanitizer,
    category_slug: str,
    default_topic_id: Optional[int],
):
    # Get the root category
    category = client.get_category_with_subcategories(category_slug)
    # Category can be None if given slug isn't found in list of categories
    # NOTE: It would have been nice to use get single category instead of list of categories that is then filtered but the response to get single category doesn't include subcategory info
    # NOTE: Subcategory ids are returned in the order they are set to in Discourse settings
    if category is None:
        return None
    root_category = RootCategory(category["name"], [])
    # For each subcategory id, get its category info and their topics
    for sub_id in category["subcategory_ids"]:
        subcategory = client.get_category(sub_id)
        assert subcategory is not None
        # Create Subcategory object
        sub_category = Subcategory(sub_id, subcategory["slug"], subcategory["name"], [])
        subcategory_topics = client.get_category_topics(subcategory["slug"], sub_id)
        for sub_topic in subcategory_topics:
            topic_main_post = client.get_topic_main_post(sub_topic["id"])
            # A lot of random tags and attributes come along for the ride in the "cooked" field, so sanitize this.
            post_html = topic_main_post["cooked"]
            topic_id = topic_main_post["topic_id"]
            topic_slug = sub_topic["slug"]
            modified_html = modify_html(
                sanitizer, topic_id, topic_slug, post_html, client.base_url
            )
            creation_date = reformat_date(topic_main_post["created_at"]).strftime(
                "%d %b %Y %I:%M%p"
            )
            update_date = reformat_date(topic_main_post["updated_at"]).strftime(
                "%d %b %Y %I:%M%p"
            )

            topic = Topic(
                topic_id,
                topic_slug,
                sub_topic["title"],
                modified_html,
                creation_date=creation_date,
                update_date=update_date,
            )
            if default_topic_id == topic_id:
                root_category.default_topic = topic

            # Add Topic to list of topics for Subcategory
            sub_category.topics.append(topic)
        # Append subcategory with topics to root category's list of subcategories
        root_category.subcategories.append(sub_category)
    return root_category


def refresh_all_category_topics(client: DiscourseClient, category_slug: str):
    assert client.reload, "Client must be in refresh mode"
    # Get the root category
    print("Fetching categories")
    category = client.get_category_with_subcategories(category_slug)
    # Category can be None if given slug isn't found in list of categories
    assert category
    # NOTE: It would have been nice to use get single category instead of list of categories that is then filtered but the response to get single category doesn't include subcategory info
    # NOTE: Subcategory ids are returned in the order they are set to in Discourse settings

    # For each subcategory id, get its category info and their topics
    for sub_id in category["subcategory_ids"]:
        print(f"Fetching subcategory {sub_id}")
        subcategory = client.get_category(sub_id)
        assert subcategory is not None
        print("Fetching topics")
        subcategory_topics = client.get_category_topics(subcategory["slug"], sub_id)
        for sub_topic in subcategory_topics:
            client.get_topic_main_post(sub_topic["id"])

    print(f"Successful in fetching all topics for {category_slug}!")


def read_forum_api_key(forum_api_key_value: str):
    if os.path.isfile(
        forum_api_key_value
    ):  # Presumably value is filepath in dev config only
        with open(forum_api_key_value) as fp:
            discourse_api_key = fp.read()
    else:
        discourse_api_key = forum_api_key_value
    return discourse_api_key
