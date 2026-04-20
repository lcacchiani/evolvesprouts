"""Tests for legacy_import_refs helpers."""

from __future__ import annotations

import uuid

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.models.legacy_import_ref import LegacyImportRef
from app.imports import refs


def _memory_session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine, tables=[LegacyImportRef.__table__])
    return Session(engine)


def test_record_and_load_mapping() -> None:
    with _memory_session() as session:
        nid = uuid.uuid4()
        refs.record_mapping(session, "venues", "42", nid)
        session.commit()
        m = refs.load_mapping(session, "venues")
        assert m["42"] == nid


def test_record_mapping_idempotent() -> None:
    with _memory_session() as session:
        a = uuid.uuid4()
        b = uuid.uuid4()
        refs.record_mapping(session, "venues", "1", a)
        refs.record_mapping(session, "venues", "1", b)
        session.commit()
        m = refs.load_mapping(session, "venues")
        assert m["1"] == a


def test_has_mapping() -> None:
    with _memory_session() as session:
        assert refs.has_mapping(session, "venues") is False
        refs.record_mapping(session, "venues", "1", uuid.uuid4())
        session.commit()
        assert refs.has_mapping(session, "venues") is True
