from __future__ import annotations

from app.utils.parsers import collect_query_params


def test_collect_query_params_prefers_multi_value_parameters() -> None:
    event = {
        "queryStringParameters": {"lang": "en", "tag": "single"},
        "multiValueQueryStringParameters": {
            "lang": ["zh", "ja"],
            "tag": ["multi"],
        },
    }

    assert collect_query_params(event) == {
        "lang": ["zh", "ja"],
        "tag": ["multi"],
    }


def test_collect_query_params_falls_back_to_single_values() -> None:
    event = {
        "queryStringParameters": {"lang": "en", "cursor": "abc"},
        "multiValueQueryStringParameters": None,
    }

    assert collect_query_params(event) == {
        "lang": ["en"],
        "cursor": ["abc"],
    }
