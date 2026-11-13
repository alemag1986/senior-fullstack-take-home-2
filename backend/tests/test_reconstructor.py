from backend.app.services.reconstructor import apply_suggestions_right_to_left


class MockEdit:
    def __init__(self, start: int, end: int, original: str, replacement: str):
        self.start_offset = start
        self.end_offset = end
        self.original_text = original
        self.replacement_text = replacement


def test_reconstructor_right_to_left_equivalence():
    # Source text: "Yo comer manzanas ayer."
    # Edit 1: "comer" [3, 8] -> "comí" (len change: -1)
    # Edit 2: "ayer" [18, 22] -> "antier" (len change: +2)
    # Edit 3: insert " muchas" at 8 [8, 8] -> " muchas"
    text = "Yo comer manzanas ayer."

    e1 = MockEdit(3, 8, "comer", "comí")
    e2 = MockEdit(18, 22, "ayer", "antier")

    result = apply_suggestions_right_to_left(text, [e1, e2])
    assert result == "Yo comí manzanas antier."


def test_reconstructor_deletion_and_insertion():
    text = "Hola amigo como estas"
    # Deletion: " amigo" [4, 10] -> ""
    # Insertion: insert "¿" at 0 [0, 0] -> "¿"
    # Replacement: "estas" [16, 21] -> "estás?"
    e_del = MockEdit(4, 10, " amigo", "")
    e_ins = MockEdit(0, 0, "", "¿")
    e_rep = MockEdit(16, 21, "estas", "estás?")

    result = apply_suggestions_right_to_left(text, [e_del, e_ins, e_rep])
    # Expected: "¿Hola como estás?"
    assert result == "¿Hola como estás?"
