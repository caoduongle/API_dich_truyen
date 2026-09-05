# Contract: Direct Glossary Engine Interface

**Path**: `src/services/directGlossaryEngine.ts`  
**Purpose**: TypeScript programmatic contract for direct client-side Gemini tasks.

---

## Exported Signatures

```typescript
export interface AnalyzeGlossaryDirectParams {
  text: string;
  apiKeys: string[];
  model?: string;
  startKeyIndex?: number;
  sourceChapterId?: string;
  isFullScan?: boolean;
  signal?: AbortSignal;
}

export interface AnalyzeGuidelinesDirectParams {
  markdownContent: string;
  apiKeys: string[];
  model?: string;
  startKeyIndex?: number;
  signal?: AbortSignal;
}

export interface ExtractGlossaryDirectParams {
  text: string;
  apiKeys: string[];
  model?: string;
  startKeyIndex?: number;
  sourceChapterId?: string;
  signal?: AbortSignal;
}

export interface AlignChapterDirectParams {
  sourceText: string;
  translatedText: string;
  apiKeys: string[];
  model?: string;
  startKeyIndex?: number;
  signal?: AbortSignal;
}

export interface QaCritiqueDirectParams {
  sourceText: string;
  translatedText: string;
  apiKeys: string[];
  model?: string;
  startKeyIndex?: number;
  signal?: AbortSignal;
}

export async function analyzeGlossaryDirect(
  params: AnalyzeGlossaryDirectParams
): Promise<GlossaryAnalysisResult>;

export async function analyzeGuidelinesDirect(
  params: AnalyzeGuidelinesDirectParams
): Promise<GuidelinesAnalysisResult>;

export async function extractGlossaryDirect(
  params: ExtractGlossaryDirectParams
): Promise<GlossaryAnalysisResult>;

export async function alignChapterDirect(
  params: AlignChapterDirectParams
): Promise<AlignChapterResult>;

export async function qaCritiqueDirect(
  params: QaCritiqueDirectParams
): Promise<QaCritiqueResult>;
```

## Behavior Contract
1. **Key Rotation**: Tự động xoay vòng qua danh sách `apiKeys` nếu một key bị lỗi quota/rate-limit hoặc network tạm thời.
2. **Cancellation**: Tuân thủ `AbortSignal` truyền vào; hủy bỏ ngay lập tức nếu user hủy hoặc component unmount.
3. **Payload Construction**: Gọi các hàm builder dùng chung từ `@shared/prompts` để đảm bảo logic tạo prompt đồng nhất 100% với backend.
