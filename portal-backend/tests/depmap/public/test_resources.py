from depmap.public.resources import expand_forum_relative_urls, add_forum_link_to_html


def test_expand_forum_relative_urls():
    input_short_url1 = "/uploads/short-url/d2aiJhyIx7jzI9zgtPlPJerd0PT.rtf"
    expected_long_url1 = (
        "https://forum.depmap.org/uploads/short-url/d2aiJhyIx7jzI9zgtPlPJerd0PT.rtf"
    )

    input_html = f'<a class="attachment" href="{input_short_url1}">test_random_non_image_pdf.pdf</a> (13.9 KB)'
    expected_output_html = f'<a class="attachment" href="{expected_long_url1}">test_random_non_image_pdf.pdf</a> (13.9 KB)'

    html_with_absolute_urls = expand_forum_relative_urls(
        "https://forum.depmap.org", input_html
    )

    assert html_with_absolute_urls == expected_output_html

    input_html = '<a href="depmap.org/portal">test</a>'
    expect_no_change_html = expand_forum_relative_urls(
        "https://forum.depmap.org", input_html
    )

    assert input_html == expect_no_change_html


def test_add_forum_link_to_html():
    html = f"<p>Test</p>"
    added_forum_link_to_html = add_forum_link_to_html(
        "https://forum.depmap.org", 1, "topic-slug", html
    )
    assert 'href="https://forum.depmap.org/t/topic-slug/1"' in added_forum_link_to_html
    assert "</p><p><a" in added_forum_link_to_html
    assert added_forum_link_to_html.endswith("</a></p>")
