import pytest
from typing import Dict, Iterator, Tuple, Union, Optional

# test commit. This should trigger build


@pytest.fixture(scope="function")
def mock_gcs(monkeypatch, pytestconfig):
    from google.cloud import storage

    class MockClient:
        def __init__(self, project: str):
            self.project = project
            self._buckets: Dict[str, "MockBucket"] = {}

        @staticmethod
        def from_service_account_json(str) -> "MockClient":
            # Needs to be mocked out. See private_datasets/test_tasks
            raise NotImplementedError

        def bucket(self, bucket_name: str) -> "MockBucket":
            try:
                return self.get_bucket(bucket_name)
            except Exception:
                return MockBucket(self, bucket_name)

        def create_bucket(
            self, bucket_or_name: Union["MockBucket", str]
        ) -> "MockBucket":
            if isinstance(bucket_or_name, MockBucket):
                if (
                    bucket_or_name.client is not None
                    and bucket_or_name.client is not self
                ):
                    raise Exception("Bucket has a different client")

                self._buckets[bucket_or_name.name] = bucket_or_name
                bucket_or_name.client = self
                return bucket_or_name
            else:
                new_bucket = self.bucket(bucket_or_name)
                self._buckets[bucket_or_name] = new_bucket
                return new_bucket

        def get_bucket(self, bucket_name: str) -> "MockBucket":
            if bucket_name is None:
                raise ValueError("Cannot determine path without bucket name.")

            if bucket_name in self._buckets:
                return self._buckets[bucket_name]
            raise Exception(
                "You do not have storage.buckets.get access to {}".format(bucket_name)
            )

        def list_buckets(self) -> Iterator["MockBucket"]:
            return iter(self._buckets.values())

        def list_blobs(
            self, bucket_or_name: Union["MockBucket", str]
        ) -> Iterator["MockBlob"]:
            if isinstance(bucket_or_name, MockBucket):
                bucket_name = bucket_or_name.name
            else:
                bucket_name = bucket_or_name
            return self.get_bucket(bucket_name).list_blobs()

    class MockBucket:
        def __init__(self, client: MockClient, name: str = None):
            self.client = client
            self.name: str = name
            self._blobs: Dict[str, "MockBlob"] = {}

        def __repr__(self):
            return "<MockBucket: {}>".format(self.name)

        def blob(self, blob_name: str):
            try:
                return self.get_blob(blob_name)
            except Exception:
                return MockBlob(blob_name, self)

        def get_blob(self, blob_name: str) -> "MockBlob":
            if blob_name is None:
                raise ValueError("None could not be converted to unicode")

            if blob_name in self._blobs:
                return self._blobs[blob_name]
            raise Exception(
                "You do not have storage.buckets.get access to {}".format(blob_name)
            )

        def list_blobs(self) -> Iterator["MockBlob"]:
            return iter(self._blobs.values())

        def exists(self) -> bool:
            if self.client is None:
                raise Exception("Client is None")

            return self.client.get_bucket(self.name) is not None

    class MockBlob:
        def __init__(self, name: str, bucket: MockBucket):
            self.name = name
            self.bucket = bucket
            self._content: bytes = None

        def __repr__(self):
            return "<MockBlob: {}, {}>".format(self.name, self.bucket.name)

        @property
        def client(self) -> MockClient:
            return self.bucket.client

        @staticmethod
        def from_string(uri: str, client: MockClient = None) -> "MockBlob":
            bucket_name, blob_name = parse_blob_uri(uri)
            if client is not None:
                bucket = client.get_bucket(bucket_name)

                return bucket.get_blob(blob_name)

            new_bucket = MockBucket(client, bucket_name)
            new_blob = MockBlob(blob_name, new_bucket)
            return new_blob

        def exists(self) -> bool:
            if self.client is None:
                raise Exception("Client is None")

            try:
                self.bucket.get_blob(self.name)
                return True
            except Exception:
                return False

        def upload_from_file(self, fileobj, content_type: Optional[str] = None):
            self.upload_from_string(fileobj.read(), content_type=content_type)

        def upload_from_string(
            self, data: Union[bytes, str], content_type: str = "text/plain"
        ):
            if self.bucket is None:
                raise Exception("Bucket is None")
            if self.client is None:
                raise Exception("Client is None")
            if self.name is None:
                raise Exception("Name is None")

            if not self.exists():
                self.bucket._blobs[self.name] = self

            if isinstance(data, bytes):
                self._content = data
            else:
                self._content = data.encode()

        def download_as_string(self) -> bytes:
            if self.bucket is None:
                raise Exception("Bucket is None")
            if self.client is None:
                raise Exception("Client is None")
            if not self.exists():
                raise Exception("Blob does not exist")

            return self._content

        def delete(self):
            if not self.exists():
                raise Exception("Blob does not exist")

            del self.bucket._blobs[self.name]

    monkeypatch.setattr(storage, "Client", MockClient)
    monkeypatch.setattr(storage, "Bucket", MockBucket)
    monkeypatch.setattr(storage, "Blob", MockBlob)


def parse_blob_uri(uri: str) -> Tuple[str, str]:
    stripped_path = uri.split("//")[1]
    bucket_name, blob_name = stripped_path.split("/", maxsplit=1)
    return bucket_name, blob_name
