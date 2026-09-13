# Research: Anti-Scraping Character Stripping, NFC Normalization & Storage Visibility

## 1. Technical Context & Overview

This research artifact details the design choices for:
1. **Raw Text Cleaner Enhancement** (`src/utils/textCleaner.ts`): Stripping hidden anti-scraping zero-width characters and normalizing raw Chinese text to Unicode NFC before feeding into translation and glossary pipelines.
2. **Storage Usage Transparency** (`src/components/ApiSettings.tsx` & subcomponents): Integrating the existing `estimateStorageUsage()` function from `src/services/db.ts` into the settings interface.
3. **Scope Bounding & Governance (Nhóm D)**: Explicitly documenting why PWA, Web Crypto, Dockerfile deprecation, and OpenCC changes are out-of-scope for this iteration.

---

## 2. Research Decisions

### Decision 1: Stripping Anti-Scraping Zero-Width Characters

- **Target Characters**:
  - `\u200B`: Zero-Width Space (ZWSP) — frequently injected between Chinese characters (e.g. `第\u200B一\u200B章`) by scrapers to defeat automated search and regex scrapers.
  - `\uFEFF`: Byte Order Mark (BOM) / Zero-Width No-Break Space — commonly present at the start of text files or inserted maliciously.
  - `\u200D`: Zero-Width Joiner (ZWJ) — used in emojis or complex scripts, but irrelevant in modern Chinese text.
  - `\u200C`: Zero-Width Non-Joiner (ZWNJ) — used to separate ligatures, unwanted in Chinese text.
- **Implementation Strategy**:
  - Execute a single compiled regular expression replacement:
    `cleaned = cleaned.replace(/[\u200B\uFEFF\u200D\u200C]/g, "");`
  - Position: Execute immediately at the start of `cleanChineseText()` prior to advertisement regex evaluation and paragraph line trimming.
- **Alternatives Considered**:
  - *Include Unicode Tags (`\u{E0000}`–`\u{E007F}`)*: Handled at the AI defense layer (`ANTI_INJECTION_DEFENSE_DIRECTIVE`). In `textCleaner.ts`, confining the pattern to `[\u200B\uFEFF\u200D\u200C]` keeps the regex performant and focused on anti-scraping watermarks without risking surrogate pair overhead.

---

### Decision 2: Canonical Unicode NFC Normalization

- **Normalization Mode**: Unicode Normalization Form C (`.normalize('NFC')`).
- **Rationale**:
  - Chinese ideographs and Vietnamese diacritics can be encoded as either composed characters (NFC) or decomposed character sequences with combining marks (NFD).
  - Web browsers and LLM tokenizers (Gemini BPE) work most reliably and cost-effectively when text is canonically composed (NFC).
  - Applying `.normalize('NFC')` to the final trimmed string ensures consistent character length calculation, accurate regex matching in glossary replacement, and structural line matching.
- **Alternatives Considered**:
  - *NFKC (Compatibility Decomposition + Canonical Composition)*: Can inadvertently alter punctuation, full-width numbers, or intentional literary glyphs (e.g. turning `（` into `(`). NFC is strictly preserving of CJK literary punctuation while standardizing combining marks.

---

### Decision 3: Storage Estimation Presentation Architecture

- **Component Location**:
  - Create `src/components/api-settings/StorageUsageSection.tsx` inside the existing `src/components/api-settings/` directory, mirroring `KeyListSection.tsx`, `CustomModelSection.tsx`, and `TranslationQualitySection.tsx`.
  - Integrate `<StorageUsageSection />` into `ApiSettings.tsx` within the primary configuration tab.
- **Null Safety & Fallback**:
  - `navigator.storage.estimate()` is an optional browser API. In private browsing modes or unsupported web engines, `estimateStorageUsage()` returns `null`.
  - When `estimate === null`, `StorageUsageSection` returns `null` (renders nothing). This completely avoids showing misleading "0 MB / 0%" cards.
- **Interaction & State**:
  - Component calls `estimateStorageUsage()` on mount (`useEffect`).
  - Provides a compact "Làm mới" (Refresh) icon button (`RefreshCw` from `lucide-react`) allowing manual re-polling.
  - Visuals: Uses a subtle progress bar showing `${percentUsed}%` and text `${formattedUsage} / ${formattedQuota}`. If `isNearLimit === true` (>= 80% or < 100MB remaining), changes progress bar accent to warning color (`text-amber-400` / `bg-amber-500`).

---

### Decision 4: Non-Goals & Scope Boundaries (Nhóm D)

- **PWA**: Not included. As specified, translation physically requires online Gemini network calls; adding offline service workers creates false user expectations of offline translation capability.
- **Web Crypto (AES-GCM)**: Not included. The project constitution and `SECURITY.md` define the Zero-Server-Knowledge client architecture storing transient keys in `sessionStorage`. Static key encryption does not prevent runtime XSS since decryption keys must reside in client memory.
- **Dockerfile**: Preserved without changes. Documented in `README.md` as one of 4 official self-hosting options.
- **opencc-js**: Preserved in `vite.config.ts`. Synchronous calls in translation hooks prevent lazy-loading.
