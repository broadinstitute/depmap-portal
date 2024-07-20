def mock_fetch_staff_topics(url, discourse_api_key):
    return {
        "topic_list": {"topics": [{"id": 0, "title": "This is Test Topic 1",},],},
    }


def mock_fetch_posts(topic_id, forum_url, api_key):
    return {
        "post_stream": {
            "posts": [
                {
                    "cooked": '<p>This is a test</p><img src="https://global.discourse-cdn.com/standard17/uploads/depmap/original/2X/1/1b1168762676d6e30fc9085027b203d2bae5b3da.png" alt="test_random_image" data-base62-sha1="3RsbFLbkR10D0nJDSTtb4NUe35E" width="690" height="308" data-dominant-color="E1E1E1"><a class="attachment" href="/uploads/short-url/d2aiJhyIx7jzI9zgtPlPJerd0PT.rtf">test_random_non_image.rtf</a> (389 Bytes)<br><a class="attachment" href="/uploads/short-url/6U1tVf3P9J4sPgwcpU4a6aML2Ne.pdf">test_random_non_image_pdf.pdf</a> (13.9 KB)</p>'
                }
            ]
        }
    }
