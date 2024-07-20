def assert_status_ok(response):
    assert response.status_code >= 200 and response.status_code < 300, response.content


def assert_status_not_ok(response):
    assert not (
        response.status_code >= 200 and response.status_code < 300
    ), response.content


def assert_task_failure(response, status_code=None):
    # make sure getting the task status was successful
    assert_status_ok(response)

    task_status = response.json()
    assert task_status["state"] == "FAILURE"

    if status_code is not None:
        assert task_status["result"]["status_code"] == status_code
