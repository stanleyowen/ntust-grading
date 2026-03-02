"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth();
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
      await sendPasswordReset(input.trim());
      setSent(true);
    } catch {
      setError("找不到此帳號，請確認學號或 Email 是否正確。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="card">
        <h2 className="text-xl font-bold text-slate-800 mb-1">忘記密碼</h2>
        <p className="text-sm text-slate-500 mb-6">
          輸入學號或 Email，系統將寄送重設密碼連結
        </p>

        {sent ? (
          <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-4 text-sm text-green-700 text-center space-y-1">
            <p className="font-semibold">已發送重設密碼信件！</p>
            <p>請檢查您的 Email 信箱並點擊連結以重設密碼。</p>
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
                <Mail size={16} />
              )}
              {loading ? "傳送中..." : "發送重設連結"}
            </button>
          </form>
        )}

        <p className="mt-5 text-center text-sm text-slate-500">
          <Link
            href="/login"
            className="font-semibold text-indigo-600 hover:text-indigo-700"
          >
            返回登入
          </Link>
        </p>
      </div>
    </div>
  );
}
