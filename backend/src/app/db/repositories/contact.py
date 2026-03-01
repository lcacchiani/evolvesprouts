"""Repository for CRM contacts."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models.contact import Contact
from app.db.models.enums import ContactSource, ContactType, RelationshipType
from app.db.repositories.base import BaseRepository

_SOURCE_PRIORITY: dict[ContactSource, int] = {
    ContactSource.FREE_GUIDE: 10,
    ContactSource.NEWSLETTER: 20,
    ContactSource.INSTAGRAM: 30,
    ContactSource.RESERVATION: 40,
    ContactSource.CONTACT_FORM: 50,
    ContactSource.REFERRAL: 60,
    ContactSource.MANUAL: 100,
}


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _normalize_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = " ".join(value.split()).strip()
    return normalized or None


def _should_replace_first_name(existing: str, incoming: str) -> bool:
    existing_normalized = _normalize_text(existing) or ""
    incoming_normalized = _normalize_text(incoming) or ""
    if not incoming_normalized:
        return False
    if not existing_normalized:
        return True
    return len(incoming_normalized) > len(existing_normalized)


def _should_replace_source(existing: ContactSource, incoming: ContactSource) -> bool:
    return _SOURCE_PRIORITY[incoming] >= _SOURCE_PRIORITY[existing]


class ContactRepository(BaseRepository[Contact]):
    """Repository for CRM contact lookup and upsert operations."""

    def __init__(self, session: Session):
        super().__init__(session, Contact)

    def find_by_email(self, email: str) -> Contact | None:
        """Case-insensitive lookup by email address."""
        normalized_email = _normalize_email(email)
        statement = select(Contact).where(func.lower(Contact.email) == normalized_email)
        return self._session.execute(statement).scalar_one_or_none()

    def upsert_by_email(
        self,
        email: str,
        *,
        first_name: str,
        source: ContactSource,
        source_detail: str | None = None,
        contact_type: ContactType = ContactType.PARENT,
        relationship_type: RelationshipType = RelationshipType.PROSPECT,
    ) -> tuple[Contact, bool]:
        """Insert or update a contact by case-insensitive email key."""
        normalized_email = _normalize_email(email)
        if not normalized_email:
            raise ValueError("email is required")

        normalized_first_name = _normalize_text(first_name)
        if not normalized_first_name:
            raise ValueError("first_name is required")

        normalized_source_detail = _normalize_text(source_detail)
        existing_contact = self.find_by_email(normalized_email)
        if existing_contact is None:
            contact = Contact(
                email=normalized_email,
                first_name=normalized_first_name,
                contact_type=contact_type,
                relationship_type=relationship_type,
                source=source,
                source_detail=normalized_source_detail,
            )
            created_contact = self.create(contact)
            return created_contact, True

        should_update = False
        if _should_replace_first_name(
            existing_contact.first_name, normalized_first_name
        ):
            existing_contact.first_name = normalized_first_name
            should_update = True

        if _should_replace_source(existing_contact.source, source):
            if existing_contact.source != source:
                existing_contact.source = source
                should_update = True
            if (
                normalized_source_detail
                and existing_contact.source_detail != normalized_source_detail
            ):
                existing_contact.source_detail = normalized_source_detail
                should_update = True
        elif (
            normalized_source_detail
            and existing_contact.source == source
            and not existing_contact.source_detail
        ):
            existing_contact.source_detail = normalized_source_detail
            should_update = True

        if should_update:
            updated_contact = self.update(existing_contact)
            return updated_contact, False

        return existing_contact, False
