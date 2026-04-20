from __future__ import annotations

from typing import Any
from uuid import uuid4

from app.api import admin_contacts, admin_families, admin_organizations_crm


def test_handle_admin_contacts_tags_get(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    marker = {"statusCode": 200, "body": "{}"}
    monkeypatch.setattr(admin_contacts, "_list_contact_tags", lambda _: marker)
    monkeypatch.setattr(
        admin_contacts,
        "extract_identity",
        lambda _event: type("Identity", (), {"user_sub": "admin-sub"})(),
    )

    response = admin_contacts.handle_admin_contacts_request(
        api_gateway_event(method="GET", path="/v1/admin/contacts/tags"),
        "GET",
        "/v1/admin/contacts/tags",
    )

    assert response is marker


def test_handle_admin_contacts_search_get(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    marker = {"statusCode": 200, "body": "{}"}
    monkeypatch.setattr(admin_contacts, "_search_contacts_for_picker", lambda _: marker)
    monkeypatch.setattr(
        admin_contacts,
        "extract_identity",
        lambda _event: type("Identity", (), {"user_sub": "admin-sub"})(),
    )

    response = admin_contacts.handle_admin_contacts_request(
        api_gateway_event(method="GET", path="/v1/admin/contacts/search"),
        "GET",
        "/v1/admin/contacts/search",
    )

    assert response is marker


def test_handle_admin_contacts_delete(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    marker = {"statusCode": 204, "body": "{}"}
    contact_id = str(uuid4())

    def _fake_delete(
        _event: Any,
        *,
        contact_id: Any,
        actor_sub: str,
    ) -> dict[str, Any]:
        assert actor_sub == "admin-sub"
        assert str(contact_id)
        return marker

    monkeypatch.setattr(admin_contacts, "delete_contact", _fake_delete)
    monkeypatch.setattr(
        admin_contacts,
        "extract_identity",
        lambda _event: type("Identity", (), {"user_sub": "admin-sub"})(),
    )

    response = admin_contacts.handle_admin_contacts_request(
        api_gateway_event(method="DELETE", path=f"/v1/admin/contacts/{contact_id}"),
        "DELETE",
        f"/v1/admin/contacts/{contact_id}",
    )

    assert response is marker


def test_handle_admin_contacts_notes_get(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    marker = {"statusCode": 200, "body": "{}"}
    contact_id = str(uuid4())

    def _fake_list(
        _event: Any,
        *,
        contact_id: Any,
        actor_sub: str,
    ) -> dict[str, Any]:
        assert actor_sub == "admin-sub"
        assert str(contact_id)
        return marker

    monkeypatch.setattr(admin_contacts, "list_contact_notes", _fake_list)
    monkeypatch.setattr(
        admin_contacts,
        "extract_identity",
        lambda _event: type("Identity", (), {"user_sub": "admin-sub"})(),
    )

    response = admin_contacts.handle_admin_contacts_request(
        api_gateway_event(method="GET", path=f"/v1/admin/contacts/{contact_id}/notes"),
        "GET",
        f"/v1/admin/contacts/{contact_id}/notes",
    )

    assert response is marker


def test_handle_admin_contacts_notes_post(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    marker = {"statusCode": 201, "body": "{}"}
    contact_id = str(uuid4())

    def _fake_create(
        _event: Any,
        *,
        contact_id: Any,
        actor_sub: str,
    ) -> dict[str, Any]:
        assert actor_sub == "admin-sub"
        assert str(contact_id)
        return marker

    monkeypatch.setattr(admin_contacts, "create_contact_note", _fake_create)
    monkeypatch.setattr(
        admin_contacts,
        "extract_identity",
        lambda _event: type("Identity", (), {"user_sub": "admin-sub"})(),
    )

    response = admin_contacts.handle_admin_contacts_request(
        api_gateway_event(method="POST", path=f"/v1/admin/contacts/{contact_id}/notes"),
        "POST",
        f"/v1/admin/contacts/{contact_id}/notes",
    )

    assert response is marker


def test_handle_admin_contacts_note_patch(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    marker = {"statusCode": 200, "body": "{}"}
    contact_id = str(uuid4())
    note_id = str(uuid4())

    def _fake_update(
        _event: Any,
        *,
        contact_id: Any,
        note_id: Any,
        actor_sub: str,
    ) -> dict[str, Any]:
        assert actor_sub == "admin-sub"
        assert str(contact_id)
        assert str(note_id)
        return marker

    monkeypatch.setattr(admin_contacts, "update_contact_note", _fake_update)
    monkeypatch.setattr(
        admin_contacts,
        "extract_identity",
        lambda _event: type("Identity", (), {"user_sub": "admin-sub"})(),
    )

    response = admin_contacts.handle_admin_contacts_request(
        api_gateway_event(
            method="PATCH",
            path=f"/v1/admin/contacts/{contact_id}/notes/{note_id}",
        ),
        "PATCH",
        f"/v1/admin/contacts/{contact_id}/notes/{note_id}",
    )

    assert response is marker


def test_handle_admin_contacts_note_delete(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    marker = {"statusCode": 204, "body": "{}"}
    contact_id = str(uuid4())
    note_id = str(uuid4())

    def _fake_delete_note(
        _event: Any,
        *,
        contact_id: Any,
        note_id: Any,
        actor_sub: str,
    ) -> dict[str, Any]:
        assert actor_sub == "admin-sub"
        assert str(contact_id)
        assert str(note_id)
        return marker

    monkeypatch.setattr(admin_contacts, "delete_contact_note", _fake_delete_note)
    monkeypatch.setattr(
        admin_contacts,
        "extract_identity",
        lambda _event: type("Identity", (), {"user_sub": "admin-sub"})(),
    )

    response = admin_contacts.handle_admin_contacts_request(
        api_gateway_event(
            method="DELETE",
            path=f"/v1/admin/contacts/{contact_id}/notes/{note_id}",
        ),
        "DELETE",
        f"/v1/admin/contacts/{contact_id}/notes/{note_id}",
    )

    assert response is marker


def test_handle_admin_families_member_delete(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    marker = {"statusCode": 200, "body": "{}"}
    monkeypatch.setattr(
        admin_families,
        "extract_identity",
        lambda _event: type("Identity", (), {"user_sub": "admin-sub"})(),
    )
    family_id = str(uuid4())
    member_id = str(uuid4())

    def _fake_remove(
        _event: Any,
        *,
        family_id: Any,
        member_id: Any,
        actor_sub: str,
    ) -> dict[str, Any]:
        assert actor_sub == "admin-sub"
        assert str(family_id)
        assert str(member_id)
        return marker

    monkeypatch.setattr(admin_families, "_remove_family_member", _fake_remove)

    response = admin_families.handle_admin_families_request(
        api_gateway_event(
            method="DELETE",
            path=f"/v1/admin/families/{family_id}/members/{member_id}",
        ),
        "DELETE",
        f"/v1/admin/families/{family_id}/members/{member_id}",
    )

    assert response is marker


def test_handle_admin_organizations_crm_list_get(
    monkeypatch: Any,
    api_gateway_event: Any,
) -> None:
    marker = {"statusCode": 200, "body": "{}"}
    monkeypatch.setattr(admin_organizations_crm, "_list_organizations", lambda _: marker)
    monkeypatch.setattr(
        admin_organizations_crm,
        "extract_identity",
        lambda _event: type("Identity", (), {"user_sub": "admin-sub"})(),
    )

    response = admin_organizations_crm.handle_admin_organizations_crm_request(
        api_gateway_event(method="GET", path="/v1/admin/organizations"),
        "GET",
        "/v1/admin/organizations",
    )

    assert response is marker
