import React from 'react';

/**
 * Khối Skeleton nguyên tử với hiệu ứng chuyển sắc mực/giấy cổ phong
 */
export function SkeletonBlock({
  className = '',
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`animate-pulse bg-parchment-2/60 rounded-[3px] ${className}`}
      style={style}
    />
  );
}

/**
 * Skeleton cho Card Dự Án trong ProjectList
 */
export function SkeletonProjectCard() {
  return (
    <div className="bg-parchment border border-parchment-2/70 rounded-md p-5 flex flex-col justify-between h-[240px] shadow-xs">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <SkeletonBlock className="h-5 w-3/5" />
          <SkeletonBlock className="h-4 w-12" />
        </div>
        <SkeletonBlock className="h-3 w-1/3" />
        <div className="space-y-1.5 pt-2">
          <SkeletonBlock className="h-3 w-full" />
          <SkeletonBlock className="h-3 w-4/5" />
        </div>
      </div>
      <div className="pt-4 border-t border-parchment-2/50 flex items-center justify-between">
        <SkeletonBlock className="h-3 w-20" />
        <SkeletonBlock className="h-8 w-24" />
      </div>
    </div>
  );
}

/**
 * Skeleton cho từng dòng trong danh sách chương / lịch sử dịch
 */
export function SkeletonChapterRow() {
  return (
    <div className="flex items-center justify-between p-3.5 bg-parchment border border-parchment-2/60 rounded-md mb-2">
      <div className="flex items-center gap-3 w-3/4">
        <SkeletonBlock className="w-4 h-4 rounded" />
        <div className="space-y-1.5 flex-1">
          <SkeletonBlock className="h-4 w-2/3" />
          <SkeletonBlock className="h-3 w-1/4" />
        </div>
      </div>
      <SkeletonBlock className="h-6 w-16 rounded" />
    </div>
  );
}

/**
 * Skeleton cho dòng bảng Từ Điển Thuật Ngữ
 */
export function SkeletonGlossaryRow() {
  return (
    <tr className="border-b border-parchment-2/40 animate-pulse">
      <td className="py-3 px-4 w-10">
        <SkeletonBlock className="w-4 h-4 rounded" />
      </td>
      <td className="py-3 px-4 w-1/4">
        <SkeletonBlock className="h-4 w-4/5" />
      </td>
      <td className="py-3 px-4 w-1/4">
        <SkeletonBlock className="h-4 w-3/4" />
      </td>
      <td className="py-3 px-4 w-1/6">
        <SkeletonBlock className="h-5 w-16 rounded" />
      </td>
      <td className="py-3 px-4 w-1/4">
        <SkeletonBlock className="h-3 w-full" />
      </td>
      <td className="py-3 px-4 w-16 text-right">
        <SkeletonBlock className="h-6 w-12 ml-auto" />
      </td>
    </tr>
  );
}

/**
 * Full Tab Loading Skeleton khi Suspense đang nạp mã nguồn component tab
 */
export function TabSkeleton({ title = 'Đang tải bản thảo...' }: { title?: string }) {
  return (
    <div className="space-y-5 animate-fade-in p-2">
      {/* Thanh tiêu đề giả lập */}
      <div className="bg-parchment border border-parchment-2 rounded-md p-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <SkeletonBlock className="w-8 h-8 rounded" />
          <div className="space-y-1.5">
            <SkeletonBlock className="h-5 w-48" />
            <SkeletonBlock className="h-3 w-32" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SkeletonBlock className="h-8 w-24 rounded" />
          <SkeletonBlock className="h-8 w-28 rounded" />
        </div>
      </div>

      {/* Vùng nội dung chính */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-3">
          <div className="bg-parchment border border-parchment-2 rounded-md p-5 space-y-4">
            <SkeletonBlock className="h-6 w-1/3" />
            <SkeletonBlock className="h-4 w-full" />
            <SkeletonBlock className="h-4 w-5/6" />
            <SkeletonBlock className="h-4 w-4/5" />
            <div className="pt-4 space-y-2">
              <SkeletonBlock className="h-28 w-full rounded" />
              <SkeletonBlock className="h-28 w-full rounded" />
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="bg-parchment border border-parchment-2 rounded-md p-5 space-y-4">
            <SkeletonBlock className="h-5 w-1/2" />
            <div className="space-y-2">
              <SkeletonBlock className="h-8 w-full rounded" />
              <SkeletonBlock className="h-8 w-full rounded" />
              <SkeletonBlock className="h-8 w-full rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
