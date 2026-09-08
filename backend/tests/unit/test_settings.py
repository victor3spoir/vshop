"""Unit: environment-driven configuration behavior."""

from settings import Environment, Settings


def make(env_value: str | None) -> Settings:
    kwargs = {} if env_value is None else {"python_env": env_value}
    # _env_file=None isolates tests from the developer's local .env file.
    return Settings(_env_file=None, **kwargs)


class TestEnvironmentFallback:
    def test_default_is_production(self):
        assert make(None).python_env is Environment.PRODUCTION

    def test_empty_value_falls_back_to_production(self):
        assert make("").python_env is Environment.PRODUCTION

    def test_unknown_value_falls_back_to_production(self):
        assert make("staging").python_env is Environment.PRODUCTION

    def test_case_insensitive(self):
        assert make("DEVELOPMENT").python_env is Environment.DEVELOPMENT


class TestDocsExposure:
    def test_production_disables_all_docs(self):
        s = make("production")
        assert s.docs_url is None
        assert s.redoc_url is None
        assert s.openapi_url is None

    def test_development_enables_docs(self):
        s = make("development")
        assert s.docs_url == "/docs"
        assert s.redoc_url == "/redoc"
        assert s.openapi_url == "/openapi.json"


class TestSecrets:
    def test_db_password_never_leaks_in_repr(self):
        s = Settings(_env_file=None, db_password="hunter2-super-secret")
        assert "hunter2-super-secret" not in repr(s)
        assert "hunter2-super-secret" not in str(s.db_password)
        assert s.db_password.get_secret_value() == "hunter2-super-secret"
