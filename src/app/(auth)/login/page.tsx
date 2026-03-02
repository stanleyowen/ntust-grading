"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { LogIn } from "lucide-react";

export default function LoginPage() {
  const { login, isAdmin } = useAuth();
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!studentId.trim() || !password) {
      setError("請填寫所有欄位。");
      return;
    }
    setLoading(true);
    try {
      await login(studentId.trim(), password);
      router.replace(isAdmin ? "/admin" : "/grade");
    } catch {
      setError("學號或密碼錯誤，請再試一次。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="card">
        <h2 className="text-xl font-bold text-slate-800 mb-1">登入</h2>
        <p className="text-sm text-slate-500 mb-6">
          學生輸入學號，教師輸入 Email
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label-base">學號 / Email</label>
            <input
              className="input-base"
              type="text"
              placeholder="例：B1234567 或 Email"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              autoComplete="username"
            />
            <p className="text-xs text-slate-400 mt-1.5">
              學生可直接輸入學號，系統會自動帶入 @mail.ntust.edu.tw
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="label-base">密碼</label>
              <Link
                href="/forgot-password"
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                忘記密碼？
              </Link>
            </div>
            <input
              className="input-base"
              type="password"
              placeholder="輸入密碼"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-2"
          >
            {loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <LogIn size={16} />
            )}
            {loading ? "登入中..." : "登入"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-500">
          還沒有帳號？{" "}
          <Link
            href="/register"
            className="font-semibold text-indigo-600 hover:text-indigo-700"
          >
            立即註冊
          </Link>
        </p>
      </div>
    </div>
  );
}
