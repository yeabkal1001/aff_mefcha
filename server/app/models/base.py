"""The declarative base, and nothing else.

Kept apart from db.py so importing a model does not drag in settings, a database URL or
a connection pool. The schema is inspectable and the pure engine functions are testable
without a running Postgres.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
