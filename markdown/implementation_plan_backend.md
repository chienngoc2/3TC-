# KẾ HOẠCH TRIỂN KHAI — BACKEND
## SPORTS CENTER MANAGEMENT SYSTEM

**Công nghệ:** NestJS + Prisma + PostgreSQL (Supabase) + Redis
**Kiến trúc:** Modular Monolith (Clean Architecture)
**Lý do chọn lựa:** Đảm bảo tính toàn vẹn giao dịch ACID, loại bỏ chi phí mạng và độ trễ phân tán của Microservices; code được đóng gói theo Domain Modules độc lập, dễ dàng tách thành Microservices trong tương lai.

---

## 1. Cấu trúc thư mục chi tiết

```text
backend/
├── prisma/
│   ├── schema.prisma                  # Toàn bộ Entity, Relations, Enums
│   ├── migrations/                    # Lịch sử migration cơ sở dữ liệu
│   └── seed.ts                        # Seed data mẫu: Manager, Rooms, Packages
├── src/
│   ├── common/                        # Dùng chung toàn hệ thống
│   │   ├── constants/                 # Error codes, system configs
│   │   ├── decorators/                # @Roles(), @CurrentUser(), @Public()
│   │   ├── filters/                   # HttpExceptionFilter (Chuẩn hóa lỗi trả về)
│   │   ├── guards/                    # JwtAuthGuard, RolesGuard (RBAC 4 roles)
│   │   ├── interceptors/              # TransformResponseInterceptor, LoggingInterceptor
│   │   ├── pipes/                     # ValidationPipe (Zod / Class-Validator)
│   │   └── utils/                     # Formatters, Date calculation helpers
│   ├── config/                        # Cấu hình môi trường (Supabase, Redis, JWT, AI API)
│   ├── database/                      # Prisma Module & Prisma Service
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   ├── infrastructure/                # Các dịch vụ nền tảng bên ngoài
│   │   ├── redis/                     # Redis Client & Lock Service (Redlock)
│   │   ├── queue/                     # BullMQ Queue Module (FCM, Mail, Cronjobs)
│   │   ├── socket/                    # Socket.io Gateway (Realtime notifications)
│   │   └── storage/                   # Supabase Storage S3 Service
│   ├── modules/                       # Từng Module nghiệp vụ độc lập (Domain Modules)
│   │   ├── auth/                      # Đăng nhập, Refresh Token, Phân quyền
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── dto/
│   │   │   └── strategies/            # JwtStrategy, RefreshJwtStrategy
│   │   ├── users/                     # Quản lý tài khoản (Admin, Coach, Member, Staff)
│   │   ├── memberships/               # Gói tập, Đăng ký, Gia hạn gói
│   │   ├── classes/                   # Quản lý lớp, Bộ môn, Phòng tập, Lịch học
│   │   ├── bookings/                  # Đặt chỗ, Hủy chỗ, Chống overbooking & race condition
│   │   │   ├── bookings.controller.ts
│   │   │   ├── bookings.service.ts    # Chứa Database Transaction & Row-level lock
│   │   │   └── dto/
│   │   ├── attendances/               # Điểm danh tại quầy (Lễ tân) và trên lớp (Coach)
│   │   ├── billing/                   # Hóa đơn, Ghi nhận thanh toán tiền mặt/chuyển khoản
│   │   ├── analytics/                 # Báo cáo doanh thu, Tỷ lệ lấp đầy, Thống kê hội viên
│   │   └── ai-assistant/              # Tích hợp LLM, Gợi ý bài tập, RAG Vector Search
│   │       ├── ai-assistant.controller.ts  # Endpoint SSE Stream
│   │       ├── ai-assistant.service.ts
│   │       └── prompts/               # System prompt cho Coach & Member
│   ├── app.module.ts                  # Root Module
│   └── main.ts                        # Entry point: Cấu hình CORS, Swagger, Global Pipes
├── test/                              # E2E test cho booking transaction & auth flow
├── Dockerfile
├── docker-compose.yml
└── package.json
```

---

## 2. Kế hoạch triển khai theo giai đoạn

### Phase 1: Setup Môi trường & Cơ sở dữ liệu nền tảng (Tuần 1 - 2)
* Khởi tạo dự án NestJS (CommonJS + Jest).
* Viết file `schema.prisma` cho toàn bộ các thực thể: `User`, `Role`, `MembershipPlan`, `UserSubscription`, `Class`, `Room`, `Schedule`, `Booking`, `Attendance`, `Invoice`.
* Kết nối Supabase PostgreSQL qua Transaction Pooler (cổng 6543).
* Chạy initial migration và viết script `prisma/seed.ts` để tạo dữ liệu tài khoản mẫu (1 Manager, 2 Coaches, 1 Receptionist, 1 Member) và các phòng tập.
* Cấu hình Redis, Docker Compose chạy cục bộ.

### Phase 2: Xác thực (Auth) & Phân quyền RBAC (Tuần 3)
* Xây dựng Module `Auth`: Login qua Email/Password, cấp cặp JWT Access Token (ngắn hạn) và Refresh Token (dài hạn).
* Xây dựng `JwtAuthGuard` và `RolesGuard` với Decorator `@Roles('MANAGER', 'COACH', 'RECEPTIONIST', 'MEMBER')`.

### Phase 3: Nghiệp vụ Quản trị, Lễ tân & Đặt lịch cốt lõi (Tuần 4 - 6)
* **Đặt lớp & Chống Overbooking:**
  * Xây dựng Endpoint đặt lớp học với Database Transaction:
    * Kiểm tra hội viên có gói tập hợp lệ hay không.
    * Thực hiện Pessimistic Lock (`FOR UPDATE`) trên lớp học để đảm bảo số lượng đăng ký không vượt quá `capacity`.
  * Cung cấp API cho Web (CRUD Bộ môn/Phòng tập/Lớp học, phân công HLV, validation chống trùng phòng/HLV trong cùng khung giờ) và Mobile (xem lịch, đăng ký/hủy giữ chỗ, danh sách học viên theo ca dạy).
  * Cung cấp API nghiệp vụ Lễ tân: tạo hội viên, bán/gia hạn gói tập, xuất hóa đơn.

### Phase 4: Điểm danh thời gian thực & Huấn luyện (Tuần 7 - 8)
* API điểm danh: đánh dấu `PRESENT`/`ABSENT` từ Mobile App (Coach).
* Đẩy sự kiện điểm danh realtime cho Web (Lễ tân) qua Socket.io.
* API giáo án/nhật ký tập luyện: lưu trọng lượng tạ/số hiệp, nhận xét sau buổi tập, để Mobile hiển thị tiến trình.

### Phase 5: Tích hợp AI Assistant & Background Jobs (Tuần 9 - 10)
* **AI Workout Generator & Assistant:**
  * Endpoint SSE (Server-Sent Events) nhận prompt, gọi LLM API (OpenAI/Gemini) và stream nội dung về theo thời gian thực.
  * AI Coach Tool: Gợi ý giáo án dựa trên hồ sơ thể lực và mục tiêu của hội viên (RAG qua pgvector).
* **Hàng đợi nền (BullMQ & Redis):**
  * Lên lịch Cron Job (00:00 hàng ngày) rà soát các gói tập hết hạn, tự động cập nhật trạng thái `EXPIRED`.
  * Worker gửi thông báo nhắc lịch tập trước 2 tiếng qua Push Notification (FCM).

### Phase 6: Kiểm thử, Tối ưu & Đóng gói (Tuần 11 - 12)
* Viết E2E Test cho luồng: Đăng nhập → Nạp gói → Đặt lớp đồng thời (Concurrency Test) → Điểm danh → Xuất báo cáo.
* Tối ưu truy vấn SQL (đánh index trên các cột tìm kiếm thường xuyên: `phone`, `user_id`, `schedule_id`).
* Đóng gói Docker Compose hoàn chỉnh cho Backend và Reverse Proxy Nginx.
* Hoàn thiện tài liệu kiến trúc và hướng dẫn cài đặt backend.
