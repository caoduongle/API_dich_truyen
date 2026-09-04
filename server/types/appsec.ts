/**
 * Các kiểu dữ liệu xác thực danh tính & ủy quyền an ninh ứng dụng (AppSec Feature 088)
 */

export interface VerifiedUserContext {
  /** Địa chỉ email chính của người dùng (đã chuẩn hóa lowercase) */
  email: string;
  /** Tên hiển thị */
  name: string;
  /** ID người dùng duy nhất (từ Google OAuth sub hoặc UUID) */
  id?: string;
  /** Đường dẫn ảnh đại diện */
  picture?: string;
  /** Thời điểm token hết hạn (epoch ms) */
  expiresAt: number;
}

export type ProjectRole = 'owner' | 'editor' | 'viewer';

export interface WsTicketRequest {
  /** Mã định danh dự án */
  projectId: string;
  /** Mã định danh chương truyện */
  chapterId: string;
  /** Vai trò mong muốn ('editor' | 'viewer') */
  role?: ProjectRole;
}

export interface WsTicketPayload {
  /** Mã dự án được ủy quyền */
  projectId: string;
  /** Mã chương được ủy quyền */
  chapterId: string;
  /** Email người dùng đã xác minh (do Server gán, KHÔNG lấy từ client) */
  userEmail: string;
  /** Quyền hạn trong phòng làm việc */
  role: ProjectRole;
  /** Thời điểm cấp (epoch ms) */
  issuedAt: number;
  /** Thời điểm hết hạn (epoch ms) */
  expiresAt: number;
}

export interface ProjectAuthorization {
  projectId: string;
  userEmail: string;
  role: ProjectRole;
  isOwner: boolean;
}
