# Take-home assignment: AI-assisted Language Journaling

## Goal

Build a small web application that helps a user practice a foreign language through journaling.

The product should let users write journal entries in a language they are learning, receive AI-assisted feedback, review past entries, and (optionally) understand how their mistakes evolve over time.

This assignment is split into two stages:

- **Stage 1 (Core)**: Writing + AI feedback + basic review
- **Stage 2 (Extension)**: Mistake tracking and improvement insights

You should fully complete Stage 1. Stage 2 is optional but encouraged.

We care more about clarity and correctness than feature completeness.

---

## Product concept

The application should support this basic idea:

> I want to write in a foreign language regularly, get useful corrections, and understand what mistakes I make repeatedly.

The writing experience should minimize friction. Users should be able to express themselves without constantly interrupting their flow to look up every word or grammar rule.

---

## Stage 1 — Core functionality

### Journal writing flow

At minimum, the user should be able to:

1. Create a new journal entry in a foreign language
2. Submit the entry for AI feedback
3. See corrections or suggestions
4. Save the entry and feedback
5. Review previous entries later

You may assume a single user.

---

## Open-ended product decisions

Several important product decisions are intentionally left open.

You may choose:

- What kind of corrections to provide:
  - grammar-only corrections
  - vocabulary improvements
  - style suggestions
  - rewritten versions
  - diffs
  - explanations
  - mistake categories

- How corrections are presented:
  - inline highlights
  - side-by-side comparison
  - list of issues
  - corrected full version
  - learning-focused explanations

- How to make writing easier:
  - lightweight vocabulary help
  - hints
  - translation assistance
  - autocomplete
  - post-writing feedback only
  - another approach you think is better

In your README, explain:

- What correction approach you chose
- Why it helps language learning
- How your UI supports the writing/review flow
- What you deliberately left out

---

## Stage 2 — Errors & improvement review (optional)

Extend the application to help users understand how their mistakes evolve over time.

This stage focuses on turning individual corrections into learning insights.

Possible directions:

- Track and categorize mistakes across entries
- Identify common or repeated mistakes
- Show which mistake types are decreasing over time
- Provide a simple “improvement summary”
- Highlight patterns in user errors

You are free to define:

- What a “mistake” is
- How mistakes are stored
- How progress is calculated
- How insights are presented

This stage does not need to be complex. A simple, well-reasoned implementation is preferred over an ambitious but unclear one.

If you choose not to implement Stage 2, briefly describe how you would approach it.

---

## AI integration

Use any AI provider or local model you prefer.

The AI should be used for at least:

1. Analyzing a journal entry
2. Returning corrections, suggestions, or structured mistake data

### Requirements

- The implementation should explain how AI output is parsed, stored, and surfaced to the user
- The README should describe how to configure the selected AI provider or model

---

## Backend requirements

Design the backend API and data flow needed to support your product decisions.

The backend should support, at minimum:

- Creating and storing journal entries
- Sending entries for AI analysis
- Storing AI feedback
- Returning previous entries and their feedback

If you implement Stage 2, your backend should also support:

- Storing mistake-related data
- Aggregating or analyzing mistakes over time

In your README, briefly explain:

- Your API design
- Your data model
- How AI analysis is triggered and stored
- Any important tradeoffs or limitations

---

## Persistence

Use a database such as SQLite, Postgres, or another reasonable choice.

Store at minimum:

- Journal entry text
- Language
- AI feedback
- Timestamp

If implementing Stage 2, also store:

- Mistakes or structured correction data

---

## Frontend requirements

Build a Single Page Application using any modern frontend framework.

### Required screens (Stage 1)

1. **Writing screen**
   - Create a journal entry
   - Submit it for feedback
   - See AI feedback

2. **Entry history**
   - View previous entries
   - Open an entry and review its corrections

### Additional screen (Stage 2, optional)

3. **Progress / insights view**
   - Show a summary of mistakes or improvements over time

Minimal styling is sufficient, but the UX should be coherent.

---

## Testing

Include automated tests for the most important parts of your implementation.

We are especially interested in tests for:

- AI response parsing or defensive handling
- One main backend flow (create entry → analyze → store → retrieve)

If implementing Stage 2:

- Tests for mistake aggregation or progress logic

---

## Running the project locally

The repository must include clear instructions for:

- Installing dependencies
- Running backend and frontend locally
- Running the application with the chosen AI provider
- Running tests

A single command, Docker Compose setup, or small set of commands is preferred.

---

## Scope and tradeoffs

You are encouraged to reduce scope where appropriate.

Acceptable simplifications:

- Single user only
- One target language only
- Basic UI
- Minimal correction types
- No authentication
- No deployment

Do not spend time on polish at the expense of architecture, correctness, or clarity.

---

## Success criteria

We will evaluate:

- Product judgment
- API and data model design
- AI integration and handling
- Quality of the correction and review experience
- Code clarity and structure
- Test coverage
- Thoughtful scoping and README documentation

Stage 2 (if implemented) will be evaluated as a bonus, especially:

- How well mistakes are modeled
- How meaningful the insights are
- Simplicity and clarity of the approach

We are not looking for the largest feature set. We are looking for a coherent, well-reasoned product slice.