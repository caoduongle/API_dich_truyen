# Interface Contract: `exportFormatter`

## Functions

### `formatChapterForWeb(input: FormattedChapterInput): WebExportResult`
**Description**: Chuẩn hóa tiêu đề và thân chương cho chế độ xuất Web.

**Input**:
- `input.index`: Số thứ tự chương (1-based index)
- `input.chapterTitle`: Tiêu đề chương lưu trong metadata
- `input.translatedText`: Nội dung dịch hoàn chỉnh của chương

**Output**:
- `WebExportResult`: Chứa `formattedTitle`, `cleanBody`, và chuỗi kết hợp `fullOutput` (`*** ${formattedTitle}\n${cleanBody}`).

### `buildExportFileContent(chapters: FormattedChapterInput[], mode: ExportMode): string`
**Description**: Ghép danh sách các chương thành nội dung của một tệp văn bản xuất bản hoàn chỉnh.

**Output**: Chuỗi văn bản phân cách các chương bằng `\n\n`.
