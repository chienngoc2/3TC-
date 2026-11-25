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
│   ├── infrastructure/                # Redis (Lock/Cache), Scheduler dự kiến, Socket.io, Storage
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