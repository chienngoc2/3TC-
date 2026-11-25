import React, { type ReactNode } from "react";

export interface PageTitleProps {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}

export const PageTitle: React.FC<PageTitleProps> = ({
  eyebrow,
  title,
  children,
}) => {
  const isMemberScreenLabel = /^MEM-\d+\b/i.test(eyebrow?.trim() ?? "");

  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
      <div>
        {eyebrow && !isMemberScreenLabel && (
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-[#17664e] mb-1">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 leading-tight">
          {title}
        </h1>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2.5">{children}</div>}
    </div>
  );
};
