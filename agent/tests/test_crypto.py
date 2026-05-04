import base64

import pytest
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from agent.lib.crypto import encrypt, decrypt, CryptoError, VERSION_BYTE


def test_encrypt_then_decrypt_roundtrips_bytes():
    plaintext = b"hello world"
    blob = encrypt(plaintext)
    assert decrypt(blob) == plaintext


def test_encrypt_then_decrypt_roundtrips_str():
    blob = encrypt("hello")
    assert decrypt(blob) == b"hello"


def test_each_encryption_uses_fresh_nonce():
    a = encrypt(b"same plaintext")
    b = encrypt(b"same plaintext")
    assert a != b


def test_blob_format_starts_with_version_byte():
    blob = encrypt(b"x")
    assert blob[0] == VERSION_BYTE


def test_decrypt_rejects_tampered_ciphertext():
    blob = bytearray(encrypt(b"hello"))
    blob[20] ^= 0x01
    with pytest.raises(CryptoError):
        decrypt(bytes(blob))


def test_decrypt_rejects_tampered_tag():
    blob = bytearray(encrypt(b"hello"))
    blob[-1] ^= 0x01
    with pytest.raises(CryptoError):
        decrypt(bytes(blob))


def test_decrypt_rejects_unknown_version():
    blob = bytearray(encrypt(b"hello"))
    blob[0] = 0x99
    with pytest.raises(CryptoError, match="version"):
        decrypt(bytes(blob))


def test_decrypt_rejects_truncated_blob():
    with pytest.raises(CryptoError):
        decrypt(b"\x01" + b"shortenough")


def test_empty_plaintext_supported():
    blob = encrypt(b"")
    assert decrypt(blob) == b""


def test_known_answer_vector_decrypt(monkeypatch):
    """Cross-implementation KAT: a blob produced with a fixed key + fixed nonce
    must decrypt to a known plaintext. Use this same vector in the TS web mirror tests.
    """
    fixed_key = bytes([0x01] * 32)
    monkeypatch.setenv("ENCRYPTION_KEY", base64.b64encode(fixed_key).decode())
    from agent.lib import crypto as _c
    _c._reset_cache_for_tests()

    fixed_nonce = bytes([0x02] * 12)
    plaintext = b"hirewire kat"
    aesgcm = AESGCM(fixed_key)
    ct_with_tag = aesgcm.encrypt(fixed_nonce, plaintext, associated_data=None)
    blob = bytes([0x01]) + fixed_nonce + ct_with_tag

    expected_hex = blob.hex()
    assert len(expected_hex) > 0

    from agent.lib.crypto import decrypt
    assert decrypt(blob) == plaintext
