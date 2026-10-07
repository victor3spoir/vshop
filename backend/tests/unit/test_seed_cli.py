"""Check the installed seed entry point without connecting to external services."""

import os
import subprocess
import sysconfig
from importlib.metadata import distribution
from pathlib import Path

import pytest


def test_seed_entry_point_is_registered():
    entry_points = distribution("vshop").entry_points
    assert any(
        entry.group == "console_scripts"
        and entry.name == "seed"
        and entry.value == "scripts.seed:cli"
        for entry in entry_points
    )


@pytest.mark.parametrize(
    ("args", "exit_code", "message"),
    [
        (["--help"], 0, "Seed vshop from DummyJSON"),
        (["--products", "-1"], 2, "--products must be zero or greater"),
        (["--products"], 2, "expected one argument"),
    ],
)
def test_seed_cli_from_outside_source_directory(tmp_path, args, exit_code, message):
    executable = Path(sysconfig.get_path("scripts")) / (
        "seed.exe" if os.name == "nt" else "seed"
    )
    env = {**os.environ, "REDIS_URL": "redis://127.0.0.1:1/0"}
    env.pop("PYTHONPATH", None)
    result = subprocess.run(
        [str(executable), *args],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )

    assert result.returncode == exit_code, result.stdout + result.stderr
    assert message in result.stdout + result.stderr
