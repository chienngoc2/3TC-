import axios from "axios";
import { validationText } from "@/lib/validation-message";

export const memberError = (error: unknown, fallback: string): string => {
  if (!axios.isAxiosError(error)) return fallback;
  if (!error.response) return "Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.";
  const data = error.response.data as { errorCode?: string; message?: string | string[] } | undefined;
  const messages: Record<string, string> = {
    INBODY_EDIT_WINDOW_EXPIRED: "Phiếu đo đã quá 24 giờ, không thể chỉnh sửa.",
    CANNOT_CHANGE_INBODY_OWNER: "Không thể chuyển phiếu đo sang hội viên khác.",
    INVALID_METRIC_VALUE: "Chỉ số InBody không hợp lệ. Vui lòng kiểm tra lại phiếu đo.",
    INBODY_LOG_NOT_FOUND: "Không tìm thấy phiếu đo InBody.",
    RESOURCE_NOT_FOUND: "Không tìm thấy bản ghi cần thao tác.",
    MEMBER_NOT_ASSIGNED_TO_COACH: "Huấn luyện viên chỉ được xem hội viên đang được phân công.",
    INVALID_USER_ROLE_OR_INACTIVE: "Hội viên không tồn tại hoặc đã ngừng hoạt động.",
    FORBIDDEN_RESOURCE: "Tài khoản không có quyền thao tác với hội viên này.",
    USER_NOT_FOUND: "Không tìm thấy hội viên. Vui lòng tìm lại.",
    SUBSCRIPTION_NOT_FREEZABLE: "Chỉ có thể đóng băng gói đang hoạt động và còn hạn.",
    SUBSCRIPTION_NOT_FROZEN: "Chỉ có thể kích hoạt lại gói đang đóng băng.",
    LOCKER_ALREADY_RETURNED: "Tủ đồ này đã được giải phóng trước đó.",
  };
  if (data?.errorCode && messages[data.errorCode]) return messages[data.errorCode];
  if (error.response.status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (error.response.status === 403) return "Tài khoản không có quyền thực hiện thao tác này.";
  if (Array.isArray(data?.message)) return validationText(data.message) ?? fallback;
  if (data?.message && !/^[A-Z][A-Z0-9_]+$/.test(data.message)) return validationText(data.message) ?? fallback;
  return fallback;
};
