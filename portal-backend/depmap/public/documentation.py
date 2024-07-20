import re
from dataclasses import dataclass
from typing import List
from depmap.utilities.sign_bucket_url import sign_url
from oauth2client.service_account import ServiceAccountCredentials
from itsdangerous import URLSafeSerializer
from flask import current_app, url_for

BUCKET_STORED_LINK = re.compile("bucket:([^/]+)/(.*)$")
STATIC_LINK = re.compile("static/(.*)")


@dataclass
class DocLink:
    link_label: str
    link: str


@dataclass
class Document:
    text: str  # the description to be shown for this link. ie: "Can I request cell lines that the Broad has used in DepMap?"
    links: List[DocLink]  # str 1 is the link_label, str 2 is the link
    link_show_dmc_warning: bool = False


@dataclass
class Subsection:
    name: str  # The sub-section title (example: "Genetic Perturbation")
    documents: List[Document]  # The list of documents under this sub-section


@dataclass
class Column:
    subsections: List[Subsection]


@dataclass
class Section:
    name: str  # the section title (example: "Analysis")
    columns: List[Column]


def rewrite_documentation_urls(sections):
    credentials = None

    def rewrite(link):
        nonlocal credentials

        if type(link) != str:
            return link

        m = BUCKET_STORED_LINK.match(link)
        if m:
            if credentials is None:
                credentials = ServiceAccountCredentials.from_json_keyfile_name(
                    current_app.config["DOWNLOADS_KEY"]
                )
            bucket_name, key_name = m.groups()

            # Serialize the GCS bucket and key
            secret_key = current_app.config["SECRET_KEY"]  # type: ignore
            serialized_path = URLSafeSerializer(secret_key).dumps(
                [bucket_name, key_name]
            )
            return url_for("public.portal_dmc_url", doclink=serialized_path)

        m = STATIC_LINK.match(link)
        if m:
            return url_for("static", filename=m.groups()[0])

        return link

    def rewrite_links(links: List[DocLink]):
        link_list: List[DocLink] = []
        for docLink in links:
            newDocLink = DocLink(docLink.link_label, rewrite(docLink.link))
            link_list.append(newDocLink)

        return link_list

    def filter_subsection(subsection):
        documents = [
            Document(
                text=document.text,
                links=rewrite_links(document.links),
                link_show_dmc_warning=document.link_show_dmc_warning,
            )
            for document in subsection.documents
        ]
        return Subsection(subsection.name, documents)

    def filter_column(column):
        subsections = [
            filter_subsection(subsection) for subsection in column.subsections
        ]
        # drop any empty subsections
        subsections = [
            subsection for subsection in subsections if len(subsection.documents) > 0
        ]
        return Column(subsections)

    def filter_section(section):
        columns = [filter_column(column) for column in section.columns]
        # drop any empty columns
        columns = [column for column in columns if len(column.subsections) > 0]
        return Section(section.name, columns)

    sections = [filter_section(section) for section in sections]
    # drop any empty sections
    sections = [section for section in sections if len(section.columns) > 0]

    return sections
