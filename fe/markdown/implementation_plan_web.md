# Kế hoạch triển khai Web Portal — ưu tiên luồng MEMBER

**Cập nhật:** 01/10/2026. Repo `app/web` hiện chỉ có scaffold React 19/Vite 8/TypeScript; chưa có router, API client, auth store hoặc màn hình nghiệp vụ. Backend giữ NestJS/Prisma hiện tại (32 model, 115 HTTP endpoint tại lần kiểm tra gần nhất), PostgreSQL, Redis cho auth và Socket.IO. Không đổi cấu trúc backend trong lát cắt frontend này.

Nguồn nghiệp vụ ưu tiên: [`business_rule_final.md`](../../erd/active/business%20rules/business_rule_final.md). Catalog route tổng thể: [`WEB_PORTAL_SCREEN_LIST.md`](../../erd/active/screen%20lists/WEB_PORTAL_SCREEN_LIST.md). Phạm vi sprint frontend: [`MEMBER_SCREEN_LIST.md`](../../erd/active/screen%20lists/MEMBER_SCREEN_LIST.md). Code routing mẫu và thứ tự thực hiện: [`user_flow.md`](./user_flow.md). Khi tài liệu đích khác mã nguồn, API/DTO thực tế quyết định khả năng tích hợp; ghi gap rõ thay vì giả endpoint.

## 1. Phạm vi và kiến trúc route

Giữ ba vùng: `/` public, `/portal` theo nghiệp vụ, `/console` ADMIN. **Chỉ triển khai luồng MEMBER trong đợt này**: đăng ký/đăng nhập → catalog theo môn → VIP quote read-only khi cần → checkout/trạng thái → subscription/quota/invoice → lịch tuần đặt/hủy nhóm/PT → history/profile/InBody/workout. Trang public `/mock-payment` là hỗ trợ demo, không là bằng chứng thanh toán thật. Route và UI cho ADMIN/CENTER_MANAGER/RECEPTIONIST/COACH là **backlog triển khai**, dù nhiều API backend đã có. MEMBER feedback/AI/inbox, PSP thật, Cron/FCM cũng backlog.

Backend có self-checkout mock, quotation, lịch tuần và PT rule. Ma trận sản phẩm trong `business_rule_final.md` là **mục tiêu nghiệp vụ**; seed hiện chỉ tạo Gym Plus và ba plan Yoga với giá/quota Yoga cũ. FE chỉ hiển thị plan active API trả, không tự bù SKU; chưa được ghi nhận đã cover đủ bốn môn để bán cho tới khi dữ liệu nguồn được đồng bộ.

## 2. Nền tảng frontend cần tạo

- Router + public/member layout + guard: trạng thái `loading`, `anonymous`, `authenticated`, `unavailable`; role MEMBER theo server. Không biến 503 thành logout. Deep link và return URL phải giữ nguyên trong phạm vi nội bộ an toàn.
- API client theo `/api/v1`, unwrap envelope, Bearer token, refresh single-flight, lỗi chuẩn; auth/session store chỉ giữ dữ liệu phiên. Dữ liệu server dùng TanStack Query hoặc giải pháp tương đương, query key gắn user, `subscriptionId`, tuần/filter khi cần; xóa cache/socket khi đổi user hoặc logout.
- Socket.IO namespace `/realtime`, path `/socket.io/`, handshake token; listener cleanup và reconnect/refetch. Event chỉ invalidate GET, không quyết định trạng thái payment/quota. REST polling/focus fallback cho checkout.
- Component dùng chung: loading/error/empty/unavailable, status badge, confirm dialog, product price breakdown, subscription card, lịch tuần, quota theo subscription. Không tạo folder trống chỉ để khớp sơ đồ.

## 3. Lát cắt MEMBER và hợp đồng dữ liệu

| Bước | Màn hình | Backend đã có | Điều kiện tích hợp |
| --- | --- | --- | --- |
| 1 | MEM-01 auth | `/auth/register`, `/login`, `/refresh`, `/logout`, `/users/profile/me` | MEMBER tự đăng ký; forgot password/OTP chưa có. |
| 2 | MEM-02 catalog | `/disciplines`, `/memberships/plans?disciplineId=&packageTier=` | Trial/Drop-in/Plus lấy giá cố định; VIP hiện base. Chỉ dùng plan active thật. |
| 3 | MEM-03 VIP quote | `/coaches`, `/billing/quotations/vip?planId=&coachId=` | Read-only; không có quoteId; checkout tính giá lại. |
| 4 | MEM-04/05 checkout, giao dịch | `/billing/checkouts`, `/:id`, `/:id/retry`, `/:id/reconcile`, mock payment API | `Idempotency-Key`; chỉ `FULFILLED` từ GET là quyền đã cấp. PSP thật backlog. |
| 5 | MEM-06/07 gói, hóa đơn | `/memberships/subscriptions`, `/billing/invoices`, add-on preview | Mỗi gói/quota/hóa đơn giữ `subscriptionId` riêng; renew/add-on vào checkout. |
| 6 | MEM-08 lịch tuần | `/members/me/calendar?week=`, POST group/PT, PUT cancel | Một lưới tuần Việt Nam, không pagination trong tuần; đúng rule PT và refetch quota sau mutation. |
| 7 | MEM-09–14 hồ sơ/lịch sử | `/bookings`, `/attendances`, `/users/profile/me`, `/inbody/my-progress`, `/workout-plans`, locker API | Read limits hiện có; chưa có reschedule nguyên tử và GET booking detail riêng. |

`GET /members/me/calendar` trả `subscriptions[].id`, `days[].eligibility[].subscriptionId` và bookings có `subscriptionId`. Booking POST **không nhận `subscriptionId`**; backend tự chọn gói đủ điều kiện của đúng môn, ưu tiên hết hạn sớm nhất, PT còn khớp Coach. FE không được cho người dùng tin rằng chọn card gói cụ thể sẽ buộc API trừ chính gói đó nếu có hai gói cùng môn. Sau đặt/hủy phải lấy lại booking/quota nguồn server. Hai môn khác nhau có thể tập PT cùng ngày nếu không trùng giờ; hủy đúng hạn ≥2h hoàn lượt và có thể đặt lại cùng môn/ngày; hủy muộn không hoàn và chặn ngày.

`checkout.updated` chỉ là tín hiệu refetch `GET /billing/checkouts/:id`. Khi GET xác nhận `FULFILLED`, invalidate checkout list, subscriptions, invoices **và calendar tuần đang mở**. Polling/focus/reconnect xử lý khi event bị mất; không dùng payload socket/redirect/QR để xác nhận đã thanh toán. Booking event/mutation cũng invalidate calendar, subscriptions và history. Trial 0đ có thể hoàn tất nội bộ; mock payment chỉ dev/demo.

## 4. Thứ tự công việc và nghiệm thu

1. Dựng foundation/auth, guard, API client và route public/member. Kiểm tra refresh token, 401/403/503, deep link, logout và đổi tài khoản.
2. Dựng catalog theo môn, VIP quote và checkout/status/transactions. Kiểm tra Trial 0đ, giá preview đổi khi checkout, duplicate idempotency key, failed/retry/reconcile, webhook lặp và mất Socket.IO.
3. Dựng subscription/quota/invoice theo `subscriptionId`, rồi lịch tuần. Kiểm tra nhiều môn/gói, hai gói cùng môn, tuần ±7 ngày, ngày ngoài hạn, group full, PT trùng môn/ngày hoặc trùng giờ liên môn, hủy đúng/muộn.
4. Dựng history/profile/InBody/workout/attendance/locker; thể hiện giới hạn list và quyền MEMBER chỉ đọc ở các trang phù hợp.
5. Chạy `npm run lint`/`npm run build` của web khi code được thêm; tích hợp backend thực tế và test trên trình duyệt. Hiện tài liệu này chỉ là kế hoạch, **chưa có code UI để kiểm thử**.

## 5. Backlog sau luồng MEMBER

- ADMIN: console metrics/audit/CM; cấu hình secrets/payment/FCM chưa có API.
- CENTER_MANAGER: vận hành/lịch/cơ sở/báo cáo; doanh thu theo tháng và coach duty còn thiếu.
- RECEPTIONIST: POS/gate đã có một phần, nhưng tạo MEMBER tại quầy, quote quầy, nộp hủy hộ Coach và check-out/chấm công chưa đủ API.
- COACH: availability/attendance/workout thủ công có một phần; ca làm, session log, template/cả lớp, thiết bị theo ca và roster tuần còn thiếu.
- MEMBER bổ sung: feedback, AI, inbox/FCM, PSP thật, reschedule nguyên tử, lịch sử phân trang, Cron. Không đăng ký navigation như tính năng ready.

Các khoảng trống backend và dữ liệu được ghi ở [`business_coverage_audit_2026-10-01.md`](../../backend/markdown/business_coverage_audit_2026-10-01.md). Không thay đổi backend vì một route/frontend feature chưa cần thêm API.
