# KẾ HOẠCH TRIỂN KHAI BACKEND (V5 - PRODUCTION ALIGNED)
## SPORTS CENTER MANAGEMENT SYSTEM (GYM / BOXING / YOGA / DANCING)

> **Cập nhật:** Release 5.0 (Đồng bộ toàn diện với `SQL_v5.md`, `business_rule_final.md` và `implementation_plan.md`)  
> **Công nghệ:** NestJS + Prisma ORM + PostgreSQL 15+ (Supabase) + Redis 7 + Socket.io + BullMQ  
> **Kiến trúc:** Modular Monolith (Clean Architecture)  
> **Quy mô nghiệp vụ:** Trung tâm thể thao cao cấp đa bộ môn với mô hình phân cấp quản trị 2 tầng (IT Admin & Center Manager), bán vé đa tầng (Trial, Drop-in, Plus, VIP, PT Add-on), kiểm soát đặt chỗ kép chống Overbooking & Race Condition, quản lý tiện ích hậu mãi (InBody Logs, Smart Locker, Towel Service) và trợ lý AI Workout RAG (pgvector).

---

## 1. CẤU TRÚC THƯ MỤC CHI TIẾT (TARGET PRODUCTION STRUCTURE)

```text
backend/
├── prisma/
│   ├── schema.prisma                  # 27 Models, Enums (đã đồng bộ 100% SQL_v5.md)
│   ├── migrations/                    # Lịch sử migration cơ sở dữ liệu Supabase
│   └── seed.ts                        # Seed data: Admin, Center Manager, 4 Disciplines, Specialties, Rooms, Lockers, Plans
├── src/
│   ├── common/                        # Thành phần chia sẻ dùng chung
│   │   ├── constants/                 # Error codes, system configs, business constraints
│   │   ├── decorators/                # @Roles(), @CurrentUser(), @Public()
│   │   ├── filters/                   # HttpExceptionFilter (Chuẩn hóa lỗi JSON)
│   │   ├── guards/                    # JwtAuthGuard, RolesGuard (RBAC 5 roles)
│   │   ├── interceptors/              # TransformResponseInterceptor, LoggingInterceptor
│   │   ├── pipes/                     # ValidationPipe
│   │   └── utils/                     # Date calculation helpers, advisory lock keys
│   ├── config/                        # Cấu hình môi trường (Supabase, Redis, JWT, AI API)
│   ├── database/                      # Prisma Module & Prisma Service
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   ├── infrastructure/                # Các dịch vụ nền tảng bên ngoài
│   │   ├── redis/                     # Redis Client & Distributed Lock (Redlock)
│   │   ├── queue/                     # BullMQ Queue Module (Cronjobs, FCM Push Notification)
│   │   ├── socket/                    # Socket.io Gateway (Realtime notifications & attendance)
│   │   └── storage/                   # Supabase Storage S3-compatible service
│   ├── modules/                       # Từng Module nghiệp vụ độc lập (Domain Modules)
│   │   ├── auth/                      # Đăng nhập, Refresh Token, Đăng xuất, Thu hồi session Redis
│   │   ├── users/                     # Quản lý tài khoản, Profile, Phân cấp 2 tầng (Admin tạo CM; CM tạo Staff/Coach)
│   │   ├── specialties/               # [V5 Mới] Quản lý danh mục chuyên môn HLV (Specialties) & gán Coach
│   │   ├── staff-shifts/              # Quản lý ca trực lễ tân, phân công ca, chống trùng lịch
│   │   ├── coach-rates/               # Quản lý cấu hình mức phí dạy của từng Coach theo thời kỳ
│   │   ├── coach-availability/        # [V5 Mới] Mở slot PT rảnh, chống xung đột chéo với lớp nhóm
│   │   ├── equipment/                 # Quản lý thiết bị máy tập, giữ chỗ máy cho ca dạy PT
│   │   ├── lockers/                   # [V5 Mới] Quản lý danh mục tủ đồ và cấp phát atomic theo lượt
│   │   ├── memberships/               # Quản lý Gói tập (Trial, Drop-in, Plus, VIP) 4 môn, hợp đồng hội viên
│   │   ├── classes/                   # 4 Bộ môn, Phòng tập, Lớp học nhóm, Lịch học cố định (Schedules)
│   │   ├── bookings/                  # Điều phối đặt chỗ kép:
│   │   │   ├── services/
│   │   │   │   ├── group-booking.service.ts  # Đặt lớp nhóm (Pessimistic lock FOR UPDATE trên schedules)
│   │   │   │   ├── pt-booking.service.ts     # Đặt PT 1-1 (Lock coach_availability, trừ remaining_pt_sessions)
│   │   │   │   └── cancellation.service.ts   # [V5 Mới] Hủy lịch trước 2 tiếng & hoàn trả quota
│   │   │   ├── bookings.controller.ts
│   │   │   └── dto/
│   │   ├── attendances/               # Điểm danh cổng (GATE_ENTRY + Locker + Towel) & Lớp/PT (CLASS_SESSION)
│   │   ├── inbody/                    # [V5 Mới] Quản lý lịch sử đo InBody định kỳ (cơ, mỡ, BMI)
│   │   ├── billing/                   # Hóa đơn (Snapshot Base/PT), Đăng ký VIP động, Mua thêm giờ PT (Add-on)
│   │   ├── analytics/                 # Báo cáo doanh thu tách biệt Base/PT, Tỷ lệ lấp đầy, Thống kê hội viên
│   │   └── ai-assistant/              # AI Workout Assistant, SSE Stream, RAG Vector Search (pgvector)
│   ├── app.module.ts                  # Root Module
│   └── main.ts                        # Entry point: CORS, Swagger (/docs), Global Pipes & Filters
├── test/                              # E2E test cho Concurrency Booking & Advisory Lock
├── Dockerfile                         # Multi-stage production build
├── docker-compose.yml                 # Redis 7 Alpine cục bộ
└── package.json
```

---

## 2. MA TRẬN PHÂN QUYỀN 2 TẦNG (RBAC MATRIX - 5 VAI TRÒ)

```mermaid
flowchart TD
    subgraph Tầng 1: System Admin [IT / Kỹ thuật]
        Admin["ADMIN (IT Support / Super Admin)"]
        Admin -->|Tạo & Khóa tài khoản| CM["CENTER_MANAGER"]
        Admin -->|Cấu hình hệ thống, Backup, Audit Logs| System["Hạ tầng System & Config"]
    end

    subgraph Tầng 2: Center Operation [Nghiệp vụ Trung tâm]
        CM["CENTER_MANAGER (Giám đốc điều hành)"]
        CM -->|Tạo TK, Phân quyền & Xếp ca| Staff["RECEPTIONIST (Lễ tân)"]
        CM -->|Tạo TK, Duyệt chuyên môn & Phê duyệt giá| Coach["COACH (Huấn luyện viên)"]
        CM -->|Quản lý gói tập, Tủ đồ, Xem toàn bộ Báo cáo| Member["MEMBER (Hội viên)"]
    end

    subgraph Nghiệp vụ Quầy & Huấn Luyện
        Staff -->|Bán gói Trial/Plus/VIP, Check-in Cổng, Cấp Tủ & Khăn| Member
        Coach -->|Mở slot PT, Điểm danh lớp/PT, Giữ máy, Lập giáo án| Member
    end
```

* **ADMIN (IT Support):**
  * Quản trị kỹ thuật cấp cao nhất, cấu hình API Keys, backup/restore, audit logs.
  * Tạo tài khoản duy nhất cho `CENTER_MANAGER`. Không can thiệp vào nghiệp vụ phòng tập hàng ngày.
* **CENTER_MANAGER (Giám đốc trung tâm):**
  * Quản trị toàn bộ nghiệp vụ: Tạo tài khoản và phân quyền cho `RECEPTIONIST`, `COACH`, `MEMBER`.
  * Cấu hình 4 môn (`disciplines`), danh mục chuyên môn (`specialties`), gói tập (`membership_plans`), phê duyệt giá HLV (`coach_rates`), quản lý tủ đồ (`lockers`).
  * **Ràng buộc an toàn:** Không thể tự nâng quyền lên `ADMIN`, không can thiệp vào tài khoản của `ADMIN`.
* **RECEPTIONIST (Lễ tân):** Bán/gia hạn gói tập (Trial, Drop-in, Plus, VIP, Add-on), xuất hóa đơn, check-in cổng (`GATE_ENTRY`), cấp phát tủ đồ theo lượt, phát khăn tập, nhập chỉ số InBody.
* **COACH (Huấn luyện viên):** Khai báo khung giờ rảnh PT (`coach_availability`), điểm danh lớp/ca PT (`CLASS_SESSION`), lập giáo án cá nhân hóa với RAG AI, giữ máy tập cho ca PT.
* **MEMBER (Hội viên):** Mua gói, xem biểu đồ InBody, theo dõi 2 quota độc lập (`remaining_group_sessions` và `remaining_pt_sessions`), đặt chỗ lớp nhóm hoặc đặt PT 1-1, hủy lịch trước 2 tiếng.

---

## 3. KẾ HOẠCH TRIỂN KHAI THEO GIAI ĐOẠN (PHASED IMPLEMENTATION PLAN V5)

### Phase 1: Môi trường, Hạ tầng & Lược đồ Database V5 (Tuần 1 - 2)
* Khởi tạo NestJS, cấu hình `.env` kết nối Supabase Pooler (`6543`), Direct (`5432`) và Docker Redis.
* **Đồng bộ hóa Prisma Schema (`prisma/schema.prisma`):**
  * Enums: `UserRole` (5 vai trò), `SubscriptionStatus`, `BookingStatus`, `AttendanceStatus`, `PaymentMethod`, `InvoiceStatus`, `TrainingMode` (`GROUP_CLASS`, `PERSONAL_TRAINING`, `HYBRID`, `CUSTOM`), `PackageTier` (`TRIAL`, `DROP_IN`, `PLUS`, `VIP`), `InvoiceType` (`SUBSCRIPTION_NEW`, `PT_ADDON`, `DROP_IN`), `LockerStatus` (`AVAILABLE`, `OCCUPIED`, `MAINTENANCE`).
  * Models mới: `Specialty`, `CoachSpecialty`, `MemberInbodyLog`, `Locker`, `LockerAssignment`.
  * Mở rộng Models hiện hữu:
    * `MembershipPlan`: thêm `discipline_id`, `package_tier`, `training_mode`, `group_session_quota`, `pt_session_quota`, `unlimited_gym_entry`.
    * `UserSubscription`: thêm `discipline_id`, `package_tier`, `assigned_coach_id`, `remaining_group_sessions`, `remaining_pt_sessions`, `has_unlimited_gym_access`.
    * `Invoice`: thêm `type`, `base_amount`, `pt_amount`.
    * `Booking`: thêm `discipline_id`.
    * `Attendance`: thêm `towel_issued`.
* Viết script `prisma/seed.ts`:
  * Khởi tạo 4 môn (`GYM`, `BOXING`, `YOGA`, `DANCING`), các danh mục chuyên môn (`specialties`), danh mục tủ đồ (`lockers` Nam/Nữ/VIP), tài khoản Admin, Manager, Coaches, Lễ tân và các gói tập chuẩn theo ma trận kinh doanh.

### Phase 2: Xác thực & Phân quyền RBAC 2 tầng (Tuần 3)
* **Xác thực JWT & Session Redis:** Access Token (15 phút), Refresh Token (7 ngày) lưu trên Redis, hỗ trợ thu hồi token khi logout.
* **RBAC Guards:** `JwtAuthGuard`, `RolesGuard` với Decorator `@Roles()`, hỗ trợ `@Public()`.
* **Users Management (`UsersModule`):**
  * Quản lý hồ sơ `member_profiles`, `coach_profiles`.
  * Endpoint tạo tài khoản phân cấp: Admin tạo Center Manager; Center Manager tạo Receptionist, Coach.

### Phase 3: Quản trị Vận hành, Chuyên môn & Tiện ích Hậu mãi (Tuần 4 - 5)
* **`SpecialtiesModule`:** Quản lý danh mục kỹ thuật chuyên môn và liên kết HLV (`coach_specialties`).
* **`StaffShiftsModule` & `CoachRatesModule`:**
  * Lập lịch ca trực lễ tân (`staff_shifts`).
  * Cấu hình mức giá dạy theo buổi của từng Coach (`coach_rates`) theo khoảng thời gian hiệu lực `rate_range`.
* **`LockersModule`:**
  * Quản lý danh mục tủ đồ Nam/Nữ/VIP.
  * Cấp phát tủ đồ atomic khi check-in, giải phóng tủ khi check-out (`returned_at = NOW()`).
* **`InbodyModule`:**
  * Lưu trữ lịch sử đo chỉ số sinh học (`member_inbody_logs`).
  * Cung cấp API biểu đồ tiến trình cơ - mỡ cho Mobile App của Member và Coach.

### Phase 4: Điều phối Bán vé Đa tầng & Đặt lịch Kép (Tuần 6 - 7)
* **`BillingModule` & Gói tập 4 Môn:**
  * Xử lý đăng ký Gói VIP động: `total_amount = base_price + (12 * coach_rate)`. Gán `assigned_coach_id` và cấp 12 buổi PT.
  * Xử lý Mua thêm giờ PT lẻ (Add-on): Tạo hóa đơn `PT_ADDON` và cộng dồn `remaining_pt_sessions`.
  * Chặn cấu hình sai: Trigger DB chặn tạo gói GYM lớp nhóm.
* **`BookingsModule` (Dual-Flow Engine):**
  * **Luồng 1 (Lớp nhóm Yoga/Boxing/Dance):** Dùng Pessimistic Locking (`SELECT ... FOR UPDATE`) trên `schedules`, kiểm tra `current_enrolled < capacity`, trừ `remaining_group_sessions`.
  * **Luồng 2 (PT 1-1 Gym/Boxing/Yoga/Dance):** Dùng `pg_advisory_xact_lock` chống xung đột lịch Coach, khóa slot `is_booked = true`, trừ `remaining_pt_sessions`.
  * **Dịch vụ Hủy lịch (`cancellation.service.ts`):** Kiểm tra thời hạn hủy $\ge 2$ tiếng $\rightarrow$ Hoàn lại session và mở lại slot. Nếu $< 2$ tiếng $\rightarrow$ Từ chối hoàn buổi.

### Phase 5: Điểm danh Realtime & Tiện ích Quầy (Tuần 8)
* **`AttendancesModule`:**
  * Điểm danh cổng (`GATE_ENTRY`): Xác thực gói tập còn hạn $\rightarrow$ Cấp tủ đồ tự động qua `FOR UPDATE SKIP LOCKED` $\rightarrow$ Ghi nhận mượn khăn `towel_issued`.
  * Điểm danh lớp/ca PT (`CLASS_SESSION`): Huấn luyện viên kiểm diện từ Mobile App (`PRESENT`, `ABSENT`, `LATE`).
* **Realtime Gateway (`SocketGateway`):**
  * Bắn sự kiện realtime cập nhật sĩ số lớp học và thông báo khách vào cổng lên Web Portal của Lễ tân & Manager.

### Phase 6: Trợ lý AI Streaming & Tác vụ Hàng đợi Nền (Tuần 9 - 10)
* **`AiAssistantModule`:**
  * Endpoint SSE streaming văn bản gợi ý bài tập từ LLM API (Gemini/OpenAI).
  * RAG pgvector trên `exercise_knowledge` (Cosine Distance `<=>`) kết hợp với dữ liệu InBody và hồ sơ bệnh án của học viên để tạo giáo án cá nhân hóa.
* **BullMQ Queue Module:**
  * **Cronjob Expiry (00:05 hàng ngày):** Quét các hợp đồng có `end_date < CURRENT_DATE` để cập nhật `status = 'EXPIRED'` (giữ nguyên số dư quota lịch sử).
  * **Notification Worker:** Bắn thông báo nhắc lịch học trước 2 tiếng qua Firebase Cloud Messaging (FCM).

### Phase 7: Kiểm thử Concurrency, Tối ưu & Đóng gói Production (Tuần 11 - 12)
* **Kiểm thử E2E & Concurrency:**
  * Test 20 requests đồng thời tranh chấp 1 slot lớp nhóm cuối cùng.
  * Test race condition 2 request đồng thời mở ca dạy lớp nhóm và slot PT của cùng 1 HLV.
  * Test race condition 2 lễ tân cùng cấp 1 tủ đồ.
* **Đóng gói Docker:** Multi-stage `Dockerfile` tối ưu kích thước image và cấu hình Nginx Reverse Proxy.
