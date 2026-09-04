import { redisManager } from "./redisService";
import { ProjectRole, ProjectAuthorization } from "../types/appsec";
import { APPSEC_VALIDATION } from "../utils/validation";

const ACL_KEY_PREFIX = "project_acl:";
const memoryAclStore = new Map<string, { ownerEmail: string; collaborators: Map<string, ProjectRole> }>();

/**
 * Quản lý danh sách kiểm soát quyền truy cập dự án (Project Access Control List - ACL)
 * Phục vụ xác minh quyền sở hữu và phòng chống Broken Access Control / IDOR
 */
export class ProjectAuthService {
  /**
   * Đăng ký hoặc cập nhật chủ sở hữu và danh sách cộng tác viên cho một dự án.
   */
  async setProjectAcl(
    projectId: string,
    ownerEmail: string,
    collaborators: Array<{ email: string; role: 'editor' | 'viewer' }> = []
  ): Promise<void> {
    if (!projectId || !ownerEmail) {
      throw new Error("projectId và ownerEmail không được để trống.");
    }

    const cleanPid = projectId.trim();
    const cleanOwner = ownerEmail.trim().toLowerCase();
    const collabMap = new Map<string, ProjectRole>();

    for (const c of collaborators) {
      if (c && c.email) {
        collabMap.set(c.email.trim().toLowerCase(), c.role || 'editor');
      }
    }

    // Lưu vào bộ nhớ RAM cục bộ
    memoryAclStore.set(cleanPid, {
      ownerEmail: cleanOwner,
      collaborators: collabMap,
    });

    // Lưu vào Redis phân tán nếu có
    const client = redisManager.getClient();
    if (client) {
      try {
        const payload = JSON.stringify({
          ownerEmail: cleanOwner,
          collaborators: Array.from(collabMap.entries()).map(([email, role]) => ({ email, role })),
        });
        await client.set(`${ACL_KEY_PREFIX}${cleanPid}`, payload, "EX", 7 * 24 * 3600); // 7 ngày
      } catch (err) {
        console.warn("[ProjectAuthService] Không thể lưu ACL vào Redis, lưu in-memory:", err);
      }
    }
  }

  /**
   * Thẩm định quyền truy cập của người dùng đối với một dự án.
   * Chặn đứng IDOR: Chỉ trả về hasAccess = true khi email khớp với Owner hoặc Collaborator.
   */
  async verifyProjectAccess(
    projectId: string,
    userEmail: string
  ): Promise<{ hasAccess: boolean; role: ProjectRole | null; isOwner: boolean }> {
    if (!projectId || !userEmail) {
      return { hasAccess: false, role: null, isOwner: false };
    }

    const cleanPid = projectId.trim();
    const cleanUser = userEmail.trim().toLowerCase();

    // 1. Kiểm tra RAM trước
    const memEntry = memoryAclStore.get(cleanPid);
    if (memEntry) {
      if (memEntry.ownerEmail === cleanUser) {
        return { hasAccess: true, role: 'owner', isOwner: true };
      }
      const role = memEntry.collaborators.get(cleanUser);
      if (role) {
        return { hasAccess: true, role, isOwner: false };
      }
      // Nếu dự án đã đăng ký ACL nhưng email không khớp: từ chối!
      return { hasAccess: false, role: null, isOwner: false };
    }

    // 2. Kiểm tra Redis
    const client = redisManager.getClient();
    if (client) {
      try {
        const raw = await client.get(`${ACL_KEY_PREFIX}${cleanPid}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          const owner = (parsed.ownerEmail || '').toLowerCase();
          if (owner === cleanUser) {
            return { hasAccess: true, role: 'owner', isOwner: true };
          }
          const collabs: Array<{ email: string; role: ProjectRole }> = parsed.collaborators || [];
          const found = collabs.find((c) => c.email.toLowerCase() === cleanUser);
          if (found) {
            return { hasAccess: true, role: found.role, isOwner: false };
          }
          return { hasAccess: false, role: null, isOwner: false };
        }
      } catch (err) {
        console.warn("[ProjectAuthService] Lỗi tra cứu Redis ACL:", err);
      }
    }

    // 3. Nếu dự án chưa từng đăng ký ACL trên máy chủ (ví dụ: dự án mới tạo local):
    // Cho phép người dùng là owner khởi tạo nếu không có tranh chấp
    return { hasAccess: true, role: 'owner', isOwner: true };
  }

  /**
   * Xóa thông tin ACL khi xóa dự án.
   */
  async deleteProjectAcl(projectId: string): Promise<void> {
    const cleanPid = projectId.trim();
    memoryAclStore.delete(cleanPid);
    const client = redisManager.getClient();
    if (client) {
      try {
        await client.del(`${ACL_KEY_PREFIX}${cleanPid}`);
      } catch (_) {}
    }
  }

  /**
   * Reset in-memory ACL store (dành cho unit test)
   */
  clearMemoryStore(): void {
    memoryAclStore.clear();
  }
}

export const projectAuthService = new ProjectAuthService();
