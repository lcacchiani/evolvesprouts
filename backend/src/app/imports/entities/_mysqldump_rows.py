"""Shared mysqldump row iteration for legacy entity parsers."""

from __future__ import annotations

from collections.abc import Sequence

from app.imports import mysqldump


def _resolve_column_names(
    sql_text: str,
    table: str,
    stmt: str,
    fields: list[str | None],
    positional: dict[int, str],
    *,
    positional_fallbacks: Sequence[dict[int, str]] = (),
) -> list[str] | None:
    insert_cols = mysqldump.parse_insert_column_names(stmt)
    if insert_cols is not None and len(insert_cols) == len(fields):
        return insert_cols
    create_cols = mysqldump.parse_create_table_column_names(sql_text, table)
    if create_cols is not None and len(create_cols) == len(fields):
        return create_cols
    if len(fields) == len(positional):
        return [positional[i] for i in range(len(fields))]
    for fb in positional_fallbacks:
        if len(fields) == len(fb):
            return [fb[i] for i in range(len(fields))]
    return None


def _row_dict(
    sql_text: str,
    table: str,
    stmt: str,
    fields: list[str | None],
    positional: dict[int, str],
    *,
    positional_fallbacks: Sequence[dict[int, str]] = (),
) -> dict[str, str | None]:
    names = _resolve_column_names(
        sql_text,
        table,
        stmt,
        fields,
        positional,
        positional_fallbacks=positional_fallbacks,
    )
    if names is not None and len(names) == len(fields):
        return {names[i]: fields[i] for i in range(len(fields))}
    return mysqldump.row_dict_from_fields(None, fields, positional_fallback=positional)


def _extract_insert(sql_text: str, table: str) -> str:
    stmt = mysqldump.extract_insert_statement(sql_text, table)
    if stmt is None:
        msg = f"Could not find INSERT INTO `{table}` in dump."
        raise ValueError(msg)
    return stmt


def iter_row_dicts(
    sql_text: str,
    table: str,
    *,
    positional: dict[int, str],
    positional_fallbacks: Sequence[dict[int, str]] = (),
) -> list[dict[str, str | None]]:
    stmt = _extract_insert(sql_text, table)
    values_sql = mysqldump.extract_values_sql_fragment(stmt)
    out: list[dict[str, str | None]] = []
    for g in mysqldump.iter_groups(values_sql):
        fields = mysqldump.split_fields(g)
        out.append(
            _row_dict(
                sql_text,
                table,
                stmt,
                fields,
                positional,
                positional_fallbacks=positional_fallbacks,
            ),
        )
    return out
