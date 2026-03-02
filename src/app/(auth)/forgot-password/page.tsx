"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { KeyRound, ArrowLeft, CheckCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!input.trim()) {
      setError("請輸入學號或 Email。");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(input.trim());
      setSent(true);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "auth/user-not-found") {
        setError("找不到此帳號，請確認學號或 Email 是否正確。");
      } else {
        setError("發送失敗，請稍後再試。");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="card">
        <h2 className="text-xl font-bold text-slate-800 mb-1">重設密碼</h2>
        <p className="text-sm text-slate-500 mb-6">
          輸入學號或 Email，我們將寄送重設連結至您的信箱
        </p>

        {sent ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <CheckCircle size={48} className="text-green-500" />
            <p className="text-slate-700 font-medium">重設信件已寄出！</p>
            <p className="text-sm text-slate-500">
              請至您的信箱查看密碼重設連結，若沒看到請檢查垃圾郵件。
            </p>
            <Link
              href="/login"
              className="mt-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
            >
              返回登入
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label-base">學號 / Email</label>
              <input
                className="input-base"
                type="text"
                placeholder="例：B1234567 或 Email"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                autoComplete="email"
              />
              <p className="text-xs text-slate-400 mt-1.5">
                學生可直接輸入學號，系統會自動帶入 @mail.ntust.edu.tw
              </p>
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
                <KeyRound size={16} />
              )}
              {loading ? "寄送中..." : "寄送重設連結"}
            </button>
          </form>
        )}

        {!sent && (
          <p className="mt-5 text-center text-sm text-slate-500">
            <Link
              href="/login"
              className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-700"
            >
              <ArrowLeft size={14} />
              返回登入
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
