# DEVELOPMENT LOG & CONTEXT RECOVERY — SPORTS CENTER MANAGEMENT SYSTEM BACKEND

> **Mục đích tài liệu:** Lưu trữ chi tiết toàn bộ các thay đổi kiến trúc, tech stack, cấu trúc thư mục (structure tree) và logic nghiệp vụ sau mỗi phiên/prompt làm việc. Tài liệu này đóng vai trò là "Single Source of Truth" phục vụ việc tối ưu token, giúp khôi phục ngữ cảnh (context recovery) tức thì trong các phiên làm việc tiếp theo mà không cần phải đọc lại toàn bộ mã nguồn.

---

## 1. PROJECT METADATA & OVERALL STATUS

* **Tên dự án:** Sports Center Management System - Backend API
* **Mô hình kiến trúc:** Modular Monolith kết hợp Clean Architecture Principles
* **Mục tiêu hệ thống:** Phục vụ Web Admin (Manager/Receptionist) và Mobile App (Coach/Member), xử lý đặt chỗ chống overbooking (Pessimistic Locking ACID), điểm danh realtime qua WebSocket, và trợ lý AI Workout Generator (Server-Sent Events streaming & RAG pgvector).
* **Giai đoạn hiện tại:** Hoàn thành **Early Phase** (Setup hạ tầng cơ sở dữ liệu, Shared Kernel, Authentication JWT + RBAC 4 vai trò, Users Management).
* **Trạng thái Build:** `npm run build` PASS (NestJS v12/10 + TypeScript 5.x/6.x, Prisma 5.22.0).

---

## 2. TECH STACK & VERSIONING TRACKING

Dưới đây là bảng theo dõi chi tiết sự thay đổi và đồng bộ phiên bản kỹ thuật:

| Công nghệ / Thư viện | Phiên bản thiết lập | Mục đích & Chi tiết thay đổi |
| :--- | :--- | :--- |
| **Node.js** | `v24.21.0` (LTS baseline v20+) | Runtime engine |
| **NestJS Core/Common** | `^12.0.1` | Core Framework xây dựng RESTful API |
| **Prisma ORM** | `^5.22.0` (LTS ổn định) | **Điều chỉnh:** Giáng cấp từ `8.0.0-rc.13` xuống `5.22.0` LTS để đảm bảo tính tương thích tuyệt đối với `@prisma/client`, giải quyết lỗi `MODULE_NOT_FOUND` và tương thích generator Prisma Client. |
| **@prisma/client** | `^5.22.0` | Client truy vấn database PostgreSQL |
| **Database** | PostgreSQL 15+ (Supabase) | Kết nối qua Pooler cổng 6543 (`DATABASE_URL`) và Direct cổng 5432 (`DIRECT_URL`) |
| **Redis** | `redis:7-alpine` via Docker / `ioredis: ^6.0.0` | Lưu cache, quản lý phiên Refresh Token, sẵn sàng cho Distributed Lock |
| **Passport & JWT** | `passport: ^0.7.0`, `@nestjs/jwt: ^12.0.1` | Cấp phát & xác thực token dạng Bearer |
| **Bcrypt** | `^6.0.0` | Băm mật khẩu (Salt rounds: 10) |
| **BullMQ** | `^6.3.4` | Chuẩn bị cho hàng đợi background jobs (Cron, FCM notifications) |
| **Socket.io** | `^4.8.3` | Chuẩn bị cho WebSocket Gateway realtime notifications |
| **Swagger** | `swagger-ui-express: ^5.0.1` | Tài liệu hóa API tại route `/docs` |

---

## 3. CURRENT STRUCTURE TREE (Chi tiết cây thư mục thực tế)

```text
backend/
├── .env                                       # [Mới] File cấu hình môi trường thực thi cục bộ
├── .env.example                               # [Mới] File mẫu biến môi trường chuẩn hóa
├── .gitignore
├── .prettierrc
├── development.md                             # [Mới] Nhật ký phát triển và khôi phục ngữ cảnh
├── docker-compose.yml                         # [Mới] Cấu hình Docker Redis 7 Alpine
├── instructions_steps.md                      # [Mới] Bản hướng dẫn tuần tự 7 bước triển khai
├── jest.config.ts
├── nest-cli.json
├── oxlint.json
├── package.json                               # [Cập nhật] Đồng bộ Prisma 5.22.0, thêm script prisma:seed
├── README.md
├── tsconfig.build.json
├── tsconfig.json
├── markdown/
│   ├── erd_SQL_v2.md                          # Thiết kế DDL PostgreSQL chuẩn hóa 17 bảng
│   └── implementation_plan_backend.md         # Kế hoạch triển khai tổng quan 6 phase
├── prisma/
│   ├── schema.prisma                          # [Mới] 17 Models, 6 Enums, Relations & Indexes
│   └── seed.ts                                # [Mới] Script seed 4 Roles, 2 Phòng, 2 Môn, 2 Gói tập
└── src/
    ├── app.controller.spec.ts
    ├── app.controller.ts
    ├── app.module.ts                          # [Cập nhật] Nạp Config, Database, Redis, Auth, Users
    ├── app.service.ts
    ├── main.ts                                # [Cập nhật] Swagger (/docs), ValidationPipe, Interceptors, Prefix
    ├── common/
    │   ├── constants/
    │   │   └── error-codes.ts                 # [Mới] Danh mục Error Codes chuẩn hóa hệ thống
    │   ├── decorators/
    │   │   ├── current-user.decorator.ts      # [Mới] Trích xuất payload user đăng nhập từ Context
    │   │   ├── public.decorator.ts            # [Mới] Bỏ qua kiểm tra JWT cho các public endpoint
    │   │   └── roles.decorator.ts             # [Mới] Decorator gắn metadata RBAC (@Roles)
    │   ├── filters/
    │   │   └── http-exception.filter.ts       # [Mới] Global Exception Filter chuẩn hóa cấu trúc lỗi JSON
    │   ├── guards/
    │   │   ├── jwt-auth.guard.ts              # [Mới] Global Guard bảo vệ endpoint bằng JWT
    │   │   └── roles.guard.ts                 # [Mới] RBAC Guard kiểm tra phân quyền 4 vai trò
    │   ├── interceptors/
    │   │   ├── logging.interceptor.ts         # [Mới] Ghi log đo latency request HTTP
    │   │   └── transform-response.interceptor.ts # [Mới] Chuẩn hóa Response chuẩn { success, statusCode, data }
    │   ├── pipes/                             # (Thư mục chờ mở rộng custom pipes)
    │   └── utils/                             # (Thư mục chờ mở rộng helpers tiện ích)
    ├── config/
    │   └── env.validation.ts                  # [Mới] Validation schema kiểm tra biến môi trường lúc khởi động
    ├── database/
    │   ├── prisma.module.ts                   # [Mới] Global Prisma Module
    │   └── prisma.service.ts                  # [Mới] Prisma Client Service quản lý lifecycle kết nối DB
    ├── infrastructure/
    │   ├── queue/                             # (Sẵn sàng cho BullMQ Worker & Schedulers)
    │   ├── redis/
    │   │   ├── redis.module.ts                # [Mới] Global Redis Module
    │   │   └── redis.service.ts               # [Mới] Redis Client Wrapper (get/set/del/TTL)
    │   └── socket/                            # (Sẵn sàng cho Socket.io Realtime Gateway)
    └── modules/
        ├── auth/
        │   ├── auth.controller.ts             # [Mới] Endpoints: register, login, refresh, logout
        │   ├── auth.module.ts                 # [Mới] Cấu hình JWT module, Passport, Strategies
        │   ├── auth.service.ts                # [Mới] Logic băm bcrypt, sinh cặp Access/Refresh Token
        │   ├── dto/
        │   │   ├── login.dto.ts               # [Mới] Validation đăng nhập (email, password)
        │   │   ├── refresh-token.dto.ts       # [Mới] Validation refresh token
        │   │   └── register.dto.ts            # [Mới] Validation đăng ký hội viên
        │   └── strategies/
        │       └── jwt.strategy.ts            # [Mới] Passport JWT Strategy xác thực Bearer token
        ├── users/
        │   ├── users.controller.ts            # [Mới] Endpoints CRUD user với phân quyền @Roles
        │   ├── users.module.ts                # [Mới] Module quản trị người dùng
        │   ├── users.service.ts               # [Mới] Quản lý tạo tài khoản, lọc theo Role, xem Profile
        │   └── dto/
        │       └── create-user.dto.ts         # [Mới] DTO tạo tài khoản nội bộ (Coach, Receptionist, Manager)
        ├── memberships/                       # (Thư mục đã scaffold DTO, sẵn sàng implement Phase 4)
        ├── classes/                           # (Thư mục đã scaffold DTO, sẵn sàng implement Phase 4)
        ├── bookings/                          # (Thư mục đã scaffold DTO, sẵn sàng implement Phase 5)
        ├── billing/                           # (Thư mục đã scaffold DTO, sẵn sàng implement Phase 5)
        ├── attendances/                       # (Thư mục đã scaffold DTO, sẵn sàng implement Phase 5)
        ├── analytics/                         # (Thư mục đã scaffold DTO, sẵn sàng implement Phase 6)
        └── ai-assistant/                      # (Thư mục đã scaffold DTO, sẵn sàng implement Phase 6)
```

---

## 4. CHI TIẾT CÁC PHIÊN LÀM VIỆC & THAY ĐỔI NGHIỆP VỤ

### Phiên 1 (Session 1): Khảo sát tài liệu & Soạn thảo Kế hoạch triển khai
* **Yêu cầu:** Duyệt toàn bộ tài liệu `markdown/` (`erd_SQL_v2.md`, `implementation_plan_backend.md`) và `README.md`.
* **Thay đổi & Sản phẩm bàn giao:**
  * Xuất bản file `instructions_steps.md` chia nhỏ quy trình thành 7 bước tuần tự có sơ đồ Mermaid và bảng phân công checklist rõ ràng.

### Phiên 2 (Session 2): Triển khai hoàn thiện Early Phase
* **Mục tiêu:** Setup toàn diện môi trường nền tảng, schema database, shared core và module Auth/Users để sẵn sàng tích hợp logic nghiệp vụ.
* **Các thay đổi cụ thể:**
  1. **Hạ tầng & Cấu hình:**
     * Tạo `.env.example` và `.env` đồng bộ thông số cổng Supabase Pooler (6543) và Direct (5432).
     * Tạo `docker-compose.yml` cho Redis 7.
     * Cấu hình kiểm tra biến môi trường nghiêm ngặt bằng `env.validation.ts` (`PORT`, `DATABASE_URL`, `REDIS_HOST`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`).
  2. **Khắc phục xung đột thư viện (Fix Compatibility Issues):**
     * Phát hiện xung đột phiên bản giữa `prisma: ^8.0.0-rc.13` và `@prisma/client: ^7.10.0` gây lỗi module generator.
     * **Giải pháp:** Đồng bộ cả hai gói về phiên bản chuẩn LTS `^5.22.0`.
     * Chạy thành công lệnh `npx prisma generate` sinh đầy đủ TypeScript models.
     * Khắc phục lỗi TypeScript type checking giữa interface `JwtSignOptions` của `@nestjs/jwt` v12 và kiểu `string` của `expiresIn` bằng explicit type casting `(as any)`.
  3. **Mô hình hóa Cơ sở dữ liệu (`prisma/schema.prisma`):**
     * Chuyển đổi 17 bảng từ `erd_SQL_v2.md` sang Prisma schema với đầy đủ các thuộc tính `@db.Uuid`, `@db.VarChar`, `@db.Decimal`, `@db.Timestamptz`.
     * Cấu hình 6 Enums: `UserRole` (`MANAGER`, `COACH`, `RECEPTIONIST`, `MEMBER`), `SubscriptionStatus`, `BookingStatus`, `AttendanceStatus`, `PaymentMethod`, `InvoiceStatus`.
     * Thiết lập quan hệ toàn vẹn dữ liệu (Referential Actions: `Cascade`, `Restrict`, `SetNull`).
     * Thiết lập các index phục vụ truy vấn: `idx_user_subscriptions_user_id`, `idx_invoices_subscription_id`, `idx_schedules_start_time`, `idx_bookings_schedule_id`, v.v.
     * Tạo script `prisma/seed.ts` khởi tạo 5 tài khoản mẫu cho 4 vai trò, 2 phòng tập, 2 bộ môn và 2 gói tập mẫu.
  4. **Triển khai Shared Kernel (`src/common`):**
     * `HttpExceptionFilter`: Chuẩn hóa lỗi theo định dạng chuẩn:
       ```json
       {
         "success": false,
         "statusCode": 400,
         "errorCode": "...",
         "message": "...",
         "timestamp": "2026-09-13T...",
         "path": "/api/v1/..."
       }
       ```
     * `TransformResponseInterceptor`: Bọc kết quả thành công trong object chuẩn `{ success: true, statusCode, data, timestamp }`.
     * `LoggingInterceptor`: Đo lường và in log thời gian hoàn tất từng request ra console.
     * `RolesGuard` & `JwtAuthGuard`: Phân quyền RBAC kết hợp Decorator `@Roles()`, hỗ trợ ngoại lệ qua `@Public()`.
  5. **Nghiệp vụ Xác thực & Người dùng (`AuthModule` & `UsersModule`):**
     * `AuthService`: Băm mật khẩu bằng bcrypt; phát hành Access Token (15 phút) và Refresh Token (7 ngày); lưu Refresh Token vào Redis với TTL 7 ngày; hỗ trợ cơ chế thu hồi token khi đăng xuất (`logout`).
     * `UsersService`: Tạo người dùng nội bộ (cho phép Manager tạo Coach, Receptionist, Manager); tự động liên kết `MemberProfile` hoặc `CoachProfile` tương ứng với vai trò.
     * Bảo vệ phân quyền chặt chẽ trên Controller:
       * `POST /api/v1/users`: Chỉ vai trò `MANAGER` có quyền truy cập.
       * `GET /api/v1/users`: Chỉ vai trò `MANAGER` và `RECEPTIONIST` có quyền truy cập.
       * `GET /api/v1/users/profile/me`: Mọi người dùng đã đăng nhập đều có quyền xem thông tin cá nhân.
  6. **Cấu hình Entrypoint (`src/main.ts`):**
     * Global API prefix: `/api/v1`.
     * Swagger UI: `/docs`.
     * Bật Global Pipes `ValidationPipe` với `{ whitelist: true, transform: true }`.
     * Bật Global CORS cho mọi origin.
  7. **Kiểm tra biên dịch:**
     * Lệnh `npm run build` thực thi thành công, tạo ra thư mục `dist/` hoàn chỉnh sẵn sàng chạy.

---

## 5. API ENDPOINTS HIỆN HÀNH (Current Exposed Endpoints)

### A. Authentication Module (`/api/v1/auth`)
* `POST /api/v1/auth/register` (Public): Đăng ký tài khoản hội viên mới.
* `POST /api/v1/auth/login` (Public): Đăng nhập, kiểm tra tài khoản hoạt động và nhận cặp tokens.
* `POST /api/v1/auth/refresh` (Public): Cấp cặp token mới từ refresh token hợp lệ còn trong Redis.
* `POST /api/v1/auth/logout` (Bearer Auth): Xóa session refresh token trong Redis.

### B. Users Module (`/api/v1/users`)
* `POST /api/v1/users` (Bearer Auth, Role: `MANAGER`): Tạo tài khoản người dùng nội bộ.
* `GET /api/v1/users` (Bearer Auth, Roles: `MANAGER`, `RECEPTIONIST`): Xem danh sách người dùng (hỗ trợ query filter theo role).
* `GET /api/v1/users/profile/me` (Bearer Auth): Xem thông tin tài khoản đang đăng nhập.
* `GET /api/v1/users/:id` (Bearer Auth, Roles: `MANAGER`, `RECEPTIONIST`, `COACH`): Xem chi tiết tài khoản theo ID.

---

## 6. ROADMAP CHO CÁC PHIÊN LÀM VIỆC TIẾP THEO

* [ ] **Next Step 1 (Memberships & Facilities):**
  * Triển khai `MembershipsModule`: CRUD Gói tập (`membership_plans`), đăng ký gói và quản lý subscription (`user_subscriptions`), gia hạn và đóng băng thẻ.
  * Triển khai `ClassesModule`: CRUD Bộ môn (`disciplines`), Phòng tập (`rooms`), Lớp học (`classes`), Lịch học (`schedules`) kèm kiểm tra xung đột thời gian (overlap check).
* [ ] **Next Step 2 (Booking Concurrency & ACID):**
  * Triển khai `BookingsModule`: Đặt chỗ lớp học với cơ chế Pessimistic Locking (`SELECT ... FOR UPDATE`) chống Race Condition và Overbooking khi nhiều học viên cùng đặt slot cuối cùng.
  * Triển khai `BillingModule`: Sinh hóa đơn tự động và ghi nhận thanh toán.
* [ ] **Next Step 3 (Realtime Attendance & Socket.io):**
  * Triển khai `AttendancesModule`: Điểm danh tại quầy (Lễ tân) và điểm danh trong lớp (Coach mobile).
  * Phát sự kiện WebSocket qua `SocketGateway` để dashboard Lễ tân cập nhật realtime.
* [ ] **Next Step 4 (AI Assistant & BullMQ Background Queues):**
  * SSE endpoint stream văn bản cho trợ lý bài tập thể hình.
  * RAG pgvector trên bảng `exercise_knowledge`.
  * Cron job tự động quét và cập nhật trạng thái `EXPIRED` cho các gói tập hết hạn hàng ngày.
