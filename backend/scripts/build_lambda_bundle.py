"""Build a local Lambda bundle for CDK asset staging."""

from __future__ import annotations

import argparse
import hashlib
import logging
import os
from pathlib import Path
import shutil
import subprocess
import sys

logger = logging.getLogger(__name__)


def _ensure_python_version() -> None:
    if sys.version_info[:2] != (3, 12):
        raise SystemExit("Python 3.12 is required to build Lambda bundles.")


def _run_pip(command: list[str], cwd: Path, env: dict[str, str]) -> None:
    subprocess.run(command, check=True, cwd=cwd, env=env)


def _copy_tree(source: Path, destination: Path) -> None:
    if not source.exists():
        raise FileNotFoundError(f"Missing source path: {source}")
    shutil.copytree(source, destination, dirs_exist_ok=True)


def _cleanup_bundle(output_dir: Path) -> None:
    for cache_dir in output_dir.rglob("__pycache__"):
        shutil.rmtree(cache_dir)
    for cache_file in output_dir.rglob("*.pyc"):
        cache_file.unlink()
    for cache_file in output_dir.rglob("*.pyo"):
        cache_file.unlink()


def _requirements_cache_key(requirements: Path) -> str:
    hasher = hashlib.sha256()
    hasher.update(requirements.read_bytes())
    hasher.update(b"\nplatform=manylinux_2_17_aarch64")
    hasher.update(b"\nimplementation=cp")
    hasher.update(b"\npython_version=3.12")
    return hasher.hexdigest()


def _build_dependency_cache(
    source_root: Path,
    requirements: Path,
    env: dict[str, str],
) -> Path:
    cache_root = source_root / ".lambda-build" / "dependency-cache"
    cache_root.mkdir(parents=True, exist_ok=True)
    cache_key = _requirements_cache_key(requirements)
    cache_dir = cache_root / cache_key
    ready_marker = cache_root / f"{cache_key}.ready"

    if cache_dir.is_dir() and ready_marker.is_file():
        logger.info("Reusing Lambda dependency cache %s", cache_key[:12])
        return cache_dir

    logger.info("Building Lambda dependency cache %s", cache_key[:12])
    temp_cache_dir = cache_root / f".tmp-{cache_key}"
    if temp_cache_dir.exists():
        shutil.rmtree(temp_cache_dir)
    temp_cache_dir.mkdir(parents=True, exist_ok=True)

    try:
        _run_pip(
            [
                sys.executable,
                "-m",
                "pip",
                "install",
                "-r",
                "requirements.txt",
                "-t",
                str(temp_cache_dir),
                "--no-compile",
                "--disable-pip-version-check",
                # Use Lambda-compatible wheels (Amazon Linux 2023 / manylinux)
                # ARM64 architecture (Graviton2) - matches Lambda config
                "--platform",
                "manylinux_2_17_aarch64",
                "--only-binary=:all:",
                "--implementation",
                "cp",
                "--python-version",
                "3.12",
            ],
            cwd=source_root,
            env=env,
        )
        _cleanup_bundle(temp_cache_dir)
        if cache_dir.exists():
            shutil.rmtree(cache_dir)
        temp_cache_dir.rename(cache_dir)
        ready_marker.write_text("ready\n", encoding="utf-8")
        return cache_dir
    finally:
        if temp_cache_dir.exists():
            shutil.rmtree(temp_cache_dir)


def build_bundle(
    source_root: Path, output_dir: Path, *, cache_only: bool = False
) -> None:
    requirements = source_root / "requirements.txt"
    if not requirements.is_file():
        raise FileNotFoundError(f"Missing requirements file: {requirements}")

    env = os.environ.copy()
    pip_cache_dir = source_root / ".lambda-build" / "pip-cache"
    pip_cache_dir.mkdir(parents=True, exist_ok=True)
    env.update(
        {
            "HOME": "/tmp",
            "PIP_CACHE_DIR": str(pip_cache_dir),
            "PYTHONUSERBASE": "/tmp/.local",
            "PYTHONDONTWRITEBYTECODE": "1",
            "PYTHONHASHSEED": "0",
        }
    )

    dependency_cache = _build_dependency_cache(source_root, requirements, env)
    if cache_only:
        return

    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    _copy_tree(dependency_cache, output_dir)

    _copy_tree(source_root / "lambda", output_dir / "lambda")
    _copy_tree(source_root / "src", output_dir / "src")
    _cleanup_bundle(output_dir)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source-root",
        default=str(Path(__file__).resolve().parents[1]),
        help="Path to backend source root.",
    )
    parser.add_argument(
        "--output-dir",
        default="",
        help="Output directory for the bundled assets.",
    )
    parser.add_argument(
        "--cache-only",
        action="store_true",
        help="Build dependency cache only (skip writing final bundle output).",
    )
    return parser.parse_args()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    _ensure_python_version()
    args = _parse_args()
    source_root = Path(args.source_root).resolve()
    output_dir = (
        Path(args.output_dir).resolve()
        if args.output_dir
        else source_root / ".lambda-build" / "base"
    )
    if args.cache_only:
        logger.info("Preparing Lambda dependency cache for %s", source_root)
    else:
        logger.info("Building Lambda bundle in %s", output_dir)
    build_bundle(source_root, output_dir, cache_only=args.cache_only)
    if args.cache_only:
        logger.info("Lambda dependency cache ready.")
    else:
        logger.info("Lambda bundle ready.")


if __name__ == "__main__":
    main()
