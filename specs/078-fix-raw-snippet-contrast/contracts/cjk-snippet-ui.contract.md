# Contract: CJK Raw Snippet & Bilingual Card Interface

**Feature**: `078-fix-raw-snippet-contrast`
**Date**: 2026-08-27
**Status**: Ready

## 1. CSS Class Contract (`src/index.css`)

```css
/* CJK Raw Snippet Typography Enhancement */
.cjk-raw-snippet {
  font-family: "Noto Serif SC", "Source Han Serif SC", "Songti SC", "SimSun", serif;
  letter-spacing: 0.02em;
  line-height: 1.65;
}
```

---

## 2. Component Markup Contract (`src/components/hako-checker/HakoIssueCard.tsx`)

### 2.1 Vietnamese Evidence Block Contract
```tsx
<div className="mb-3">
  <div className="text-[10px] uppercase font-bold text-text-muted tracking-wider mb-1">
    Trích đoạn bản dịch làm bằng chứng:
  </div>
  <div className="bg-ink/60 border-l-4 border-polish/80 border border-parchment-2 rounded-r-[2px] p-2.5 text-xs text-text-main leading-relaxed font-sans selection:bg-polish/30">
    "{issue.vietnameseSnippet}"
  </div>
</div>
```

### 2.2 Chinese Raw Snippet Block Contract
```tsx
{issue.rawSnippet && (
  <div className="mb-3">
    <div className="flex items-center justify-between text-[10px] uppercase font-bold text-text-muted tracking-wider mb-1">
      <div className="flex items-center gap-1.5 text-amber-500/90">
        <FileCode className="w-3 h-3 text-amber-500" />
        <span>Đoạn gốc tiếng Trung đối ứng (Raw):</span>
      </div>
      <button
        type="button"
        onClick={handleCopyRaw}
        title="Sao chép đoạn gốc tiếng Trung"
        className="flex items-center gap-1 text-[10px] font-medium text-text-muted hover:text-text-main px-1.5 py-0.5 rounded-[2px] bg-ink/50 border border-parchment-2 hover:border-polish/40 transition-colors cursor-pointer"
      >
        {isCopied ? (
          <>
            <Check className="w-2.5 h-2.5 text-emerald-400" />
            <span className="text-emerald-400 font-bold">Đã chép</span>
          </>
        ) : (
          <>
            <Copy className="w-2.5 h-2.5" />
            <span>Sao chép</span>
          </>
        )}
      </button>
    </div>
    <div className="bg-parchment/60 border-l-4 border-amber-600/80 border border-parchment-2 rounded-r-[2px] p-2.5 text-xs text-text-main font-medium leading-relaxed cjk-raw-snippet select-text">
      "{issue.rawSnippet}"
    </div>
  </div>
)}
```

---

## 3. Contrast Auditor Contract (`src/utils/contrastAuditor.ts`)

```typescript
export interface ContrastAuditResult {
  foreground: string;
  background: string;
  ratio: number;
  isWcagAaPass: boolean;
  isWcagAaaPass: boolean;
}

export function calculateLuminance(hexColor: string): number;
export function calculateContrastRatio(foregroundHex: string, backgroundHex: string): number;
export function auditThemeSnippets(theme: 'light' | 'dark' | 'sepia'): ContrastAuditResult;
```
