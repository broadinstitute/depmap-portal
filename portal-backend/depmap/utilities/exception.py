class InvalidDatasetEnumError(Exception):
    pass


class InvalidEntityTypeError(Exception):
    pass


class MatrixConversionException(Exception):
    pass


class DownloadHeadlinersException(Exception):
    pass


class UserError(Exception):
    """
    Used, typically in long-running celery tasks, to indicate that the user provided input that was in some ways invalid.
    These errors should catch specific expected situations,
        and be thrown with a message that will be displayed with a specific message to the user to correct their input
    """

    pass


class CeleryException(Exception):
    pass


class ApiNodeNotFound(Exception):
    pass


class AllRowsOrColsSkipped(Exception):
    # this isn't caught anywhere, but is useful error reporting to throw
    pass


class InteractiveDatasetNotFound(Exception):
    pass


class CustomDatasetsNotEnabled(Exception):
    pass


class FileTooLarge(Exception):
    def __init__(self, file_size, max_size):
        self.file_size = file_size
        self.max_size = max_size
