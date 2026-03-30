from __future__ import annotations

from typing import Any

import pytest

from app.exceptions import AppError, ValidationError
from app.services import nominatim_geocode


def test_geocode_success(monkeypatch: Any) -> None:
    monkeypatch.setenv("NOMINATIM_USER_AGENT", "TestAgent/1.0")
    monkeypatch.setenv("NOMINATIM_REFERER", "https://example.com")

    def fake_http_invoke(
        method: str,
        url: str,
        headers: dict[str, str] | None = None,
        body: str | None = None,
        timeout: int = 10,
    ) -> dict[str, Any]:
        assert method == "GET"
        assert "nominatim.openstreetmap.org/search" in url
        assert headers is not None
        assert headers.get("User-Agent") == "TestAgent/1.0"
        assert headers.get("Referer") == "https://example.com"
        assert "countrycodes=hk" in url.lower()
        payload = '[{"lat":"1.5","lon":"2.5","display_name":"Somewhere"}]'
        return {"status": 200, "body": payload}

    monkeypatch.setattr(nominatim_geocode, "http_invoke", fake_http_invoke)

    lat, lng, name = nominatim_geocode.geocode_address_with_context(
        address="123 Main St",
        area_context="City",
        country_code="HK",
    )
    assert lat == 1.5
    assert lng == 2.5
    assert name == "Somewhere"


def test_geocode_rejects_empty_address() -> None:
    with pytest.raises(ValidationError):
        nominatim_geocode.geocode_address_with_context(
            address="   ",
            area_context="",
            country_code=None,
        )


def test_geocode_proxy_error(monkeypatch: Any) -> None:
    monkeypatch.setenv("NOMINATIM_USER_AGENT", "TestAgent/1.0")
    monkeypatch.setenv("NOMINATIM_REFERER", "https://example.com")

    from app.services.aws_proxy import AwsProxyError

    def raise_proxy(*_a: Any, **_k: Any) -> None:
        raise AwsProxyError("Upstream", "boom")

    monkeypatch.setattr(nominatim_geocode, "http_invoke", raise_proxy)

    with pytest.raises(AppError) as exc:
        nominatim_geocode.geocode_address_with_context(
            address="x",
            area_context="",
            country_code=None,
        )
    assert exc.value.status_code == 502


def test_geocode_no_results(monkeypatch: Any) -> None:
    monkeypatch.setenv("NOMINATIM_USER_AGENT", "TestAgent/1.0")
    monkeypatch.setenv("NOMINATIM_REFERER", "https://example.com")

    monkeypatch.setattr(
        nominatim_geocode,
        "http_invoke",
        lambda *_a, **_k: {"status": 200, "body": "[]"},
    )

    with pytest.raises(ValidationError):
        nominatim_geocode.geocode_address_with_context(
            address="nowhere",
            area_context="",
            country_code=None,
        )
