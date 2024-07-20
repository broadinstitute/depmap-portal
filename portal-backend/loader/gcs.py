import os
from google.cloud import storage
import json
import re
import logging

log = logging.getLogger(__name__)


class GCSCache:
    def __init__(self, bucket, key_prefix, cachedir):
        self.bucket = bucket
        self.key_prefix = key_prefix
        self.gcs = storage.Client()
        self.cachedir = cachedir
        self.full_prefix = "gs://{}/{}/".format(bucket, key_prefix)

    def _get_key(self, key):
        return self.key_prefix + "/" + key

    def download_to_cache(self, name):
        "returns filename in cache"

        if name.startswith("gs://"):
            m = re.match("gs://([^/]+)/(.*)", name)
            assert m is not None
            bucket_name = m.group(1)
            assert bucket_name == self.bucket, "bucket %r != %r" % (
                bucket_name,
                self.bucket,
            )
            key = m.group(2)

            cache_key = "{}/{}".format(bucket_name, key)
        else:
            key = self._get_key(name)
            cache_key = key
        bucket = self.gcs.bucket(self.bucket)
        blob = bucket.blob(key)

        # check for file in cache
        downloaded = False
        cached_path = os.path.join(self.cachedir, cache_key)
        if os.path.exists(cached_path):
            downloaded = True

        if not downloaded:
            destination_directory = os.path.dirname(cached_path)
            if not os.path.exists(destination_directory):
                os.makedirs(destination_directory)
            blob.download_to_filename(cached_path)
            log.info(
                "Download complete in gs://%s/%s (%s)", self.bucket, key, cached_path
            )
        else:
            log.info("Already fetched gs://%s/%s -> %s", self.bucket, key, cached_path)

        return cached_path

    def open(self, name, *args, **kwargs):
        return open(self.download_to_cache(name), *args, **kwargs)

    def read_json(self, name):
        with self.open(name, "rt") as fd:
            return json.load(fd)
