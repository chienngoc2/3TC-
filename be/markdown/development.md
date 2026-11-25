# DEVELOPMENT LOG — trạng thái backend ngày 27/09/2026

## Trạng thái và quyết định hiện hành

- Phase 1–5: đã triển khai REST/realtime; xem snapshot chi tiết bên dưới và backend_phases_1_5_report.md.
- Stack: Node 24, NestJS 12, Prisma 5.22, PostgreSQL V5 29 models, Redis 7 dành riêng cho auth, Socket.IO.
- Khóa nghiệp vụ: PostgreSQL row/advisory locks và transaction Serializable, không dùng Redis Redlock.
- Deployment mục tiêu: một EC2 instance + Docker Compose + Nginx/TLS + Supabase. Chưa tạo hạ tầng, build image production hoặc xác nhận deployment.
- Không dùng BullMQ. AI/RAG/SSE, scheduler và FCM vẫn chưa triển khai.
- Nhánh chuẩn hóa: feature/backend-deployment-simplification, kế thừa feature/backend-core-validation; chưa merge dev/push.

## Nhật ký chuẩn hóa deployment và loại bỏ logic cũ

1. Bỏ bullmq và @nestjs/bullmq khỏi package.json/package-lock.json; npm uninstall loại 11 package. Code src không có queue/producer/worker nên không xóa logic nghiệp vụ nào và giữ nguyên Redis auth Lua.
2. Viết lại markdown/backend_deployment_new.md: EC2 một instance, Redis auth-only, scheduler tương lai, persistence AOF/volume/noeviction, Node 24, build context không secret, runtime non-root, migration bằng môi trường công cụ riêng.
3. Sửa cấu hình env thống nhất .env.production, bỏ REDIS_TTL không được code đọc, placeholder secrets; sửa checklist đúng auth:session:<sid>, auth:user:<userId> và system-metrics hiện có.
4. Chuẩn hóa chi phí theo region/credit thực tế, IPv4/CPU surplus/allowance, Billing Alarm us-east-1, budget không phải hard cap. Bỏ tuyên bố uptime/chi phí tuyệt đối.
5. Bổ sung Security Group, Docker Compose V2, Nginx/TLS, transport Socket.IO, log rotation, giám sát, migration V5 và rollback. AI/SSE/Cron là checklist tương lai, không báo đã implement.
6. Đồng bộ implementation_plan_backend.md và README: bỏ queue mục tiêu/BullMQ badge, thay roadmap phase 6 bằng scheduler có timezone, chạy bù/chống trùng và PostgreSQL retry khi cần.
7. Log này giữ toàn bộ báo cáo phase 1–5 bên dưới. Các ghi chép cũ sau mục lịch sử là ngữ cảnh cũ, không đại diện trạng thái hiện hành.
8. Những file đã bị xóa trước lượt này (backend_deployment.md, v5_review_report.md) được giữ theo trạng thái người dùng; không phục hồi hoặc ghi đè.

## Snapshot toàn bộ thay đổi và kiểm chứng phase 1–5

# Báo cáo triển khai backend cơ bản — Phase 1–5

Phạm vi: triển khai logic REST và realtime theo `implementation_plan_backend.md`, đối chiếu Prisma V5 và các tài liệu trong `../erd`. Không triển khai AI/RAG/SSE, CronJobs, BullMQ workers, FCM hay đóng gói Docker/Nginx production. Kiểm thử hồi quy và concurrency được thực hiện theo yêu cầu riêng để chuẩn bị merge.

## 1. Các chức năng đã triển khai

| Phần | Chức năng |
| --- | --- |
| Phase 1 | Prisma/PostgreSQL, Redis, validate cấu hình, API `/api/v1`, định dạng phản hồi/lỗi, health kiểm tra DB và Redis, audit; giữ quy trình `db:setup` áp dụng SQL V5 sau schema và trước seed. |
| Phase 2 | Đăng ký MEMBER; đăng nhập; access token 15 phút; refresh 7 ngày; rotation bằng Redis Lua; phát hiện replay; logout; thu hồi toàn bộ phiên khi đổi mật khẩu/vô hiệu hóa; global JWT/RBAC guards; ADMIN quản lý CM, CM quản lý nhân sự/hội viên; hồ sơ Member/Coach. |
| Phase 3 | Danh mục môn/chuyên môn và gán chuyên môn HLV; phòng, thiết bị, lớp; ca trực; biểu phí theo khoảng ngày; slot PT; tủ Nam/Nữ/VIP và trả tủ; InBody và lịch sử tiến trình có kiểm soát quyền truy cập/cửa sổ sửa 24 giờ. |
| Phase 4 | Bán Trial/Drop-in/Plus/VIP; VIP base + 12 × rate hiện hành của HLV đúng chuyên môn; hóa đơn PAID chốt base/PT; mua thêm PT; gia hạn bằng hợp đồng nối tiếp; freeze/unfreeze; đặt lớp và PT; chọn hợp đồng theo hạn gần nhất; giữ thiết bị; hủy sát giờ/đúng hạn; đề nghị hủy khẩn cấp, duyệt hai tầng và DSS. |
| Phase 5 | Điểm danh cổng; kiểm tra gói còn hạn/đã bắt đầu hoặc booking hợp lệ trong ngày; Gym Drop-in dùng một lượt; cấp tủ atomic; ghi khăn; quét lại cùng lượt có tủ không cấp trùng; điểm danh lớp/PT; sửa điểm danh; Socket.IO có JWT/session và phòng theo người dùng/vai trò. |
| Logic cơ bản bổ sung | Giáo án thủ công và thư viện bài tập không sinh embedding; báo cáo doanh thu base/PT theo môn, dashboard ngày, KPI từ dữ liệu sẵn có, chỉ số tiến trình Node cho ADMIN. |

Controller, service, module và DTO đã được tách theo cấu trúc NestJS. Mã nguồn được format bằng Prettier và kiểm tra bằng Oxlint. Swagger CLI plugin xuất schema DTO từ bản build; kiểm tra wiring/schema/endpoint bằng `test:openapi`.

`.gitattributes` cố định LF cho checkout mới trên Windows/Linux; Prettier dùng `endOfLine: auto` để chấp nhận working tree Windows hiện có. Mô phỏng merge đã phát hiện `core.autocrlf` khiến CRLF làm format check thất bại; cấu hình phối hợp này tránh lỗi khi merge vào checkout đã tồn tại.

## 2. Các bất biến nghiệp vụ

- Mọi booking lưu `subscriptionId` thực tế. Chọn hợp đồng ACTIVE đã bắt đầu, còn hạn đến ngày tập, đúng môn, đúng HLV cho PT và đủ quota; ưu tiên `endDate`, rồi thời điểm mua và ID.
- Sĩ số được khóa bằng `FOR UPDATE`; chỉ đặt lớp OPEN còn chỗ. Service cập nhật sĩ số đúng một lần, DB suy ra OPEN/FULL.
- PT claim slot bằng điều kiện `isBooked = false`, `isEmergencyCancelled = false`. Khóa advisory HLV, unique/exclusion và transaction Serializable bảo vệ các luồng đồng thời.
- Khóa advisory theo hội viên ngăn đặt trùng giờ giữa lớp/PT và tranh chấp quota giữa các buổi khác nhau.
- Quyết định nghiệp vụ MEMBER PT (28/09/2026, đã điều chỉnh ngày 29/09/2026): bỏ trần 3 PT/tuần; dùng quota PT toàn gói linh hoạt và có thể mua add-on không gia hạn hợp đồng. Một booking PT còn hiệu lực theo MEMBER + môn + ngày Việt Nam, cho phép hai môn cùng ngày nếu không trùng giờ. Quy định cũ chỉ cho đặt lại ngày khác sau hủy đã được thay bằng chính sách hủy đúng hạn/hoàn quota cho phép đặt lại cùng ngày; xem log thay đổi mới ở cuối file.
- Tài liệu MEMBER đã được đồng bộ ở use case, business rule, API contract, routing, danh sách màn hình web/mobile và kế hoạch web; `markdown/api_addendum.md` bị xóa theo yêu cầu. URL lịch tuần giữ `?week=YYYY-MM-DD` theo Thứ Hai–Chủ Nhật giờ Việt Nam; contract tải đầy đủ dữ liệu tuần được triển khai ngày 29/09/2026, không kế thừa đề xuất `from`/`to` từ file đã xóa.
- Hủy trước buổi tập luôn giải phóng tài nguyên. Từ 2 giờ trở lên hoàn quota vào đúng hợp đồng; dưới 2 giờ không hoàn; đã bắt đầu thì từ chối. Claim trạng thái trước khi hoàn quota.
- APPROVE/REJECT chỉ xử lý yêu cầu PENDING được claim thành công. Hủy khẩn cấp chỉ hoàn cho booking chuyển trạng thái được; slot PT bị đánh dấu emergency; lịch nhóm giữ lịch sử và đóng `CANCELLED_BY_COACH`; thiết bị được giải phóng.
- DSS dùng trigger V5, gắn penalty với request; reset bộ đếm tháng khi xử lý yêu cầu, giữ bộ đếm cả đời. Không chạy tác vụ tự động và không tự quyết định giảm giá/đình chỉ HLV.
- Transaction đặt timezone Việt Nam để ngày hiệu lực và tháng DSS nhất quán. Freeze/unfreeze gia hạn theo số ngày lịch Việt Nam, phù hợp `endDate` kiểu DATE.
- Hóa đơn dùng Decimal, không đổi số tiền khi sửa plan/rate sau mua. Các phương thức CASH/BANK_TRANSFER/CARD là giao dịch do quầy ghi nhận; không tích hợp payment gateway bên ngoài.
- GYM không có lớp nhóm. Yoga/Boxing tối đa 10, Dance/Dancing tối đa 20 và không vượt sức chứa phòng. `unlimitedGymEntry` chỉ cho gói môn GYM; seed Yoga VIP đã được sửa về false.
- Cấp tủ dùng `FOR UPDATE SKIP LOCKED`; trả tủ claim `returnedAt IS NULL`. Tủ chưa trả từ ngày trước phải được trả trước khi vào lượt mới.
- Quyền vào cổng theo SQL V5: gói ACTIVE còn hiệu lực và còn quota nhóm/PT, Gym unlimited hoặc Gym Drop-in chưa dùng; booking hợp lệ trong ngày cũng cho vào khi quota đã hết. Không trừ thêm quota lớp/PT ở cổng vì lượt đã được trừ khi đặt lịch.
- Event chỉ phát sau transaction commit. Không gửi `internalNote` của yêu cầu hủy cho hội viên. Realtime kiểm tra lại phiên/quyền/hạn token trước mỗi lần giao sự kiện và khi ping.

## 3. API và realtime

Các endpoint chính theo hợp đồng:

- `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`.
- `/users/profile/me`, `/users/members`, `/users/staff`, `/users/center-managers`.
- `/specialties`, `/coaches/:id/specialties`, `/coaches/:id/rates`, `/coaches/availability`, `/staff-shifts`.
- `/memberships/plans`, `/memberships/subscriptions`, `/memberships/subscriptions/:id/status`.
- `POST /billing/purchase` cho các tier; `/billing/subscriptions/vip` nhận `userId`; `/billing/subscriptions/:id/pt-addon` nhận `addonSessions`; `/billing/subscriptions/:id/renew`; `GET /billing/invoices`.
- `/schedules`, `POST /bookings/group-class`, `/bookings/pt`, `PUT /bookings/:id/cancel`.
- `POST /coaches/cancellation-requests`; `PUT /cancellation-requests/:id/review` nhận `action: APPROVE|REJECT`; `/coach-penalties` và duyệt quyết định quản lý.
- `POST /attendances/gate-checkin` nhận `userId`, `preferredZone`, `towelIssued`; `POST /attendances/class-checkin`; `PUT /attendances/class-checkin/:id`.
- `/lockers/assignments/:id/return`, `/inbody/logs`, `/inbody/my-progress`, `/workout-plans`, `/exercise-knowledge`, `/analytics/revenue`, `/analytics/manager-summary`, `/analytics/kpi`.

Tất cả path trên có tiền tố `/api/v1`. Swagger tại `/docs`; artifact kiểm tra tại `.tmp/backend-openapi.json`. Bản build có 104 HTTP endpoints, gồm CRUD/read hỗ trợ và các alias tương thích. Số này không đồng nghĩa mọi endpoint của tài liệu 59 API đã thuộc phạm vi: AI, quản trị secrets tích hợp bên ngoài và workers chưa được triển khai.

Socket.IO namespace `/realtime`; handshake `auth: { token: accessToken }`. Server tự gán `user:<id>` và phòng role; client không tự chọn phòng người khác. Event: `booking.updated`, `schedule.updated`, `cancellation.requested`, `cancellation.reviewed`, `session.cancelled`, `gate.checked-in`, `attendance.updated`, `pong`. Event sĩ số có `currentEnrolled`, `capacity`, `status`. `CORS_ORIGINS` là danh sách origin phân cách dấu phẩy.

## 4. Kiểm chứng

Môi trường: Windows, Node 24.21.0, NestJS 12, Prisma 5.22, PostgreSQL Supabase và Redis 7 chạy trong container kiểm thử riêng. Không reset DB, chạy seed hoặc ghi fixture vào các bảng nghiệp vụ public.

| Nhóm | Kết quả |
| --- | --- |
| Build TypeScript/Nest và wiring bản compile | PASS |
| Prettier và Oxlint | PASS |
| Unit | 13 test: auth, phân cấp tài khoản, payload null/quota/số nguyên, workout lồng nhau, boolean dạng chuỗi. |
| HTTP/database/realtime integration | 25 test với PostgreSQL và Redis thật; schema và Redis prefix riêng, dọn sau chạy. |
| Swagger từ bản build | PASS: 104 endpoint, schema DTO, tên endpoint/body chính. |
| SQL V5 verification | PASS: partial exclusion, OPEN/FULL, xung đột phòng/HLV/lớp-PT, approve/reject, hủy hội viên tranh chấp duyệt HLV và hoàn quota một lần. |

Các ca tích hợp kiểm tra: auth/RBAC/IDOR, refresh rotation/replay/logout; snapshot VIP/add-on; Trial một lần; 20 người tranh chỗ cuối; FIFO và hủy đồng thời; hai người đặt cùng PT; hai người duyệt một yêu cầu; hủy nhóm chỉ một penalty; approve tranh reject; một quota tranh hai buổi; khóa chéo lớp/PT; freeze/gói tương lai/hết hạn; Gym Drop-in; một tủ tranh hai quầy; trả tủ đồng thời; InBody 24 giờ; rate/shift overlap; hủy muộn/đã bắt đầu; điểm danh/sửa quá hạn; cổng khi quota đã dùng hết nhưng có booking; Socket.IO auth/cách ly/thu hồi/ping; giáo án tác giả; payload hợp đồng; rollback không phát event; reset tháng DSS.

Lệnh tái chạy:

```powershell
npm ci
npm run check
$env:TEST_REDIS_URL = 'redis://127.0.0.1:6379'
npm run test:e2e -- --runInBand
npm run db:verify:v5
```

E2E lấy `TEST_DATABASE_URL`, hoặc `DIRECT_URL` khi không cấu hình riêng. Tài khoản cần quyền tạo/drop schema; DB cần `btree_gist`, `vector` và môi trường auth/role tương thích SQL Supabase V5. Không chạy E2E song song với `prisma generate` trên Windows: engine DLL đang được Node sử dụng sẽ gây EPERM. Không đặt `TEST_REDIS_URL` thì integration suite dùng session adapter in-memory; lần kiểm chứng được báo cáo dùng Redis thật.

## 5. Git flow và merge

Các nhánh xếp chồng, merge theo đúng thứ tự, dùng merge commit để giữ ancestry:

1. `feature/backend-foundation` — `8953bf7`.
2. `feature/backend-operations` — `41b5617`.
3. `feature/backend-bookings-billing` — `a57b07e`.
4. `feature/backend-attendance-realtime` — `3d1652a`.
5. `feature/backend-core-validation` — kiểm thử, Swagger, sửa biên DTO/timezone và báo cáo cuối.

```powershell
git switch dev
git merge --no-ff feature/backend-foundation
git merge --no-ff feature/backend-operations
git merge --no-ff feature/backend-bookings-billing
git merge --no-ff feature/backend-attendance-realtime
git merge --no-ff feature/backend-core-validation
npm run check
```

Tránh squash từng nhánh nối tiếp mà chưa rebase nhánh con: ancestry có thể làm diff lặp lại. Có thể merge một lần nhánh cuối nếu không cần từng PR riêng. `dev` thực tế được giữ nguyên; mô phỏng merge và kiểm tra build thực hiện trên worktree tạm. Chưa push, mở PR hay deploy.

Kết quả mô phỏng trên base `dev = 19d04d9`: merge đủ 5 nhánh bằng `--no-ff` không có conflict; `git diff` giữa tree sau merge và nhánh cuối rỗng. Chạy `npm run check` trên worktree sau merge đã pass generate, format, lint, build, 104 endpoint Swagger và 13 unit test. Lượt integration cuối trên cùng mã nguồn pass **25/25** với Redis thật (199,654 giây); Redis prefix được dọn về 0 key sau chạy. Worktree và container kiểm thử được dọn sau kiểm chứng.

## 6. Giới hạn của kết quả

- Đây là backend cơ bản trong phạm vi đã yêu cầu; không kết luận production hardening/triển khai Phase 6–7 hoàn tất.
- RLS V5 được áp dụng khi dựng schema test, nhưng transaction của Prisma dùng tài khoản DB chủ sở hữu. Test HTTP kiểm tra RBAC/ownership tại API; không thay thế kiểm toán RLS với JWT/role PostgREST hoặc tài khoản DB hạn chế quyền.
- KPI dùng các dữ liệu đang có (ca/lịch, giờ phòng, DSS). Schema chưa có mô hình rating/commission nên không suy diễn số liệu đó.
- Realtime là event trong tiến trình, chưa có durable outbox/Redis adapter để phục hồi event hoặc scale nhiều instance; các phần đó cần thiết kế khi đóng gói production.
- Các query nghiệp vụ tự xét ngày hiệu lực nên không cấp quyền cho hợp đồng hết hạn dù cột status chưa được Cron cập nhật. Không tự chuyển lịch cũ sang COMPLETED hoặc gửi nhắc lịch.
- Các kiểm chứng là bằng chứng cho snapshot mã nguồn và `dev` hiện tại; thay đổi mới trên dev cần merge/rebase và chạy lại kiểm tra.
- Đã áp dụng bản vá dependency tương thích qua `npm audit fix`. Audit dependency production không còn advisory; audit đầy đủ còn 5 advisory trong chuỗi dev dependency của `@nestjs/mau`, cần thay đổi major theo đề xuất npm. Không dùng `--force` để đổi công cụ deploy ngoài phạm vi này.


## Lịch sử trước chuẩn hóa — chỉ để tham khảo

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
    ├── infrastructure/                        # Redis Module, Scheduler dự kiến, Socket Gateway
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
* `PUT /api/v1/bookings/:id/cancel`: Hủy đặt chỗ (áp dụng Tiered Cancellation Policy: luôn giải phóng slot; hoàn quota nếu $\ge 2\text{h}$; không hoàn quota nếu $< 2\text{h}$).

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

- [x] Cập nhật `prisma/schema.prisma` với 29 models hoàn chỉnh từ `SQL_v5.md` (bao gồm `subscription_id` trong Booking, `schedule_status`, `frozen_at`, `cancellation_requests`, `coach_penalties`).
- [x] Đồng bộ hóa Schema V5 (29 tables) lên Supabase qua Prisma.
- [x] Cập nhật `prisma/seed.ts` nạp dữ liệu chuẩn cho 4 môn thể thao, Specialties, Lockers, 5 Roles.
- [ ] Triển khai các Domain Modules theo đúng roadmap 7 bước trong `instructions_steps.md`.

## Kiểm chứng sau chuẩn hóa deployment — 27/09/2026

- npm run check: PASS (Prisma generate, Prettier, Oxlint, Nest build, OpenAPI 104 HTTP endpoints, 4 unit suites/13 tests).
- npm ls bullmq @nestjs/bullmq: empty; không còn dependency hoặc usage trong src.
- npm audit --omit=dev --audit-level=low: 0 vulnerabilities. Audit toàn bộ vẫn báo 5 advisory dev dependencies; không dùng force để thay major ngoài phạm vi.
- git diff --check: PASS sau sửa trailing whitespace trong roadmap.
- Không chạy lại 25 integration tests trong lượt này vì không thay đổi logic runtime/schema; kết quả 25/25 bên trên là kiểm chứng phase 1–5 trước đó, không phải lần chạy mới.
- Docker/Nginx/EC2 là cấu hình mục tiêu trong tài liệu; chưa build image hoặc deploy, chưa xác nhận ARM64 và migration production.
- Chưa commit/push/merge dev; thay đổi nằm trên feature/backend-deployment-simplification để review.
## Publication và merge vào dev — 27/09/2026

- Theo yêu cầu người dùng, đã push 6 nhánh feature lên origin: backend-foundation, backend-operations, backend-bookings-billing, backend-attendance-realtime, backend-core-validation, backend-deployment-simplification.
- Merge lần lượt bằng --no-ff vào dev: ecba76a, 776e0f0, 299d41e, 2cb34b9, 8474475, eabca0d. Không có conflict; tree tại eabca0d trùng feature/backend-deployment-simplification.
- npm run check trên dev sau merge: PASS generate/format/lint/build, OpenAPI 104 endpoints, 4 suites/13 unit tests.
- Không chạy lại integration/EC2 deployment trong lượt publication; 25/25 integration phía trên là kiểm chứng trước đó.
- Các ghi chú chưa push/merge ở phiên trước là lịch sử và được thay thế bởi bản ghi này. Nhánh feature được giữ để truy vết, không force-push hoặc xóa nhánh.

## MEMBER self-checkout, lịch tuần và PT theo môn/ngày — 29/09/2026

- Triển khai trên nhánh `feature/member-self-checkout-weekly-calendar`, đối chiếu `erd/user.md` và `erd/checkout_simulate.md`. Giữ API POS cho RECEPTIONIST/CENTER_MANAGER; MEMBER đi qua checkout riêng, luôn lấy danh tính từ JWT và không nhận số tiền/phương thức thanh toán từ client.
- Thêm `CheckoutOrder`, `PaymentAttempt`, `PaymentWebhookEvent`, enum checkout/payment và quan hệ `Invoice.checkoutId` trong Prisma. Migration `20260929000000_member_self_checkout` tạo FK, unique/idempotency/index; cập nhật script SQL V5 thủ công để bật RLS và policy cho ba bảng mới khi chạy `db:setup`.
- Catalog `GET /memberships/plans` hỗ trợ lọc `disciplineId` và `packageTier`. Thêm VIP quotation read-only, PT add-on preview, checkout NEW_SUBSCRIPTION/RENEWAL/PT_ADDON, danh sách/chi tiết trạng thái, retry và reconcile. Giá VND được tính bằng Decimal rồi khóa trong order snapshot; invoice/quota chỉ tạo khi fulfillment hợp lệ. Trial 0đ hoàn tất nội bộ với payment method `FREE`; đơn có tiền dùng `MOCK`. Advisory lock, unique key và webhook inbox chống cộng quyền/hóa đơn lặp. Renewal nối tiếp gói, add-on chỉ cộng PT quota vào gói ACTIVE còn hạn.
- Thêm mock adapter cho demo non-production: lookup/simulate theo `paymentId`, HMAC SHA-256 raw body, HTTP nội bộ tới `/billing/webhooks/mock`, outcome/eventId lưu bền để phát lại cùng kết quả, giới hạn lookup/simulate theo IP/mã. Thành công → `FULFILLED`; thất bại → `PAYMENT_FAILED`; tiền đến sau hạn hoặc điều kiện cấp gói không còn hợp lệ → `PAYMENT_REVIEW`. Sau commit phát Socket.IO `checkout.updated` tới MEMBER và trả `invoiceId`/`subscriptionId`; GET checkout là trạng thái chuẩn. Không tích hợp PSP thật hoặc refund tự động. Frontend `/mock-payment`/QR/tunnel cần triển khai riêng theo đặc tả.
- `POST /bookings/pt` kiểm tra một PT còn hiệu lực cho MEMBER + môn + ngày Việt Nam dưới advisory lock, cho phép hai môn cùng ngày nếu khác giờ. Quy định ban đầu chặn mọi booking MEMBER đã hủy cùng ngày; chính sách này đã được thay bằng ngoại lệ hủy đúng hạn/hoàn quota ngày 29/09/2026. Không tạo unit test riêng cho API PT theo yêu cầu; kiểm tra bằng E2E.
- Thêm `GET /members/me/calendar?week=YYYY-MM-DD` cho Web/Mobile: tuần Thứ Hai–Chủ Nhật Việt Nam, trả lịch nhóm, slot PT, booking của tôi, subscription/quota và eligibility theo môn/ngày. Query giới hạn theo UTC của tuần trước khi lấy dữ liệu, không cắt ngầm ở `take:200`, giữ các GET cũ.
- Cập nhật `erd/business_rule_final.md` và `erd/API_CONTRACT.md` theo runtime đã triển khai; các đoạn legacy ngoài phạm vi MEMBER được giữ nguyên. Đồng bộ `.env.example` với cờ mock và secret; `main.ts` bật raw body cho xác thực webhook.
- Kiểm chứng cuối: `npm run check` PASS (Prisma generate, format, Oxlint, Nest build, OpenAPI 115 endpoint, 4 unit suites/13 tests); `npm run test:e2e -- --runInBand` PASS 26/26 ca trên PostgreSQL/Redis cô lập, gồm checkout trùng key, webhook lặp/sai chữ ký, add-on, retry, Trial miễn phí, PT theo môn/ngày và calendar. `git diff --check` PASS. Migration mới được tạo bằng Prisma diff và schema được thực thi trong E2E qua `db push` + SQL constraints; chưa chạy riêng `prisma migrate deploy` trên production. Không có PSP thật hoặc UI Mock Payment trong backend.

## MEMBER đặt lại PT cùng môn/cùng ngày sau hủy đúng hạn — 29/09/2026

- Nhánh backend `feature/member-pt-same-day-rebooking` từ `dev`. Hủy PT thường trước giờ tập ít nhất 2 giờ hoàn quota và giải phóng slot trong cùng transaction; booking đã hủy đúng hạn không còn chặn ngày. MEMBER có thể đặt slot khác cùng môn/cùng ngày nếu subscription còn hiệu lực, quota còn và slot/lịch không xung đột. Hủy thường dưới 2 giờ không hoàn quota và vẫn chặn ngày; hủy khẩn cấp do trung tâm có hoàn quota không chặn. Giữ giới hạn tối đa một PT còn hiệu lực cho MEMBER + môn + ngày Việt Nam; hai môn cùng ngày được nếu không trùng giờ.
- `BookingsService.pt` và lịch tuần `GET /members/me/calendar` dùng chung `ptDayBlockReason`, dựa vào trạng thái hủy/`cancelledAt`/`isLateCancellation`/`isEmergencyCancellation` thay vì role `cancelledBy`. Booking hủy cũ thiếu dữ liệu kiểm chứng tiếp tục bị chặn an toàn; giữ mã lỗi `PT_REBOOK_SAME_CANCELLED_DAY` cho trường hợp này và hủy muộn, tránh đổi contract đột ngột. `BookingsService.cancel` dùng advisory lock theo hội viên cùng với luồng đặt PT để đồng bộ thay đổi quota/trạng thái. Hủy hộ đúng hạn bởi nhân viên cũng cho đặt lại ngày đó.
- Đồng bộ `implementation_plan_backend.md`; trong repo `erd` cập nhật `API_CONTRACT.md`, `business_rule_final.md`, `use_cases.md`, `user.md`, `WEB_PORTAL_SCREEN_LIST.md`, `MOBILE_SCREEN_LIST.md`, `tasks.md`. FE/mobile phải tải lại calendar và subscription sau hủy/đặt; quy trình hủy rồi đặt mới gồm hai transaction, không bảo đảm slot mới.
- Không thêm unit test cho API/rule PT theo yêu cầu. E2E MEMBER đã kiểm tra active day bị chặn, hủy đúng hạn hoàn quota và calendar cho phép đặt lại cùng ngày, nhân viên hủy hộ, hủy muộn không hoàn và vẫn chặn ngày. `npm run check` PASS (Prisma generate, Prettier, Oxlint, build, OpenAPI 115 endpoint, 4 suite/13 unit test có sẵn); `npm run test:e2e -- --runInBand` PASS 26/26 ca trên PostgreSQL/Redis cô lập. `git diff --check` PASS sau chuẩn hóa whitespace.

## Seed Supabase theo ma trận 4 môn — 01/10/2026

- Nhánh `feature/seed-supabase-member-demo-matrix`. Cập nhật `prisma/seed.ts` theo giá/quota trong `erd/active/business rules/business_rule_final.md`: Gym, Boxing, Yoga, Dancing có TRIAL/DROP_IN/PLUS/VIP; Yoga Drop-in gồm Hatha 120k, Vinyasa 150k, Hot Yoga 180k. Giá VIP chỉ là base, quotation/checkout cộng 12 × coach rate của đúng môn. Tổng 18 SKU active.
- Bổ sung `coach_rates.discipline_id` nullable để bảo toàn rate cũ và lưu rate theo từng cặp HLV–môn. Quotation/checkout ưu tiên rate theo môn, fallback rate cũ khi chưa cấu hình. API tạo/sửa rate kiểm tra HLV có chuyên môn của môn đó; GiST exclusion và hai stored procedure SQL được đồng bộ theo khóa môn.
- Seed dùng 2 HLV hiện hữu Alex/Elena và 11 HLV demo mới (gồm 1 HLV dạy 4 môn), tạo đúng 4 phân công/rate cho mỗi môn. Tạo 8 MEMBER demo riêng (2/môn: 1 PLUS, 1 VIP), giữ nguyên 4 MEMBER hiện hữu. Subscription demo có invoice MOCK/PAID mã `DEMO-*`; rerun không đặt lại quota hoặc lịch sử đã sử dụng.
- Tuần Việt Nam Thứ Hai–Chủ Nhật: Boxing/Yoga/Dancing mỗi môn có một lớp nhóm tương lai (sức chứa 10/10/20); Gym không có lớp nhóm theo nghiệp vụ, chỉ có PT. Mỗi HLV có tối thiểu 5 slot PT còn trống trong tuần. Seed dùng ID ổn định theo thực thể/tuần, tránh tạo trùng khi chạy lại.
- Một SKU Boxing Trial cũ có 0 quota đã có subscription lịch sử; seed chỉ chuyển SKU này sang inactive, giữ nguyên subscription. Catalog sau đó có đúng 18 SKU active.
- Schema Supabase trước đợt này không có bản ghi Prisma migration history dù các bảng đã tồn tại. Chỉ áp dụng SQL additive `20261001000000_coach_rates_by_discipline/migration.sql` qua `prisma db execute`; không chạy `migrate deploy`/`db push` trên dữ liệu hiện hữu. Trước khi chuyển quy trình deploy sang Prisma Migrate cần baseline lịch sử migration riêng.
- Gym Drop-in một lượt được backend hiện hữu xử lý bằng `remainingSessions = 1` lúc bán và trừ khi check-in; seed chỉ cấu hình giá 50k và hạn 1 ngày. Boxing VIP vẫn chưa có cờ entitlement free boxing bag/check-in chuyên biệt; mô tả SKU không thay thế kiểm tra quyền lợi ở backend.
- Đã sửa subscription demo để hạn 30 ngày là 30 ngày tính cả ngày bắt đầu (`endDate = startDate + 29`) và `remainingSessions = groupSessionQuota + ptSessionQuota`; sửa cả 8 bản ghi vừa nạp nếu chưa có booking, không reset quota đã tiêu dùng.
- Kiểm chứng: seed chạy lặp thành công; `db:verify:seed` PASS (18 SKU active phân bố 4/4/6/4; mỗi môn 4 HLV, 2 MEMBER demo; Gym 0 lớp nhóm, ba môn còn lại 1 lớp; mỗi HLV ít nhất 5 PT slot tương lai). `npm run check` PASS 115 endpoints/13 unit tests; E2E trên schema PostgreSQL cô lập PASS 26/26 sau khi fixture bổ sung rate Boxing cho HLV đa môn.
