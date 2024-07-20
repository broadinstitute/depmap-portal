import json


def parse_resp(r):
    assert r.status_code == 200, r.status_code
    return json.loads(r.data.decode("utf8"))
