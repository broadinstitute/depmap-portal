from fastapi.testclient import TestClient


def test_user_settings(client: TestClient, settings):
    user1_headers = {"X-Forwarded-User": "joe"}
    user2_headers = {"X-Forwarded-User": "mar"}

    # make sure we handle missing settings
    response = client.get("/user/settings", headers=user1_headers)
    assert response.status_code == 200
    assert {} == response.json()

    # make sure storing and getting results in same value
    value = {"name": "Joe", "age": 23, "contexts": [1, 2, 3]}
    response = client.post("/user/settings", json=value, headers=user1_headers)
    assert response.status_code == 200
    assert value == response.json()

    response = client.get("/user/settings", headers=user1_headers)
    assert response.status_code == 200
    assert value == response.json()

    # make sure storing a different value results in a different key
    value2 = {"name": "Joe", "age": 100, "contexts": [1, 2, 3]}
    response = client.post("/user/settings", json=value2, headers=user1_headers)
    assert response.status_code == 200
    assert value2 == response.json()

    # now write as a different user and confirm those changes don't affect the first user
    response = client.get("/user/settings", headers=user2_headers)
    assert response.status_code == 200
    assert {} == response.json()

    user2_value = {"name": "Martha"}
    response = client.post("/user/settings", json=user2_value, headers=user2_headers)
    assert response.status_code == 200
    assert user2_value == response.json()

    # and check the original user
    response = client.get("/user/settings", headers=user1_headers)
    assert response.status_code == 200
    assert value2 == response.json()
