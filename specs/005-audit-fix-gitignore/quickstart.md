# Quickstart & Verification Guide: Audit and Refine Project .gitignore

**Feature**: [spec.md](./spec.md) | **Date**: 2026-08-19

## 1. Automated Verification Commands

Kiểm tra trạng thái ignore của các tệp và thư mục qua Git CLI:

```bash
# 1. Kiểm tra file patch hiện tại trong root
git check-ignore -v quota-feature.patch

# 2. Kiểm tra các file nhạy cảm và file tạm giả lập
git check-ignore -v .env.local dump.rdb test.patch __pycache__/temp.pyc desktop.ini .DS_Store coverage/lcov.info .vitest/cache

# 3. Kiểm tra các tệp whitelist không bị ignore (lệnh trả về exit code 1)
git check-ignore -v .env.example .vscode/extensions.json specs/004-quota-usage-dashboard/spec.md .agents/rules/design-system.md

# 4. Kiểm tra git status tổng thể
git status
```

---

## 2. Project Quality Gates Verification

Đảm bảo việc cập nhật `.gitignore` không ảnh hưởng đến build và test:

```bash
# 1. TypeScript type check
npx tsc --noEmit

# 2. Test suite
npx vitest run

# 3. Production build
npm run build
```
