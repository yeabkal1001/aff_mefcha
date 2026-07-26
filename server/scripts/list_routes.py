"""Every route the app serves, as a flat list.

Faster to read than /docs when the question is only "did that router get wired in",
and it needs no running server.

Read from the OpenAPI schema rather than by walking `app.routes`. Recent FastAPI keeps
an included router as one opaque nested node, so a naive walk reports only the docs
endpoints and looks alarmingly like nothing got registered.

    .venv/Scripts/python.exe -m scripts.list_routes
"""

from app.main import app


def main() -> None:
    paths = app.openapi()["paths"]
    rows = sorted(
        (path, method.upper())
        for path, operations in paths.items()
        for method in operations
    )
    for path, method in rows:
        print(f"  {method:<6} {path}")
    print(f"\n{len(rows)} routes")


if __name__ == "__main__":
    main()
