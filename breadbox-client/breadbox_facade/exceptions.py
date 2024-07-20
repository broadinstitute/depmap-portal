class BreadboxException(Exception):
    def __init__(self, status_code, *args) -> None:
        super().__init__(status_code, *args)
        self.status_code = status_code
