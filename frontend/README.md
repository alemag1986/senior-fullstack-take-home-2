# Frontend — AI Language Journal

This folder contains the Single Page Application (SPA) for the AI-Assisted Language Journaling project.

## Technology Stack
- **Framework**: React 18+ (TypeScript)
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Testing**: Vitest + React Testing Library

## Structure
```
frontend/
├── src/
│   ├── api/            # API client functions (communicates with backend)
│   ├── components/     # Reusable UI components (Editor, Corrections, History, Insights)
│   ├── types/          # TypeScript interface definitions (Entry, Feedback, Mistake)
│   ├── App.tsx         # Main application container & view routing
│   └── main.tsx        # Application entry point
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Getting Started
```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Run unit tests
npm test
```
