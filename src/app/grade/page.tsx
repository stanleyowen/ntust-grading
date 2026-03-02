"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  collection,
  query,
  getDocs,
  getDoc,
  addDoc,
  serverTimestamp,
  where,
  doc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Student, GradeSubmission, GradingSettings } from "@/lib/types";
import { CheckCircle, ChevronDown, Lock } from "lucide-react";

const STAGES = [
  { value: "midterm", label: "期中報告" },
  { value: "final", label: "期末報告" },
];

const SCORE_FIELDS = [
  {
    key: "topicMastery",
    label: "主題掌握",
    weight: "30%",
    description: "題目意旨與答題內容切題度",
    max: 30,
  },
  {
    key: "contentRichness",
    label: "內容豐富",
    weight: "30%",
    description: "簡報內容清楚、詳細",
    max: 30,
  },
  {
    key: "narrativeSkill",
    label: "敘事技巧",
    weight: "20%",
    description: "表達流暢、組織結構、段落、圖文清楚易讀",
    max: 20,
  },
  {
    key: "presentationSkill",
    label: "簡報技巧、互動問答",
    weight: "10%",
    description: "",
    max: 10,
  },
  {
    key: "teamwork",
    label: "團隊表現、組員協調",
    weight: "10%",
    description: "",
    max: 10,
  },
] as const;

type ScoreKey = (typeof SCORE_FIELDS)[number]["key"];

const defaultScores: Record<ScoreKey, string> = {
  topicMastery: "",
  contentRichness: "",
  narrativeSkill: "",
  presentationSkill: "",
  teamwork: "",
};

export default function GradePage() {
  const { student } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [stage, setStage] = useState<"midterm" | "final">("midterm");
  const [targetId, setTargetId] = useState("");
  const [scores, setScores] = useState<Record<ScoreKey, string>>(defaultScores);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [alreadyGraded, setAlreadyGraded] = useState(false);
  const [settings, setSettings] = useState<GradingSettings | null>(null);

  const stageLocked =
    settings === null ||
    (stage === "midterm" ? !settings.midtermOpen : !settings.finalOpen);

  // Load grading settings (real-time)
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "grading"), (snap) => {
      if (snap.exists()) {
        setSettings(snap.data() as GradingSettings);
      } else {
        setSettings({ midtermOpen: false, finalOpen: false });
      }
    });
    return unsub;
  }, []);

  // Load student list (exclude self)
  useEffect(() => {
    async function load() {
      const snap = await getDocs(collection(db, "students"));
      const list: Student[] = snap.docs
        .map((d) => d.data() as Student)
        .filter((s) => s.studentId !== student?.studentId);
      setStudents(list.sort((a, b) => a.studentId.localeCompare(b.studentId)));
    }
    load();
  }, [student]);

  // Check if already graded this target for this stage
  useEffect(() => {
    async function check() {
      if (!targetId || !student) return;
      const q = query(
        collection(db, "grades"),
        where("graderId", "==", student.studentId),
        where("targetId", "==", targetId),
        where("stage", "==", stage),
      );
      const snap = await getDocs(q);
      setAlreadyGraded(!snap.empty);
    }
    check();
  }, [targetId, stage, student]);

  function setScore(key: ScoreKey, value: string) {
    setScores((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): string {
    for (const field of SCORE_FIELDS) {
      const raw = scores[field.key];
      if (raw === "" || raw === undefined)
        return `請填寫「${field.label}」分數。`;
      const num = Number(raw);
      if (isNaN(num) || num < 0 || num > field.max) {
        return `「${field.label}」分數必須在 0 ~ ${field.max} 之間。`;
      }
    }
    if (!targetId) return "請選擇評分對象。";
    return "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!student) return;

    // Double-check stage is still open (client-side guard before Firestore write)
    const freshSnap = await getDoc(doc(db, "settings", "grading"));
    if (freshSnap.exists()) {
      const s = freshSnap.data() as GradingSettings;
      const open = stage === "midterm" ? s.midtermOpen : s.finalOpen;
      if (!open) {
        setError("此評分階段已關閉，無法提交。");
        setSubmitting(false);
        return;
      }
    }

    const target = students.find((s) => s.studentId === targetId)!;
    const numScores = Object.fromEntries(
      SCORE_FIELDS.map((f) => [f.key, Number(scores[f.key])]),
    ) as Record<ScoreKey, number>;
    const total = Object.values(numScores).reduce((a, b) => a + b, 0);

    const submission: Omit<GradeSubmission, "id"> = {
      stage,
      graderId: student.studentId,
      graderName: student.name,
      targetId,
      targetName: target.name,
      scores: numScores,
      total,
      comment: comment.trim(),
      submittedAt: new Date(),
    };

    setSubmitting(true);
    try {
      await addDoc(collection(db, "grades"), {
        ...submission,
        submittedAt: serverTimestamp(),
      });
      setSubmitted(true);
    } catch {
      setError("提交失敗，請再試一次。");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setStage("midterm");
    setTargetId("");
    setScores(defaultScores);
    setComment("");
    setSubmitted(false);
    setAlreadyGraded(false);
    setError("");
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
          <CheckCircle size={32} className="text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">提交成功！</h2>
        <p className="text-slate-500">您的評分已成功記錄</p>
        <button onClick={resetForm} className="btn-primary mt-2">
          繼續評分其他同學
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">同儕互評</h1>
        <p className="text-slate-500 mt-1 text-sm">
          請誠實客觀地為您的同學評分
        </p>
      </div>

      {stageLocked && settings !== null && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100">
            <Lock size={18} className="text-slate-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">
              {stage === "midterm" ? "期中報告" : "期末報告"}評分已關閉
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              請等待老師開放此評分階段後再提交。
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Stage selection */}
        <div className="card">
          <h2 className="font-semibold text-slate-700 mb-4 text-sm uppercase tracking-wider">
            評分階段
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {STAGES.map((s) => {
              const isOpen =
                settings &&
                (s.value === "midterm"
                  ? settings.midtermOpen
                  : settings.finalOpen);
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStage(s.value as "midterm" | "final")}
                  className={`relative rounded-xl border-2 px-4 py-3 text-sm font-semibold transition ${
                    stage === s.value
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-slate-100 bg-white text-slate-600 hover:border-slate-200"
                  }`}
                >
                  <span className="flex items-center justify-center gap-1.5">
                    {!isOpen && <Lock size={13} className="opacity-50" />}
                    {s.label}
                  </span>
                  {!isOpen && (
                    <span className="absolute top-1.5 right-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                      已關閉
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Target selection */}
        <div className="card">
          <h2 className="font-semibold text-slate-700 mb-4 text-sm uppercase tracking-wider">
            評分對象
          </h2>
          <div className="relative">
            <select
              className="input-base appearance-none pr-10"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
            >
              <option value="">請選擇您正在為哪一位報告者評分</option>
              {students.map((s) => (
                <option key={s.studentId} value={s.studentId}>
                  {s.name}（{s.studentId}）
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
          </div>

          {alreadyGraded && targetId && (
            <div className="mt-3 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-700">
              您已為此同學評分過（{stage === "midterm" ? "期中" : "期末"}
              ），再次提交將新增一筆記錄。
            </div>
          )}
        </div>

        {/* Scores */}
        <div className="card">
          <h2 className="font-semibold text-slate-700 mb-1 text-sm uppercase tracking-wider">
            評分項目
          </h2>
          <p className="text-xs text-slate-400 mb-5">
            請根據以下項目為評分對象打分數
          </p>

          <div className="space-y-5">
            {SCORE_FIELDS.map((field) => (
              <div key={field.key}>
                <div className="flex items-start justify-between mb-1.5">
                  <div>
                    <label className="text-sm font-semibold text-slate-700">
                      {field.label}
                      <span className="ml-1.5 text-xs font-normal text-indigo-500 bg-indigo-50 rounded-full px-2 py-0.5">
                        {field.weight}
                      </span>
                    </label>
                    {field.description && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        {field.description}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 mt-1 shrink-0 ml-4">
                    0 – {field.max}
                  </span>
                </div>
                <input
                  type="number"
                  min={0}
                  max={field.max}
                  step={1}
                  className="input-base"
                  placeholder={`輸入 0 – ${field.max}`}
                  value={scores[field.key]}
                  onChange={(e) => setScore(field.key, e.target.value)}
                />
              </div>
            ))}
          </div>

          {/* Score preview */}
          {SCORE_FIELDS.every((f) => scores[f.key] !== "") && (
            <div className="mt-5 rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-medium text-indigo-700">總分</span>
              <span className="text-2xl font-bold text-indigo-700">
                {SCORE_FIELDS.reduce(
                  (sum, f) => sum + (Number(scores[f.key]) || 0),
                  0,
                )}
                <span className="text-base font-normal text-indigo-400">
                  {" "}
                  / 100
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Comment */}
        <div className="card">
          <h2 className="font-semibold text-slate-700 mb-1 text-sm uppercase tracking-wider">
            建議或訊息
          </h2>
          <p className="text-xs text-slate-400 mb-3">
            （選填）給對方的建議或鼓勵話語
          </p>
          <textarea
            className="input-base resize-none"
            rows={4}
            placeholder="輸入您的建議或訊息..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !targetId || stageLocked}
          className="btn-primary w-full"
        >
          {submitting ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : null}
          {submitting ? "提交中..." : "提交評分"}
        </button>
      </form>
    </div>
  );
}
