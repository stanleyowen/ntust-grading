"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Student, GradeSubmission } from "@/lib/types";
import {
  Users,
  Star,
  Plus,
  Trash2,
  Upload,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

type Tab = "students" | "grades";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("students");

  // Student management
  const [students, setStudents] = useState<Student[]>([]);
  const [newName, setNewName] = useState("");
  const [newStudentId, setNewStudentId] = useState("");
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkMode, setBulkMode] = useState(false);

  // Grade view
  const [grades, setGrades] = useState<GradeSubmission[]>([]);
  const [stageFilter, setStageFilter] = useState<"all" | "midterm" | "final">(
    "all",
  );
  const [expandedGrade, setExpandedGrade] = useState<string | null>(null);

  async function loadStudents() {
    const snap = await getDocs(collection(db, "students"));
    setStudents(
      snap.docs
        .map((d) => d.data() as Student)
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
  }

  async function loadGrades() {
    const q = query(collection(db, "grades"), orderBy("submittedAt", "desc"));
    const snap = await getDocs(q);
    setGrades(
      snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GradeSubmission),
    );
  }

  useEffect(() => {
    loadStudents();
    loadGrades();
  }, []);

  async function addStudent() {
    setAddError("");
    if (!newName.trim() || !newStudentId.trim()) {
      setAddError("請填寫姓名與學號。");
      return;
    }
    setAdding(true);
    try {
      const id = newStudentId.trim();
      const data: Student = { id, studentId: id, name: newName.trim() };
      await setDoc(doc(db, "students", id), data);
      setNewName("");
      setNewStudentId("");
      await loadStudents();
    } catch {
      setAddError("新增失敗，請再試一次。");
    } finally {
      setAdding(false);
    }
  }

  async function removeStudent(studentId: string) {
    if (!confirm(`確定要移除 ${studentId}？`)) return;
    await deleteDoc(doc(db, "students", studentId));
    await loadStudents();
  }

  async function bulkImport() {
    setAddError("");
    const lines = bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const parsed: { id: string; name: string }[] = [];
    for (const line of lines) {
      // Accept: "B1234567 John" or "B1234567,John" or "B1234567\tJohn"
      const parts = line.split(/[\s,\t]+/);
      if (parts.length < 2) {
        setAddError(`格式錯誤：「${line}」（應為：學號 姓名）`);
        return;
      }
      parsed.push({ id: parts[0], name: parts.slice(1).join(" ") });
    }

    for (const { id, name } of parsed) {
      await setDoc(doc(db, "students", id), { id, studentId: id, name });
    }
    setBulkText("");
    setBulkMode(false);
    await loadStudents();
  }

  const filteredGrades =
    stageFilter === "all"
      ? grades
      : grades.filter((g) => g.stage === stageFilter);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">管理面板</h1>
          <p className="text-slate-500 text-sm mt-1">
            管理學生名單與查看評分結果
          </p>
        </div>
        <div className="flex gap-2 bg-white border border-slate-100 rounded-xl p-1">
          {(["students", "grades"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${
                tab === t
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t === "students" ? <Users size={15} /> : <Star size={15} />}
              {t === "students" ? "學生名單" : "評分結果"}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Student Management ─── */}
      {tab === "students" && (
        <div className="space-y-6">
          {/* Add Student */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-700">新增學生</h2>
              <button
                onClick={() => setBulkMode((v) => !v)}
                className="btn-secondary !px-3 !py-1.5 text-xs"
              >
                <Upload size={13} />
                {bulkMode ? "單筆新增" : "批量匯入"}
              </button>
            </div>

            {!bulkMode ? (
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="label-base">學號</label>
                  <input
                    className="input-base"
                    placeholder="例：B1234567"
                    value={newStudentId}
                    onChange={(e) => setNewStudentId(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addStudent()}
                  />
                </div>
                <div className="flex-1">
                  <label className="label-base">姓名</label>
                  <input
                    className="input-base"
                    placeholder="學生姓名"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addStudent()}
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={addStudent}
                    disabled={adding}
                    className="btn-primary !py-3"
                  >
                    <Plus size={16} />
                    新增
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">
                  每行一位學生，格式：
                  <code className="bg-slate-100 px-1 rounded">學號 姓名</code>
                  （空格、逗號或 Tab 分隔）
                </p>
                <textarea
                  className="input-base resize-none font-mono text-xs"
                  rows={6}
                  placeholder={
                    "B1234567 張小明\nB2345678 李大華\nB3456789 王文中"
                  }
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                />
                <button onClick={bulkImport} className="btn-primary">
                  <Upload size={15} />
                  匯入
                </button>
              </div>
            )}

            {addError && (
              <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 border border-red-100">
                {addError}
              </p>
            )}
          </div>

          {/* Student List */}
          <div className="card overflow-hidden !p-0">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-700">學生名單</h2>
              <span className="text-sm text-slate-400">
                {students.length} 位
              </span>
            </div>
            {students.length === 0 ? (
              <div className="px-6 py-12 text-center text-slate-400 text-sm">
                尚無學生資料，請先新增。
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      學號
                    </th>
                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      姓名
                    </th>
                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      狀態
                    </th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {students.map((s) => (
                    <tr
                      key={s.studentId}
                      className="hover:bg-slate-50/50 transition"
                    >
                      <td className="px-6 py-4 text-sm font-mono text-slate-600">
                        {s.studentId}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-800 font-medium">
                        {s.name}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                            s.uid
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {s.uid ? "已註冊" : "未註冊"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => removeStudent(s.studentId)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ─── Grades View ─── */}
      {tab === "grades" && (
        <div className="space-y-6">
          {/* Filter */}
          <div className="card !p-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-600 font-medium">篩選：</span>
              {(["all", "midterm", "final"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setStageFilter(f)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    stageFilter === f
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {f === "all"
                    ? "全部"
                    : f === "midterm"
                      ? "期中報告"
                      : "期末報告"}
                </button>
              ))}
              <span className="ml-auto text-sm text-slate-400">
                {filteredGrades.length} 筆
              </span>
            </div>
          </div>

          {/* Grade list */}
          {filteredGrades.length === 0 ? (
            <div className="card text-center py-12 text-slate-400 text-sm">
              尚無評分資料。
            </div>
          ) : (
            <div className="space-y-3">
              {filteredGrades.map((g) => (
                <div key={g.id} className="card !p-0 overflow-hidden">
                  <button
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition text-left"
                    onClick={() =>
                      setExpandedGrade(
                        expandedGrade === g.id ? null : g.id || null,
                      )
                    }
                  >
                    <div className="flex items-center gap-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          g.stage === "midterm"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {g.stage === "midterm" ? "期中" : "期末"}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          <span className="text-slate-500">
                            {g.graderName}（{g.graderId}）
                          </span>
                          {" → "}
                          <span>
                            {g.targetName}（{g.targetId}）
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-indigo-600">
                        {g.total}
                      </span>
                      <span className="text-slate-400">/ 100</span>
                      {expandedGrade === g.id ? (
                        <ChevronUp size={16} className="text-slate-400" />
                      ) : (
                        <ChevronDown size={16} className="text-slate-400" />
                      )}
                    </div>
                  </button>

                  {expandedGrade === g.id && (
                    <div className="border-t border-slate-100 px-6 py-4 bg-slate-50/50">
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
                        {[
                          {
                            label: "主題掌握 (30)",
                            value: g.scores.topicMastery,
                            max: 30,
                          },
                          {
                            label: "內容豐富 (30)",
                            value: g.scores.contentRichness,
                            max: 30,
                          },
                          {
                            label: "敘事技巧 (20)",
                            value: g.scores.narrativeSkill,
                            max: 20,
                          },
                          {
                            label: "簡報技巧 (10)",
                            value: g.scores.presentationSkill,
                            max: 10,
                          },
                          {
                            label: "團隊表現 (10)",
                            value: g.scores.teamwork,
                            max: 10,
                          },
                        ].map((item) => (
                          <div
                            key={item.label}
                            className="bg-white rounded-xl border border-slate-100 px-3 py-2.5 text-center"
                          >
                            <p className="text-xs text-slate-500 mb-1">
                              {item.label}
                            </p>
                            <p className="text-lg font-bold text-slate-800">
                              {item.value}
                              <span className="text-xs font-normal text-slate-400">
                                /{item.max}
                              </span>
                            </p>
                          </div>
                        ))}
                      </div>

                      {g.comment && (
                        <div className="bg-white rounded-xl border border-slate-100 px-4 py-3">
                          <p className="text-xs text-slate-400 mb-1">
                            建議或訊息
                          </p>
                          <p className="text-sm text-slate-700">{g.comment}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
