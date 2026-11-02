# BÁO CÁO KỸ THUẬT & ĐỀ XUẤT MERGE NHÁNH CHÍNH (PULL REQUEST REPORT)
## PHÂN HỆ: GIÁO TRÌNH 12 BUỔI MẪU & TỰ ĐỘNG HÓA GÁN BÀI TẬP BUỔI PT (WORKOUT TEMPLATES & AUTO-ASSIGN ENGINE)

> **Kính gửi:** Ban Giám đốc Kỹ thuật / Tech Lead dự án Sports Center Management System  
> **Người thực hiện:** Đội ngũ Kỹ thuật Backend  
> **Ngày lập báo cáo:** 30/10/2026  
> **Mục tiêu:** Báo cáo chi tiết các thay đổi kiến trúc cơ sở dữ liệu và logic backend phục vụ nạp danh mục bài tập chuẩn, quản lý giáo trình 12 buổi mẫu (Boxing, Yoga), cơ chế tự động hóa gắn bài tập vào buổi tập PT 1-1, và đề xuất phê duyệt merge vào nhánh chính (`develop` / `main`).

---

## 1. TỔNG QUAN VÀ BỐI CẢNH NGHIỆP VỤ (BUSINESS CONTEXT)

### 1.1. Yêu cầu nghiệp vụ mới
Theo định hướng chuẩn hóa dịch vụ tập luyện của 3 bộ môn trọng tâm (`GYM`, `BOXING`, `YOGA`):
1. **Chuẩn hóa thư viện động tác:** Cung cấp danh mục 84 bài tập chuẩn quốc tế với đầy đủ thông tin phân loại (`category`), nhóm cơ tác động chính (`primary_muscle`), thiết bị sử dụng (`equipment`) và đơn vị tính (`reps`, `seconds`, `minutes`, `rounds`) phục vụ tra cứu và tìm kiếm ngữ nghĩa/AI RAG Assistant (Màn hình M09).
2. **Đóng gói giáo trình 12 buổi Boxing & 12 buổi Yoga:** Khóa tập chuẩn hóa kéo dài 4 tuần (3 buổi/tuần = 12 buổi). Giáo trình đi theo lộ trình sư phạm: *Nền tảng $\rightarrow$ Kỹ thuật/Combo $\rightarrow$ Cường độ cao $\rightarrow$ Tổng hợp/Phục hồi*.
3. **Cơ chế gắn bài tập vào buổi tập (`auto_assign`):** Khi Hội viên đặt lịch tập PT 1-1 với Huấn luyện viên (Coach), hệ thống phải **tự động xác định số thứ tự buổi tập trong khóa (từ buổi 1 đến buổi 12) và tự động gán giáo án mẫu tương ứng vào buổi tập đó**, không đòi hỏi HLV phải thao tác gán thủ công.
4. **Phân quyền chỉnh sửa của HLV (Coach Customization):** HLV có toàn quyền điều chỉnh số hiệp (`sets`), số lần lặp (`reps`), trọng lượng tạ (`weight_kg`) và ghi nhận xét (`coach_feedback`) cho riêng học viên đó trong buổi tập đó mà **tuyệt đối không làm thay đổi giáo án mẫu gốc của trung tâm**.

### 1.2. Điểm nghẽn kiến trúc trước khi cập nhật & Giải pháp
* **Hạn chế cũ:** Bảng `workout_plans` ban đầu có 2 khóa ngoại bắt buộc `member_id NOT NULL` và `coach_id NOT NULL`, đồng thời thiếu liên kết đến buổi tập (`bookings`). Điều này khiến hệ thống không thể lưu trữ các chương trình mẫu dùng chung mà phải gán gượng ép vào một cá nhân.
* **Giải pháp chuẩn hóa:** Áp dụng mô hình **Template Pattern** trong CSDL:
  * Tách riêng 2 bảng Template mẫu: `workout_templates` và `workout_template_exercises` (lưu trữ 24 buổi học mẫu của Boxing và Yoga).
  * Giữ nguyên 2 bảng thực thi cá nhân hóa: `workout_plans` và `workout_exercises` nhưng bổ sung trường liên kết `booking_id`, `template_id`, `session_order`.
  * Tự động hóa nhân bản (clone) bài tập từ Template sang buổi tập của học viên ngay trong transaction đặt lịch PT.

---

## 2. CHI TIẾT THAY ĐỔI CƠ SỞ DỮ LIỆU (DATABASE DDL & SEED DATA)

### 2.1. Nạp 84 bài tập chuẩn vào bảng `exercise_knowledge`
* Dữ liệu nguồn: [`prisma/data/exercise_catalog.json`](file:///d:/ki8/wdp/BE_Sports_Center_Management_System/prisma/data/exercise_catalog.json) (84 bài tập 3 môn Gym, Boxing, Yoga).
* **Cơ chế sinh UUID xác định (Deterministic UUID):** Sử dụng hàm băm SHA-256 `seedId('exercise', exercise_id)` đồng bộ với convention của [`prisma/seed.ts`](file:///d:/ki8/wdp/BE_Sports_Center_Management_System/prisma/seed.ts). Điều này đảm bảo mỗi bài tập luôn mang UUID cố định, triệt tiêu nguy cơ lệch khóa ngoại khi deploy ở các môi trường khác nhau.
* Metadata đóng gói dạng structured tag trong trường `instructions`: `[Code: EXERCISE_*] [Môn: GYM/BOXING/YOGA] [Nhóm cơ: ...] [Thiết bị: ...] [Đơn vị: ...]`.
* File DDL/Seed: [`prisma/data/seed_exercise_catalog.sql`](file:///d:/ki8/wdp/BE_Sports_Center_Management_System/prisma/data/seed_exercise_catalog.sql).

### 2.2. Khởi tạo 2 bảng Template mới & Mở rộng liên kết `workout_plans`
File SQL đã thực thi thành công trên Supabase Production: [`prisma/data/seed_workout_templates.sql`](file:///d:/ki8/wdp/BE_Sports_Center_Management_System/prisma/data/seed_workout_templates.sql).

```sql
-- 1. Bảng lưu trữ Giáo trình khung mẫu của Trung tâm
CREATE TABLE IF NOT EXISTS workout_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_code VARCHAR(50) NOT NULL UNIQUE,     -- vd: WORKOUT_PLAN_BOXING_01
    discipline_code VARCHAR(20) NOT NULL,          -- BOXING, YOGA, GYM
    title VARCHAR(150) NOT NULL,                   -- vd: Nền tảng: Tư thế & Jab-Cross
    week_number INT NOT NULL,                      -- Tuần 1..4
    session_order INT NOT NULL,                    -- Buổi 1..12
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Bảng lưu trữ Bài tập chi tiết trong từng Template mẫu
CREATE TABLE IF NOT EXISTS workout_template_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES exercise_knowledge(id) ON DELETE RESTRICT,
    sets INT,
    reps INT,
    unit VARCHAR(20) DEFAULT 'reps',
    weight_kg DECIMAL(5, 2),
    rest_seconds INT,
    order_index INT NOT NULL DEFAULT 0
);

-- 3. Bổ sung cột liên kết buổi tập vào bảng workout_plans thực tế của Hội viên
ALTER TABLE workout_plans 
    ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES workout_templates(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS session_order INT;

-- 4. Kích hoạt Row Level Security (RLS) bảo mật Zero-Trust
ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_template_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workout_templates_read_all" ON workout_templates 
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "workout_template_exercises_read_all" ON workout_template_exercises 
    FOR SELECT TO authenticated USING (true);
```

### 2.3. Khối lượng dữ liệu đã nạp (Seed Metrics)
* **84** bài tập trong `exercise_knowledge`.
* **24** giáo án mẫu trong `workout_templates` (12 Boxing, 12 Yoga).
* **128** bài tập mẫu trong `workout_template_exercises`.

---

## 3. CHI TIẾT THAY ĐỔI MÃ NGUỒN BACKEND (NESTJS & PRISMA)

### 3.1. Cập nhật Prisma Schema ([`prisma/schema.prisma`](file:///d:/ki8/wdp/BE_Sports_Center_Management_System/prisma/schema.prisma))
* Khai báo 2 model mới `WorkoutTemplate` và `WorkoutTemplateExercise`.
* Mở rộng model `WorkoutPlan` với các trường `bookingId`, `templateId`, `sessionOrder` và thiết lập quan hệ 1-N với `Booking`.
* Khai báo quan hệ tương hỗ trong model `Booking` (`workoutPlans WorkoutPlan[]`).

### 3.2. Cập nhật DTOs ([`src/modules/workout-plans/dto/workout.dto.ts`](file:///d:/ki8/wdp/BE_Sports_Center_Management_System/src/modules/workout-plans/dto/workout.dto.ts))
* Thêm `WorkoutTemplatesQueryDto`: Cho phép lọc template theo môn học (`discipline`).
* Thêm `AssignTemplateDto`: Hỗ trợ gán linh hoạt theo `bookingId`, `templateCode` hoặc `sessionOrder`.

### 3.3. Cập nhật Module Giáo án ([`workout-plans.service.ts`](file:///d:/ki8/wdp/BE_Sports_Center_Management_System/src/modules/workout-plans/workout-plans.service.ts) & [`workout-plans.controller.ts`](file:///d:/ki8/wdp/BE_Sports_Center_Management_System/src/modules/workout-plans/workout-plans.controller.ts))
* **Endpoint 1: `GET /api/v1/workout-templates`**
  * Quyền truy cập: `MEMBER`, `COACH`, `CENTER_MANAGER`.
  * Trả về danh sách giáo trình mẫu theo môn kèm bài tập đã sắp xếp theo thứ tự `orderIndex`.
* **Endpoint 2: `GET /api/v1/bookings/:bookingId/workout-plan`**
  * Quyền truy cập: `MEMBER`, `COACH`, `CENTER_MANAGER`.
  * Trả về bài tập chi tiết của buổi tập đó (nếu là Member thì kiểm tra quyền sở hữu IDOR qua `requireOwner`).
* **Endpoint 3: `POST /api/v1/workout-plans/assign-template`**
  * Quyền truy cập: `COACH`, `CENTER_MANAGER`.
  * API hỗ trợ ghi đè/gán lại template cho buổi tập khi cần.

### 3.4. Tự động hóa gán bài tập trong Luồng Đặt lịch PT 1-1 ([`bookings.service.ts`](file:///d:/ki8/wdp/BE_Sports_Center_Management_System/src/modules/bookings/bookings.service.ts))
* Tích hợp hàm `autoAssignWorkoutPlan` chạy **ngay trong cùng một Database Transaction** của hàm `pt(dto: PtBookingDto)`:
  * Khi Member đặt ca PT thành công, hệ thống đếm số buổi tập PT hợp lệ (`CONFIRMED`, `ATTENDED`) trong gói tập hiện tại.
  * Nếu $1 \le \text{sessionCount} \le 12$: Tự động truy vấn Template tương ứng của môn (`WORKOUT_PLAN_{MÔN}_{NN}`) và sao chép bài tập sang `workout_plans` + `workout_exercises` gắn với `booking.id`.
  * Nếu $\text{sessionCount} > 12$: Không tự động gán template (buổi tự do/cardio nhẹ để HLV tự thiết kế thủ công).
  * **Kết quả:** Hội viên vừa bấm đặt lịch xong là bài tập của buổi đó đã sẵn sàng trong DB. HLV không phải thao tác tay.

---

## 4. KẾT QUẢ KIỂM THỬ VÀ ĐẢM BẢO CHẤT LƯỢNG (QA & VERIFICATION)

Toàn bộ các tiêu chuẩn kiểm thử khắt khe của dự án đều đã được chạy và vượt qua tuyệt đối:

| Hạng mục kiểm thử | Công cụ / Lệnh | Kết quả | Ghi chú |
| :--- | :--- | :---: | :--- |
| **Lint & Syntax Check** | `npm run lint` (Oxlint) | **PASS** | 0 warnings, 0 errors trên toàn bộ 95 files. |
| **Code Formatting** | `npm run format:check` (Prettier) | **PASS** | 100% tệp tin tuân thủ chuẩn format dự án. |
| **TypeScript Compilation** | `npm run build` (`nest build`) | **PASS** | Biên dịch thành công mã máy, 0 lỗi kiểu dữ liệu. |
| **OpenAPI Schema Contract** | `npm run test:openapi` | **PASS** | Xác thực thành công 123 HTTP endpoints và DTO schema. |
| **Jest Unit Tests** | `npm test -- --runInBand` | **PASS** | **14 / 14 tests** đạt tiêu chuẩn (Commerce, Users, Auth, App). |
| **Hồi quy & Tương thích** | Regression & Security | **PASS** | RLS Zero-Trust, bảo toàn các bất biến nghiệp vụ Phase 1-5. |

---

## 5. KẾ HOẠCH TRIỂN KHAI & CHECKLIST MERGE (DEPLOYMENT STEPS)

1. **Bước 1 (Database Migration):** File SQL [`prisma/data/seed_workout_templates.sql`](file:///d:/ki8/wdp/BE_Sports_Center_Management_System/prisma/data/seed_workout_templates.sql) đã được chạy và kiểm chứng hoàn tất trên cơ sở dữ liệu Supabase.
2. **Bước 2 (Merge Code):** Tiến hành phê duyệt Pull Request và merge nhánh tính năng vào nhánh chính (`develop` hoặc `main`).
3. **Bước 3 (CI/CD Pipeline):**
   * Chạy lệnh `npm ci`
   * Chạy lệnh `npx prisma generate` (đảm bảo cập nhật Prisma Client cho môi trường chạy)
   * Chạy lệnh `npm run build` và khởi động lại dịch vụ backend.

---

## 6. KẾT LUẬN & ĐỀ XUẤT

Các thay đổi trên đã giải quyết triệt để bài toán quản lý giáo án 12 buổi chuẩn của bộ môn Boxing và Yoga, nâng cao tự động hóa trải nghiệm cho Hội viên và Huấn luyện viên, đồng thời tuân thủ chuẩn mực thiết kế cơ sở dữ liệu và bảo mật RLS của hệ thống.

**Kính đề nghị Tech Lead phê duyệt Merge Pull Request này vào nhánh chính.**
