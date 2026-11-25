import React from "react";
import { AlertCircle, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { errorText } from "@/lib/api";

export interface StateMessageProps {
  loading?: boolean;
  error?: unknown;
  empty?: boolean;
  emptyText?: string;
  onRetry?: () => void;
}

export const StateMessage: React.FC<StateMessageProps> = ({
  loading,
  error,
  empty,
  emptyText = "Chưa có dữ liệu cho mục này.",
  onRetry,
}) => {
  if (loading) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-md bg-slate-50 border border-slate-200/80 text-xs font-medium text-slate-600 my-4 animate-pulse">
        <Loader2 className="h-4 w-4 animate-spin text-[#17664e]" />
        <span>Đang tải dữ liệu...</span>
      </div>
    );
  }

  if (error) {
    const message = errorText(error);
    return (
      <div
        role="alert"
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-md bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800 my-4"
      >
        <div className="flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
          <span>{message}</span>
        </div>
        {onRetry && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="rounded-md border-rose-300 text-rose-800 hover:bg-rose-100 shrink-0 self-start sm:self-auto cursor-pointer"
          >
            Thử lại
          </Button>
        )}
      </div>
    );
  }

  if (empty) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-md bg-amber-50/60 border border-amber-200/70 text-xs font-medium text-amber-800 my-4">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
        <span>{emptyText}</span>
      </div>
    );
  }

  return null;
};
