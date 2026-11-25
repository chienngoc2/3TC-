import React from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft } from "lucide-react";

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-[#f8fafc] text-slate-800">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50 text-center space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 shadow-sm">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">404 - Không tìm thấy trang</h1>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            Đường dẫn bạn yêu cầu không tồn tại hoặc đã được di chuyển.
          </p>
        </div>
        <div className="pt-2">
          <Link to="/plans">
            <Button variant="mint" className="w-full">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Quay lại Trang chủ / Gói tập
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
