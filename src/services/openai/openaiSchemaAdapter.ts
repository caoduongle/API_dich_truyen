/**
 * OpenAI Structured Output Schema Adapter
 * Chuyển đổi schema chữ hoa kiểu Gemini sang JSON Schema chuẩn cho /v1/chat/completions
 * và sinh hướng dẫn cấu trúc JSON khi nhà cung cấp phải hạ cấp sang json_object / prompt_only.
 */

const GEMINI_TYPE_MAP: Record<string, string> = {
  OBJECT: 'object',
  ARRAY: 'array',
  STRING: 'string',
  NUMBER: 'number',
  INTEGER: 'integer',
  BOOLEAN: 'boolean',
};

function normalizeSchemaType(rawType: unknown): string | undefined {
  if (typeof rawType !== 'string' || !rawType.trim()) return undefined;
  const upper = rawType.trim().toUpperCase();
  return GEMINI_TYPE_MAP[upper] || rawType.trim().toLowerCase();
}

/**
 * Kiểm tra xem schema có thể dùng trực tiếp ở cấp response_format: { type: 'json_schema' } hay không.
 * Đặc tả OpenAI json_schema yêu cầu root node phải là 'object' (không hỗ trợ root 'array').
 */
export function canUseOpenAIJsonSchema(geminiSchema?: Record<string, any>): boolean {
  if (!geminiSchema || typeof geminiSchema !== 'object') return false;
  return normalizeSchemaType(geminiSchema.type) === 'object';
}

/**
 * Chuyển đổi đệ quy schema Gemini (OBJECT/ARRAY/STRING...) sang JSON Schema viết thường.
 * Mặc định sử dụng `strict: false` ở mức wrapper để giữ tương thích với các trường optional không nằm trong `required`.
 */
export function convertGeminiSchemaToJsonSchema(geminiSchema: Record<string, any>): Record<string, any> {
  if (!geminiSchema || typeof geminiSchema !== 'object') {
    return { type: 'object', additionalProperties: false };
  }

  const out: Record<string, any> = {};
  const mappedType = normalizeSchemaType(geminiSchema.type);
  if (mappedType) {
    out.type = mappedType;
  }

  if (typeof geminiSchema.description === 'string' && geminiSchema.description.trim()) {
    out.description = geminiSchema.description;
  }

  if (Array.isArray(geminiSchema.enum)) {
    out.enum = [...geminiSchema.enum];
  }

  if (mappedType === 'object' || (geminiSchema.properties && typeof geminiSchema.properties === 'object')) {
    out.type = 'object';
    const nextProps: Record<string, any> = {};
    if (geminiSchema.properties && typeof geminiSchema.properties === 'object') {
      for (const [key, val] of Object.entries(geminiSchema.properties)) {
        if (val && typeof val === 'object') {
          nextProps[key] = convertGeminiSchemaToJsonSchema(val as Record<string, any>);
        }
      }
    }
    out.properties = nextProps;
    if (Array.isArray(geminiSchema.required) && geminiSchema.required.length > 0) {
      out.required = [...geminiSchema.required];
    }
    out.additionalProperties = false;
  }

  if (mappedType === 'array' && geminiSchema.items && typeof geminiSchema.items === 'object') {
    out.items = convertGeminiSchemaToJsonSchema(geminiSchema.items as Record<string, any>);
  }

  return out;
}

/**
 * Sinh chỉ dẫn cấu trúc JSON ngắn gọn để đính kèm cuối systemInstruction khi hạ cấp sang json_object hoặc prompt_only.
 */
export function buildJsonInstructionHint(geminiSchema?: Record<string, any>): string {
  if (!geminiSchema || typeof geminiSchema !== 'object') {
    return '\n\n[ĐỊNH DẠNG ĐẦU RA BẮT BUỘC]\nChỉ trả về JSON hợp lệ, tuyệt đối không chèn giải thích ngoài khối JSON.';
  }

  const converted = convertGeminiSchemaToJsonSchema(geminiSchema);
  const rootType = converted.type || 'object';
  let shapeSummary = '';

  if (rootType === 'object' && converted.properties && typeof converted.properties === 'object') {
    const keys = Object.keys(converted.properties);
    const reqSet = new Set<string>(Array.isArray(converted.required) ? converted.required : []);
    const fieldLines = keys.map((k) => {
      const prop = converted.properties[k] || {};
      const t = prop.type || 'any';
      const reqLabel = reqSet.has(k) ? 'bắt buộc' : 'tùy chọn';
      return `- "${k}": (${t}, ${reqLabel})`;
    });
    shapeSummary = `Cấu trúc JSON Object gồm các khóa:\n${fieldLines.join('\n')}`;
  } else if (rootType === 'array') {
    shapeSummary = `Trả về một JSON Array ([...]) phù hợp với schema: ${JSON.stringify(converted)}`;
  } else {
    shapeSummary = `Schema JSON: ${JSON.stringify(converted)}`;
  }

  return `\n\n[ĐỊNH DẠNG ĐẦU RA BẮT BUỘC]\nChỉ trả về đúng một khối JSON hợp lệ (không bọc văn bản giải thích thừa bên ngoài).\n${shapeSummary}`;
}
