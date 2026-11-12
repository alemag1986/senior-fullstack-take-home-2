import { Analysis, JournalEntry, Suggestion } from '../types/journal';
import { validateSuggestionOffsets } from './offsetUtils';

export interface FixtureScenario {
  name: string;
  description: string;
  entry: JournalEntry;
  analysis: Analysis;
}

/**
 * Creates a validated Suggestion by finding the target phrase within text.
 * Throws an error if target original text does not match the slice.
 */
function createValidatedSuggestion(
  sourceText: string,
  id: string,
  category: Suggestion['category'],
  kind: Suggestion['kind'],
  ruleCode: string,
  start: number,
  end: number,
  replacement: string,
  explanation: { title: string; message: string }
): Suggestion {
  const original = sourceText.slice(start, end);

  const suggestion: Suggestion = {
    id,
    category,
    kind,
    ruleCode,
    edit: {
      start,
      end,
      original,
      replacement,
    },
    explanation,
  };

  // Immediate validation
  if (sourceText.slice(start, end) !== original) {
    throw new Error(
      `Fixture invariant violated: slice(${start}, ${end}) is "${sourceText.slice(start, end)}", expected "${original}"`
    );
  }

  return suggestion;
}

/**
 * Fixture 1: Demonstrates all 3 categories (grammar, vocabulary, spelling)
 */
export function getMultiCategoryFixture(): FixtureScenario {
  const text = 'Hoy yo fui a la biblioteka para estudiar, pero no tenia mis libro.';
  // biblioteka -> biblioteca (spelling_accents)
  // tenia -> tenía (spelling_accents)
  // mis libro -> mis libros (grammar_syntax)

  const s1Start = text.indexOf('biblioteka');
  const s1End = s1Start + 'biblioteka'.length;

  const s2Start = text.indexOf('tenia');
  const s2End = s2Start + 'tenia'.length;

  const s3Start = text.indexOf('mis libro');
  const s3End = s3Start + 'mis libro'.length;

  const suggestions: Suggestion[] = [
    createValidatedSuggestion(
      text,
      'sug-spelling-1',
      'spelling_accents',
      'correction',
      'SPELL_K_TO_C',
      s1Start,
      s1End,
      'biblioteca',
      {
        title: 'Ortografía de "biblioteca"',
        message: 'En español se escribe con "c", no con "k".',
      }
    ),
    createValidatedSuggestion(
      text,
      'sug-accent-1',
      'spelling_accents',
      'correction',
      'ACCENT_IMPERFECT',
      s2Start,
      s2End,
      'tenía',
      {
        title: 'Tilde en pretérito imperfecto',
        message: 'El verbo "tener" lleva tilde en la "í" en pretérito imperfecto (tenía).',
      }
    ),
    createValidatedSuggestion(
      text,
      'sug-grammar-1',
      'grammar_syntax',
      'correction',
      'PLURAL_AGREEMENT',
      s3Start,
      s3End,
      'mis libros',
      {
        title: 'Concordancia de número',
        message: 'El determinante posesivo plural "mis" requiere el sustantivo en plural: "libros".',
      }
    ),
  ];

  validateSuggestionOffsets(text, suggestions);

  const entry: JournalEntry = {
    id: 'entry-multi-cat',
    title: 'Estudiando en la biblioteca',
    targetLanguage: 'es',
    content: text,
    revision: 1,
  };

  const analysis: Analysis = {
    id: 'analysis-multi-cat',
    entryId: entry.id,
    entryRevision: entry.revision,
    sourceText: text,
    status: 'completed',
    offsetEncoding: 'utf-16',
    suggestions,
    isMock: true,
  };

  return {
    name: 'Multi-Category Feedback',
    description: 'Demonstrates grammar, spelling, and accent corrections in one sentence.',
    entry,
    analysis,
  };
}

/**
 * Fixture 2: Demonstrates insertions and deletions
 */
export function getInsertionsDeletionsFixture(): FixtureScenario {
  const text = 'Me gusta mucho mucho el café de la mañana.';
  // Deletion: duplicate 'mucho '
  // Insertion: insert 'por' before 'la mañana'

  const delStart = text.indexOf('mucho ');
  const delEnd = delStart + 'mucho '.length;

  const insPos = text.indexOf('la mañana');

  const suggestions: Suggestion[] = [
    createValidatedSuggestion(
      text,
      'sug-del-1',
      'vocabulary_phrasing',
      'improvement',
      'REDUNDANCY',
      delStart,
      delEnd,
      '',
      {
        title: 'Eliminar palabra redundante',
        message: 'La repetición de "mucho" es redundante.',
      }
    ),
    createValidatedSuggestion(
      text,
      'sug-ins-1',
      'grammar_syntax',
      'improvement',
      'NATURAL_PREP',
      insPos,
      insPos, // start === end -> insertion!
      'por ',
      {
        title: 'Añadir preposición temporal',
        message: 'Es más natural decir "por la mañana" en este contexto.',
      }
    ),
  ];

  validateSuggestionOffsets(text, suggestions);

  const entry: JournalEntry = {
    id: 'entry-ins-del',
    title: 'Café matutino',
    targetLanguage: 'es',
    content: text,
    revision: 1,
  };

  const analysis: Analysis = {
    id: 'analysis-ins-del',
    entryId: entry.id,
    entryRevision: entry.revision,
    sourceText: text,
    status: 'completed',
    offsetEncoding: 'utf-16',
    suggestions,
    isMock: true,
  };

  return {
    name: 'Insertions & Deletions',
    description: 'Demonstrates pure insertion (caret marker) and pure deletion.',
    entry,
    analysis,
  };
}

/**
 * Fixture 3: Accents and emojis before highlighted range (UTF-16 safety)
 */
export function getUnicodeEmojiFixture(): FixtureScenario {
  // Flag emoji 🇪🇸 takes 4 UTF-16 code units: \uD83C\uDDEA\uD83C\uDDF8
  const text = '¡Hola amigos! 🇪🇸 Ayer comí una paella muy delicioso con mi familia.';

  const target = 'delicioso';
  const start = text.indexOf(target);
  const end = start + target.length;

  const suggestions: Suggestion[] = [
    createValidatedSuggestion(
      text,
      'sug-emoji-1',
      'grammar_syntax',
      'correction',
      'GENDER_AGREEMENT',
      start,
      end,
      'deliciosa',
      {
        title: 'Concordancia de género',
        message: '"Paella" es un sustantivo femenino, por lo que el adjetivo debe ser "deliciosa".',
      }
    ),
  ];

  validateSuggestionOffsets(text, suggestions);

  const entry: JournalEntry = {
    id: 'entry-unicode-emoji',
    title: 'Paella en España',
    targetLanguage: 'es',
    content: text,
    revision: 1,
  };

  const analysis: Analysis = {
    id: 'analysis-unicode-emoji',
    entryId: entry.id,
    entryRevision: entry.revision,
    sourceText: text,
    status: 'completed',
    offsetEncoding: 'utf-16',
    suggestions,
    isMock: true,
  };

  return {
    name: 'Unicode & Emoji Safety',
    description: 'Validates UTF-16 offset precision after emojis and inverted exclamation marks.',
    entry,
    analysis,
  };
}

/**
 * Fixture 4: Repeated words in different places
 */
export function getRepeatedWordsFixture(): FixtureScenario {
  const text = 'El perro es bueno. Pero el otro perro es malo.';

  // Target second occurrence of 'perro'
  const firstIndex = text.indexOf('perro');
  const secondIndex = text.indexOf('perro', firstIndex + 1);

  const suggestions: Suggestion[] = [
    createValidatedSuggestion(
      text,
      'sug-repeat-1',
      'vocabulary_phrasing',
      'improvement',
      'VOCAB_SYNONYM',
      secondIndex,
      secondIndex + 'perro'.length,
      'can',
      {
        title: 'Variedad de vocabulario',
        message: 'Para evitar repetir "perro", puedes usar un sinónimo como "can" o referirte como "el otro animal".',
      }
    ),
  ];

  validateSuggestionOffsets(text, suggestions);

  const entry: JournalEntry = {
    id: 'entry-repeated-words',
    title: 'Dos perros',
    targetLanguage: 'es',
    content: text,
    revision: 1,
  };

  const analysis: Analysis = {
    id: 'analysis-repeated-words',
    entryId: entry.id,
    entryRevision: entry.revision,
    sourceText: text,
    status: 'completed',
    offsetEncoding: 'utf-16',
    suggestions,
    isMock: true,
  };

  return {
    name: 'Repeated Words Precision',
    description: 'Ensures suggestions target the exact occurrence of repeated words.',
    entry,
    analysis,
  };
}

/**
 * Fixture 5: Clean entry with no errors
 */
export function getCleanEntryFixture(): FixtureScenario {
  const text = 'Esta mañana salí a caminar por el parque mientras salía el sol.';

  const entry: JournalEntry = {
    id: 'entry-clean',
    title: 'Paseo matutino',
    targetLanguage: 'es',
    content: text,
    revision: 1,
  };

  const analysis: Analysis = {
    id: 'analysis-clean',
    entryId: entry.id,
    entryRevision: entry.revision,
    sourceText: text,
    status: 'completed',
    offsetEncoding: 'utf-16',
    suggestions: [],
    isMock: true,
  };

  return {
    name: 'Clean Entry (Zero Mistakes)',
    description: 'Valid text producing zero suggestions.',
    entry,
    analysis,
  };
}
