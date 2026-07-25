import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

# Imported for the side effect of registering every table on Base.metadata.
import app.models  # noqa: F401
from alembic import context
from app.config import get_settings
from app.models.base import Base

config = context.config

# Deliberately not written into the ini config. Alembic reads that through
# configparser, which treats % as interpolation syntax and chokes on any URL holding a
# percent-encoded character — a password with an @ in it, for instance. Passing the URL
# straight to the engine keeps one source of truth and no escaping rules.
database_url = get_settings().database_url

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = create_async_engine(database_url, poolclass=pool.NullPool)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
