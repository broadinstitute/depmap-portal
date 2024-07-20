import os
from tqdm import tqdm


def chunk_iter(seq, length):
    batch = []
    for x in seq:
        batch.append(x)
        if len(batch) >= length:
            yield batch
            batch = []

    if len(batch) > 0:
        yield batch


def estimate_line_count(filename, read_size=500000):
    with open(filename, "rt") as fd:
        sample = fd.read(read_size)
        size = os.path.getsize(filename)
        sampled_line_count = sample.count("\n")
        if size > len(sample):
            return int(sampled_line_count * size / len(sample))
        else:
            return sampled_line_count


class TranslateCRtoNL:
    def __init__(self, file):
        self.file = file

    def write(self, text):
        return self.file.write(text.replace("\r", "\n"))

    def flush(self):
        return self.file.flush()


def progressbar(*args, **kwargs):
    import sys

    defaults = {"mininterval": 5}

    # this is done so that when progress bars appear under jenkins, we can see incremental progress even though jenkins only displays data per line
    if not (hasattr(sys.stderr, "isatty") and sys.stderr.isatty()):
        defaults["file"] = TranslateCRtoNL(sys.stderr)

    defaults.update(kwargs)

    return tqdm(*args, **defaults)
