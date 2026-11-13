import pytest
from backend.app.services.utf16 import (
    find_all_utf16_occurrences,
    is_valid_surrogate_boundary,
    utf16_len,
    utf16_slice,
)


def test_utf16_length_ascii_and_accents():
    ascii_text = "Hello world"
    assert utf16_len(ascii_text) == 11
    assert utf16_slice(ascii_text, 0, 5) == "Hello"

    spanish_text = "mañana canción olé"
    # Accented Latin characters (ñ, ó, é) are BMP characters (1 UTF-16 code unit each)
    assert utf16_len(spanish_text) == len(spanish_text)
    assert utf16_slice(spanish_text, 0, 6) == "mañana"


def test_utf16_length_and_slice_with_emoji():
    # Party popper emoji '🎉' is U+1F389 (astral character, requires 2 UTF-16 code units)
    text = "¡Fiesta! 🎉 Hoy comemos."
    # len(text) in Python is 23, but in UTF-16 code units it is 24!
    assert len(text) == 23
    assert utf16_len(text) == 24

    # Emoji starts at UTF-16 offset 9 and ends at 11
    emoji_slice = utf16_slice(text, 9, 11)
    assert emoji_slice == "🎉"

    # Slicing in the middle of the surrogate pair (offset 10) must be rejected
    assert not is_valid_surrogate_boundary(text, 10)
    with pytest.raises(ValueError, match="splits a UTF-16 surrogate pair"):
        utf16_slice(text, 9, 10)

    with pytest.raises(ValueError, match="splits a UTF-16 surrogate pair"):
        utf16_slice(text, 10, 11)


def test_utf16_multiline_and_repeated_words():
    multiline = "Línea uno\nLínea dos\nLínea tres"
    assert utf16_slice(multiline, 0, 9) == "Línea uno"
    assert utf16_slice(multiline, 10, 19) == "Línea dos"

    repeated = "el gato y el perro y el pájaro"
    matches = find_all_utf16_occurrences(repeated, "el")
    assert len(matches) == 3
    for start, end in matches:
        assert utf16_slice(repeated, start, end) == "el"
