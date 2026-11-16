from urllib.parse import urlparse


def assert_test_database(url: str) -> None:
    name = urlparse(url).path.rsplit("/", 1)[-1].split("?", 1)[0]
    if "test" not in name:
        raise RuntimeError(
            f"Refusing to run tests against database {name!r}. "
            "Use a database whose name contains 'test'."
        )
