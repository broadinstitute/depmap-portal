from depmap.public.documentation import (
    DocLink,
    Column,
    Section,
    Subsection,
    Document,
)
from typing import List
from tests.depmap.public import mock_discourse_api_responses
from depmap.public import fetch_forum_resources
from depmap.public.fetch_forum_resources import (
    Post,
    Topic,
    _rewrite_html_with_converted_relative_urls,
    pull_resource_topics_from_forum,
)

from depmap.public.parse_resources import parse_resources_file


# Test for documentation_prototype
def test_rewrite_html_with_converted_short_urls():
    input_short_url1 = "/uploads/short-url/d2aiJhyIx7jzI9zgtPlPJerd0PT.rtf"
    expected_long_url1 = (
        "https://forum.depmap.org/uploads/short-url/d2aiJhyIx7jzI9zgtPlPJerd0PT.rtf"
    )

    input_html = f'<a class="attachment" href="{input_short_url1}">test_random_non_image_pdf.pdf</a> (13.9 KB)'
    expected_output_html = f'<a class="attachment" href="{expected_long_url1}">test_random_non_image_pdf.pdf</a> (13.9 KB)'

    html_with_absolute_urls = _rewrite_html_with_converted_relative_urls(
        "forum.depmap.org", input_html
    )

    assert html_with_absolute_urls == expected_output_html

    input_html = '<a href="depmap.org/portal">test</a>'
    expect_no_change_html = _rewrite_html_with_converted_relative_urls(
        "forum.depmap.org", input_html
    )

    assert input_html == expect_no_change_html


# Test for documentation_prototype
def test_pull_resource_topics_from_forum(monkeypatch):

    monkeypatch.setattr(
        fetch_forum_resources,
        "fetch_staff_topics",
        mock_discourse_api_responses.mock_fetch_staff_topics,
    )

    monkeypatch.setattr(
        fetch_forum_resources,
        "fetch_posts",
        mock_discourse_api_responses.mock_fetch_posts,
    )

    mock_discourse_api_key = "abcde"
    forum_resources = pull_resource_topics_from_forum(mock_discourse_api_key)

    expected_forum_resources = [
        Topic(
            topic_title="This is Test Topic 1",
            posts=[
                Post(
                    html='<p>This is a test</p><img height="308" src="https://global.discourse-cdn.com/standard17/uploads/depmap/original/2X/1/1b1168762676d6e30fc9085027b203d2bae5b3da.png" width="690"/><a href="https://forum.depmap.org/uploads/short-url/d2aiJhyIx7jzI9zgtPlPJerd0PT.rtf">test_random_non_image.rtf</a> (389 Bytes)<br/><a href="https://forum.depmap.org/uploads/short-url/6U1tVf3P9J4sPgwcpU4a6aML2Ne.pdf">test_random_non_image_pdf.pdf</a> (13.9 KB)'
                )
            ],
        ),
    ]

    assert forum_resources == expected_forum_resources


def assert_no_empties(sections: List[Section]):
    # make sure we never end up with a parent with no children
    for section in sections:
        assert len(section.columns) > 0
        for column in section.columns:
            assert len(column.subsections) > 0
            for subsection in column.subsections:
                assert len(subsection.documents) > 0


def test_parse_resources_file(
    file_path="tests/depmap/public/test_documentation_file.yaml",
):
    resources = parse_resources_file(file_path)
    assert_no_empties(resources)

    # What is DepMap
    c11 = Column(
        subsections=[
            Subsection(
                name="",
                documents=[
                    Document(
                        text="DMC Portal Introduction 2020 Part 1 (26 mins)",
                        links=[
                            DocLink(
                                "Video",
                                "bucket:dmc-portal-files/DMC2020/DMC Portal Introduction Part 1.mp4",
                            )
                        ],
                    ),
                ],
            )
        ]
    )

    c12 = Column(
        subsections=[
            Subsection(
                name="",
                documents=[
                    Document(
                        text="Portal Walkthrough 2019 (24 mins)",
                        links=[
                            DocLink(
                                "Video",
                                "https://dmc.depmap.org/portal/download/api/download/dmc?file_name=dmc-resources%2Fdmc-portal-101.mp4",
                            )
                        ],
                    ),
                ],
            )
        ]
    )

    c13 = Column(
        subsections=[
            Subsection(
                name="",
                documents=[
                    Document(
                        text="User created DepMap tutorial (11 mins)",
                        links=[DocLink("Video", "https://youtu.be/1knIFBXY9g0")],
                    ),
                ],
            )
        ]
    )

    expected_resources = [Section(name="What is DepMap?", columns=[c11, c12, c13])]

    for i, expected_r in enumerate(expected_resources):
        assert expected_r.name == resources[i].name
        for j, column in enumerate(expected_r.columns):
            assert len(column.subsections) == len(resources[i].columns[j].subsections)
            for k, subsection in enumerate(expected_r.columns[j].subsections):
                assert subsection.name == expected_r.columns[j].subsections[k].name
                for l, document in enumerate(
                    expected_r.columns[j].subsections[k].documents
                ):
                    assert (
                        document.text
                        == expected_r.columns[j].subsections[k].documents[l].text
                    )
                    for m, link in enumerate(
                        expected_r.columns[j].subsections[k].documents[l].links
                    ):
                        assert (
                            link.link
                            == expected_r.columns[j]
                            .subsections[k]
                            .documents[l]
                            .links[m]
                            .link
                        )
                        assert (
                            link.link_label
                            == expected_r.columns[j]
                            .subsections[k]
                            .documents[l]
                            .links[m]
                            .link_label
                        )
