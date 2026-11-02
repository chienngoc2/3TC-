# FE handoff: luồng Coach và Receptionist

Tài liệu này mô tả contract backend để FE triển khai các màn hình Coach/Receptionist. API prefix là `/api/v1`; endpoint riêng tư cần gửi `Authorization: Bearer <accessToken>`. Response thành công được bọc dạng `{ "success": true, "statusCode": 200, "data": ..., "timestamp": "..." }`.

## Thay đổi backend cần FE dùng

### 1. Lễ tân tạo hội viên tại quầy

`POST /api/v1/users/members` — role `RECEPTIONIST` hoặc `CENTER_MANAGER`.

Request:

```json
{
  "email": "member@example.com",
  "password": "Member123!",
  "fullName": "Nguyen Van A",
  "phone": "0900000000"
}
```

Backend tạo user role `MEMBER` và hồ sơ hội viên ban đầu. Không gửi role khác `MEMBER`; service sẽ từ chối receptionist tạo coach/nhân viên. Response `data` là user gồm `id`, `email`, `fullName`, `phone`, `role`, `isActive`, `avatarUrl`, `createdAt`.

### 2. Coach xem lịch dạy cùng booking và điểm danh

`GET /api/v1/coaches/today-schedule` — role `COACH`.

`data` gồm hai danh sách `classes` và `pt` trong ngày hiện tại theo giờ trung tâm. Lịch lớp có `class`, `room` và `bookings`; slot PT có `bookings`. Mỗi booking kèm thông tin cơ bản hội viên (`id`, `fullName`, `phone`, `avatarUrl`, `memberProfile`) và `attendance` nếu đã điểm danh.

FE nên hiển thị trạng thái booking và tình trạng điểm danh từ dữ liệu trả về; refresh lịch sau khi điểm danh.

### 3. Coach tra cứu hội viên đang phụ trách

`GET /api/v1/coaches/members?q=<từ-khóa>` — role `COACH`; `q` tùy chọn, tìm theo tên, số điện thoại hoặc email.

Kết quả là danh sách subscription đang `ACTIVE` được gán cho coach hiện tại. Mỗi dòng gồm subscription id, môn, hạn gói, quota lớp/PT còn lại và `user` với hồ sơ cơ bản, `memberProfile` cùng tối đa 5 log InBody gần nhất. Không truyền coach/member id để đổi phạm vi; backend lấy coach từ JWT.

### 4. Lễ tân nộp đơn hủy khẩn cấp thay coach

`POST /api/v1/cancellation-requests/on-behalf` — role `RECEPTIONIST`.

Request hủy một booking PT hoặc một lớp nhóm:

```json
{
  "coachId": "<coach-uuid>",
  "targetType": "PERSONAL_TRAINING",
  "bookingId": "<booking-uuid>",
  "reasonMessage": "Coach gặp sự cố sức khỏe và không thể đến dạy buổi này.",
  "internalNote": "Đã liên hệ và xác nhận với coach."
}
```

Với lớp nhóm, gửi `targetType: "GROUP_CLASS"` và `scheduleId`, bỏ `bookingId`. Chỉ gửi đúng một trong `bookingId`/`scheduleId`. `reasonMessage` tối thiểu 20 ký tự. Coach phải trùng coach của booking/lớp; buổi đã bắt đầu hoặc target không hợp lệ sẽ bị từ chối. Request ở trạng thái chờ duyệt, không tự hủy booking. Audit ghi receptionist là người thao tác; thông báo gửi cho coach và receptionist/manager.

## Các endpoint hiện có để hoàn chỉnh màn hình

### Receptionist

| Use case | Endpoint | Ghi chú |
|---|---|---|
| Tìm hội viên | `GET /api/v1/users/members?q=...` | Tối đa 100 kết quả |
| Xem hồ sơ user | `GET /api/v1/users/:id` | Role receptionist, manager, coach |
| Xem catalog gói | `GET /api/v1/memberships/plans?disciplineId=...` | Có thể lọc thêm `packageTier` |
| Tra cứu subscription | `GET /api/v1/memberships/subscriptions?memberId=...` | Trả plan, coach, hạn và quota |
| Bán gói thường tại quầy | `POST /api/v1/billing/purchase` | Gửi `memberId`, `planId`, `paymentMethod`; tùy gói có `coachId`, `transactionRef` |
| Bán gói VIP tại quầy | `POST /api/v1/billing/subscriptions/vip` | Dùng `userId` thay `memberId`, kèm `planId`, `coachId`, `paymentMethod` |
| Gia hạn | `POST /api/v1/billing/subscriptions/:id/renew` | Gửi `paymentMethod`, có thể gửi `transactionRef` |
| Bán PT add-on | `POST /api/v1/billing/subscriptions/:id/pt-addon` | Gửi `addonSessions`, `paymentMethod`; response có invoice và quota PT mới |
| Xem hóa đơn | `GET /api/v1/billing/invoices` | Có thể lọc phía FE theo `subscription.userId` |
| Check-in hội viên/cấp khăn/tủ | `POST /api/v1/attendances/gate-checkin` | Request `userId`, optional `preferredZone`, `towelIssued`, `notes`; response có attendance, locker, thời gian |
| Trả tủ khi khách check-out | `PUT /api/v1/lockers/assignments/:id/return` | Dùng assignment đang hoạt động |
| Danh sách tủ | `GET /api/v1/lockers` | Receptionist/manager |
| Xem/ghi InBody | `GET /api/v1/inbody/my-progress?memberId=...`, `POST /api/v1/inbody/logs` | POST cần `userId`, `heightCm`, `weightKg`; các chỉ số khác tùy chọn |
| Duyệt đơn hủy khẩn cấp | `GET /api/v1/cancellation-requests`, `PUT /api/v1/cancellation-requests/:id/review` | Duyệt: `{ "action": "APPROVE" }`; từ chối: `{ "action": "REJECT", "rejectionReason": "..." }` |

### Coach

| Use case | Endpoint | Ghi chú |
|---|---|---|
| Xem khung PT của mình | `GET /api/v1/coaches/availability/mine` | Chỉ xem slot thuộc mình |
| Mở slot PT | `POST /api/v1/coaches/availability` | `{ "startTime": "ISO-8601", "endTime": "ISO-8601" }`; slot phải ở tương lai |
| Xóa slot chưa đặt | `DELETE /api/v1/coaches/availability/:id` | Slot đã đặt không xóa trực tiếp được |
| Điểm danh booking | `POST /api/v1/attendances/class-session` hoặc `POST /api/v1/attendances/class-checkin` | `{ "bookingId": "...", "status": "PRESENT", "notes": "..." }`; coach phải phụ trách buổi |
| Sửa điểm danh | `PUT /api/v1/attendances/class-checkin/:attendanceId` | Có giới hạn thời gian sửa từ backend |
| Giáo án | `GET/POST /api/v1/workout-plans`, `PUT/DELETE /api/v1/workout-plans/:id` | Coach quản lý giáo án mình tạo |
| Thư viện bài tập | `GET /api/v1/exercise-knowledge` | Tra cứu knowledge để soạn giáo án |
| Xin hủy khẩn cấp | `POST /api/v1/cancellation-requests` | Cùng payload nhưng không cần `coachId`; coach lấy từ JWT |
| Theo dõi trạng thái đơn | `GET /api/v1/cancellation-requests` | Coach chỉ nhận đơn của mình |

## Quy tắc tích hợp

- Giá trị enum dùng đúng chữ hoa backend trả về, ví dụ role `COACH`, `RECEPTIONIST`, status `PRESENT`, `ABSENT`.
- ValidationPipe bật `whitelist` và `forbidNonWhitelisted`: body có field không được DTO khai báo sẽ bị từ chối.
- Không dùng endpoint self-checkout của MEMBER cho giao dịch quầy. Quầy dùng các endpoint billing ở trên; response mua tại quầy chứa `subscription` và `invoice`.
- Gate check-in gửi lặp trong cùng lượt sẽ trả attendance/tủ đã cấp, không cấp tiện ích lần hai. Hội viên không đủ điều kiện sẽ bị từ chối.
- Endpoint điểm danh buổi tập không phải chấm công ca làm. Backend hiện chưa có API check-in/check-out ca làm cho coach/receptionist.
- Response lỗi được chuẩn hóa bởi exception filter; FE cần hiển thị message/error code do backend trả về.

