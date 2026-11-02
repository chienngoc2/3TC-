# Đặc tả kỹ thuật & Hướng dẫn tích hợp: API Hủy Yêu Cầu Hủy Lịch Của Coach

> **Tài liệu bàn giao Backend (Backend Implementation & FE Handoff Document)**  
> **Chức năng:** HLV (Coach) rút lại / hủy bỏ yêu cầu hủy lịch khẩn cấp (`cancellation_request`)  
> **Ngày cập nhật:** 02/11/2026  
> **Trạng thái:** Đã triển khai hoàn tất, kiểm thử thành công, sẵn sàng tích hợp

---

## 1. Bối cảnh nghiệp vụ (Business Context)

* Khi Huấn luyện viên (Coach) gặp sự cố khẩn cấp (sốt đột xuất, tai nạn giao thông, việc gia đình cấp bách), họ gửi yêu cầu hủy lịch qua API `POST /api/v1/coaches/cancellation-requests` (hoặc do Lễ tân gửi thay qua `POST /api/v1/cancellation-requests/on-behalf`). Đơn này ban đầu ở trạng thái **`PENDING`** (Chờ duyệt).
* **Vấn đề phát sinh thực tế:** Nếu Coach đã sắp xếp ổn thỏa công việc, sức khỏe hồi phục, hoặc trước đó bấm nhầm, Coach cần có quyền **rút lại / hủy bỏ yêu cầu hủy lịch này** trước khi Lễ tân hoặc Quản lý bấm duyệt (`APPROVED`) hay từ chối (`REJECTED`).
* **Hiệu lực sau khi rút đơn:**
  * Trạng thái yêu cầu chuyển từ `PENDING` sang **`CANCELLED`**.
  * Lịch dạy lớp nhóm (`Schedule`) hoặc lịch hẹn PT 1-1 (`Booking`) của Hội viên vẫn được bảo toàn nguyên vẹn ở trạng thái `CONFIRMED`.
  * Coach **không** bị tính vi phạm hủy lịch, **không** bị trừ hạn mức hủy khẩn cấp hàng tháng, và **không** phát sinh phạt (`CoachPenalty`).
  * Hệ thống phát tín hiệu WebSocket cập nhật tức thời giao diện của Quản lý và Lễ tân.

---

## 2. Thay đổi Cơ sở dữ liệu & Mô hình dữ liệu

### 2.1. Cập nhật Enum trong PostgreSQL (Supabase)
Đã cập nhật type `cancellation_request_status` trên PostgreSQL:
```sql
ALTER TYPE cancellation_request_status ADD VALUE IF NOT EXISTS 'CANCELLED';
```

Giá trị enum hiện tại:
* `PENDING`: Đang chờ duyệt.
* `APPROVED`: Đã duyệt hủy (hệ thống tự động hủy booking/lớp, hoàn tiền/buổi cho học viên).
* `REJECTED`: Bị từ chối duyệt.
* **`CANCELLED`** *(Mới)*: Coach hoặc Quản lý đã rút lại/hủy yêu cầu khi đang chờ duyệt.

### 2.2. Cập nhật Prisma Schema (`prisma/schema.prisma`)
```prisma
enum CancellationRequestStatus {
  PENDING
  APPROVED
  REJECTED
  CANCELLED

  @@map("cancellation_request_status")
}
```

---

## 3. Đặc tả Endpoint API

Backend hỗ trợ cả hai phong cách gọi (PUT hành động hoặc DELETE chuẩn RESTful), đồng thời cung cấp đường dẫn alias theo ngữ cảnh để Frontend thuận tiện tích hợp:

### 3.1. Thông tin Endpoint

* **Method & Paths:**
  * `PUT /api/v1/cancellation-requests/:id/cancel` *(Khuyên dùng)*
  * `DELETE /api/v1/cancellation-requests/:id` *(RESTful style)*
  * `PUT /api/v1/coaches/cancellation-requests/:id/cancel` *(Alias)*
  * `DELETE /api/v1/coaches/cancellation-requests/:id` *(Alias)*
* **Headers:**
  * `Authorization: Bearer <accessToken>`
  * `Content-Type: application/json`
* **Tham số Path:**
  * `:id` *(bắt buộc, UUID v4)*: Mã định danh của `cancellation_request` cần hủy.
* **Request Body:**
  * Không yêu cầu body (hoặc gửi `{}`).
* **Phân quyền (RBAC):**
  * `COACH`: Chỉ được phép hủy yêu cầu do **chính mình** tạo ra (`coachId === actor.userId`).
  * `CENTER_MANAGER`: Quản lý có thể hủy đơn chờ duyệt nếu phát hiện đơn rác/sai sót.

---

## 4. Mẫu Request & Response

### 4.1. Ví dụ cURL
```bash
curl -X PUT "http://localhost:3000/api/v1/cancellation-requests/3fa85f64-5717-4562-b3fc-2c963f66afa6/cancel" \
  -H "Authorization: Bearer <COACH_JWT_TOKEN>" \
  -H "Content-Type: application/json"
```

### 4.2. Response thành công (200 OK)
Phản hồi tuân thủ định dạng Response Envelope chuẩn của toàn hệ thống:
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "coachId": "8b51d45e-85b4-4b53-9118-24324f6cb774",
    "targetType": "PERSONAL_TRAINING",
    "bookingId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "scheduleId": null,
    "reasonMessage": "Coach có việc gia đình đột xuất sáng nay.",
    "internalNote": null,
    "status": "CANCELLED",
    "reviewedById": null,
    "reviewedAt": null,
    "rejectionReason": null,
    "isFrontdeskOverride": false,
    "createdAt": "2026-11-02T08:30:00.000Z"
  },
  "timestamp": "2026-11-02T10:15:30.123Z"
}
```

---

## 5. Danh sách mã lỗi & Ràng buộc bảo mật (Validation)

| Mã HTTP | Mã Exception (`code`) | Ý nghĩa & Nguyên nhân | Hướng xử lý cho Frontend |
| :--- | :--- | :--- | :--- |
| **`400 Bad Request`** | `REQUEST_NOT_PENDING` | Đơn không ở trạng thái `PENDING` (đã bị duyệt `APPROVED`, từ chối `REJECTED`, hoặc đã hủy trước đó). | Thông báo: *"Yêu cầu này đã được xử lý hoặc không thể rút lại."* và tải lại danh sách. |
| **`400 Bad Request`** | `REQUEST_ALREADY_REVIEWED` | Phát sinh khi có tranh chấp dữ liệu đồng thời (Optimistic lock failed khi đang cập nhật). | Thông báo: *"Đơn đã được Lễ tân/Quản lý duyệt ngay trước đó."* |
| **`400 Bad Request`** | `Validation failed (uuid is expected)` | Giá trị `:id` trên URL không đúng chuẩn định dạng UUID. | Kiểm tra lại biến `id` truyền vào router. |
| **`403 Forbidden`** | `FORBIDDEN_RESOURCE` | Coach đăng nhập hiện tại cố tình hủy đơn của một Coach khác. | Kiểm tra phân quyền đăng nhập; chặn hành động từ UI. |
| **`404 Not Found`** | `RECORD_NOT_FOUND` | Không tìm thấy bản ghi `cancellation_requests` với ID tương ứng trong CSDL. | Thông báo: *"Không tìm thấy yêu cầu hủy lịch này."* |

---

## 6. Audit Trail & Cơ chế Realtime WebSocket

### 6.1. Ghi nhận Audit Log
Mọi thao tác rút đơn đều được ghi lại trong bảng `audit_logs` để kiểm soát minh bạch:
* **`action`**: `'CANCEL_EMERGENCY_REQUEST'`
* **`entity_name`**: `'cancellation_requests'`
* **`entity_id`**: `:id`
* **`actor_id`**: ID của Coach hoặc Manager thực hiện rút đơn.

### 6.2. Phát sự kiện Realtime (WebSocket)
Ngay khi hủy thành công, Backend kích hoạt event qua `DomainEvents`:
* **Event Name:** `cancellation.cancelled`
* **Payload:** Toàn bộ thông tin bản ghi `cancellationRequest` với `status: 'CANCELLED'`.
* **Đối tượng nhận (Target Recipients):**
  * Chính Coach tạo đơn (`coachId`).
  * Tất cả tài khoản có role `CENTER_MANAGER` và `RECEPTIONIST`.
* **Tác dụng với FE:** Màn hình của Lễ tân và Quản lý đang mở danh sách duyệt đơn sẽ tự động đổi trạng thái đơn sang "Đã rút / Đã hủy" hoặc biến mất khỏi danh sách chờ duyệt mà **không cần người dùng phải bấm F5 / Reload trang**.

---

## 7. Hướng dẫn tích hợp cho Frontend (FE Integration Guide)

### 7.1. Logic hiển thị nút bấm trên giao diện Coach
```typescript
// Chỉ cho phép Coach bấm nút "Rút yêu cầu" / "Hủy đơn" khi đơn đang PENDING
const canCancelRequest = (request: CancellationRequest, currentUserId: string): boolean => {
  return request.coachId === currentUserId && request.status === 'PENDING';
};
```

### 7.2. Ví dụ hàm gọi API (TypeScript / Axios)
```typescript
import axios from 'axios';

export async function cancelCoachEmergencyRequest(requestId: string, token: string) {
  try {
    const response = await axios.put(
      `/api/v1/cancellation-requests/${requestId}/cancel`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data;
  } catch (error: any) {
    const errorCode = error.response?.data?.message || error.response?.data?.error;
    if (errorCode === 'REQUEST_NOT_PENDING') {
      alert('Đơn này đã được duyệt hoặc xử lý trước đó, không thể rút lại!');
    } else if (errorCode === 'FORBIDDEN_RESOURCE') {
      alert('Bạn không có quyền rút đơn của huấn luyện viên khác!');
    } else {
      alert('Có lỗi xảy ra khi rút đơn hủy lịch: ' + (error.response?.data?.message || error.message));
    }
    throw error;
  }
}
```

### 7.3. Lắng nghe WebSocket đồng bộ dữ liệu
```typescript
socket.on('cancellation.cancelled', (cancelledRequest) => {
  // Cập nhật danh sách đơn chờ duyệt trên Redux / Pinia / React Query
  queryClient.setQueryData(['cancellationRequests'], (oldData: any[]) => {
    return oldData.map((item) =>
      item.id === cancelledRequest.id ? { ...item, status: 'CANCELLED' } : item
    );
  });
});
```

---

## 8. Kết quả nghiệm thu kỹ thuật (Technical Verification)

| Hạng mục kiểm thử | Công cụ | Kết quả | Chi tiết |
| :--- | :--- | :---: | :--- |
| **Linting & Code Quality** | `oxlint` | **PASS** | 0 warnings, 0 errors trên 95 files source code. |
| **Code Formatting** | `prettier` | **PASS** | Tuân thủ 100% chuẩn style dự án. |
| **TypeScript Compilation** | `nest build` | **PASS** | Biên dịch toàn bộ ứng dụng thành công, 0 lỗi cú pháp/kiểu dữ liệu. |
| **OpenAPI Contract** | `verify-openapi` | **PASS** | Đã biên dịch & ánh xạ thành công **127 HTTP endpoints**. |
| **Unit Testing** | `jest` | **PASS** | 14/14 unit test suites pass (100%). |
