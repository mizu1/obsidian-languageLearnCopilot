# Language Learn Plugin

AI-powered language learning in Obsidian. Select text → get explanations → structured notes with relationships.

## Quick Start

1. **Install** — npm install, then npm run build, copy main.js, data.json, style.css, manifest.json to Obsidian plugins folder
2. **Configure** — open Settings → Language Learn, paste your API key, choose model
3. **Select text** → click "Analyze" floating button → AI explains and saves a note

## Features

### Word Analysis
Select a word or phrase → click **Analyze** → AI writes a structured note with:
- Part of speech + meaning
- Pronunciation (IPA / pinyin / kana)
- Morphology (word roots)
- Derived meanings with evolution paths
- Example sentences in context

### Hover Preview
Hover over any known word → popup shows meaning, etymology, examples. Click to open full note.

### Reinterpret in Context
Click **Reinterpret** on a note → AI compares existing explanations with current context:
- If applicable → cites note content, guides thinking
- If not → explains new meaning, optionally updates note

### AI Chat Panel (right sidebar)
Free-form chat with the AI assistant. Supports **streaming**, **conversation history** (auto-saved to `_chat_histories/`), and **file browsing** (read directory, search files).

### Vocabulary Highlighting
Known words are automatically highlighted in all notes. Click highlighted words to view notes.

### Relation Graph

Generate synonym / antonym / cognate relationships between words.

**How it works:**

1. **Flag system** — each word has 3 flags in `data.json`: synonym / antonym / cognate, each 0 (unprocessed), 1 (matched), or -1 (no match found). Only words with flag=0 enter the queue.

2. **Per-word query** — for each unprocessed word (focus), AI evaluates all other words (candidates):
   ```
   System: "Analyze which words share a {cognate} relationship with {focus}…"
   User: list of all other words
   ```
   
3. **Chain-of-Thought** — AI reasons step by step: identify word roots → compare → decide. If unsure, returns `[]`.

4. **Checker model** — a second AI pass reviews each match for fabricated etymology, false cognates, or far-fetched connections. Entries the checker rejects get `check: false` and are skipped.

5. **Three parallel queues** — synonym, antonym, and cognate run simultaneously via `Promise.all()`. Progress shown in the right panel.

6. **Wiki links** — confirmed matches write `[[wiki links]]` with reasoning into both word notes:
   ```markdown
   ## 同义词
   - [[unchanged]] — both mean "not changed", interchangeable
   ```

7. **Idempotent** — words marked 1 or -1 never re-enter the queue. Click **Reset** to clear all flags and links, then regenerate.

**Performance note:** This feature makes one AI call per word per relation type. For 100 words, that's ~300 calls. Best used with `deepseek-v4-flash` (budget) or `deepseek-v4-pro` (accuracy).

## Settings

| Category | Options |
|----------|---------|
| **Provider** | OpenAI, DeepSeek, Gemini |
| **Model** | Dropdown with presets per provider, or custom |
| **Language** | Native language + target language (dropdown) |
| **Storage** | Custom folders for word/phrase notes |

All settings apply on **Save & Apply** — no restart needed.

## Supported Languages

Interface: English, 中文 (extensible via `src/i18n/`)

Analysis: works with any language the AI model supports. The plugin auto-detects text language and adapts pronunciation format (IPA for English, pinyin for Chinese, kana for Japanese).

## File Structure

```
vault/
├── _word_notes/          # Word analysis notes
├── _phrase_notes/        # Phrase analysis notes
├── _chat_histories/      # Chat conversation history
└── _relations/           # Relation graph debug logs
```

## Adding New Languages

1. Copy `src/i18n/en.ts` → translate all strings
2. Register in `src/i18n/index.ts` maps
3. Add to `LANGUAGE_OPTIONS` in `src/types/index.ts`

## Commands

| Command | Action |
|---------|--------|
| Analyze selected text | Analyze word/phrase or translate sentence |
| Force store selected text | Force word-level analysis |
| Reanalyze current word | Re-run analysis on word under cursor |
| Generate relation graph | Run synonym/antonym/cognate analysis |
| Refresh index | Clear all relation marks + rescan folders |
