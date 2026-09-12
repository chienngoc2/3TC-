# Sports Center Management System - Backend API

> Hệ thống API dịch vụ trung tâm (Core RESTful & Realtime API) cho nền tảng Quản lý Trung tâm Thể thao, hỗ trợ điều phối nghiệp vụ, kiểm soát giao dịch đặt lịch và luồng phản hồi trí tuệ nhân tạo (AI Streaming).

[![NestJS](https://img.shields.io/badge/NestJS-v10.x-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Node.js](https://img.shields.io/badge/Node.js-v20.x_LTS-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-v5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-v5.x-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/Supabase_PostgreSQL-v15.x-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Redis](https://img.shields.io/badge/Redis-v7.x-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Socket.io](https://img.shields.io/badge/Socket.io-v4.x-010101?logo=socketdotio&logoColor=white)](https://socket.io/)
[![BullMQ](https://img.shields.io/badge/BullMQ-v5.x-FF4438)](https://bullmq.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 1. Quick Start

### Yêu cầu tiên quyết
* **Node.js**: `v20.x LTS` hoặc mới hơn
* **Package Manager**: `npm` hoặc `pnpm`
* **Docker & Docker Compose**: Dùng để chạy Redis cục bộ (nếu chưa có cụm Redis ngoài)
* **Tài khoản Supabase**: Đã tạo project PostgreSQL (kèm extension `pgvector` kích hoạt sẵn)

### Các bước cài đặt

1. **Clone repository:**
   ```bash
   git clone https://github.com/your-org/sports-center-backend.git
   cd sports-center-backend
   ```

2. **Cài đặt dependencies:**
   ```bash
   npm install
   ```

3. **Cấu hình biến môi trường:**
   Tạo file `.env` từ `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Cập nhật các tham số cấu hình:
   ```env
   PORT=3000
   NODE_ENV=development

   # Supabase Database (Lưu ý dùng Transaction Pooler cổng 6543)
   DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
   DIRECT_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

   # Redis Configuration
   REDIS_HOST="127.0.0.1"
   REDIS_PORT=6379
   REDIS_PASSWORD=""

   # JWT Secrets
   JWT_ACCESS_SECRET="your_access_token_secret_key"
   JWT_ACCESS_EXPIRES_IN="15m"
   JWT_REFRESH_SECRET="your_refresh_token_secret_key"
   JWT_REFRESH_EXPIRES_IN="7d"

   # AI LLM Provider
   GEMINI_API_KEY="your_gemini_api_key"
   ```

4. **Khởi chạy Redis (Docker):**
   ```bash
   docker-compose up -d redis
   ```

5. **Đồng bộ cơ sở dữ liệu và seed dữ liệu khởi tạo:**
   ```bash
   npx prisma migrate dev --name init
   npm run prisma:seed
   ```

6. **Khởi động server phát triển:**
   ```bash
   npm run start:dev
   ```
   * API Server: `http://localhost:3000/api/v1`
   * Swagger Documentation: `http://localhost:3000/docs`

---

## 2. Structure Tree & Architecture

Hệ thống được thiết kế theo mô hình **Modular Monolith** kết hợp **Clean Architecture Principles**. Mỗi domain nghiệp vụ được đóng gói thành một NestJS Module riêng biệt với Controller, Service, DTO, Repository abstraction.

```text
backend/
├── prisma/
│   ├── migrations/                    # Lịch sử migrations của Prisma
│   ├── schema.prisma                  # Lược đồ cơ sở dữ liệu quan hệ (PostgreSQL)
│   └── seed.ts                        # Script tạo dữ liệu mẫu ban đầu
├── src/
│   ├── common/                        # Thành phần chia sẻ xuyên suốt các modules
│   │   ├── constants/                 # Biến tĩnh, mã lỗi chuẩn hóa
│   │   ├── decorators/                # Custom decorators: @Roles(), @CurrentUser(), @Public()
│   │   ├── filters/                   # Global exception filters (HttpExceptionFilter)
│   │   ├── guards/                    # JwtAuthGuard, RolesGuard (RBAC 4 roles)
│   │   ├── interceptors/              # Response transform, Logging interceptor
│   │   ├── pipes/                     # Zod/ValidationPipe kiểm tra DTO
│   │   └── utils/                     # Hàm tiện ích tính toán ngày, mã hóa
│   ├── config/                        # Quản lý env, cấu hình Supabase, Redis, JWT
│   ├── database/                      # PrismaService kết nối Supabase Pooler
│   ├── infrastructure/                # Các dịch vụ nền tảng bên ngoài
│   │   ├── queue/                     # BullMQ setup (background jobs, send mail, auto-cancel)
│   │   ├── redis/                     # Redis Client & Redlock (Distributed lock)
│   │   ├── socket/                    # Socket.io Gateway cho realtime notifications
│   │   └── storage/                   # Supabase Storage S3-compatible service
│   ├── modules/                       # Từng Module nghiệp vụ độc lập
│   │   ├── ai-assistant/              # Tích hợp LLM, SSE streaming endpoint, pgvector query
│   │   ├── analytics/                 # Báo cáo doanh thu, tỷ lệ lấp đầy, retention
│   │   ├── attendances/               # Điểm danh tại quầy & trong ca dạy của HLV
│   │   ├── auth/                      # Đăng nhập, cấp phát JWT Access/Refresh Token
│   │   ├── billing/                   # Hóa đơn, giao dịch thanh toán quầy/online
│   │   ├── bookings/                  # Đặt chỗ, hủy chỗ, Pessimistic lock slot
│   │   ├── classes/                   # Quản lý môn học, phòng tập, ca học định kỳ
│   │   ├── memberships/               # Gói thành viên, quy định số buổi, gia hạn
│   │   └── users/                     # Quản trị 4 roles: Manager, Coach, Receptionist, Member
│   ├── app.module.ts                  # Root Application Module
│   └── main.ts                        # Entry point: Swagger, CORS, Global pipes & filters
├── test/                              # Unit test (Jest) & E2E integration test
├── Dockerfile                         # Multi-stage production build
├── docker-compose.yml                 # Khởi chạy Redis & phụ trợ cục bộ
├── package.json
└── tsconfig.json
```

---

## 3. Coding Conventions

Dự án tuân thủ nghiêm ngặt các quy chuẩn kỹ thuật của cộng đồng TypeScript và NestJS:

### 3.1. Git Branching Model (Gitflow rút gọn)
* `main`: Nhánh production, luôn ở trạng thái sẵn sàng release (chỉ merge qua Pull Request từ `dev`).
* `dev`: Nhánh tích hợp chính cho môi trường staging.
* `feature/<tên-tính-năng>`: Nhánh phát triển tính năng mới (vd: `feature/booking-lock-slot`, `feature/ai-sse-stream`).
* `fix/<mã-lỗi>` hoặc `bugfix/<vấn-đề>`: Nhánh sửa lỗi trên develop (vd: `fix/overbooking-race-condition`).
* `hotfix/<phiên-bản>`: Sửa lỗi khẩn cấp trực tiếp từ `main`.

### 3.2. Git Commit Convention (Conventional Commits)
Mỗi commit message tuân theo cấu trúc: `type(scope): description`
* `feat`: Thêm tính năng mới (vd: `feat(bookings): implement row-level locking for class reservation`)
* `fix`: Sửa lỗi (vd: `fix(auth): resolve refresh token expiration mismatch`)
* `refactor`: Tái cấu trúc mã nguồn không thay đổi logic nghiệp vụ (vd: `refactor(billing): extract invoice calculation helper`)
* `perf`: Tối ưu hiệu năng (vd: `perf(classes): add index on schedule_id and start_time`)
* `docs`: Cập nhật tài liệu kỹ thuật, Swagger hoặc README
* `chore`: Cập nhật cấu hình, dependencies, script build

### 3.3. Naming Conventions & Code Style
* **Files & Folders**: Đặt theo định dạng `kebab-case` kèm định danh vai trò (vd: `booking-transaction.service.ts`, `create-class.dto.ts`).
* **Classes & Interfaces**: Đặt theo định dạng `PascalCase` (vd: `RolesGuard`, `CreateMemberDto`, `IAuthPayload`).
* **Methods & Variables**: Đặt theo định dạng `camelCase` (vd: `calculateMonthlyRevenue()`, `activeMembershipCount`).
* **Constants & Enums**: Đặt theo định dạng `UPPER_SNAKE_CASE` (vd: `DEFAULT_PAGE_SIZE`, `ROLE_MANAGER`).
* **Linter & Formatter**: Toàn bộ codebase phải vượt qua kiểm tra của `eslint` và `prettier` trước khi tạo Pull Request (`npm run lint`).

---

## 4. License

Dự án được phân phối dưới giấy phép mã nguồn mở [MIT License](LICENSE).  
Bản quyền thuộc về © 2026 Sports Center Management System Team.
