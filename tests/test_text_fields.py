from __future__ import annotations

import pytest

from app.api.text_fields import optional_text, require_text
from app.exceptions import ValidationError


def test_require_text_rejects_empty() -> None:
    with pytest.raises(ValidationError, match="fieldName"):
        require_text("   ", "fieldName", 10)


def test_require_text_returns_trimmed_value() -> None:
    assert require_text("  hello  ", "fieldName", 10) == "hello"


def test_optional_text_returns_none_for_blank() -> None:
    assert optional_text("   ", "fieldName", 10) is None


def test_optional_text_returns_trimmed_value() -> None:
    assert optional_text("  hello  ", "fieldName", 10) == "hello"
