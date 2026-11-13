import struct
from typing import List, Tuple


def get_utf16_code_units(s: str) -> Tuple[int, ...]:
    """Returns a tuple of 16-bit unsigned integers representing UTF-16LE code units."""
    encoded = s.encode("utf-16-le")
    count = len(encoded) // 2
    return struct.unpack(f"<{count}H", encoded)


def utf16_len(s: str) -> int:
    """Returns the length in UTF-16 code units (matching JavaScript string.length)."""
    return len(s.encode("utf-16-le")) // 2


def is_valid_surrogate_boundary(s: str, offset: int) -> bool:
    """
    Checks if an offset in UTF-16 code units is at a valid character boundary.
    Returns False if the offset points directly between a high and low surrogate pair.
    """
    units = get_utf16_code_units(s)
    total_units = len(units)

    if offset < 0 or offset > total_units:
        return False

    if 0 < offset < total_units:
        curr = units[offset]
        prev = units[offset - 1]
        # If current is low surrogate (0xDC00-0xDFFF) and previous is high surrogate (0xD800-0xDBFF)
        if 0xDC00 <= curr <= 0xDFFF and 0xD800 <= prev <= 0xDBFF:
            return False

    return True


def utf16_slice(s: str, start: int, end: int) -> str:
    """
    Extracts a substring based on UTF-16 code unit offsets,
    matching JavaScript String.prototype.slice(start, end).
    Raises ValueError if start or end splits a surrogate pair or is out of bounds.
    """
    total = utf16_len(s)
    if start < 0 or end < start or end > total:
        raise ValueError(f"Offsets [{start}, {end}] out of bounds for string of length {total}")

    if not is_valid_surrogate_boundary(s, start):
        raise ValueError(f"Start offset {start} splits a UTF-16 surrogate pair")

    if not is_valid_surrogate_boundary(s, end):
        raise ValueError(f"End offset {end} splits a UTF-16 surrogate pair")

    encoded = s.encode("utf-16-le")
    return encoded[start * 2 : end * 2].decode("utf-16-le")


def find_all_utf16_occurrences(source: str, needle: str) -> List[Tuple[int, int]]:
    """
    Finds all occurrences of needle in source, returning a list of (start, end)
    offsets in UTF-16 code units.
    """
    if not needle:
        return []

    source_units = get_utf16_code_units(source)
    needle_units = get_utf16_code_units(needle)

    s_len = len(source_units)
    n_len = len(needle_units)

    if n_len > s_len:
        return []

    occurrences: List[Tuple[int, int]] = []
    for i in range(s_len - n_len + 1):
        if source_units[i : i + n_len] == needle_units:
            # Verify boundaries don't split surrogate pairs
            if is_valid_surrogate_boundary(source, i) and is_valid_surrogate_boundary(source, i + n_len):
                occurrences.append((i, i + n_len))

    return occurrences


def find_utf16_substring(
    source: str, needle: str, start_char: int = 0
) -> Tuple[int, int] | None:
    """
    Finds the first occurrence of needle in source at or after start_char,
    returning (u16_start, u16_end) offsets in UTF-16 code units.
    """
    all_occ = find_all_utf16_occurrences(source, needle)
    if not all_occ:
        return None

    # Find the occurrence closest to start_char in UTF-16 code units
    target_u16 = utf16_len(source[:start_char])
    for start, end in all_occ:
        if start >= target_u16:
            return (start, end)

    # Return the first one if none is >= target_u16
    return all_occ[0]
