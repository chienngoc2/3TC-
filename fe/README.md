# Sports Center Management System - Web Portal

> Cổng thông tin và bảng điều khiển quản trị web dành cho Quản lý Trung tâm (Center Manager) và Nhân viên Lễ tân (Receptionist), cung cấp giao diện trực quan cho quản lý lớp học, phân quyền, thanh toán và check-in thời gian thực.

[![React](https://img.shields.io/badge/React-v18.x-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-v5.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-v5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v3.x-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-latest-000000?logo=shadcnui&logoColor=white)](https://ui.shadcn.com/)
[![TanStack Query](https://img.shields.io/badge/TanStack_Query-v5.x-FF4154?logo=reactquery&logoColor=white)](https://tanstack.com/query)
[![TanStack Table](https://img.shields.io/badge/TanStack_Table-v8.x-FF4154)](https://tanstack.com/table)
[![Zustand](https://img.shields.io/badge/Zustand-v4.x-443E38)](https://zustand-demo.pmnd.rs/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 1. Quick Start

### Yêu cầu tiên quyết
* **Node.js**: `v20.x LTS` hoặc mới hơn
* **Package Manager**: `npm` hoặc `pnpm`
* **Backend API**: Đang hoạt động cục bộ hoặc có URL endpoint staging sẵn sàng

### Các bước cài đặt

1. **Clone repository:**
   ```bash
   git clone https://github.com/your-org/sports-center-web.git
   cd sports-center-web
   ```

2. **Cài đặt dependencies:**
   ```bash
   npm install
   ```

3. **Cấu hình biến môi trường:**
   Tạo file `.env.local` từ `.env.example`:
   ```bash
   cp .env.example .env.local
   ```
   Cập nhật các giá trị cấu hình kết nối:
   ```env
   VITE_API_BASE_URL=https://be-sports-center-management-system.onrender.com
   VITE_PUBLIC_WEB_URL=
   VITE_ENABLE_MOCK_PAYMENT=false
   ```

   `VITE_API_BASE_URL` là domain backend, không thêm `/docs` hoặc `/api/v1`.
   Dev gọi `/api/v1` và Socket.IO qua Vite proxy đến backend trong env. Muốn chạy
   backend local thì đổi giá trị trong `.env.local` thành `http://localhost:3000`.
   HTTP và Socket.IO dùng chung domain backend; không cần `VITE_SOCKET_SERVER_URL`.
   Khởi động lại Vite sau khi thay đổi env.

4. **Khởi chạy môi trường phát triển (Dev Server):**
   ```bash
   npm run dev
   ```
   * Ứng dụng sẽ khả dụng tại: `http://localhost:5173`

5. **Build kiểm tra mã nguồn cho Production:**
   ```bash
   npm run build
   npm run preview
   ```

### Deploy frontend

* Build command: `npm ci && npm run build`. Thư mục publish/output: `dist`.
* `.env.production` chứa domain Render mặc định công khai và tắt mock payment.
  Trên hosting, đặt `VITE_API_BASE_URL` nếu cần ghi đè domain backend.
* Các biến `VITE_*` được đưa vào JavaScript khi build: không chứa mật khẩu,
  secret hoặc thông tin Basic Auth của Swagger. Thay env phải build/deploy lại.
* Production và `npm run preview` gọi backend trực tiếp. Backend phải cho phép
  origin FE qua CORS, gồm domain deploy và `http://localhost:4173` nếu dùng preview.
  Cấu hình CORS cho Socket.IO cũng cần cho phép origin FE. Vite proxy chỉ phục vụ dev.
* Hosting cần rewrite các URL giao diện như `/auth/login` và `/portal/member`
  về `/index.html` để refresh hoặc mở link trực tiếp không bị 404.
* `VITE_PUBLIC_WEB_URL` chỉ dùng cho link QR demo; để trống sẽ dùng domain FE
  đang mở. Giữ `VITE_ENABLE_MOCK_PAYMENT=false` trên production.

---

## 2. Structure Tree & Architecture

Dự án áp dụng kết hợp **Atomic Design (cho tầng Base UI)** và **Feature-Sliced Design (cho tầng Logic Nghiệp vụ)** nhằm đảm bảo khả năng tái sử dụng thành phần giao diện nhưng vẫn cô lập logic của từng màn hình quản trị.

```text
frontend-web/
├── public/                            # Tài nguyên tĩnh, favicon, logos
├── src/
│   ├── assets/                        # Ảnh tĩnh, icon nội bộ, vector graphics
│   ├── components/                    # [ATOMIC DESIGN] Các thành phần UI dùng chung
│   │   ├── common/                    # [Organisms] Bảng biểu, cards dữ liệu tái sử dụng
│   │   │   ├── confirm-dialog.tsx
│   │   │   ├── data-table/            # Data table bọc TanStack Table (sort, filter, page)
│   │   │   ├── search-input.tsx
│   │   │   └── stat-card.tsx          # Card hiển thị chỉ số doanh thu / học viên
│   │   ├── feedback/                  # Component trạng thái (Skeleton, EmptyState, ErrorBoundary)
│   │   └── ui/                        # [Atoms / Molecules] Thư viện shadcn/ui nguyên bản
│   │       ├── button.tsx
│   │       ├── dialog.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── input.tsx
│   │       ├── select.tsx
│   │       └── table.tsx
│   ├── features/                      # [FEATURE-SLICED] Nghiệp vụ chia theo domain
│   │   ├── analytics/                 # Thống kê, biểu đồ Recharts doanh thu/tỷ lệ lấp đầy
│   │   ├── auth/                      # Form đăng nhập, xử lý refresh session
│   │   ├── billing/                   # Quản lý hóa đơn, in phiếu thu tiền mặt/chuyển khoản
│   │   ├── classes-schedule/          # Bảng lịch tuần, quản lý phòng tập, điều phối HLV
│   │   ├── members/                   # Danh sách hội viên, modal hồ sơ, gia hạn gói
│   │   └── reception-checkin/         # Màn hình điểm danh nhanh tại quầy lễ tân
│   ├── layouts/                       # Khung màn hình theo vai trò (Templates)
│   │   ├── auth-layout.tsx            # Layout trang đăng nhập
│   │   ├── dashboard-layout.tsx       # Sidebar, Header điều hướng cho Manager
│   │   └── reception-layout.tsx       # Layout tối ưu màn hình cảm ứng / thao tác nhanh cho Lễ tân
│   ├── routes/                        # Cấu hình React Router v6
│   │   ├── index.tsx                  # Khai báo tuyến đường
│   │   ├── protected-route.tsx        # Bọc kiểm tra đăng nhập
│   │   └── role-guard.tsx             # Chặn truy cập trái quyền theo vai trò (RBAC)
│   ├── services/                      # Cấu hình Axios Client, Interceptors, Socket Client
│   ├── stores/                        # Zustand Store (authStore, uiStore, sidebarStore)
│   ├── types/                         # TypeScript definitions & API response models
│   ├── App.tsx
│   └── main.tsx                       # React root entry, TanStack Query Client Provider
├── index.html
├── tailwind.config.js                 # Cấu hình màu sắc, layout, plugin Tailwind
├── tsconfig.json
└── vite.config.ts                     # Cấu hình alias (@/), proxy dev server
```

---

## 3. Coding Conventions

### 3.1. Git Branching & Quy trình đóng góp
* `main`: Nhánh production.
* `dev`: Nhánh staging tích hợp trước khi release.
* `feature/web-<tên-tính-năng>`: Phát triển UI/tính năng mới (vd: `feature/web-attendance-table`, `feature/web-class-scheduler`).
* `fix/web-<vấn-đề>`: Khắc phục lỗi giao diện/luồng dữ liệu (vd: `fix/web-token-refresh-loop`).

### 3.2. Commit Guidelines (Conventional Commits)
* `feat(scope)`: Thêm màn hình hoặc component mới (vd: `feat(schedule): add drag-and-drop class assignment grid`)
* `fix(scope)`: Sửa lỗi hiển thị hoặc xử lý state (vd: `fix(members): correct table pagination offset calculation`)
* `style(scope)`: Tinh chỉnh Tailwind CSS, responsive spacing không ảnh hưởng logic
* `refactor(scope)`: Gom nhóm hoặc tái cấu trúc custom hook (vd: `refactor(auth): simplify role check hook`)

### 3.3. React & TypeScript Standards
* **Component Architecture**: Sử dụng Functional Components hoàn toàn kèm typed props interface rõ ràng:
  ```tsx
  interface MemberTableProps {
    data: MemberItem[];
    isLoading: boolean;
    onRowClick: (id: string) => void;
  }
  export const MemberTable: React.FC<MemberTableProps> = ({ ... }) => { ... };
  ```
* **State Management**:
  * Dữ liệu từ Server (Server State): Bắt buộc quản lý qua **TanStack Query** (`useQuery`, `useMutation`). Tuyệt đối không dùng `useEffect` + `useState` để fetch và lưu trữ dữ liệu API thủ công.
  * Trạng thái giao diện cục bộ (UI State): Dùng `useState` hoặc **Zustand** cho trạng thái toàn cục nhẹ (Sidebar collapsed, Active modal).
* **Styling**: Sử dụng các tiện ích utility-first của TailwindCSS; gom class có điều kiện bằng hàm tiện ích `cn()` (`clsx` + `tailwind-merge`).

---

## 4. License

Dự án được phân phối dưới giấy phép mã nguồn mở [MIT License](LICENSE).  
Bản quyền thuộc về © 2026 Sports Center Management System Team.
