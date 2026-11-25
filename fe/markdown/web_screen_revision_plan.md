# Kế hoạch điều chỉnh catalog màn hình Web Portal

**Cập nhật:** 01/10/2026. Nguồn duy nhất cho topology và mã W01–W31: [`WEB_PORTAL_SCREEN_LIST.md`](../../erd/active/screen%20lists/WEB_PORTAL_SCREEN_LIST.md). Nguồn triển khai trước: [`MEMBER_SCREEN_LIST.md`](../../erd/active/screen%20lists/MEMBER_SCREEN_LIST.md) và [`user_flow.md`](./user_flow.md). Kế hoạch cũ ngày 28/09 đã được thay bằng lát cắt MEMBER-first; các đề xuất tách lịch nhóm/PT thành nhiều màn hình và “mua gói phải tới quầy” không còn áp dụng.

## 1. Phân loại màn hình

| Nhóm | Quyết định hiện tại |
| --- | --- |
| Public và MEMBER | Triển khai MEM-01–14 theo thứ tự đăng ký/đăng nhập → catalog/quote → checkout/status → gói/quota/invoice → lịch tuần hợp nhất → history/profile/InBody/workout/attendance/locker. |
| `/mock-payment` | Trang public **chỉ dev/demo**, QR tĩnh chứa URL trang; backend mock nhận `paymentId` và tạo webhook nội bộ. |
| ADMIN/CM/RECEPTIONIST/COACH | Giữ mã, route, quyền và yêu cầu trong WEB_PORTAL_SCREEN_LIST để truy vết; **toàn bộ UI ngoài lát cắt MEMBER đặt backlog triển khai sau**. API backend của các role này không bị xóa/đổi chỉ vì chưa triển khai UI. |
| MEMBER feedback/assistant/notifications | W29–W31 backlog, không hiển thị như tính năng hoạt động; chưa có API đầy đủ. |

## 2. Các chỉnh sửa bắt buộc cho MEMBER

1. W21 là **một màn hình** `/portal/member/bookings?week=YYYY-MM-DD`; W27 là bước PT bên trong. Không tách thành menu schedules/pt-slots/bookings. Tuần Thứ Hai–Chủ Nhật Việt Nam, Back/Next ±7 ngày, lọc môn và `view=all|group|pt|mine`, dùng `GET /members/me/calendar` thay vì ghép ba GET có cap. Eligibility xám theo gói/môn.
2. W23 catalog hiển thị Trial/Drop-in/Plus từ giá plan active; VIP hiện base hoặc “từ…”. W24 VIP quotation read-only; không tạo bảng/screen quotation snapshot hay tính giá VIP ở FE. PT add-on là thao tác của gói ACTIVE có Coach, không là tier thứ năm.
3. W26 checkout dùng `CheckoutOrder.priceSnapshot` làm số tiền chốt trước thanh toán. `GET /billing/checkouts/:id` là nguồn trạng thái; chỉ `FULFILLED` chứng minh đã cấp gói/invoice. Mock URL không phải cổng thanh toán thật. Giao dịch thất bại/chờ/review có trang trạng thái riêng, không lẫn invoice.
4. W22/W26/W21 phải giữ **`subscriptionId`** ở danh sách, quota, eligibility, booking và hóa đơn. Nhiều subscription/môn không được gộp quota. Booking POST hiện tự chọn subscription cùng môn đủ điều kiện, ưu tiên hết hạn sớm; UI không được hứa chọn chính xác một gói cùng môn để trừ quota khi request không nhận `subscriptionId`.
5. Sau `checkout.updated`, chỉ dùng event để invalidate. GET lại checkout; khi server trả `FULFILLED`, refetch subscriptions, invoices, calendar đang mở và transactions. Có polling/focus/reconnect fallback. Sau booking/hủy refetch calendar, quota và history; không optimistic trừ/hoàn lượt.
6. PT tối đa một booking còn hiệu lực theo MEMBER+môn+ngày Việt Nam, cho phép khác môn cùng ngày nếu không trùng giờ; hủy đúng hạn ≥2 giờ hoàn lượt và cho đặt lại cùng môn/ngày nếu hợp lệ. Hủy muộn không hoàn và vẫn chặn ngày. “Đổi lịch” là hủy rồi đặt mới, không nguyên tử.

## 3. Blocker, backlog và ranh giới nghiệm thu

- **Dữ liệu catalog:** `backend/prisma/seed.ts` chỉ tạo bốn plan Gym/Yoga và Yoga Plus/VIP còn giá/quota cũ so với ma trận bốn môn trong `business_rule_final.md`. Frontend không tự thêm tier để che thiếu dữ liệu. Trước khi bán đủ bốn môn cần đồng bộ nguồn dữ liệu và xem xét gói đã bán.
- **Lịch sử:** GET bookings/attendances/invoices cap 200, workout cap 100; không tuyên bố phân trang vô hạn/booking detail độc lập. Nếu sản phẩm cần, mở backlog API read riêng.
- **Thanh toán:** mock payment + webhook chỉ cho demo; PSP thật/refund tự động và inbox/FCM chưa có. Socket.IO không là nguồn trạng thái tiền.
- **Các role khác:** tiếp tục ở backlog dù backend có API một phần; khi quay lại phải so với thay đổi role mới ở `business_rule_final.md` và báo cáo backend, không dùng ma trận 22 màn hình cũ làm tiêu chí đủ.

Catalog route là **tài liệu triển khai**, không chứng minh UI đã tồn tại. Chỉ đánh dấu ready sau khi web thực sự chạy với backend, qua kiểm tra quyền/ownership, nhiều môn/gói, thanh toán thành công/thất bại, mất Socket.IO, race booking, ngày hết hạn gói và hủy đúng/muộn.
