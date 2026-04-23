from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.api.admin_entities_helpers import (
    FAMILY_RELATIONSHIP_TYPES,
    ORGANIZATION_RELATIONSHIP_TYPES,
    replace_service_instance_tags,
    require_assignable_tag,
    request_id,
    parse_contact_type_filter,
    parse_relationship_type,
)
from app.db.models import RelationshipType, ServiceInstanceTag
from app.db.models.enums import ContactType
from app.exceptions import ValidationError


def test_request_id_reads_api_gateway_request_id() -> None:
    event: dict[str, Any] = {
        "requestContext": {"requestId": "  req-abc  "},
    }
    assert request_id(event) == "req-abc"


def test_request_id_empty_when_missing() -> None:
    assert request_id({}) == ""


def test_parse_relationship_type_defaults_to_prospect() -> None:
    assert parse_relationship_type(None, field="x") == RelationshipType.PROSPECT
    assert parse_relationship_type("", field="x") == RelationshipType.PROSPECT


def test_parse_relationship_type_accepts_vendor() -> None:
    assert (
        parse_relationship_type("vendor", field="relationship_type")
        == RelationshipType.VENDOR
    )


def test_parse_relationship_type_accepts_client() -> None:
    assert (
        parse_relationship_type("client", field="relationship_type")
        == RelationshipType.CLIENT
    )


def test_parse_relationship_type_family_allowed_subset() -> None:
    assert (
        parse_relationship_type(
            "client",
            field="relationship_type",
            allowed=FAMILY_RELATIONSHIP_TYPES,
        )
        == RelationshipType.CLIENT
    )
    with pytest.raises(ValidationError, match="relationship_type"):
        parse_relationship_type(
            "past_client",
            field="relationship_type",
            allowed=FAMILY_RELATIONSHIP_TYPES,
        )


def test_parse_relationship_type_organization_excludes_past_client() -> None:
    assert (
        parse_relationship_type(
            "partner",
            field="relationship_type",
            allowed=ORGANIZATION_RELATIONSHIP_TYPES,
        )
        == RelationshipType.PARTNER
    )
    with pytest.raises(ValidationError, match="relationship_type"):
        parse_relationship_type(
            "past_client",
            field="relationship_type",
            allowed=ORGANIZATION_RELATIONSHIP_TYPES,
        )


def test_parse_contact_type_filter_empty_means_no_filter() -> None:
    assert parse_contact_type_filter(None) is None
    assert parse_contact_type_filter("") is None
    assert parse_contact_type_filter("  ") is None


def test_parse_contact_type_filter_accepts_known_values() -> None:
    assert parse_contact_type_filter("parent") == ContactType.PARENT
    assert parse_contact_type_filter("CHILD") == ContactType.CHILD


def test_parse_contact_type_filter_rejects_unknown() -> None:
    with pytest.raises(ValidationError, match="contact_type"):
        parse_contact_type_filter("not_a_type")


@pytest.mark.filterwarnings("ignore::sqlalchemy.exc.SAWarning")
def test_replace_service_instance_tags_dedupes_preserving_order() -> None:
    instance_id = uuid4()
    t1, t2 = uuid4(), uuid4()
    session = MagicMock()
    added: list[ServiceInstanceTag] = []

    def fake_get(_model: type, pk: object) -> object | None:
        if pk == t1:
            return SimpleNamespace(id=t1, archived_at=None)
        if pk == t2:
            return SimpleNamespace(id=t2, archived_at=None)
        return None

    session.get.side_effect = fake_get
    session.add.side_effect = lambda row: added.append(row)

    replace_service_instance_tags(
        session,
        instance_id=instance_id,
        tag_ids=[t2, t1, t2],
    )

    assert len(added) == 2
    assert isinstance(added[0], ServiceInstanceTag)
    assert added[0].service_instance_id == instance_id
    assert added[0].tag_id == t2
    assert added[1].tag_id == t1
    session.execute.assert_called_once()
    session.flush.assert_called_once()


@pytest.mark.filterwarnings("ignore::sqlalchemy.exc.SAWarning")
def test_replace_service_instance_tags_unknown_id_sets_field() -> None:
    instance_id = uuid4()
    known = uuid4()
    missing = uuid4()
    session = MagicMock()

    def fake_get(_model: type, pk: object) -> object | None:
        if pk == known:
            return SimpleNamespace(id=known, archived_at=None)
        return None

    session.get.side_effect = fake_get

    with pytest.raises(ValidationError, match="tag_id not found") as exc:
        replace_service_instance_tags(
            session,
            instance_id=instance_id,
            tag_ids=[known, missing],
        )
    assert exc.value.field == "tag_ids"


@pytest.mark.filterwarnings("ignore::sqlalchemy.exc.SAWarning")
def test_replace_service_instance_tags_rejects_archived_tag() -> None:
    instance_id = uuid4()
    active_id = uuid4()
    archived_id = uuid4()
    session = MagicMock()

    def fake_get(_model: type, pk: object) -> object | None:
        if pk == active_id:
            return SimpleNamespace(id=active_id, archived_at=None)
        if pk == archived_id:
            return SimpleNamespace(id=archived_id, archived_at="2024-01-01")
        return None

    session.get.side_effect = fake_get

    with pytest.raises(ValidationError, match="tag is archived") as exc:
        replace_service_instance_tags(
            session,
            instance_id=instance_id,
            tag_ids=[active_id, archived_id],
        )
    assert exc.value.field == "tag_ids"


def test_require_assignable_tag_raises_for_archived() -> None:
    tid = uuid4()
    session = MagicMock()
    session.get.return_value = SimpleNamespace(id=tid, archived_at="x")

    with pytest.raises(ValidationError, match="tag is archived"):
        require_assignable_tag(session, tid)
