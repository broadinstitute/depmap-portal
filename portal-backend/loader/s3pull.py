import os
import boto3
import json
import re
from botocore.exceptions import ClientError
import logging

log = logging.getLogger(__name__)


class S3Cache:
    def __init__(self, bucket, key_prefix, cachedir):
        self.bucket = bucket
        self.key_prefix = key_prefix
        self.s3 = boto3.client("s3")
        self.cachedir = cachedir
        self.full_prefix = "s3://{}/{}/".format(bucket, key_prefix)

    def _get_key(self, key):
        return self.key_prefix + "/" + key

    def download_to_cache(self, name):
        "returns filename in cache"

        if name.startswith("s3://"):
            m = re.match("s3://([^/]+)/(.*)", name)
            assert m is not None
            bucket_name = m.group(1)
            assert bucket_name == self.bucket, "bucket %r != %r" % (
                bucket_name,
                self.bucket,
            )
            key = m.group(2)

            cache_key = "{}/{}".format(bucket_name, key)
        else:
            # assert name.startswith(self.full_prefix), "Expected url %r to start with %r" % (
            #     name, self.full_prefix)
            # name = name[len(self.full_prefix):]

            key = self._get_key(name)
            cache_key = key

        # log.debug("Checking s3://{}/{}".format(self.bucket, key))
        try:
            obj = self.s3.get_object(Bucket=self.bucket, Key=key)
        except ClientError as ex:
            raise Exception(
                "Got error {} fetching {}".format(ex.response["Error"]["Code"], key)
            )
        etag = obj["ETag"]

        # check for file in cache
        downloaded = False

        cached_path = os.path.join(self.cachedir, cache_key)
        cached_path_etag = cached_path + ".etag"

        if os.path.exists(cached_path_etag) and etag == open(cached_path_etag).read():
            downloaded = True

        if not downloaded:
            parentdir = os.path.dirname(cached_path)
            if not os.path.exists(parentdir):
                os.makedirs(parentdir)
            log.info(
                "Downloading s3://%s/%s -> %s (%s)", self.bucket, key, cached_path, etag
            )

            if False:  # obj['ContentLength'] > 100000:
                os.system(
                    "gsutil cp s3://{}/{} {}".format(self.bucket, key, cached_path)
                )
            else:
                length = [0]
                import time

                last_print = [time.time()]

                def _callback(*args, **kwargs):
                    length[0] += args[0]
                    now = time.time()
                    if now - last_print[0] > 5:
                        print(
                            "downloaded {}/{} ({}%)".format(
                                length[0],
                                obj["ContentLength"],
                                int(length[0] * 100 / obj["ContentLength"]),
                            )
                        )
                        last_print[0] = now

                self.s3.download_file(self.bucket, key, cached_path, Callback=_callback)
                log.info("Download complete")
                with open(cached_path_etag, "wt") as fd:
                    fd.write(etag)
        else:
            log.info("Already fetched %s/%s -> %s", self.bucket, key, cached_path)

        return cached_path

    def open(self, name, *args, **kwargs):
        return open(self.download_to_cache(name), *args, **kwargs)

    def read_json(self, name):
        with self.open(name, "rt") as fd:
            return json.load(fd)
