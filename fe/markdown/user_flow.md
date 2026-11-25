# Triển khai luồng MEMBER trên Web Portal

Tài liệu này dành cho repo `app/web` (tên thư mục frontend hiện tại). Nguồn màn hình: [`MEMBER_SCREEN_LIST.md`](../../erd/active/screen%20lists/MEMBER_SCREEN_LIST.md); nguồn nghiệp vụ: [`business_rule_final.md`](../../erd/active/business%20rules/business_rule_final.md). Chỉ dựng luồng MEMBER trước. Cấu trúc backend, URL `/`, `/portal`, `/console` và quyền API được giữ nguyên. Web đã có implementation trong `src/`; các đoạn code dưới đây giữ vai trò **template tham chiếu** cho quyết định routing và cache. Kiểm tra mã nguồn thật khi bảo trì.

## 1. Routing template

Các package `react-router`, `@tanstack/react-query` và `socket.io-client` đã được cài và kiểm tra tương thích với React 19. [React Router Data Mode](https://reactrouter.com/start/data/installation) hiện dùng `createBrowserRouter` từ `react-router` và `RouterProvider` từ `react-router/dom`. Tạo page components theo `MEM-01` đến `MEM-14`; dùng modal/drawer cho thao tác thay vì tạo URL cho từng nút. Ví dụ route config TypeScript/React Router:

```tsx
// src/routes/member-routes.tsx — template; import Page/Layout từ feature thật khi triển khai
import { createBrowserRouter, Navigate, Outlet, useLocation, useSearchParams } from 'react-router';
import type { ReactNode } from 'react';
import { LoginPage, RegisterPage } from '../features/auth/pages';
import { PublicPlansPage, MockPaymentPage } from '../features/public/pages';
import { MemberLayout } from '../features/member/layout';
import {
  PlansPage, VipQuotationPage, CheckoutPage, TransactionsPage,
  SubscriptionsPage, InvoicesPage, CalendarPage, HistoryPage,
  ProfilePage, ProgressPage, WorkoutPlansPage, AttendancesPage, LockersPage,
} from '../features/member/pages';
import { useSession } from '../features/auth/use-session';

function MemberGuard({ children }: { children: ReactNode }) {
  const { state, user } = useSession(); // state: 'loading' | 'anonymous' | 'authenticated' | 'unavailable'
  const location = useLocation();
  if (state === 'loading') return <p>Đang kiểm tra phiên đăng nhập…</p>;
  if (state === 'unavailable') return <p>Không thể kiểm tra phiên. Thử lại sau.</p>;
  if (state === 'anonymous') return <Navigate to="/auth/login" replace state={{ from: location.pathname + location.search }} />;
  if (user?.role !== 'MEMBER') return <Navigate to="/forbidden" replace />;
  return <>{children}</>;
}

// Dùng lịch ngày tại Việt Nam; cộng tuần bằng UTC date-only để không lệch vì timezone trình duyệt.
export function mondayInVietnam(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const day = new Date(`${value.year}-${value.month}-${value.day}T00:00:00Z`);
  const offset = (day.getUTCDay() + 6) % 7;
  day.setUTCDate(day.getUTCDate() - offset);
  return day.toISOString().slice(0, 10);
}

export function shiftWeek(week: string, deltaWeeks: number): string {
  const day = new Date(`${week}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + deltaWeeks * 7);
  return day.toISOString().slice(0, 10);
}

function CalendarRoute() {
  const [params] = useSearchParams();
  const week = params.get('week');
  const validMonday = week && /^\d{4}-\d{2}-\d{2}$/.test(week) &&
    !Number.isNaN(new Date(`${week}T00:00:00Z`).getTime()) &&
    new Date(`${week}T00:00:00Z`).toISOString().slice(0, 10) === week &&
    new Date(`${week}T00:00:00Z`).getUTCDay() === 1;
  if (!validMonday) return <Navigate to={`/portal/member/bookings?week=${mondayInVietnam()}`} replace />;
  return <CalendarPage week={week} />; // giữ disciplineId/view từ search params trong CalendarPage
}

export const router = createBrowserRouter([
  { path: '/', element: <Outlet />, children: [
    { index: true, element: <Navigate to="/plans" replace /> },
    { path: 'plans', element: <PublicPlansPage /> },
    { path: 'auth/login', element: <LoginPage /> },
    { path: 'auth/register', element: <RegisterPage /> },
    { path: 'mock-payment', element: <MockPaymentPage /> }, // chỉ hiển thị trong môi trường demo
    { path: 'portal/member', element: <MemberGuard><MemberLayout /></MemberGuard>, children: [
      { index: true, element: <Navigate to={`/portal/member/bookings?week=${mondayInVietnam()}`} replace /> },
      { path: 'plans', element: <PlansPage /> },
      { path: 'quotations', element: <VipQuotationPage /> },
      { path: 'checkouts/:checkoutId', element: <CheckoutPage /> },
      { path: 'transactions', element: <TransactionsPage /> },
      { path: 'subscriptions', element: <SubscriptionsPage /> },
      { path: 'invoices', element: <InvoicesPage /> },
      { path: 'bookings', element: <CalendarRoute /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'progress', element: <ProgressPage /> },
      { path: 'workout-plans', element: <WorkoutPlansPage /> },
      { path: 'attendances', element: <AttendancesPage /> },
      { path: 'lockers', element: <LockersPage /> },
    ] },
    // `/portal/manager`, `/portal/desk`, `/portal/coach`, `/console` thuộc backlog UI;
    // không render các màn hình giả và không cấp quyền chỉ bằng guard ở FE.
    { path: 'forbidden', element: <p>Không có quyền truy cập.</p> },
  ] },
]);
```

Template cần `useSession()` xác minh token bằng backend trước khi định tuyến; `unavailable` (503/mạng lỗi) không được coi là đăng xuất. `returnTo` sau login chỉ chấp nhận đường dẫn nội bộ hợp lệ, và role sau login do server trả. Nếu cần public landing thay `/plans`, thay element ở route `/`, giữ nguyên ba zone. Các alias `/portal/member/schedules` và `/portal/member/pt-slots` nếu hỗ trợ bookmark cũ phải redirect replace sang `bookings` với `view=group|pt`, giữ `week` hợp lệ.

Gắn router vào entry point sau khi tạo QueryClient; router được tạo một lần ngoài cây React:

```tsx
// src/main.tsx — phần tích hợp mẫu
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from './routes/member-routes';

const queryClient = new QueryClient();
ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>
);
```

## 2. API, cache và thanh toán

Client dùng prefix `/api/v1`, unwrap response envelope theo backend. Không gửi `memberId`, `amount`, `paymentMethod`, `transactionRef` từ MEMBER. Query key luôn gắn user và ID cụ thể; xóa toàn bộ cache khi logout/đổi tài khoản. Ví dụ tổ chức key:

```ts
export const memberKeys = {
  catalog: (disciplineId?: string, tier?: string) => ['catalog', disciplineId ?? 'all', tier ?? 'all'] as const,
  checkout: (userId: string, checkoutId: string) => ['member', userId, 'checkout', checkoutId] as const,
  transactions: (userId: string) => ['member', userId, 'transactions'] as const,
  subscriptions: (userId: string) => ['member', userId, 'subscriptions'] as const,
  invoices: (userId: string) => ['member', userId, 'invoices'] as const,
  calendar: (userId: string, week: string, disciplineId?: string, view = 'all') =>
    ['member', userId, 'calendar', week, disciplineId ?? 'all', view] as const,
  history: (userId: string) => ['member', userId, 'history'] as const,
};
```

Sau `POST /billing/checkouts`, hiển thị `amount` và `priceSnapshot` **do order trả về**, cho xác nhận nếu khác VIP preview; `Idempotency-Key` ổn định cho cùng thao tác. Trial 0đ có thể `FULFILLED` ngay. Đơn có tiền hiện trả `paymentId`/`paymentUrl=/mock-payment`, không có PSP thật; Mock Payment là trang public dev/demo, QR tĩnh chứa chỉ URL trang, người dùng nhập `paymentId`. Browser không gọi webhook. `POST /billing/checkouts/:id/retry` cần key mới cho lần retry và chỉ dùng khi API cho phép.

`checkout.updated` ở Socket.IO `/realtime` chỉ báo **có thay đổi**. Dù payload có `status`, luôn GET lại checkout trước khi thông báo “đã kích hoạt”. Ví dụ handler:

```ts
// Gọi trong effect của CheckoutPage; cleanup bằng socket.off khi unmount.
async function onCheckoutUpdated(event: { checkoutId: string }, currentId: string, userId: string) {
  if (event.checkoutId !== currentId) return;
  await queryClient.invalidateQueries({ queryKey: memberKeys.checkout(userId, currentId) });
  const order = await queryClient.query({
    queryKey: memberKeys.checkout(userId, currentId),
    queryFn: () => api.getCheckout(currentId),
  });
  await queryClient.invalidateQueries({ queryKey: memberKeys.transactions(userId) });
  if (order.status === 'FULFILLED') {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: memberKeys.subscriptions(userId) }),
      queryClient.invalidateQueries({ queryKey: memberKeys.invoices(userId) }),
      queryClient.invalidateQueries({ queryKey: ['member', userId, 'calendar'] }),
    ]);
  }
}
```

Đoạn trên là **logic mẫu trong phạm vi component/hook**, cần khai báo `queryClient`, `api` theo implementation thật và xử lý lỗi GET. API `query` và `invalidateQueries` đối chiếu với [QueryClient hiện hành](https://tanstack.com/query/latest/docs/framework/react/reference/classes/QueryClient). Không dựa duy nhất vào Socket.IO: poll `GET /billing/checkouts/:id` khi chờ thanh toán, refetch khi focus/reconnect/redirect và ngừng polling ở trạng thái terminal. `PAYMENT_REVIEW`/refund không được coi là `FULFILLED`. Sau đặt/hủy cũng invalidate calendar tuần đang mở, subscriptions và history; không tự cộng/trừ quota trong cache.

Subscription list, invoice, calendar `subscriptions[]` và `days[].eligibility[]` phải hiển thị/quản lý theo `subscriptionId`; không gộp quota của các môn/gói. POST booking hiện **không nhận `subscriptionId`**: backend tự chọn gói cùng môn đủ điều kiện hết hạn sớm nhất (PT còn khớp Coach). UI chọn môn/Coach/slot; sau POST đọc `booking.subscriptionId` và refetch số dư thực tế. Nếu product quyết định cho MEMBER chỉ định gói khi có hai gói cùng môn, đó là thay đổi backend/contract riêng, chưa nằm trong flow này.

## 3. Thứ tự triển khai frontend

1. Tạo router, public/member layout, guard 4 trạng thái, API client + token refresh, error envelope; chưa dựng role khác. Xác minh deep link, refresh trang, logout/xóa cache và 403.
2. Tạo MEM-01 đăng ký/đăng nhập, MEM-02 catalog theo môn và tier. Seed đã nạp ma trận 4 môn. Chỉ render SKU trả từ API và báo trạng thái thiếu dữ liệu nếu môi trường triển khai chưa seed.
3. Tạo MEM-03 quote VIP read-only và lựa chọn Coach; Trial/Drop-in/Plus dùng giá catalog. Tạo MEM-04 checkout và MEM-05 lịch sử giao dịch; tích hợp `/mock-payment` chỉ cho demo, trạng thái bằng GET/polling trước Socket.IO.
4. Tạo MEM-06 subscriptions/quota và MEM-07 invoices; mỗi card/hàng có `subscriptionId`, môn, hạn, Coach, quota nhóm/PT tách biệt. Renew/add-on tạo checkout riêng và xác nhận giá order.
5. Tạo MEM-08 lịch tuần hợp nhất: URL Monday Việt Nam, Back/Next ±7 ngày, lọc môn/view, eligibility theo gói, đặt/hủy nhóm/PT. Dùng một GET aggregate tuần, không ghép ba GET cap. Xử lý lớp đầy, quota hết, PT cùng môn/ngày, hai môn trùng giờ, hủy đúng/muộn và race.
6. Tạo MEM-09 đến MEM-14 cho history, profile, InBody, workout, attendance, locker. History hiện cap 200 booking/attendance, workout 100, invoices 200; không tuyên bố đã hỗ trợ phân trang vô hạn hoặc reschedule nguyên tử.
7. Tích hợp Socket.IO như tín hiệu invalidate, polling/focus fallback. Sau webhook GET checkout; nếu `FULFILLED`, refetch subscriptions, invoices, calendar và transactions. Kiểm tra mất Socket.IO, đổi tab, replay webhook, thất bại/retry, nhiều subscription/môn, hai gói cùng môn, logout/đổi user và các ngày ngoài hạn gói.

Các role ADMIN, CENTER_MANAGER, RECEPTIONIST, COACH và các luồng MEMBER feedback/AI/inbox, PSP thật, Cron/FCM thuộc backlog triển khai sau. Không sửa backend để phục vụ riêng việc chia route frontend này.
