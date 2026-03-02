"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { UserPlus } from "lucide-react";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const { email, password, confirm } = form;

    if (!email.trim() || !password || !confirm) {
      setError("請填寫所有必填欄位。");
      return;
    }
    if (password.length < 6) {
      setError("密碼至少需要 6 個字元。");
      return;
    }
    if (password !== confirm) {
      setError("兩次密碼輸入不一致。");
      return;
    }

    setLoading(true);
    try {
      await register(email.trim(), password);
      router.replace("/"); // root redirects to /grade or /admin based on role
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "註冊失敗，請再試一次。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="card">
        <h2 className="text-xl font-bold text-slate-800 mb-1">建立帳號</h2>
        <p className="text-sm text-slate-500 mb-6">
          學生請使用 NTUST 信箱登錄·教師請使用授權 Email
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label-base">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              className="input-base"
              type="email"
              placeholder="學號@mail.ntust.edu.tw"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              autoComplete="email"
            />
            <p className="text-xs text-slate-400 mt-1.5">
              學生請使用{" "}
              <span className="font-medium text-slate-500">
                學號@mail.ntust.edu.tw
              </span>
            </p>
          </div>

          <div>
            <label className="label-base">
              密碼 <span className="text-red-500">*</span>
            </label>
            <input
              className="input-base"
              type="password"
              placeholder="至少 6 個字元"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="label-base">
              確認密碼 <span className="text-red-500">*</span>
            </label>
            <input
              className="input-base"
              type="password"
              placeholder="再次輸入密碼"
              value={form.confirm}
              onChange={(e) => update("confirm", e.target.value)}
              autoComplete="new-password"
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
              <UserPlus size={16} />
            )}
            {loading ? "註冊中..." : "註冊"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-500">
          已有帳號？{" "}
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
