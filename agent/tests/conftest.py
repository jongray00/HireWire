"""Shared pytest fixtures for the HireWire agent test suite."""

import pytest


@pytest.fixture
def anyio_backend() -> str:
    """Force anyio-based async tests onto asyncio."""
    return "asyncio"
