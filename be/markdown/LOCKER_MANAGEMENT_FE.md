# Hướng Dẫn Tích Hợp Quản Lý Tủ Đồ (Locker Management) - FE

Tài liệu này cung cấp chi tiết các cập nhật Backend về **Quản lý Tủ đồ (Smart Lockers)**, bao gồm hiển thị thông tin Hội viên đang mượn tủ và tính năng cho phép Nhân viên Lễ tân (Receptionist) / Quản lý (Center Manager) trực tiếp giải phóng / trả tủ hộ học viên.

---

## 1. Tóm Tắt Các Điểm Cải Tiến

| Vấn đề trước đây | Cải tiến mới từ Backend |
| :--- | :--- |
| `GET /api/v1/lockers` chỉ trả về thông tin tủ thuần túy, Lễ tân thấy tủ đỏ (`OCCUPIED`) nhưng mù tịt không biết ai đang dùng. | `GET /api/v1/lockers` trả về thêm object `currentAssignment` chứa chi tiết Hội viên (`fullName`, `phone`, `email`, `avatarUrl`, `assignedAt`). |
| Chỉ có Hội viên tự trả tủ qua mobile/web (`PUT /lockers/assignments/:id/return` yêu cầu `assignmentId`). Lễ tân không có `assignmentId` nên không checkout được. | Bổ sung endpoint **`PUT /api/v1/lockers/:id/release`** cho phép Staff bấm Trả tủ trực tiếp bằng `lockerId` mà không cần biết `assignmentId`. |
| Lễ tân không có quyền đổi trạng thái bảo trì khi khóa hỏng. | Mở rộng quyền `PUT /api/v1/lockers/:id/status` cho cả `RECEPTIONIST` và `CENTER_MANAGER`. |

---

## 2. Chi Tiết API Contracts

### 2.1. Lấy danh sách tủ đồ (Đã làm giàu dữ liệu)
* **Endpoint**: `GET /api/v1/lockers`
* **Query Params (Optional)**:
  * `zone`: lọc theo khu vực (ví dụ: `MALE_LOCKER`, `FEMALE_LOCKER`, `VIP_AREA`).
  * `status`: lọc theo trạng thái (`AVAILABLE`, `OCCUPIED`, `MAINTENANCE`).
* **Roles**: `RECEPTIONIST`, `CENTER_MANAGER`.

#### Response Data Structure (JSON)
```json
[
  {
    "id": "e6a0d2f8-08b5-4b0d-b223-fa4c034a79c1",
    "lockerNumber": "NAM-01",
    "zone": "MALE_LOCKER",
    "status": "OCCUPIED",
    "isActive": true,
    "currentAssignment": {
      "id": "52f9b2cf-4b71-41ee-a843-e18e3845b4ee",
      "userId": "93693e50-2f95-46f3-936d-d12f3bcbc869",
      "assignedAt": "2026-11-19T08:30:00.000Z",
      "notes": null,
      "user": {
        "id": "93693e50-2f95-46f3-936d-d12f3bcbc869",
        "fullName": "Nguyễn Văn An",
        "phone": "0987654321",
        "email": "an.nguyen@example.com",
        "avatarUrl": "https://..."
      }
    }
  },
  {
    "id": "2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e",
    "lockerNumber": "NAM-02",
    "zone": "MALE_LOCKER",
    "status": "AVAILABLE",
    "isActive": true,
    "currentAssignment": null
  }
]
```

> [!NOTE]
> Các trường dữ liệu cũ (`id`, `lockerNumber`, `zone`, `status`, `isActive`) được bảo toàn 100%, hoàn toàn không gây breaking change cho các component hiện tại đang render `lockerNumber` và `status`.

---

### 2.2. Nhân viên Trả tủ / Checkout hộ Hội viên (Mới)
* **Endpoint**: `PUT /api/v1/lockers/:id/release`
* **Param**:
  * `:id`: UUID của tủ đồ (`locker.id`).
* **Roles**: `RECEPTIONIST`, `CENTER_MANAGER`.
* **Body**: Rỗng (không cần body).

#### Response thành công (200 OK)
```json
{
  "id": "e6a0d2f8-08b5-4b0d-b223-fa4c034a79c1",
  "lockerNumber": "NAM-01",
  "status": "AVAILABLE",
  "releasedAssignmentId": "52f9b2cf-4b71-41ee-a843-e18e3845b4ee",
  "returnedAt": "2026-11-19T10:15:30.123Z"
}
```

#### Mã lỗi có thể xảy ra:
* `404 Not Found`: `LOCKER_NOT_FOUND` - ID tủ không tồn tại.
* `400 Bad Request`: `LOCKER_NOT_OCCUPIED` - Tủ này hiện không có ai mượn (đang `AVAILABLE`).
* `403 Forbidden`: Tài khoản đăng nhập không có role `RECEPTIONIST` hoặc `CENTER_MANAGER`.

---

### 2.3. Cập nhật trạng thái bảo trì
* **Endpoint**: `PUT /api/v1/lockers/:id/status`
* **Param**: `:id` (UUID của tủ).
* **Roles**: `RECEPTIONIST`, `CENTER_MANAGER`.
* **Body**:
  ```json
  {
    "status": "MAINTENANCE" // hoặc "AVAILABLE"
  }
  ```

---

## 3. Khuyến Nghị Cập Nhật TypeScript Types Phía FE

FE có thể mở rộng interface `Locker` trong `types.ts` như sau:

```typescript
export interface LockerUserSummary {
  id: string;
  fullName: string;
  phone: string | null;
  email: string;
  avatarUrl: string | null;
}

export interface CurrentLockerAssignment {
  id: string;
  userId: string;
  assignedAt: string;
  notes?: string | null;
  user: LockerUserSummary;
}

export interface Locker {
  id: string;
  lockerNumber: string;
  zone: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';
  isActive: boolean;
  currentAssignment?: CurrentLockerAssignment | null; // <-- Trường mới
}
```

---

## 4. Gợi Ý Triển Khai UI Trên Frontend

### 4.1. Màn hình Lễ tân (`features/front-desk` & Sơ đồ tủ)
1. **Hiển thị thông tin hội viên khi tủ đang sử dụng**:
   * Khi render ô tủ có màu đỏ (`status === 'OCCUPIED'`), kiểm tra `locker.currentAssignment`.
   * Hiển thị Tooltip/Popover hoặc hiển thị phụ bên dưới số tủ:
     * **Tên hội viên**: `locker.currentAssignment?.user.fullName`
     * **SĐT**: `locker.currentAssignment?.user.phone ?? "Chưa có SĐT"`
     * **Thời gian mượn**: Tính thời gian đã dùng từ `assignedAt`.
2. **Nút Thao Tác Nhanh "Thu tủ" / "Trả tủ"**:
   * Thêm button `[Trả tủ]` trên Card hoặc Action menu của từng tủ.
   * Khi Lễ tân click:
     ```typescript
     const handleReleaseLocker = async (lockerId: string) => {
       if (window.confirm("Xác nhận thu hồi và trả tủ này?")) {
         await put(`/lockers/${lockerId}/release`, {});
         // Invalidate queries để load lại danh sách tủ
         queryClient.invalidateQueries({ queryKey: ["lockers"] });
       }
     };
     ```

### 4.2. Màn hình Quản lý Cơ sở vật chất (`features/manager/pages/facilities-page.tsx`)
Tại bảng danh sách tủ ([facilities-page.tsx](file:///D:/FPT/FA26/WDP301/app/web/src/features/manager/pages/facilities-page.tsx#L285)):
* Hiện tại đang hiển thị tĩnh: `<span className="text-xs text-slate-400">Đang có hội viên dùng</span>`.
* **Cải tiến đề xuất**:
  * Hiển thị Badge: `Nguyễn Văn A · 0987654321`
  * Bổ sung nút hành động `[Trả tủ hộ]` gọi endpoint `PUT /api/v1/lockers/${locker.id}/release`.
