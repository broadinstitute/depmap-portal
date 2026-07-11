from typing import Optional, Tuple
import time
import random
import os
import shutil
from google.cloud import storage


class DoesNotExist(Exception):
    pass


class TempspacePath(str):
    """
    A path string known to have been returned from
    `Tempspace.get_path_if_exists`, as opposed to an arbitrary caller-chosen name.

    This distinction exists to make a real (and previously easy-to-miss) contract explicit:
    `Tempspace.put()` does NOT bucket `dest_name` into the current time interval for you -- it
    writes exactly the path it's given. So calling `tempspace.put(local_file, "myname")` silently
    writes outside of the interval-bucketing scheme entirely, orphaning the file from GC and from
    `get_path_if_exists` lookups. The correct usage is to call `get_path_if_exists(name)` first to
    obtain the current, interval-bucketed `TempspacePath` for `name`, and pass that (unmodified)
    into `put()` if it wasn't found.

    Since a `TempspacePath` is a plain `str` subclass, it can be passed anywhere a `str` is
    expected (formatting, path splitting, storage calls, etc.) -- the wrapper exists purely so
    `Tempspace.put()` can assert its input actually came from `_make_path`, rather than being a
    caller-supplied name.
    """


class ObjStore:
    """
    A contract that Tempspace uses to interact with cloud storage. Created to make easier to mock out
    storage for testing.
    """

    def exists(self, path: TempspacePath) -> bool:
        ...

    def copy(self, src_path: TempspacePath, dst_path: TempspacePath):
        ...

    def get(self, src_path: TempspacePath, dst_local_path: str):
        ...

    def put(self, src_local_path: str, dst_path: TempspacePath):
        ...

    def find_paths_in_range(
        self, start: TempspacePath, end: TempspacePath, limit: int
    ) -> list[TempspacePath]:
        ...

    def delete(self, paths: list[TempspacePath]):
        ...

    def abspath(self, path: TempspacePath) -> str:
        """resolve a TempspacePath to a fully resolved absolute path"""
        ...


class FileObjStore(ObjStore):
    """
    An `ObjStore` implementation backed by the local filesystem, intended for use in tests.
    All paths passed to `ObjStore` methods are relative keys (using "/" separators, as produced
    by `Tempspace._make_path`) which are resolved against `root_dir`.
    """

    def __init__(self, root_dir: str):
        self.root_dir = root_dir

    def abspath(self, path: TempspacePath) -> str:
        # path is always a "/"-separated relative key, regardless of host OS
        return os.path.join(self.root_dir, *path.split("/"))

    def exists(self, path: TempspacePath) -> bool:
        return os.path.isfile(self.abspath(path))

    def copy(self, src_path: TempspacePath, dst_path: TempspacePath):
        full_src = self.abspath(src_path)
        if not os.path.isfile(full_src):
            raise DoesNotExist(src_path)
        full_dst = self.abspath(dst_path)
        os.makedirs(os.path.dirname(full_dst), exist_ok=True)
        shutil.copyfile(full_src, full_dst)

    def get(self, src_path: TempspacePath, dst_local_path: str):
        full_src = self.abspath(src_path)
        if not os.path.isfile(full_src):
            raise DoesNotExist(src_path)
        shutil.copyfile(full_src, dst_local_path)

    def put(self, src_local_path: str, dst_path: TempspacePath):
        full_dst = self.abspath(dst_path)
        os.makedirs(os.path.dirname(full_dst), exist_ok=True)
        shutil.copyfile(src_local_path, full_dst)

    def find_paths_in_range(
        self, start: TempspacePath, end: TempspacePath, limit: int
    ) -> list[TempspacePath]:
        matches = []
        for dirpath, _dirnames, filenames in os.walk(self.root_dir):
            rel_dir = os.path.relpath(dirpath, self.root_dir)
            for filename in filenames:
                rel_path = (
                    filename
                    if rel_dir == "."
                    else f"{rel_dir.replace(os.sep, '/')}/{filename}"
                )
                if start <= rel_path < end:
                    matches.append(TempspacePath(rel_path))
        matches.sort()
        return matches[:limit]

    def delete(self, paths: list[TempspacePath]):
        for path in paths:
            full_path = self.abspath(path)
            if os.path.isfile(full_path):
                os.remove(full_path)


class GCSObjStore(ObjStore):
    """
    An `ObjStore` implementation backed by a Google Cloud Storage bucket. All paths passed to
    `ObjStore` methods are relative keys (using "/" separators, as produced by
    `Tempspace._make_path`) which are resolved to blob names under `prefix`.
    """

    def __init__(self, client: storage.Client, bucket_name: str, prefix: str = ""):
        self.client = client
        self.bucket_name = bucket_name
        self.bucket = self.client.bucket(bucket_name)
        self.prefix = prefix

    def _full_path(self, path: str) -> str:
        return f"{self.prefix}{path}"

    def abspath(self, path: TempspacePath) -> str:
        return f"gs://{self.bucket_name}/{self._full_path(path)}"

    def exists(self, path: TempspacePath) -> bool:
        return self.bucket.blob(self._full_path(path)).exists()

    def copy(self, src_path: TempspacePath, dst_path: TempspacePath):
        src_blob = self.bucket.blob(self._full_path(src_path))
        if not src_blob.exists():
            raise DoesNotExist(src_path)
        self.bucket.copy_blob(src_blob, self.bucket, self._full_path(dst_path))

    def get(self, src_path: TempspacePath, dst_local_path: str):
        src_blob = self.bucket.blob(self._full_path(src_path))
        if not src_blob.exists():
            raise DoesNotExist(src_path)
        src_blob.download_to_filename(dst_local_path)

    def put(self, src_local_path: str, dst_path: TempspacePath):
        self.bucket.blob(self._full_path(dst_path)).upload_from_filename(src_local_path)

    def find_paths_in_range(
        self, start: TempspacePath, end: TempspacePath, limit: int
    ) -> list[TempspacePath]:
        # GCS lists blobs in lexicographic order by name; start_offset/end_offset restrict
        # that ordering to a lexicographic range and max_results caps how many are returned.
        blobs = self.client.list_blobs(
            self.bucket,
            start_offset=self._full_path(start),
            end_offset=self._full_path(end),
            max_results=limit,
        )
        prefix_len = len(self.prefix)
        return [TempspacePath(blob.name[prefix_len:]) for blob in blobs]

    def delete(self, paths: list[TempspacePath]):
        blob_names = [self._full_path(path) for path in paths]
        if blob_names:
            self.bucket.delete_blobs(blob_names)


class Tempspace:
    """
    A class for writing objects to an object store for temporary use. Has
    built in garbage collection that guarentees that objects will persist
    for at least `interval` seconds, but will eventually (as long as puts continue)
    will delete older objects.
    """

    def __init__(
        self,
        storage: ObjStore,
        interval: int,
        clock=lambda: time.time(),
        max_delete_count=50,
    ):
        self.storage = storage
        self.interval = interval
        self.clock = clock
        self.max_delete_count = max_delete_count

    def _get_current_interval_index(self):
        now = self.clock()
        return int(now / self.interval)

    def _make_path(self, interval_index: int, name: str) -> TempspacePath:
        # some sanity checks
        assert "/" not in name
        assert isinstance(interval_index, int)
        interval_index_str = f"{interval_index:07}"
        assert (
            interval_index_str[0] == "0"
        )  # make sure that we haven't overflown our digits
        # since we know the first digit is 0, just drop it
        return TempspacePath(f"{self.interval}/{interval_index_str[1:]}/{name}")

    def get_path_if_exists(self, name: str) -> Tuple[TempspacePath, bool]:
        """
        returns a path which can be used to retreive `name` if there is such a file within this tempspace. (Also updates the file to avoid the file from being GCed)
        """

        interval_index = self._get_current_interval_index()
        current_path = self._make_path(interval_index, name)
        if self.storage.exists(current_path):
            return current_path, True

        # okay, didn't exist at our current path. How about in the previous period?

        previous_path = self._make_path(interval_index - 1, name)
        if self.storage.exists(previous_path):
            # if it's here, then let's copy from the old location (which will eventually get GC'd) to the new location
            try:
                self.storage.copy(previous_path, current_path)
            except DoesNotExist as ex:
                # must have been deleted before the copy could execute, so return None
                return current_path, False
            assert self.storage.exists(current_path)
            return current_path, True

        # return None to signify that it doesn't exist at all
        return current_path, False

    def get(self, src_path: TempspacePath, dest: str):
        """
        copies file from `src_path` (which is a value returned from `get_path_if_exists`) to the local file system path `dest`. However, it's always possible for a file to disappear
        so this will throw `DoesNotExist` if the copy failed because the file no longer exists
        """
        self.storage.get(src_path, dest)

    def put(self, src: str, dest_name: TempspacePath):
        """
        copies from local filesystem path `src` to tempspace as `dest_name` (and potentially triggers gc to clean up old files)

        `dest_name` must be a `TempspacePath` obtained from `get_path_if_exists()` -- it is written
        to storage as-is, with no further interval-bucketing applied. See `TempspacePath`'s docstring
        for why this distinction matters.
        """
        assert isinstance(
            dest_name, TempspacePath
        ), "dest_name must come from get_path_if_exists(), not be an arbitrary caller-chosen name"
        self._ammortized_gc()
        self.storage.put(src, dest_name)

    def _ammortized_gc(self, aggression_factor=10) -> bool:
        """
        Stochastic, incremental trigger for `gc()`, called on every `put()` instead of running a full
        sweep on a fixed schedule. A full `gc()` sweep is usually a no-op (the semispace it targets is
        already empty), so calling it unconditionally on every `put()` would mean paying the cost of
        scanning for stale keys far more often than there's anything to collect. Instead, each `put()`
        independently rolls the dice and only runs `gc()` some fraction of the time, amortizing the
        collection cost across many `put()` calls rather than paying it all at once.

        The trigger probability is tuned so that, in expectation, `gc()` deletes keys `aggression_factor`
        times faster than new keys are added via `put()`. As long as that holds, deletions keep pace with
        writes and total storage stays bounded to roughly two semispaces' worth of data.
        """

        probability_of_running_gc = (1.0 / self.max_delete_count) * aggression_factor

        if random.random() < probability_of_running_gc:
            self.gc()
            return True
        return False

    def gc(self):
        """
        Cleans out any old files
        """
        interval_index = self._get_current_interval_index()

        # find files starting in interval 0
        start_path = self._make_path(0, "")
        # through the start of the previous interval
        end_path = self._make_path(interval_index - 1, "")

        # get all paths in that range, limiting ourselves to max_delete_count so that we're deleting for a bounded
        # amount of time
        paths_to_delete = self.storage.find_paths_in_range(
            start_path, end_path, self.max_delete_count
        )

        # and delete them all
        self.storage.delete(paths_to_delete)

    def abspath(self, path: TempspacePath) -> str:
        return self.storage.abspath(path)
