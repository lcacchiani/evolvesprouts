"""Shared backend application package.

This package provides the core application logic, database access,
authentication utilities, and HTTP helpers for Lambda handlers.

Modules:
    auth: Authentication and authorization utilities.
    config: Application configuration from environment variables.
    db: Database connection and session management.
    errors: API error types and factory functions.
    handler: Lambda handler decorator and response helpers.
    http: HTTP request/response utilities.
    models: SQLAlchemy ORM models.
    pagination: Cursor-based pagination utilities.
    utils: Shared utility functions.

Subpackages:
    repositories: Database access layer.
    services: Business logic layer.
"""

__version__ = '0.1.0'
