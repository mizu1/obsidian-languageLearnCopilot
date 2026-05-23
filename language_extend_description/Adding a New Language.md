# How to Add a New Language

## 1. Create Translation File

Create `xx-XX.ts` under `src/i18n/`. Copy `en.ts`, translate all strings.

```ts
// src/i18n/fr.ts
import { UIStrings } from './types';
export const fr: UIStrings = {
  selection: { analyze: 'Analyser', translate: 'Traduire', loading: '...', error: 'Erreur', processing: 'Analyse en cours...' },
  ...
};
```

## 2. Register the Language

Two places to update:

### `src/types/index.ts` — add enum value

```ts
export const LANGUAGE_OPTIONS = {
  'zh-CN': '中文',
  'en':    'English',
  'ja':    '日本語',
  'fr':    'Français',  // ← new
} as const;
```

### `src/i18n/index.ts` — register translations

```ts
import { fr } from './fr';  // ← import

const maps: Record<LanguageCode, UIStrings> = {
  'zh-CN': zhCN,
  'en': en,
  'ja': zhCN,   // fallback to Chinese until translated
  'fr': fr,     // ← register
};
```

## 3. Done

The new language appears in the settings dropdown automatically. Switching applies instantly — no component code changes needed.
