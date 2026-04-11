from __future__ import annotations

from app.utils.public_slug import normalize_public_slug


def test_normalize_public_slug_basic() -> None:
    assert normalize_public_slug("Sleep Routines") == "sleep-routines"
    assert normalize_public_slug("  Foo_Bar  ") == "foo-bar"


def test_normalize_public_slug_empty() -> None:
    assert normalize_public_slug("") is None
    assert normalize_public_slug("   ") is None
    assert normalize_public_slug(None) is None


def test_normalize_public_slug_max_length() -> None:
    long = "a" * 100
    out = normalize_public_slug(long, max_length=10)
    assert out == "aaaaaaaaaa"
