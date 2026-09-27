# Sports Center Management System - Backend API

> Hệ thống API dịch vụ trung tâm (Core RESTful & Realtime API) cho nền tảng Quản lý Trung tâm Thể thao đa bộ môn (Gym, Boxing, Yoga, Dancing), hỗ trợ điều phối nghiệp vụ, kiểm soát giao dịch đặt lịch kép, bảo toàn quota/amenities và tích hợp trí tuệ nhân tạo (RAG AI Coaching).

[![NestJS](https://img.shields.io/badge/NestJS-v12.x-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Node.js](https://img.shields.io/badge/Node.js-v20.x_LTS-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-v5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-v5.22.0-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/Supabase_PostgreSQL-v15.x-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Redis](https://img.shields.io/badge/Redis-v7.x-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Socket.io](https://img.shields.io/badge/Socket.io-v4.x-010101?logo=socketdotio&logoColor=white)](https://socket.io/)
[![BullMQ](https://img.shields.io/badge/BullMQ-v6.x-FF4438)](https://bullmq.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 1. Quick Start

### Yêu cầu tiên quyết
* **Node.js**: `v20.x LTS` hoặc mới hơn
* **Package Manager**: `npm`
* **Docker & Docker Compose**: Dùng để chạy Redis 7 cục bộ
* **Tài khoản Supabase / PostgreSQL 15+**: Đã kích hoạt extension `btree_gist` và `vector` (pgvector)

### Các bước cài đặt

1. **Clone repository:**
   ```bash
   git clone https://github.com/Sports-Center-Management-System/BE_Sports_Center_Management_System.git
   cd backend
   ```

2. **Cài đặt dependencies:**
   ```bash
   npm install
   ```

3. **Cấu hình biến môi trường:**
   Không cần thiết với dự án hiện tại. file `.env` tớ đã cấu hình sẵn, pull và chạy là được.

4. **Khởi chạy Redis (Docker Compose):**
   ```bash
   docker-compose up -d redis
   ```

5. **Đồng bộ Cơ sở dữ liệu V5 & Dữ liệu mẫu (Seed):**
   Không cần thiết với dự án hiện tại, tớ cũng cấu hình DB và nạp seed data rồi.

6. **Khởi động server phát triển:**
   ```bash
   npm run start:dev
   ```
   * **API Gateway Root**: `http://localhost:3000/api/v1`
   * **Swagger API Documentation**: `http://localhost:3000/docs`

---

## 2. Danh mục Lệnh Quản trị (Scripts Reference)

| Lệnh | Mục đích | Môi trường |
| :--- | :--- | :--- |
| `npm run start:dev` | Chạy backend NestJS ở chế độ Watch mode | Dev |
| `npm run build` | Biên dịch TypeScript sang thư mục `dist/` | Dev / CI |
| `npm run lint` | Kiểm tra cú pháp và quy chuẩn code bằng Oxlint | Dev / CI |
| `npm run db:constraints` | Nạp `.env`, áp dụng toàn bộ DDL ngoài Prisma (`v5_constraints_triggers_rls.sql`) qua `DIRECT_URL` | Dev / Staging / Prod |
| `npm run db:setup` | Chuỗi tự động hóa khép kín cho Dev: `db push` → `db:constraints` → `prisma:seed` | Dev |
| `npm run db:verify:v5` | Bộ kiểm thử tích hợp DB trên schema tạm xác thực GiST exclusion, triggers và race conditions | Dev / CI |
| `npm run prisma:seed` | Nạp dữ liệu mẫu ban đầu theo ma trận kinh doanh V5 | Dev / Staging |

> [!IMPORTANT]
> **Lưu ý triển khai Production / CI:**
> Không dùng `prisma db push` trên môi trường Production. Quy trình chuẩn là:
> 1. Xem xét migration schema đã review: `npx prisma migrate deploy`
> 2. Áp dụng bổ sung các trigger, RLS, partial exclusion: `npm run db:constraints`

---

## 3. Kiến trúc Hệ thống & Lược đồ Dữ liệu V5

Hệ thống được thiết kế theo mô hình **Modular Monolith** kết hợp **Clean Architecture**:
* **Xác thực & Phân quyền (RBAC 2 tầng, 5 Roles)**: `ADMIN` (Hạ tầng, tạo CM) ➔ `CENTER_MANAGER` (Điều hành, tạo Coach/Lễ tân) ➔ `RECEPTIONIST` ➔ `COACH` ➔ `MEMBER`.
* **Cơ sở dữ liệu (29 Models, 15 Enums)**: Đạt chuẩn 100% tài liệu thiết kế DDL `SQL_v5.md`.
* **Bảo vệ toàn vẹn dữ liệu đa tầng**:
  - **GiST Partial Exclusion Constraints**: Chống trùng phòng (`no_room_schedule_overlap`) và chống trùng lịch HLV (`no_coach_schedule_overlap`) trên `schedules` có trạng thái `OPEN` hoặc `FULL`.
  - **Advisory Locks (`pg_advisory_xact_lock`)**: Đồng bộ hóa theo HLV giữa lịch lớp nhóm cố định và lịch mở PT 1-1.
  - **Claim hủy nguyên tử (Optimistic Locking)**: Duyệt yêu cầu hủy khẩn cấp và hủy booking bằng cập nhật có điều kiện `updateMany({ where: { status: 'PENDING' } })`, triệt tiêu hoàn toàn rủi ro hoàn quota 2 lần.
  - **Zero-Trust Supabase RLS**: Chính sách bảo mật cấp hàng (Row Level Security) được bật trên toàn bộ các bảng.

```text
backend/
├── prisma/
│   ├── migrations/
│   │   └── manual/
│   │       └── v5_constraints_triggers_rls.sql   # DDL V5 (GiST, Triggers, RLS, Procedures)
│   ├── schema.prisma                             # 29 Models Prisma Client
│   └── seed.ts                                   # Dữ liệu chuẩn ma trận 4 môn V5
├── scripts/
│   ├── db-constraints.cjs                        # Script thực thi DDL an toàn qua DIRECT_URL
│   └── verify-v5.cjs                             # Suite kiểm chứng concurrency & metadata
├── src/
│   ├── common/                                   # Shared Kernel
│   │   ├── constants/                            # Mã lỗi, hằng số toàn hệ thống
│   │   ├── decorators/                           # @Roles(), @CurrentUser(), @Public()
│   │   ├── filters/                              # HttpExceptionFilter chuẩn hóa phản hồi lỗi
│   │   ├── guards/                               # JwtAuthGuard, RolesGuard (RBAC 5 roles)
│   │   ├── interceptors/                         # TransformResponseInterceptor, LoggingInterceptor
│   │   └── pipes/                                # ValidationPipe
│   ├── config/                                   # Nạp và validate env qua class-validator
│   ├── database/                                 # PrismaModule & PrismaService kết nối Pooler
│   ├── infrastructure/                           # Dịch vụ nền tảng bên ngoài
│   │   ├── queue/                                # BullMQ background queues
│   │   ├── redis/                                # RedisModule quản lý session & token revoke
│   │   ├── socket/                               # Socket.io Gateway cập nhật realtime
│   │   └── storage/                              # Supabase Storage S3-compatible service
│   ├── modules/                                  # Các Domain Modules
│   │   ├── auth/                                 # [Hoàn thành] Đăng nhập JWT + Refresh token Redis
│   │   ├── users/                                # [Hoàn thành] Hồ sơ, quản lý phân cấp 5 roles
│   │   ├── specialties/                          # [Kế hoạch] Danh mục kỹ thuật & biểu phí HLV
│   │   ├── memberships/                          # [Kế hoạch] Gói tập 4 môn (Trial, Drop-in, Plus, VIP)
│   │   ├── billing/                              # [Kế hoạch] Hóa đơn, tính giá VIP động, PT Add-on
│   │   ├── bookings/                             # [Kế hoạch] Dual-flow Engine & Tiered Cancellation
│   │   ├── classes/                              # [Kế hoạch] Lịch học lớp nhóm & phòng tập
│   │   ├── attendances/                          # [Kế hoạch] Check-in cổng, cấp tủ đồ, mượn khăn
│   │   ├── inbody/                               # [Kế hoạch] Lưu vết chỉ số cơ - mỡ định kỳ
│   │   ├── ai-assistant/                         # [Kế hoạch] SSE streaming & RAG pgvector giáo án
│   │   └── analytics/                            # [Kế hoạch] Báo cáo doanh thu & tỷ lệ lấp đầy
│   ├── app.module.ts                             # Root Application Module
│   └── main.ts                                   # Bootstrap: Swagger, CORS, Global Guards & Filters
├── docker-compose.yml                            # Redis 7 service
├── package.json
└── tsconfig.json
```

---

## 4. Quy chuẩn Phát triển (Coding Conventions)

### 4.1. Quy ước Đặt tên (Naming Conventions)
* **Tập tin & Thư mục**: Định dạng `kebab-case` kèm định danh vai trò (vd: `booking-transaction.service.ts`, `create-booking.dto.ts`).
* **Lớp & Interface**: Định dạng `PascalCase` (vd: `RolesGuard`, `CreateUserDto`, `IAuthPayload`).
* **Phương thức & Thuộc tính**: Định dạng `camelCase` (vd: `cancelBooking()`, `remainingGroupSessions`).
* **Constants & Enums**: Định dạng `UPPER_SNAKE_CASE` (vd: `USER_ROLES`, `SCHEDULE_STATUS`).
* **Mô hình Dữ liệu**:
  - Tầng Database (PostgreSQL): `snake_case` (vd: `subscription_id`, `is_emergency_cancelled`).
  - Tầng Ứng dụng (Prisma / NestJS): `camelCase` ánh xạ qua `@map` (vd: `subscriptionId`, `isEmergencyCancelled`).

### 4.2. Git Workflow & Conventional Commits
* Cấu trúc commit: `type(scope): description`
  - `feat`: Tính năng mới (vd: `feat(bookings): implement atomic claim for coach cancellation`)
  - `fix`: Sửa lỗi (vd: `fix(billing): correct dynamic pricing formula for vip hybrid plan`)
  - `refactor`: Tối ưu hóa mã nguồn không đổi logic nghiệp vụ
  - `perf`: Cải thiện hiệu năng xử lý hoặc câu lệnh cơ sở dữ liệu
  - `docs`: Cập nhật tài liệu kỹ thuật, Swagger hoặc README
  - `chore`: Cập nhật phụ thuộc, cấu hình hoặc script hệ thống

---

## 5. Tài liệu Tham khảo Liên quan

* **Đặc tả Nghiệp vụ 4 Bộ môn**: [`../erd/business_rule_final.md`](https://github.com/Sports-Center-Management-System/documents/blob/main/business_rule_final.md)
* **Kế hoạch Triển khai Backend chi tiết**: [`markdown/implementation_plan_backend.md`](markdown/implementation_plan_backend.md)
* **Mẫu Thiết kế & Logic Xử lý Tranh chấp**: [`../erd/implementation_plan.md`](https://github.com/Sports-Center-Management-System/documents/blob/main/implementation_plan.md)
* **Đặc tả Cơ sở Dữ liệu DDL V5**: [`../erd/SQL_v5.md`](https://github.com/Sports-Center-Management-System/documents/blob/main/SQL_v5.md)
* **Danh mục API Contract (59 Endpoints)**: [`../erd/API_CONTRACT.md`](https://github.com/Sports-Center-Management-System/documents/blob/main/API_CONTRACT.md)
* **Báo cáo Khắc phục & Nghiệm thu Kỹ thuật V5**: [`markdown/v5_review_report.md`](markdown/v5_review_report.md)

---

## 6. License

Dự án được phân phối dưới giấy phép [MIT License](LICENSE).  
Bản quyền thuộc về © 2026 Sports Center Management System Team.
