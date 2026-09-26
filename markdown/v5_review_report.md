# Báo cáo khắc phục các điểm còn lệch V5 — 26/09/2026

## Kết quả

Đã sửa các điểm trong review gần nhất, áp dụng SQL cập nhật lên DB cấu hình qua DIRECT_URL và chạy seed. Yoga VIP hiện có base 1.000.000đ, thời hạn 30 ngày, 15 lượt nhóm và 12 lượt PT. Các thao tác kiểm thử tranh chấp dùng schema tạm độc lập, dọn trong finally.

## 1. Duyệt hủy khẩn cấp và bảo toàn quota

Trong `../erd/implementation_plan.md`, APPROVE và REJECT cùng claim yêu cầu bằng `updateMany` với điều kiện `id + status=PENDING`. Chỉ transaction cập nhật được đúng một hàng mới được xử lý tiếp. Các thao tác trạng thái, hoàn quota và audit nằm chung transaction.

PT và lớp nhóm chỉ hoàn lượt cho booking chuyển được từ CONFIRMED/PENDING sang CANCELLED. Nếu Member hoặc một yêu cầu khác đã hủy booking, transaction không cộng quota thêm. Hoàn vào booking.subscriptionId. Lớp nhóm giảm sĩ số đúng số booking transaction đã hủy thành công; không giảm theo snapshot cũ.

Mã mẫu sử dụng Serializable và retry toàn bộ transaction tối đa ba lần khi Prisma trả P2034; không retry độc lập bước hoàn quota. Slot PT bị hủy được giữ lại và đánh dấu isEmergencyCancelled=true. Đây là sửa trong tài liệu triển khai; backend hiện chưa có module xử lý hủy để thay thế một endpoint đang chạy.

## 2. Chống trùng lịch phòng/HLV

Migration SQL dùng hai partial GiST exclusion constraints cho schedules: phòng + khoảng thời gian và HLV + khoảng thời gian, chỉ xét OPEN/FULL. Loại bỏ trigger kiểm tra EXISTS trước đây vì không đủ bảo vệ hai transaction chạy đồng thời.

Lịch CANCELLED_BY_COACH/COMPLETED được giữ lại nhưng không giữ phòng/HLV. Không xóa schedule để giải phóng khung giờ. Slot PT emergency-cancelled cũng được loại khỏi exclusion của coach_availability.

Trigger kiểm tra chéo PT/lớp nhóm tính range từ start_time/end_time và chạy lại khi is_emergency_cancelled thay đổi. Kích hoạt lại slot bị hủy phải kiểm tra xung đột lịch nhóm.

PostgreSQL 15 hỗ trợ predicate WHERE cho exclusion constraint: https://www.postgresql.org/docs/15/sql-createtable.html. Nhận định cũ trong migration rằng PostgreSQL không hỗ trợ cú pháp này đã được loại bỏ.

## 3. OPEN/FULL và SQL tham chiếu

Thêm fn_sync_schedule_capacity_status và trigger tương ứng. Khi service cập nhật current_enrolled/capacity, DB tự chuyển OPEN ↔ FULL. Trigger giữ nguyên CANCELLED_BY_COACH/COMPLETED và không tự tăng/giảm sĩ số từ booking, tránh đếm hai lần.

Migration đồng bộ các lịch active hiện có về trạng thái phù hợp. SQL_v5.md có cùng định nghĩa trigger trạng thái và trigger kiểm tra chéo, cùng predicate của hai exclusion. Kế hoạch backend, mô tả dữ liệu và chú thích Prisma đã được cập nhật.

## 4. Seed Yoga VIP

Đổi durationDays từ 60 thành 30 ở cả create/update. Cập nhật mô tả gói ở cả hai nhánh để chạy lại seed sửa cả thời hạn lẫn mô tả cũ. Business rules ghi rõ thời hạn 30 ngày. Thay đổi danh mục gói không sửa thời hạn/quota của hợp đồng đã bán.

## 5. Quy trình áp dụng SQL

- `npm run db:constraints`: nạp .env, yêu cầu DIRECT_URL, chạy Prisma db execute --file. URL không nằm trong tham số command line.
- `npm run db:setup`: Prisma db push → SQL V5 → seed, dừng khi bước trước thất bại. Dùng cho Dev, không tự reset/accept-data-loss.
- `npm run db:verify:v5`: kiểm tra metadata đã cài và thực hiện các ca tranh chấp trong schema tạm. TEST_DATABASE_URL có thể chỉ định DB kiểm thử riêng.

SQL V5 chạy trong BEGIN/COMMIT để lỗi giữa chừng không để lại bộ ràng buộc áp dụng dở dang. Đã chạy db:constraints hai lần thành công để kiểm tra khả năng áp dụng lại.

README ghi rõ thứ tự cho CI/Production: migration schema đã review → migrate deploy → db:constraints. Các migration lịch sử chưa biểu diễn toàn bộ model V5; việc tạo migration schema đầy đủ cho database mới là công việc riêng, không được coi db push là migration production.

## Kiểm chứng

- Prisma validate: PASS.
- Nest build: PASS, exit code 0.
- Prisma seed: PASS, exit code 0.
- Áp dụng SQL và áp dụng lại: PASS.
- Metadata DB: có hai partial exclusions, trigger OPEN/FULL được bật; Yoga VIP đúng giá, ngày và quota.
- Syntax TypeScript của hai đoạn mẫu hủy/duyệt: PASS; không phải kiểm tra endpoint end-to-end.
- Hai lịch cùng phòng, khác HLV: đúng một transaction thành công.
- Hai lịch cùng HLV, khác phòng: đúng một transaction thành công.
- Đặt lịch lớp nhóm và mở slot PT cùng HLV/giờ: đúng một transaction thành công.
- OPEN → FULL → OPEN; trạng thái kết thúc được giữ nguyên.
- Lịch hủy giải phóng phòng/HLV và giữ bản ghi lịch sử.
- Kích hoạt lại slot PT bị hủy có xung đột: bị từ chối.
- Hai reviewer APPROVE: một claim, một lần hoàn lượt.
- APPROVE cạnh tranh REJECT: chỉ một quyết định cuối.
- Member hủy cạnh tranh Coach được duyệt hủy: không hoàn quota trùng.

Các kiểm thử SQL xác minh ràng buộc và mẫu chuyển trạng thái nguyên tử trên PostgreSQL thật. Chưa có module cancellation chạy thực tế, nên không gọi đây là kiểm thử API hoặc chứng nhận toàn bộ RLS/AI/billing của hệ thống.
