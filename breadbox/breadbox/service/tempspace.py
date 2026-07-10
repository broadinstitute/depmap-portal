from typing import Optional, Tuple
import time
import random
import os
import shutil


class DoesNotExist(Exception):
    pass


class ObjStore:
    def exists(self, path: str) -> bool:
        ...

    def copy(self, src_path: str, dst_path: str):
        ...

    def get(self, src_path: str, dst_local_path: str):
        ...

    def put(self, src_local_path: str, dst_path: str):
        ...

    def find_paths_in_range(self, start: str, end: str, limit: int) -> list[str]:
        ...

    def delete(self, paths: list[str]):
        ...


class FileObjStore(ObjStore):
    """
    An `ObjStore` implementation backed by the local filesystem, intended for use in tests.
    All paths passed to `ObjStore` methods are relative keys (using "/" separators, as produced
    by `Tempspace._make_path`) which are resolved against `root_dir`.
    """

    def __init__(self, root_dir: str):
        self.root_dir = root_dir

    def _full_path(self, path: str) -> str:
        # path is always a "/"-separated relative key, regardless of host OS
        return os.path.join(self.root_dir, *path.split("/"))

    def exists(self, path: str) -> bool:
        return os.path.isfile(self._full_path(path))

    def copy(self, src_path: str, dst_path: str):
        full_src = self._full_path(src_path)
        if not os.path.isfile(full_src):
            raise DoesNotExist(src_path)
        full_dst = self._full_path(dst_path)
        os.makedirs(os.path.dirname(full_dst), exist_ok=True)
        shutil.copyfile(full_src, full_dst)

    def get(self, src_path: str, dst_local_path: str):
        full_src = self._full_path(src_path)
        if not os.path.isfile(full_src):
            raise DoesNotExist(src_path)
        shutil.copyfile(full_src, dst_local_path)

    def put(self, src_local_path: str, dst_path: str):
        full_dst = self._full_path(dst_path)
        os.makedirs(os.path.dirname(full_dst), exist_ok=True)
        shutil.copyfile(src_local_path, full_dst)

    def find_paths_in_range(self, start: str, end: str, limit: int) -> list[str]:
        matches = []
        for dirpath, _dirnames, filenames in os.walk(self.root_dir):
            rel_dir = os.path.relpath(dirpath, self.root_dir)
            for filename in filenames:
                rel_path = (
                    filename
                    if rel_dir == "."
                    else f"{rel_dir.replace(os.sep, '/')}/{filename}"
                )
                if start <= rel_path <= end:
                    matches.append(rel_path)
        matches.sort()
        return matches[:limit]

    def delete(self, paths: list[str]):
        for path in paths:
            full_path = self._full_path(path)
            if os.path.isfile(full_path):
                os.remove(full_path)


class Tempspace:
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

    def _make_path(self, interval_index: int, name: str):
        # some sanity checks
        assert "/" not in name
        assert isinstance(interval_index, int)
        interval_index_str = f"{interval_index:07}"
        assert (
            interval_index_str[0] == "0"
        )  # make sure that we haven't overflown our digits
        # since we know the first digit is 0, just drop it
        return f"{self.interval}/{interval_index_str[1:]}/{name}"

    def get_path_if_exists(self, name: str) -> Tuple[str, bool]:
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

    def get(self, src_path: str, dest: str):
        """
        copies file from `src_path` (which is a value returned from `get_path_if_exists`) to the local file system path `dest`. However, it's always possible for a file to disappear
        so this will throw `DoesNotExist` if the copy failed because the file no longer exists
        """
        self.storage.get(src_path, dest)

    def put(self, src: str, dest_name: str):
        """
        copies from local filesystem path `src` to tempspace as `dest_name` (and potentially triggers gc to clean up old files)
        """
        self._ammortized_gc()
        self.storage.put(src, dest_name)

    def _ammortized_gc(self, aggression_factor=10) -> bool:
        """
        This function is intended to be to run frequently (specifically every time we add a file) and act as an "eventually consistent" version of `gc()`. Since GC is always deleting 
        the semispace from two generations ago, it's quite likely that it'll be empty. To save ourselves from calling gc() repeatedly and paying
        the cost of scanning for old keys unnecessarily, this ammortizes the gc process by probabilistically deciding whether to run gc or not. 

        The idea is this saves us from having to schedule a full sweep by doing small sweeps. We run these sweeps at a rate proprotional 
        with the rate that we add to the latest generation by calling this from `put()`. This should generally keep the storage bounded to the size of two semispaces.

        aggression_factor is how much faster we want to delete keys than the target of one delete per add
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
