# DEVELOPMENT LOG & CONTEXT RECOVERY — SPORTS CENTER MANAGEMENT SYSTEM BACKEND
## PRODUCTION RELEASE 5.0

> **Mục đích tài liệu:** Lưu trữ chi tiết toàn bộ các thay đổi kiến trúc, tech stack, cấu trúc thư mục (structure tree) và logic nghiệp vụ sau mỗi phiên/prompt làm việc. Tài liệu này đóng vai trò là "Single Source of Truth" phục vụ việc tối ưu token, giúp khôi phục ngữ cảnh (context recovery) tức thì trong các phiên làm việc tiếp theo mà không cần phải đọc lại toàn bộ mã nguồn.

---

## 1. PROJECT METADATA & OVERALL STATUS

* **Tên dự án:** Sports Center Management System - Backend API (V5 Production)
* **Mô hình kiến trúc:** Modular Monolith kết hợp Clean Architecture Principles
* **Mục tiêu hệ thống:** Phục vụ Web Portal (Admin/Center Manager/Receptionist) và Mobile App (Coach/Member), xử lý bán vé 4 môn đa tầng, đặt chỗ kép chống overbooking (Pessimistic Locking & PostgreSQL Advisory Lock), quản lý tiện ích hậu mãi (InBody, Lockers, Towel), điểm danh realtime qua WebSocket, và trợ lý AI Workout Generator (Server-Sent Events streaming & RAG pgvector).
* **Giai đoạn hiện tại:** Hoàn thành **Early Phase Architecture Sync** (Đã đồng bộ toàn diện với `SQL_v5.md`, chuẩn bị migration Prisma Schema 27 Models).
* **Trạng thái Build:** `npm run build` PASS (NestJS v12 + TypeScript 5.x, Prisma 5.22.0 LTS).

---

## 2. TECH STACK & VERSIONING TRACKING

| Công nghệ / Thư viện | Phiên bản thiết lập | Mục đích & Chi tiết kiến trúc V5 |
| :--- | :--- | :--- |
| **Node.js** | `v24.21.0` (LTS baseline v20+) | Runtime engine |
| **NestJS Core/Common** | `^12.0.1` | Core Framework xây dựng RESTful API Modular Monolith |
| **Prisma ORM** | `^5.22.0` (LTS ổn định) | ORM truy vấn PostgreSQL, quản lý schema 27 models |
| **Database** | PostgreSQL 15+ (Supabase) | Zero-Trust RLS trên 27 bảng, Pooler cổng 6543 (`DATABASE_URL`), Direct cổng 5432 (`DIRECT_URL`) |
| **Concurrency & Lock** | Redis 7 & `pg_advisory_xact_lock` | Redlock phân tán + Advisory Lock triệt tiêu race condition trùng lịch Coach |
| **Passport & JWT** | `passport: ^0.7.0`, `@nestjs/jwt: ^12.0.1` | Cấp phát & xác thực token Bearer, quản lý phiên trên Redis (TTL 7 ngày) |
| **Bcrypt** | `^6.0.0` | Băm mật khẩu (Salt rounds: 10) |
| **BullMQ** | `^6.3.4` | Quản lý tác vụ nền: Cronjob quét hết hạn thẻ 00:05, FCM push notifications |
| **Socket.io** | `^4.8.3` | WebSocket Gateway phát thông báo điểm danh realtime về Web Portal |
| **AI / Vector Search** | Gemini / OpenAI + `pgvector` | RAG tìm kiếm bài tập vector 1536 chiều, SSE streaming response |
| **Swagger** | `swagger-ui-express: ^5.0.1` | Tài liệu hóa API tại route `/docs` |

---

## 3. TARGET STRUCTURE TREE V5 (Cây thư mục hoàn chỉnh)

```text
backend/
├── .env                                       # File cấu hình môi trường thực thi cục bộ
├── .env.example                               # File mẫu biến môi trường chuẩn hóa
├── .gitignore
├── .prettierrc
├── development.md                             # [Cập nhật V5] Nhật ký phát triển và khôi phục ngữ cảnh
├── docker-compose.yml                         # Cấu hình Docker Redis 7 Alpine
├── instructions_steps.md                      # [Cập nhật V5] Hướng dẫn tuần tự 7 bước triển khai
├── package.json                               # Đồng bộ Prisma 5.22.0 LTS
├── README.md
├── markdown/
│   ├── development.md                         # Tài liệu đối chiếu
│   ├── implementation_plan_backend.md         # [Cập nhật V5] Kế hoạch triển khai tổng thể 7 phase
│   └── instructions_steps.md                  # [Cập nhật V5] Quy trình chi tiết 7 bước
├── prisma/
│   ├── schema.prisma                          # 27 Models, Enums (tương thích 100% SQL_v5.md)
│   └── seed.ts                                # Script seed 4 môn, Specialties, Lockers, 5 Roles, Gói mẫu
└── src/
    ├── app.module.ts                          # Nạp Config, Database, Redis, và các Domain Modules
    ├── main.ts                                # Swagger (/docs), ValidationPipe, Interceptors, Prefix
    ├── common/
    │   ├── constants/                         # Error codes, business constraints
    │   ├── decorators/                        # @Roles(), @CurrentUser(), @Public()
    │   ├── filters/                           # HttpExceptionFilter chuẩn hóa lỗi JSON
    │   ├── guards/                            # JwtAuthGuard, RolesGuard (5 vai trò)
    │   ├── interceptors/                      # LoggingInterceptor, TransformResponseInterceptor
    │   ├── pipes/                             # ValidationPipe
    │   └── utils/                             # Helpers, advisory lock keys
    ├── config/                                # Validation schema kiểm tra biến môi trường
    ├── database/                              # Prisma Module & Prisma Service
    ├── infrastructure/                        # Redis Module, Queue Module (BullMQ), Socket Gateway
    └── modules/
        ├── auth/                              # Đăng nhập, Refresh Token, Đăng xuất, Thu hồi session
        ├── users/                             # CRUD Users, Profiles (Phân cấp 2 tầng Admin/CM)
        ├── specialties/                       # [V5 Mới] Danh mục chuyên môn HLV (Specialties)
        ├── staff-shifts/                      # Lịch ca trực lễ tân, chống trùng ca
        ├── coach-rates/                       # Biểu phí theo giờ của HLV theo thời kỳ
        ├── coach-availability/                # [V5 Mới] Mở slot PT rảnh, chống trùng lịch chéo
        ├── equipment/                         # Quản lý thiết bị máy tập, giữ chỗ ca PT
        ├── lockers/                           # [V5 Mới] Danh mục tủ đồ và cấp phát atomic
        ├── memberships/                       # Gói tập 4 môn (Trial, Drop-in, Plus, VIP), hợp đồng hội viên
        ├── classes/                           # Bộ môn, Phòng tập, Lớp học, Lịch cố định (Schedules)
        ├── bookings/                          # Điều phối Dual-Flow Booking, Hủy lịch trước 2 tiếng
        ├── attendances/                       # Check-in Cổng (Tủ + Khăn) & Điểm danh Lớp/PT
        ├── inbody/                            # [V5 Mới] Quản lý lịch sử đo InBody định kỳ
        ├── billing/                           # Hóa đơn snapshot Base/PT, Đăng ký VIP, PT Add-on
        ├── analytics/                         # Báo cáo doanh thu, Tỷ lệ lấp đầy, Thống kê hội viên
        └── ai-assistant/                      # AI Workout Generator (SSE Stream & RAG pgvector)
```

---

## 4. CHI TIẾT CÁC PHIÊN LÀM VIỆC & BẢN VÁ KỸ THUẬT V5

### Phiên 1 & 2: Khởi tạo Early Phase & Khắc phục xung đột thư viện
* Thiết lập NestJS Core, Prisma 5.22.0 LTS, Docker Redis 7, Shared Kernel (`HttpExceptionFilter`, `TransformResponseInterceptor`, `LoggingInterceptor`, `JwtAuthGuard`, `RolesGuard`).
* Xây dựng `AuthModule` (JWT + Redis session revocation) và `UsersModule` (CRUD người dùng nội bộ).

### Phiên 3 (V5 Sync): Cập nhật Toàn Diện Kiến Trúc & Xử Lý Misses.md
* **Đồng bộ hóa 100% với `SQL_v5.md`:**
  1. **Khắc phục Race Condition của Trigger:** Sử dụng `pg_advisory_xact_lock(hashtext(v_coach_id::text))` trong PostgreSQL Trigger chống xung đột chéo giữa lịch lớp nhóm và slot PT.
  2. **Zero-Trust Row Level Security (RLS):** Thiết lập cấu hình bảo vệ toàn bộ 27 bảng dữ liệu trên Supabase.
  3. **Atomic Concurrency Cho Tủ Đồ:** Áp dụng Partial Unique Index `uq_locker_single_active_assignment ... WHERE returned_at IS NULL`.
  4. **Số hóa Ma trận Bán vé 4 Môn:**
     - Gym: Chỉ vào tập tự do (Plus) & PT 1-1 (VIP Base + <X>k), hoàn toàn không có lớp nhóm.
     - Boxing/Yoga/Dancing: Hỗ trợ cả Lớp nhóm (sĩ số tối đa 10 - 20) và PT 1-1.
     - Tách biệt 2 quota: `remaining_group_sessions` và `remaining_pt_sessions`.
     - Chống lạm dụng Free Trial 1 lần trong đời bằng Partial Unique Index `uq_user_single_trial_per_discipline`.
  5. **Quản lý Tiện ích Hậu mãi:** Tích hợp `Specialties`, `Lockers`, `MemberInbodyLogs` và cờ phát khăn `towel_issued`.
  6. **Quy tắc Hủy chỗ & Cronjob Hết hạn:**
     - Hủy lịch trước 2 tiếng: Xử lý tại `bookings/services/cancellation.service.ts` với Prisma `$transaction`.
     - Cronjob 00:05: Quét `end_date < CURRENT_DATE` chuyển `status = 'EXPIRED'`, bảo toàn số dư quota lịch sử.

---

## 5. API ENDPOINTS MỤC TIÊU CỦA TOÀN BỘ HỆ THỐNG V5

### A. Authentication Module (`/api/v1/auth`)
* `POST /api/v1/auth/register` (Public): Đăng ký hội viên mới.
* `POST /api/v1/auth/login` (Public): Đăng nhập, nhận cặp tokens.
* `POST /api/v1/auth/refresh` (Public): Làm mới access token từ Redis.
* `POST /api/v1/auth/logout` (Bearer Auth): Thu hồi token trên Redis.

### B. Users & Profiles Module (`/api/v1/users`)
* `POST /api/v1/users` (Bearer Auth, Role: `ADMIN`, `CENTER_MANAGER`): Tạo tài khoản phân cấp.
* `GET /api/v1/users`: Danh sách người dùng (lọc theo role).
* `GET /api/v1/users/profile/me`: Thông tin cá nhân đang đăng nhập.

### C. Specialties & Coach Management (`/api/v1/specialties`, `/api/v1/coaches`)
* `GET /api/v1/specialties` (Public): Xem danh mục chuyên môn theo môn thể thao.
* `POST /api/v1/specialties` (Role: `CENTER_MANAGER`, `ADMIN`): Tạo chuyên môn mới.
* `POST /api/v1/coaches/:id/rates` (Role: `CENTER_MANAGER`): Thiết lập biểu phí theo giờ của Coach.
* `POST /api/v1/coaches/availability` (Role: `COACH`): Mở slot PT rảnh.

### D. Memberships & Billing (`/api/v1/memberships`, `/api/v1/billing`)
* `GET /api/v1/memberships/plans` (Public): Xem bảng giá gói tập 4 môn.
* `POST /api/v1/billing/subscriptions/vip`: Đăng ký gói VIP động (Base + 12 * Coach Rate).
* `POST /api/v1/billing/subscriptions/:id/pt-addon`: Mua thêm giờ PT lẻ (Add-on).
* `GET /api/v1/billing/invoices/my`: Xem lịch sử hóa đơn của chính mình.

### E. Bookings Module (`/api/v1/bookings`)
* `POST /api/v1/bookings/group-class`: Đặt chỗ lớp nhóm Yoga/Boxing/Dancing (Pessimistic lock).
* `POST /api/v1/bookings/pt`: Đặt lịch kèm 1-1 với HLV (Advisory lock).
* `POST /api/v1/bookings/:id/cancel`: Hủy đặt chỗ (áp dụng quy tắc trước 2 tiếng).

### F. Attendances & Amenities (`/api/v1/attendances`, `/api/v1/inbody`, `/api/v1/lockers`)
* `POST /api/v1/attendances/gate-checkin`: Điểm danh vào cổng + Tự động cấp tủ đồ + Cấp khăn.
* `POST /api/v1/attendances/class-checkin`: HLV điểm danh lớp học trên mobile.
* `POST /api/v1/inbody/logs`: Nhập chỉ số đo InBody định kỳ.
* `GET /api/v1/inbody/my-progress`: Xem biểu đồ tiến trình cơ - mỡ của hội viên.

### G. AI Workout Assistant (`/api/v1/ai-assistant`)
* `GET /api/v1/ai-assistant/chat-stream`: SSE stream văn bản hướng dẫn bài tập.
* `POST /api/v1/ai-assistant/generate-workout-plan`: RAG pgvector sinh giáo án cá nhân hóa.

---

## 6. CHECKLIST BÀN GIAO & KẾ THỪA (NEXT STEPS)

- [x] Cập nhật `prisma/schema.prisma` với 27 models hoàn chỉnh từ `SQL_v5.md`.
- [x] Đồng bộ hóa Schema V5 lên Supabase qua Prisma.
- [x] Cập nhật `prisma/seed.ts` nạp dữ liệu chuẩn cho 4 môn thể thao, Specialties, Lockers, 5 Roles.
- [ ] Triển khai các Domain Modules theo đúng roadmap 7 bước trong `instructions_steps.md`.
