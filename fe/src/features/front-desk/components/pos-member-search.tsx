import React, { type FormEvent, useEffect, useRef, useState } from "react";
import axios from "axios";
import { Check, Search, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { searchMembers } from "../services/gate-checkin.service";
import type { SearchMember } from "../types/gate-checkin.types";

interface Props {
  selected: SearchMember | null;
  onSelect: (member: SearchMember | null) => void;
  disabled: boolean;
  placeholder?: string;
  inputMode?: "tel" | "text";
  minimumLength?: number;
  resultsClassName?: string;
  showEmail?: boolean;
  searchFn?: (query: string) => Promise<SearchMember[]>;
}

export const PosMemberSearch: React.FC<Props> = ({
  selected, onSelect, disabled, placeholder = "Số điện thoại hội viên",
  inputMode = "tel", minimumLength = 4, resultsClassName = "max-h-48", showEmail = false, searchFn,
}) => {
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<SearchMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);

  useEffect(() => () => { sequence.current += 1; }, []);
  useEffect(() => {
    if (selected) {
      setMembers((current) => {
        if (!current.some((member) => member.id === selected.id)) {
          return [selected, ...current];
        }
        return current.map((member) => member.id === selected.id ? selected : member);
      });
      if (!query) {
        setQuery(selected.fullName || selected.phone || "");
      }
    }
  }, [selected]);

  const clear = () => {
    sequence.current += 1;
    setQuery("");
    setMembers([]);
    setLoading(false);
    setSearched(false);
    setError(null);
    onSelect(null);
  };

  const search = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const q = query.trim();
    if (minimumLength > 0 && q.length < minimumLength) {
      setError(`Nhập ít nhất ${minimumLength} ký tự để tìm hội viên.`);
      return;
    }
    const current = ++sequence.current;
    setLoading(true);
    setSearched(false);
    setError(null);
    setMembers([]);
    onSelect(null);
    try {
      const found = searchFn ? await searchFn(q) : await searchMembers(q);
      if (current !== sequence.current) return;
      setMembers(found);
      setSearched(true);
    } catch (cause) {
      if (current !== sequence.current) return;
      if (axios.isAxiosError(cause)) {
        const data = cause.response?.data as { message?: string | string[] } | undefined;
        const message = data?.message;
        setError(!cause.response ? "Không kết nối được máy chủ. Vui lòng thử lại."
          : cause.response.status === 403 ? "Tài khoản không có quyền tìm hội viên."
          : Array.isArray(message) ? message.join(" ")
          : message && !/^[A-Z][A-Z0-9_]+$/.test(message) ? message
          : "Không thể tìm hội viên. Vui lòng thử lại.");
      } else setError("Không thể tìm hội viên. Vui lòng thử lại.");
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  };

  return (
    <section aria-labelledby="pos-member-heading" className="border-b border-[#dce8e2] pb-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id="pos-member-heading" className="text-base font-semibold">Hội viên</h2>
        {selected && <span className="flex items-center gap-1 text-xs font-semibold text-[#17664e]"><Check className="h-4 w-4" />Đã chọn</span>}
      </div>
      <form onSubmit={(event) => void search(event)} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <label htmlFor="pos-member-query" className="sr-only">{placeholder}</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#789188]" />
          <input id="pos-member-query" type={inputMode === "tel" ? "tel" : "text"} inputMode={inputMode} autoComplete="off" value={query} disabled={disabled}
            onChange={(event) => { sequence.current += 1; setQuery(event.target.value); setMembers([]); setSearched(false); setLoading(false); setError(null); onSelect(null); }}
            placeholder={placeholder} className="h-10 w-full rounded-md border border-[#ceded5] bg-white pl-10 pr-9 text-sm outline-none focus:border-[#17664e] focus:ring-2 focus:ring-[#17664e]/15 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden [&::-webkit-search-results-button]:hidden [&::-webkit-search-results-decoration]:hidden" />
          {query && <button type="button" onClick={clear} disabled={disabled} title="Xóa tìm kiếm" aria-label="Xóa tìm kiếm" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[#667b73] hover:bg-[#edf5f0]"><X className="h-4 w-4" /></button>}
        </div>
        <Button type="submit" variant="mint" disabled={disabled || loading} className="h-10 shrink-0">{loading ? "Đang tìm..." : "Tìm hội viên"}</Button>
      </form>
      {error && <p role="alert" className="mt-3 text-sm text-[#b53a2c]">{error}</p>}
      {loading && <div className="mt-4 h-16 animate-pulse rounded-md bg-[#edf5f0]" aria-label="Đang tải hội viên" />}
      {searched && !members.length && <p className="mt-4 text-sm text-[#667b73]">Không tìm thấy hội viên phù hợp.</p>}
      {members.length > 0 && <div className={`mt-4 divide-y divide-[#e7efea] overflow-y-auto border-y border-[#dce8e2] ${resultsClassName}`}>
        {members.map((member) => <button type="button" key={member.id} disabled={!member.isActive || disabled} onClick={() => onSelect(member)}
          className={`flex w-full items-center gap-3 px-2 py-2.5 text-left disabled:opacity-50 ${selected?.id === member.id ? "bg-[#e6f5ed]" : "hover:bg-[#f7faf8]"}`}>
          {member.avatarUrl ? <img src={member.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" /> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e8f1eb] text-[#17664e]"><UserRound className="h-4 w-4" /></span>}
          <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{member.fullName}</strong><span className="block text-xs text-[#667b73]">{member.phone || "Chưa có SĐT"}</span>{showEmail && <span className="block truncate text-xs text-[#667b73]">{member.email}</span>}</span>
          {!member.isActive ? <span className="text-xs text-[#b53a2c]">Ngừng hoạt động</span> : selected?.id === member.id ? <Check className="h-4 w-4 text-[#17664e]" /> : null}
        </button>)}
      </div>}
    </section>
  );
};
