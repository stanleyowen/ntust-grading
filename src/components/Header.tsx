"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { LogOut, BookOpen } from "lucide-react";

export default function Header() {
  const { student, logout, isAdmin } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-slate-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm shadow-indigo-200">
            <BookOpen size={15} strokeWidth={2.5} className="text-white" />
          </div>
          <div>
            <span className="font-bold text-slate-800 text-sm">
              NTUST 同儕互評
            </span>
            {isAdmin && (
              <span className="ml-2 rounded-full bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5">
                教師
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {student && (
            <span className="text-sm text-slate-500 hidden sm:block">
              {student.name} <span className="text-slate-300 mx-1">·</span>{" "}
              {student.studentId}
            </span>
          )}
          <button onClick={handleLogout} className="btn-secondary !px-3 !py-2">
            <LogOut size={15} />
            <span className="hidden sm:inline">登出</span>
          </button>
        </div>
      </div>
    </header>
  );
}
