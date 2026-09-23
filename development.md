# DEVELOPMENT LOG & CONTEXT RECOVERY — SPORTS CENTER MANAGEMENT SYSTEM BACKEND

> **Mục đích tài liệu:** Lưu trữ chi tiết toàn bộ các thay đổi kiến trúc, tech stack, cấu trúc thư mục (structure tree) và logic nghiệp vụ sau mỗi phiên/prompt làm việc. Tài liệu này đóng vai trò là "Single Source of Truth" phục vụ việc tối ưu token, giúp khôi phục ngữ cảnh (context recovery) tức thì trong các phiên làm việc tiếp theo mà không cần phải đọc lại toàn bộ mã nguồn.

---

## 1. PROJECT METADATA & OVERALL STATUS

* **Tên dự án:** Sports Center Management System - Backend API
* **Mô hình kiến trúc:** Modular Monolith kết hợp Clean Architecture Principles
* **Mục tiêu hệ thống:** Phục vụ Web Admin (IT Admin / Center Manager / Receptionist) và Mobile App (Coach / Member). Hỗ trợ kiểm soát giao dịch đặt chỗ kép (Lớp nhóm cố định và PT 1-1 chống Overbooking bằng Pessimistic Lock ACID), quản lý ca trực lễ tân & thiết bị, điểm danh Realtime qua WebSocket, và trợ lý AI Workout Generator (Server-Sent Events streaming & RAG pgvector).
* **Giai đoạn hiện tại:** Đã bóc tách và đồng bộ tài liệu kiến trúc [implementation_plan_backend.md](file:///D:/FPT/FA26/WDP301/app/backend/markdown/implementation_plan_backend.md) theo [ERD_DB_addendum.md](file:///D:/FPT/FA26/WDP301/app/backend/markdown/ERD_DB_addendum.md) và phân quyền 2 tầng theo SRS. Sẵn sàng cập nhật `schema.prisma`.

---

## 2. MA TRẬN PHÂN QUYỀN 2 TẦNG (SRS & ADDENDUM ALIGNMENT)

Nhằm giải quyết triệt để xung đột giữa yêu cầu cốt lõi của **SRS** (*Center Manager phân quyền hệ thống*) và **Addendum** (*Tách vai trò `ADMIN` IT Support khỏi `CENTER_MANAGER`*):

* **Tầng 1 - IT & System Administration (`ADMIN`):**
  * Đảm nhiệm vai trò quản trị kỹ thuật cao nhất (IT Support), bảo trì hệ thống, cấu hình biến môi trường, giám sát audit log khi có sự cố dữ liệu.
  * Là người tạo tài khoản cấp cao cho `CENTER_MANAGER`. Không can thiệp vào nghiệp vụ bán gói hay vận hành phòng tập hằng ngày.
* **Tầng 2 - Center Business Operations (`CENTER_MANAGER`):**
  * Đóng vai trò Giám đốc trung tâm, nắm quyền tối cao ở tầng nghiệp vụ theo đúng SRS.
  * Trực tiếp tạo tài khoản và phân quyền truy cập chức năng cho nhân sự dưới quyền: `RECEPTIONIST`, `COACH`, `MEMBER`.
  * Xếp lịch ca trực nhân viên lễ tân, duyệt thiết bị, duyệt bảng giá Coach, xem toàn bộ báo cáo doanh thu & KPI.
  * **Ràng buộc an toàn:** Không thể tự nâng quyền cho chính mình lên `ADMIN` và không thể can thiệp vào tài khoản của `ADMIN`.

---

## 3. CÁC ĐIỂM THAY ĐỔI NGHIỆP VỤ & CƠ SỞ DỮ LIỆU CỐT LÕI (THEO ADDENDUM)

1. **Phân cấp người tạo tài khoản (`users.created_by_id`):**
   * Bổ sung cột tự tham chiếu `created_by_id UUID REFERENCES users(id)` (nullable).
   * Enforce phân cấp ở tầng Service: `ADMIN` tạo `CENTER_MANAGER`; `CENTER_MANAGER` (hoặc `ADMIN`) tạo `COACH`, `RECEPTIONIST`.
2. **Ca trực nhân viên lễ tân (`staff_shifts`):**
   * Quản lý ca trực theo ngày, khung giờ (`shift_date`, `start_time`, `end_time`).
   * Chống 1 nhân viên bị xếp 2 ca chồng giờ qua GiST exclusion hoặc logic validation.
3. **Mức phí theo huấn luyện viên (`coach_rates`):**
   * Quản lý giá dạy 1-1 của từng Coach (`rate_per_session`) theo khoảng thời gian hiệu lực (`effective_from` $\rightarrow$ `effective_to`).
   * **Nguyên tắc snapshot kế toán:** Khi phát hành hóa đơn (`invoices`), số tiền chốt được ghi trực tiếp vào `invoices.amount`, không phụ thuộc vào việc Coach đổi giá sau này.
4. **Tách biệt 2 luồng đặt chỗ (Booking Concurrency Dual-flow):**
   * **Luồng lớp nhóm (`GROUP_CLASS`):** Học viên đặt vào lịch học cố định (`schedules`), kiểm soát sĩ số lớp qua Pessimistic Lock (`SELECT ... FOR UPDATE`).
   * **Luồng huấn luyện viên cá nhân (`PERSONAL_TRAINING`):** Học viên chọn khung giờ $\rightarrow$ Hệ thống gợi ý Coach khả dụng (`coach_availability`) $\rightarrow$ Khóa slot PT 1-1 và trừ buổi tập trong gói PT.
   * `bookings.schedule_id` được chuyển sang nullable, bổ sung `coach_availability_id` và `booking_type`.
5. **Quản lý thiết bị máy tập (`equipment` & `equipment_reservations`):**
   * Quản lý danh mục máy tập theo từng phòng (`rooms`).
   * Chỉ cho phép giữ trước máy tập đối với các ca PT có Coach đi kèm và học viên có gói tập hợp lệ.

---

## 4. CẤU TRÚC THƯ MỤC HỆ THỐNG MỤC TIÊU

```text
backend/
├── prisma/
│   ├── schema.prisma                  # Lược đồ cơ sở dữ liệu đã tích hợp Addendum
│   └── seed.ts                        # Seed Admin, Center Manager, Coaches, Staff, Members, Rooms, Plans
├── src/
│   ├── common/                        # Constants, Decorators, Filters, Guards, Interceptors, Pipes
│   ├── config/                        # Validation biến môi trường (.env)
│   ├── database/                      # PrismaService & PrismaModule
│   ├── infrastructure/                # Redis (Lock/Cache), Queue (BullMQ), Socket.io, Storage
│   └── modules/
│       ├── auth/                      # Authentication JWT, Refresh Token, Logout
│       ├── users/                     # Phân quyền 2 tầng, Profile, CRUD Users
│       ├── staff-shifts/              # [Module Mới] Quản lý ca trực lễ tân
│       ├── coach-rates/               # [Module Mới] Quản lý cấu hình mức phí dạy của Coach
│       ├── equipment/                 # [Module Mới] Quản lý máy tập & giữ chỗ máy cho ca PT
│       ├── memberships/               # Gói tập (General/PT), Subscription, KPI định mức tuần
│       ├── classes/                   # Bộ môn, Phòng tập, Lớp học nhóm, Lịch học cố định
│       ├── bookings/                  # Điều phối đặt chỗ kép: Group Class vs PT 1-1
│       ├── attendances/               # Điểm danh quầy (Gate Entry) & Lớp/PT (Class/PT Session)
│       ├── billing/                   # Hóa đơn snapshot, Thanh toán
│       ├── analytics/                 # Thống kê, Báo cáo doanh thu & KPI
│       └── ai-assistant/              # Trợ lý bài tập SSE Stream, RAG pgvector
```

---

## 5. ROADMAP TIẾP THEO

* [ ] **Bước 1:** Cập nhật `prisma/schema.prisma` với 5 roles (`ADMIN`, `CENTER_MANAGER`, `COACH`, `RECEPTIONIST`, `MEMBER`), thêm `staff_shifts`, `coach_rates`, `coach_availability`, `equipment`, `equipment_reservations`, `plan_curriculum_requirements`.
* [ ] **Bước 2:** Cập nhật `RolesGuard` và `@Roles()` tương thích với hệ 5 vai trò mới.
* [ ] **Bước 3:** Cập nhật script `prisma/seed.ts` để sinh dữ liệu mẫu đầy đủ các vai trò mới.
* [ ] **Bước 4:** Lần lượt triển khai các domain modules: `staff-shifts`, `equipment`, `coach-rates`, `memberships` và `bookings` dual-flow.
