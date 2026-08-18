# Design system: "Mực & Chu Sa" (Ink & Cinnabar)

Bản sắc hiện tại của app **không phải** giao diện AI mặc định — đây là bản thảo cổ
phong: nền mực tối, giấy da rám nắng, một chấm đỏ chu sa. Nhiệm vụ của bạn là MỞ RỘNG
bản sắc này sang các màn hình còn thiếu, không phải thay nó bằng theme trung tính kiểu
dashboard SaaS. Phép thử nhanh trước khi commit: nếu đổi logo/tên app mà giao diện vẫn
y hệt mọi app AI khác → chưa đạt.

## Token (định nghĩa ở `src/index.css`, dùng class Tailwind, đừng hard-code hex mới)
- `bg-ink` #14100D (nền chính, tối) · `bg-parchment` / `bg-parchment-2` (bề mặt thẻ/viền)
- `text-text-main` / `text-text-muted`
- `text-polish` / `bg-polish` #B8402C — **đỏ chu sa, CHỈ dùng cho**: hành động chính,
  trạng thái "đang hoạt động/đã xác nhận", điểm nhấn duy nhất. Không dùng thêm
  rose/red/pink của Tailwind mặc định cho lỗi — nếu cần màu lỗi, ưu tiên tông amber
  đã dùng sẵn (amber-950/amber-300) hoặc hỏi trước khi thêm token mới.
- Font: `font-display` = Fraunces (tiêu đề), mặc định = Be Vietnam Pro (thân bài),
  `font-serif`/Noto Serif SC cho ký tự Hán, `font-mono` = JetBrains Mono (số liệu/code).

## Hình khối
- Bo góc CHỈ dùng `rounded-[2px]` (badge/input nhỏ) hoặc `rounded-[3px]`/`rounded-md`
  (card/panel). Không dùng `rounded-xl`, `rounded-2xl`, hay `rounded-full` trừ khi đó
  thực sự là vòng tròn (avatar, progress-cap, chấm trạng thái).
- Không dùng gradient nhiều màu (`gradient-to-r from-X to-Y` kiểu tím-hồng-xanh). Nếu
  cần chiều sâu, dùng `shadow-xs`/`shadow-md` tối giản như code hiện có.
- Z-index: dùng đúng thang sau, không tự chế số tùy tiện (đã phát hiện dự án có tới 7
  giá trị z-index khác nhau, gây chồng lớp sai):
  `z-10` nội bộ trong 1 component · `z-30` sticky header/tab bar ·
  `z-40` dropdown/tooltip · `z-50` modal/dialog overlay · `z-[60]` toast/notification
  (luôn nổi trên modal). Nếu thấy `z-55`, `z-[9990]`, `z-[9999]`, `z-[99999]` khi sửa
  file nào đó — chuẩn hóa lại theo thang này trong lúc tiện tay.

## Mô-típ nhận diện: con dấu triện (Seal)
`src/components/ui/Seal.tsx` là mô-típ lặp lại xuyên suốt app — khung vuông nhỏ xoay
nhẹ (-rotate-3, hover về 0°) chứa 1 chữ Hán, mô phỏng ấn triện thư pháp. Hai cách dùng
đã có: `tone="polish"` (đỏ, nghĩa "đã xác nhận" — xem `SealStamp.tsx`/glossary) và
`tone="ink"` (trung tính, nghĩa "phân loại" — xem `GenreMark.tsx`/thể loại truyện).
**Khi cần một dấu hiệu nhận diện nhỏ mới (trạng thái, phân loại...), ưu tiên tái dùng
Seal với tone phù hợp thay vì tạo icon/emoji mới.** Không dùng emoji nền tảng
(✨⚔️👻🌾 v.v.) ở bất kỳ đâu — emoji render khác nhau giữa Windows/macOS/Android và phá
vỡ ngôn ngữ hình ảnh (lucide-react line icon + con dấu chữ Hán) mà app đang dùng.

## Chuyển động (đã cài `motion`, đừng cài framer-motion song song)
Dial gợi ý cho app này (công cụ làm việc hằng ngày, không phải landing page):
**ENERGY thấp-vừa · RHYTHM vừa (nhịp đều, không giật) · MOTION thấp-vừa**. Cụ thể:
- Danh sách/lưới card khi load: stagger nhẹ (delay ~0.03-0.05s/item), không quá 8 item
  đầu có delay riêng, còn lại đồng loạt (xem `CARD_ENTRANCE` trong `ProjectList.tsx`).
- Modal/toast: spring nhẹ, đã có sẵn pattern tốt trong `NotificationSystem.tsx` — copy
  y hệt easing/duration đó cho modal khác, đừng tự bịa easing mới mỗi file.
- KHÔNG dùng `animate-bounce`, parallax scroll, 3D tilt, hay hiệu ứng "hero page" kiểu
  Aceternity/Magic UI (aurora, beams, globe, spotlight...) — những hiệu ứng đó thiết kế
  cho trang marketing, nhồi vào công cụ thao tác dày đặc sẽ gây rối mắt và chậm máy.

## Trạng thái bắt buộc phải có cho MỌI danh sách/bảng dữ liệu
Loading (dùng `src/components/common/Skeleton.tsx` có sẵn) · Empty (dùng
`src/components/ui/EmptyState.tsx`, luôn kèm 1 hành động rõ ràng) · Error (thông báo cụ
thể + nút thử lại, không chỉ "Đã có lỗi xảy ra"). Thiếu 1 trong 3 trạng thái = chưa
xong việc.

## Primitives đã có trong `src/components/ui/` — tái dùng, đừng viết lại
- `cn()` (`src/lib/cn.ts`) — luôn dùng để merge className thay vì nối chuỗi thủ công.
- `Button` — variant: primary/secondary/outline/ghost/danger; size: sm/md/icon.
- `Badge` — tone: neutral/polish/warning/danger/solid. Không phải pill — bo [2px].
- `Seal`, `GenreMark`, `SealStamp` — xem mục "Mô-típ nhận diện" ở trên.
- `EmptyState`, `Kbd` — dùng lại thay vì tự viết markup tương tự.
- **Còn thiếu, có thể cần tạo khi chạm tới**: `Modal`/`Dialog` dùng chung (hiện có
  ~8 modal tự viết riêng: AuthModal, ApiSettings, DiffModal, ReviewQueuePanel,
  ProjectMetadataModal, QuickAddTermModal, ImportGuidelinesModal, ImportChaptersModal —
  mỗi cái tự set z-index/backdrop khác nhau). Nếu sửa modal nào, cân nhắc trích xuất
  luôn thành `src/components/ui/Modal.tsx` (props: `open`, `onClose`, `title`,
  `children`, đóng bằng phím Escape + click backdrop, focus trap) rồi migrate dần —
  không bắt buộc migrate hết 8 modal trong 1 lần.

## Cách dùng các nguồn tham khảo bên ngoài (đã audit, đừng đọc lại từ đầu)
- **shadcn/ui**: tham khảo kiến trúc "component sở hữu được, có variant" — đã áp dụng
  đúng tinh thần này ở `src/components/ui/`. KHÔNG copy bảng màu neutral-gray mặc định
  của shadcn đè lên token ink/parchment hiện có.
- **Aceternity UI / Magic UI**: chỉ mượn Ý TƯỞNG tương tác nhỏ (hover glow, animated
  border tinh tế) nếu thật sự cần — KHÔNG import nguyên component hiệu ứng landing
  page (3D card, aurora, globe, parallax, beams).
- **coss.com/ui**: dùng làm checklist "app có thiếu loại component nào không" (đã phát
  hiện thiếu Empty/Kbd — đã bổ sung). Có thể tham khảo tiếp: `Command` (command
  palette — hợp lý vì app đã có hotkey Alt+1..5 nhưng chưa expose), `Field`/`Fieldset`
  cho form (ApiSettings, ProjectFormModal đang tự validate thủ công).
- **anti-slop / taste-skill**: đã map dial ENERGY/RHYTHM/MOTION ở trên. Nguyên tắc lõi
  cần giữ: mỗi thành phần trực quan phải có LÝ DO chức năng, không phải trang trí.
