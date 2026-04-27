"""Shared pytest fixtures for the HireWire agent test suite.

Fixtures will be added here as subsequent Phase 1 tasks (config, health
endpoints) introduce shared test dependencies.
"""

from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def _clear_settings_cache() -> None:
    """Reset the get_settings() lru_cache around every test.

    Prevents one test's monkeypatched env from leaking into the next.
    """
    from hirewire.config import get_settings

    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
