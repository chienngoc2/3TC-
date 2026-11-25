import { Navigate, createBrowserRouter } from "react-router";
import { PublicLayout, MemberLayout, CoachLayout, ReceptionistLayout, ManagerLayout, ConsoleLayout } from "@/layouts";
import { LoginPage, NotFoundPage } from "@/features/auth";
import { PublicPlansPage, LandingPage } from "@/features/public";
import { PlansPage, QuotePage } from "@/features/plans";
import { CoachesPage } from "@/features/coaches";
import { CheckoutPage, TransactionsPage } from "@/features/checkout";
import { SubscriptionsPage, InvoicesPage } from "@/features/subscriptions";
import {
  HistoryPage,
  ProfilePage,
  ProgressPage,
  WorkoutPlansPage,
  AttendancesPage,
  LockersPage,
} from "@/features/member";
import {
  FrontDeskPage,
  GateCheckinPage,
  InbodyPage,
  MembersPage,
  PosPage,
} from "@/features/front-desk";
import {
  CoachSchedulePage,
  CoachAvailabilityPage,
  CoachMembersPage,
  CoachWorkoutPlansPage,
  CoachRequestsPage,
  CoachProfilePage,
} from "@/features/coach-portal";
import {
  ManagerDashboardPage,
  ManagerStaffPage,
  ManagerStaffShiftsPage,
  ManagerCoachesPage,
  ManagerPenaltiesPage,
  ManagerPlansPage,
  ManagerClassesPage,
  ManagerFacilitiesPage,
  ManagerMembersPage,
  ManagerReportsPage,
  ManagerExercisesPage,
  ManagerPosPage,
  ManagerBookingsPage,
  ManagerAttendancesPage,
} from "@/features/manager";
import {
  ConsoleManagersPage,
  ConsoleAuditLogsPage,
  ConsoleMetricsPage,
} from "@/features/console";
import { mondayInVietnam } from "@/lib/date";
import {
  MemberGuard,
  CalendarRoute,
  CalendarAlias,
  StaffGuard,
  PortalErrorFallback,
} from "./route-elements";

export const router = createBrowserRouter([
  // 1. LANDING PAGE (Full-width, dedicated sticky header & footer)
  {
    path: "/",
    element: <LandingPage />,
  },
  {
    path: "/landing",
    element: <LandingPage />,
  },

  // 2. AUTHENTICATION (Standalone full-screen, no navbar header, fixed viewport)
  { path: "login", element: <LoginPage /> },
  { path: "register", element: <LoginPage /> },
  { path: "auth/login", element: <LoginPage /> },
  { path: "auth/register", element: <LoginPage /> },

  // 3. PUBLIC APP ROUTES (wrapped in PublicLayout with public header)
  {
    element: <PublicLayout />,
    children: [
      { path: "plans", element: <PublicPlansPage /> },
      { path: "coaches", element: <CoachesPage /> },
      {
        path: "forbidden",
        element: (
          <div className="p-8 max-w-xl mx-auto text-center space-y-3 bg-rose-50 rounded-2xl border border-rose-200 shadow-sm mt-8 text-rose-800">
            <h2 className="text-xl font-bold">403 - Không có quyền truy cập</h2>
            <p className="text-xs">Tài khoản hiện tại không có quyền truy cập vào phân hệ này.</p>
          </div>
        ),
      },
    ],
  },

  // 4. MEMBER PORTAL (Dedicated full-screen workspace with fixed sidebar)
  {
    path: "/portal/member",
    element: (
      <MemberGuard>
        <MemberLayout />
      </MemberGuard>
    ),
    children: [
      {
        index: true,
        element: <Navigate to={`/portal/member/bookings?week=${mondayInVietnam()}`} replace />,
      },
      { path: "plans", element: <PlansPage /> },
      { path: "coaches", element: <CoachesPage isMemberView /> },
      { path: "quotations", element: <QuotePage /> },
      { path: "checkouts/:checkoutId", element: <CheckoutPage /> },
      { path: "checkout/:checkoutId", element: <CheckoutPage /> },
      { path: "transactions", element: <TransactionsPage /> },
      { path: "subscriptions", element: <SubscriptionsPage /> },
      { path: "invoices", element: <InvoicesPage /> },
      { path: "bookings", element: <CalendarRoute /> },
      { path: "schedules", element: <CalendarAlias view="group" /> },
      { path: "pt-slots", element: <CalendarAlias view="pt" /> },
      { path: "history", element: <HistoryPage /> },
      { path: "profile", element: <ProfilePage /> },
      { path: "progress", element: <ProgressPage /> },
      { path: "workout-plans", element: <WorkoutPlansPage /> },
      { path: "attendances", element: <AttendancesPage /> },
      { path: "lockers", element: <LockersPage /> },
    ],
  },

  // 5. COACH PORTAL (/portal/coach and /coach)
  {
    path: "/portal/coach",
    element: <StaffGuard roles={["COACH"]} />,
    errorElement: <PortalErrorFallback />,
    children: [
      {
        element: <CoachLayout />,
        children: [
          { index: true, element: <Navigate to="/portal/coach/schedule" replace /> },
          { path: "schedule", element: <CoachSchedulePage /> },
          { path: "availability", element: <CoachAvailabilityPage /> },
          { path: "members", element: <CoachMembersPage /> },
          { path: "inbody", element: <InbodyPage /> },
          { path: "workout-plans", element: <CoachWorkoutPlansPage /> },
          { path: "pickup", element: <CoachRequestsPage defaultTab="PICKUP" /> },
          { path: "requests", element: <CoachRequestsPage /> },
          { path: "profile", element: <CoachProfilePage /> },
        ],
      },
    ],
  },
  {
    path: "/coach",
    element: <StaffGuard roles={["COACH"]} />,
    errorElement: <PortalErrorFallback />,
    children: [
      {
        element: <CoachLayout />,
        children: [
          { index: true, element: <Navigate to="/coach/schedule" replace /> },
          { path: "schedule", element: <CoachSchedulePage /> },
          { path: "availability", element: <CoachAvailabilityPage /> },
          { path: "members", element: <CoachMembersPage /> },
          { path: "inbody", element: <InbodyPage /> },
          { path: "workout-plans", element: <CoachWorkoutPlansPage /> },
          { path: "pickup", element: <CoachRequestsPage defaultTab="PICKUP" /> },
          { path: "requests", element: <CoachRequestsPage /> },
          { path: "profile", element: <CoachProfilePage /> },
        ],
      },
    ],
  },

  // 6. FRONT DESK / RECEPTIONIST PORTAL
  {
    path: "/portal/desk",
    element: <ReceptionistLayout />,
    children: [
      {
        element: <StaffGuard roles={["RECEPTIONIST", "CENTER_MANAGER"]} />,
        children: [
          { index: true, element: <FrontDeskPage /> },
          { path: "gate-checkin", element: <GateCheckinPage /> },
          { path: "pos", element: <PosPage key="sale" /> },
          { path: "subscriptions", element: <PosPage key="subscriptions" initialMode="RENEW" /> },
          { path: "members", element: <MembersPage /> },
          { path: "members/:memberId", element: <MembersPage /> },
        ],
      },
      {
        element: <StaffGuard roles={["RECEPTIONIST", "COACH"]} />,
        children: [{ path: "inbody", element: <InbodyPage /> }],
      },
    ],
  },
  { path: "/desk", element: <Navigate to="/portal/desk" replace /> },

  // 4. CENTER MANAGER PORTAL
  {
    path: "/portal/manager",
    element: <StaffGuard roles={["CENTER_MANAGER"]} />,
    errorElement: <PortalErrorFallback />,
    children: [
      {
        element: <ManagerLayout />,
        children: [
          { index: true, element: <Navigate to="/portal/manager/dashboard" replace /> },
          { path: "dashboard", element: <ManagerDashboardPage /> },
          { path: "staff", element: <ManagerStaffPage /> },
          { path: "staff-shifts", element: <ManagerStaffShiftsPage /> },
          { path: "coaches", element: <Navigate to="/portal/manager/payouts" replace /> },
          { path: "payouts", element: <ManagerCoachesPage /> },
          { path: "penalties", element: <ManagerPenaltiesPage /> },
          { path: "plans", element: <ManagerPlansPage /> },
          { path: "classes", element: <ManagerClassesPage /> },
          { path: "facilities", element: <ManagerFacilitiesPage /> },
          { path: "members", element: <ManagerMembersPage /> },
          { path: "reports", element: <ManagerReportsPage /> },
          { path: "exercises", element: <ManagerExercisesPage /> },
          { path: "pos", element: <ManagerPosPage /> },
          { path: "bookings", element: <ManagerBookingsPage /> },
          { path: "attendances", element: <ManagerAttendancesPage /> },
        ],
      },
    ],
  },

  // 5. ADMIN CONSOLE (/console)
  {
    path: "/console",
    element: <StaffGuard roles={["ADMIN"]} />,
    errorElement: <PortalErrorFallback />,
    children: [
      {
        element: <ConsoleLayout />,
        children: [
          { index: true, element: <Navigate to="/console/managers" replace /> },
          { path: "managers", element: <ConsoleManagersPage /> },
          { path: "audit-logs", element: <ConsoleAuditLogsPage /> },
          { path: "metrics", element: <ConsoleMetricsPage /> },
        ],
      },
    ],
  },
  { path: "/portal/console", element: <Navigate to="/console" replace /> },

  // 6. 404 Catch-all
  { path: "404", element: <NotFoundPage /> },
  { path: "*", element: <NotFoundPage /> },
]);

export default router;
