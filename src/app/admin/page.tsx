"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  getDoc,
  addDoc,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Class, Student, GradeSubmission, GradingSettings } from "@/lib/types";
import {
  Users,
  Star,
  Plus,
  Trash2,
  Upload,
  ChevronDown,
  ChevronUp,
  Settings,
  Lock,
  Unlock,
  Download,
  Edit3,
  Check,
  X,
  Layers,
} from "lucide-react";

type Tab = "classes" | "students" | "grades" | "settings";

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

  // Settings
  const [gradingSettings, setGradingSettings] = useState<GradingSettings>({
    midtermOpen: false,
    finalOpen: false,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Grade summary / adjustments
  const [gradesView, setGradesView] = useState<"list" | "summary">("list");
  const [adjustments, setAdjustments] = useState<Record<string, number>>({});
  const [editingAdjustment, setEditingAdjustment] = useState<string | null>(
    null,
  );
  const [adjustmentInput, setAdjustmentInput] = useState("");

  // Class management
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [newClassName, setNewClassName] = useState("");
  const [newClassDesc, setNewClassDesc] = useState("");
  const [classError, setClassError] = useState("");
  const [addingClass, setAddingClass] = useState(false);

  async function loadClasses() {
    const snap = await getDocs(collection(db, "classes"));
    setClasses(
      snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Class)
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
  }

  async function addClass() {
    setClassError("");
    if (!newClassName.trim()) {
      setClassError("請填寫班級名稱。");
      return;
    }
    setAddingClass(true);
    try {
      const ref = await addDoc(collection(db, "classes"), {
        name: newClassName.trim(),
        description: newClassDesc.trim() || null,
      });
      await setDoc(ref, {
        id: ref.id,
        name: newClassName.trim(),
        description: newClassDesc.trim() || null,
      });
      setNewClassName("");
      setNewClassDesc("");
      await loadClasses();
    } catch {
      setClassError("新增失敗，請再試一次。");
    } finally {
      setAddingClass(false);
    }
  }

  async function deleteClass(classId: string, className: string) {
    if (!confirm(`確定要刪除班級「${className}」？學生資料不會被刪除。`)) return;
    await deleteDoc(doc(db, "classes", classId));
    if (selectedClassId === classId) setSelectedClassId("");
    await loadClasses();
  }

  async function loadStudents() {
    const snap = selectedClassId
      ? await getDocs(
          query(
            collection(db, "students"),
            where("classId", "==", selectedClassId),
          ),
        )
      : await getDocs(collection(db, "students"));
    setStudents(
      snap.docs
        .map((d) => d.data() as Student)
        .sort((a, b) => a.studentId.localeCompare(b.studentId)),
    );
  }

  async function loadGrades() {
    const q = selectedClassId
      ? // Filter by class without orderBy to avoid needing a composite index;
        // sort client-side instead.
        query(
          collection(db, "grades"),
          where("classId", "==", selectedClassId),
        )
      : query(collection(db, "grades"), orderBy("submittedAt", "desc"));
    const snap = await getDocs(q);
    const docs = snap.docs.map(
      (d) => ({ id: d.id, ...d.data() }) as GradeSubmission,
    );
    if (selectedClassId) {
      docs.sort(
        (a, b) =>
          (b.submittedAt as unknown as { seconds: number }).seconds -
          (a.submittedAt as unknown as { seconds: number }).seconds,
      );
    }
    setGrades(docs);
  }

  async function loadAdjustments() {
    try {
      const snap = await getDocs(collection(db, "adjustments"));
      const map: Record<string, number> = {};
      snap.docs.forEach((d) => {
        map[d.id] = (d.data().adjustedScore as number) ?? 0;
      });
      setAdjustments(map);
    } catch {
      // Firestore rule for /adjustments not yet deployed — silently skip
    }
  }

  async function saveAdjustment(
    key: string,
    targetId: string,
    targetName: string,
    stage: string,
  ) {
    const raw = parseFloat(adjustmentInput);
    if (isNaN(raw) || raw < 0) return;
    const clamped = Number(Math.min(100, Math.max(0, raw)).toFixed(2));
    await setDoc(doc(db, "adjustments", key), {
      stage,
      targetId,
      targetName,
      adjustedScore: clamped,
    });
    setAdjustments((prev) => ({ ...prev, [key]: clamped }));
    setEditingAdjustment(null);
  }

  // Load classes once on mount
  useEffect(() => {
    loadClasses();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reload students/grades when selected class changes
  useEffect(() => {
    loadStudents();
    loadGrades();
    loadAdjustments();
  }, [selectedClassId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time settings listener (class-scoped)
  useEffect(() => {
    const settingsId = selectedClassId || "grading";
    const unsub = onSnapshot(doc(db, "settings", settingsId), (snap) => {
      if (snap.exists()) {
        setGradingSettings(snap.data() as GradingSettings);
      } else {
        setGradingSettings({ midtermOpen: false, finalOpen: false });
      }
    });
    return unsub;
  }, [selectedClassId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function addStudent() {
    setAddError("");
    if (!newName.trim() || !newStudentId.trim()) {
      setAddError("請填寫姓名與學號。");
      return;
    }
    setAdding(true);
    try {
      const id = newStudentId.trim();
      const data: Student = {
        id,
        studentId: id,
        name: newName.trim(),
        ...(selectedClassId ? { classId: selectedClassId } : {}),
      };
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
      await setDoc(doc(db, "students", id), {
        id,
        studentId: id,
        name,
        ...(selectedClassId ? { classId: selectedClassId } : {}),
      });
    }
    setBulkText("");
    setBulkMode(false);
    await loadStudents();
  }

  async function toggleSetting(key: keyof GradingSettings) {
    if (!selectedClassId) {
      alert("請先從上方下拉選單選擇一個班級，再調整開關設定。");
      return;
    }
    setSavingSettings(true);
    const next = { ...gradingSettings, [key]: !gradingSettings[key] };
    await setDoc(doc(db, "settings", selectedClassId), next);
    setSavingSettings(false);
  }

  const filteredGrades =
    stageFilter === "all"
      ? grades
      : grades.filter((g) => g.stage === stageFilter);

  // Per-student averages grouped by (stage, targetId)
  const gradeSummary = useMemo(() => {
    const groups: Record<string, typeof filteredGrades> = {};
    filteredGrades.forEach((g) => {
      const key = `${g.stage}_${g.targetId}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(g);
    });
    return Object.entries(groups)
      .map(([key, gs]) => {
        const avg = (fn: (g: (typeof gs)[0]) => number) =>
          Number((gs.reduce((s, g) => s + fn(g), 0) / gs.length).toFixed(2));
        const avgTotal = avg((g) => g.total);
        const teacherScore = key in adjustments ? adjustments[key] : null;
        return {
          key,
          stage: gs[0].stage,
          targetId: gs[0].targetId,
          targetName: gs[0].targetName,
          count: gs.length,
          avgTopicMastery: avg((g) => g.scores.topicMastery),
          avgContentRichness: avg((g) => g.scores.contentRichness),
          avgNarrativeSkill: avg((g) => g.scores.narrativeSkill),
          avgPresentationSkill: avg((g) => g.scores.presentationSkill),
          avgTeamwork: avg((g) => g.scores.teamwork),
          avgTotal,
          teacherScore,
          finalScore:
            teacherScore !== null
              ? Number(((teacherScore + avgTotal) / 2).toFixed(2))
              : avgTotal,
        };
      })
      .sort((a, b) =>
        a.stage === b.stage
          ? a.targetId.localeCompare(b.targetId)
          : a.stage.localeCompare(b.stage),
      );
  }, [filteredGrades, adjustments]);

  function exportToExcel() {
    // Build per-stage summaries independent of the current filter
    function buildSummary(gradeList: GradeSubmission[]) {
      const groups: Record<string, typeof gradeList> = {};
      gradeList.forEach((g) => {
        const key = `${g.stage}_${g.targetId}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(g);
      });
      return Object.entries(groups)
        .map(([key, gs]) => {
          const avg = (fn: (g: (typeof gs)[0]) => number) =>
            Number((gs.reduce((s, g) => s + fn(g), 0) / gs.length).toFixed(2));
          const avgTotal = avg((g) => g.total);
          const teacherScore = key in adjustments ? adjustments[key] : null;
          return {
            key,
            stage: gs[0].stage,
            targetId: gs[0].targetId,
            targetName: gs[0].targetName,
            count: gs.length,
            avgTopicMastery: avg((g) => g.scores.topicMastery),
            avgContentRichness: avg((g) => g.scores.contentRichness),
            avgNarrativeSkill: avg((g) => g.scores.narrativeSkill),
            avgPresentationSkill: avg((g) => g.scores.presentationSkill),
            avgTeamwork: avg((g) => g.scores.teamwork),
            avgTotal,
            teacherScore,
            finalScore:
              teacherScore !== null
                ? Number(((teacherScore + avgTotal) / 2).toFixed(2))
                : avgTotal,
          };
        })
        .sort((a, b) => a.targetId.localeCompare(b.targetId));
    }

    const midSummary = buildSummary(
      grades.filter((g) => g.stage === "midterm"),
    );
    const finalSummary = buildSummary(
      grades.filter((g) => g.stage === "final"),
    );

    const stageColDef = [
      { wch: 10 }, // 學號
      { wch: 10 }, // 姓名
      { wch: 6 },  // 評分人數
      { wch: 10 }, // 主題掌握
      { wch: 10 }, // 內容豐富
      { wch: 10 }, // 敘事技巧
      { wch: 10 }, // 簡報技巧
      { wch: 10 }, // 團隊表現
      { wch: 10 }, // 學生評分
      { wch: 10 }, // 老師評分
      { wch: 10 }, // 最終評分
    ];

    function makeStageSheet(summary: ReturnType<typeof buildSummary>) {
      const rows = summary.map((r) => ({
        學號: r.targetId,
        姓名: r.targetName,
        評分人數: r.count,
        "主題掌握 (avg/30)": r.avgTopicMastery,
        "內容豐富 (avg/30)": r.avgContentRichness,
        "敘事技巧 (avg/20)": r.avgNarrativeSkill,
        "簡報技巧 (avg/10)": r.avgPresentationSkill,
        "團隊表現 (avg/10)": r.avgTeamwork,
        學生評分: r.avgTotal,
        老師評分: r.teacherScore ?? "",
        最終評分: r.finalScore,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = stageColDef;
      return ws;
    }

    // "All" sheet with two-row merged headers (matches the image)
    const midMap = Object.fromEntries(midSummary.map((r) => [r.targetId, r]));
    const finalMap = Object.fromEntries(
      finalSummary.map((r) => [r.targetId, r]),
    );

    const headerRow1 = [
      "姓名",
      "學號",
      "期中成績 (30%)",
      "",
      "",
      "期末成績 (30%)",
      "",
      "",
      "出席 (20%)",
      "課堂互動 (20%)",
      "最終成績",
    ];
    const headerRow2 = [
      "",
      "",
      "學生評分",
      "老師評分",
      "最終評分",
      "學生評分",
      "老師評分",
      "最終評分",
      "",
      "",
      "",
    ];

    const sortedStudents = [...students].sort((a, b) =>
      a.studentId.localeCompare(b.studentId),
    );

    const dataRows = sortedStudents.map((s) => {
      const mid = midMap[s.studentId];
      const fin = finalMap[s.studentId];
      return [
        s.name,
        s.studentId,
        mid?.avgTotal ?? "",
        mid?.teacherScore ?? "",
        mid ? mid.finalScore : "",
        fin?.avgTotal ?? "",
        fin?.teacherScore ?? "",
        fin ? fin.finalScore : "",
        "", // 出席
        "", // 課堂互動
        "", // 最終成績
      ];
    });

    const allWs = XLSX.utils.aoa_to_sheet([
      headerRow1,
      headerRow2,
      ...dataRows,
    ]);
    allWs["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, // 姓名
      { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } }, // 學號
      { s: { r: 0, c: 2 }, e: { r: 0, c: 4 } }, // 期中成績 (30%)
      { s: { r: 0, c: 5 }, e: { r: 0, c: 7 } }, // 期末成績 (30%)
      { s: { r: 0, c: 8 }, e: { r: 1, c: 8 } }, // 出席 (20%)
      { s: { r: 0, c: 9 }, e: { r: 1, c: 9 } }, // 課堂互動 (20%)
      { s: { r: 0, c: 10 }, e: { r: 1, c: 10 } }, // 最終成績
    ];
    allWs["!cols"] = [
      { wch: 10 }, // 姓名
      { wch: 12 }, // 學號
      { wch: 14 }, // 期中 學生評分
      { wch: 10 }, // 期中 老師評分
      { wch: 10 }, // 期中 最終評分
      { wch: 14 }, // 期末 學生評分
      { wch: 10 }, // 期末 老師評分
      { wch: 10 }, // 期末 最終評分
      { wch: 10 }, // 出席
      { wch: 14 }, // 課堂互動
      { wch: 10 }, // 最終成績
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, makeStageSheet(midSummary), "期中");
    XLSX.utils.book_append_sheet(wb, makeStageSheet(finalSummary), "期末");
    XLSX.utils.book_append_sheet(wb, allWs, "全部");

    XLSX.writeFile(
      wb,
      `grades_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">管理面板</h1>
          <p className="text-slate-500 text-sm mt-1">
            管理學生名單與查看評分結果
          </p>
        </div>
        <div className="flex gap-2 bg-white border border-slate-100 rounded-xl p-1">
          {(["classes", "students", "grades", "settings"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${
                tab === t
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t === "classes" ? (
                <Layers size={15} />
              ) : t === "students" ? (
                <Users size={15} />
              ) : t === "grades" ? (
                <Star size={15} />
              ) : (
                <Settings size={15} />
              )}
              {t === "classes"
                ? "班級管理"
                : t === "students"
                  ? "學生名單"
                  : t === "grades"
                    ? "評分結果"
                    : "開關設定"}
            </button>
          ))}
        </div>
      </div>

      {/* Class selector (hidden on classes tab) */}
      {tab !== "classes" && classes.length > 0 && (
        <div className="mb-6 flex items-center gap-3 bg-white border border-slate-100 rounded-xl px-4 py-3">
          <span className="text-sm font-medium text-slate-600 shrink-0">
            班級篩選：
          </span>
          <select
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
          >
            <option value="">全部班級</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {selectedClassId && (
            <button
              onClick={() => setSelectedClassId("")}
              className="text-xs text-slate-400 hover:text-slate-600 shrink-0"
            >
              清除
            </button>
          )}
        </div>
      )}

      {/* ─── Class Management ─── */}
      {tab === "classes" && (
        <div className="space-y-6">
          {/* Add class */}
          <div className="card">
            <h2 className="font-semibold text-slate-700 mb-4">新增班級</h2>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="label-base">班級名稱</label>
                <input
                  className="input-base"
                  placeholder="例：資管3甲 週一 8:00"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addClass()}
                />
              </div>
              <div className="flex-1">
                <label className="label-base">說明（選填）</label>
                <input
                  className="input-base"
                  placeholder="選填說明"
                  value={newClassDesc}
                  onChange={(e) => setNewClassDesc(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addClass()}
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={addClass}
                  disabled={addingClass}
                  className="btn-primary py-3!"
                >
                  <Plus size={16} />
                  新增
                </button>
              </div>
            </div>
            {classError && (
              <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 border border-red-100">
                {classError}
              </p>
            )}
          </div>

          {/* Class list */}
          <div className="card overflow-hidden p-0!">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-700">班級列表</h2>
              <span className="text-sm text-slate-400">{classes.length} 個班級</span>
            </div>
            {classes.length === 0 ? (
              <div className="px-6 py-12 text-center text-slate-400 text-sm">
                尚無班級資料，請先新增。
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      班級名稱
                    </th>
                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      說明
                    </th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {classes.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-6 py-4 text-sm font-medium text-slate-800">
                        {c.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {c.description ?? "—"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => deleteClass(c.id, c.name)}
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

      {/* ─── Student Management ─── */}
      {tab === "students" && (
        <div className="space-y-6">
          {/* Hard gate: must have a class selected before adding students */}
          {!selectedClassId ? (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4">
              <Layers size={18} className="text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-700">
                  {classes.length === 0
                    ? "尚未建立任何班級"
                    : "尚未選擇班級"}
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  {classes.length === 0
                    ? "請先到「班級管理」建立班級，再回來新增學生。"
                    : "請先從上方下拉選單選擇一個班級，再新增學生。"}
                </p>
                {classes.length === 0 && (
                  <button
                    onClick={() => setTab("classes")}
                    className="mt-2 text-xs font-semibold text-amber-700 underline underline-offset-2 hover:text-amber-800"
                  >
                    前往班級管理 →
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Add Student — only shown when a class is selected */
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-slate-700">新增學生</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    加入班級：
                    <span className="font-medium text-slate-600">
                      {classes.find((c) => c.id === selectedClassId)?.name}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => setBulkMode((v) => !v)}
                  className="btn-secondary px-3! py-1.5! text-xs"
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
                      className="btn-primary py-3!"
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
          )}

          {/* Student List */}
          <div className="card overflow-hidden p-0!">
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
                      班級
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
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {classes.find((c) => c.id === s.classId)?.name ?? (
                          <span className="text-slate-300">—</span>
                        )}
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
          {/* Filter + view toggle */}
          <div className="card p-4!">
            <div className="flex flex-wrap items-center gap-3">
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
              <div className="ml-auto flex items-center gap-2">
                <span className="text-sm text-slate-400">
                  {filteredGrades.length} 筆
                </span>
                <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                  {(["list", "summary"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setGradesView(v)}
                      className={`px-3 py-1.5 text-xs font-medium transition ${
                        gradesView === v
                          ? "bg-slate-700 text-white"
                          : "bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {v === "list" ? "評分明細" : "成績摘要"}
                    </button>
                  ))}
                </div>
                {gradesView === "summary" && gradeSummary.length > 0 && (
                  <button
                    onClick={exportToExcel}
                    className="btn-secondary px-3! py-1.5! text-xs"
                  >
                    <Download size={13} />
                    匯出 Excel
                  </button>
                )}
              </div>
            </div>
          </div>

          {filteredGrades.length === 0 ? (
            <div className="card text-center py-12 text-slate-400 text-sm">
              尚無評分資料。
            </div>
          ) : gradesView === "summary" ? (
            /* ── Summary table ── */
            <div className="card p-0! overflow-x-auto">
              <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-700">
                  成績摘要
                </span>
                <span className="text-xs text-slate-400">
                  （老師評分：選填，最終分數 = (老師分數 + 同學平均) / 2）
                </span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    {stageFilter === "all" && (
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                        階段
                      </th>
                    )}
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      學號
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      姓名
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">
                      人數
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">
                      主題(30)
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">
                      內容(30)
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">
                      敘事(20)
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">
                      簡報(10)
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">
                      團隊(10)
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">
                      平均
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">
                      老師評分
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">
                      最終
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {gradeSummary.map((row) => {
                    const isEditing = editingAdjustment === row.key;
                    return (
                      <tr
                        key={row.key}
                        className="hover:bg-slate-50/50 transition"
                      >
                        {stageFilter === "all" && (
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                row.stage === "midterm"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-purple-100 text-purple-700"
                              }`}
                            >
                              {row.stage === "midterm" ? "期中" : "期末"}
                            </span>
                          </td>
                        )}
                        <td className="px-4 py-3 font-mono text-slate-600">
                          {row.targetId}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {row.targetName}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-500">
                          {row.count}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-600">
                          {row.avgTopicMastery}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-600">
                          {row.avgContentRichness}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-600">
                          {row.avgNarrativeSkill}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-600">
                          {row.avgPresentationSkill}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-600">
                          {row.avgTeamwork}
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-700">
                          {row.avgTotal}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.01}
                                className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-xs text-center focus:border-indigo-400 focus:outline-none"
                                value={adjustmentInput}
                                onChange={(e) =>
                                  setAdjustmentInput(e.target.value)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter")
                                    saveAdjustment(
                                      row.key,
                                      row.targetId,
                                      row.targetName,
                                      row.stage,
                                    );
                                  if (e.key === "Escape")
                                    setEditingAdjustment(null);
                                }}
                                autoFocus
                              />
                              <button
                                onClick={() =>
                                  saveAdjustment(
                                    row.key,
                                    row.targetId,
                                    row.targetName,
                                    row.stage,
                                  )
                                }
                                className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
                              >
                                <Check size={13} />
                              </button>
                              <button
                                onClick={() => setEditingAdjustment(null)}
                                className="rounded p-1 text-slate-400 hover:bg-slate-100"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              <span
                                className={
                                  row.teacherScore !== null
                                    ? "font-semibold text-emerald-600"
                                    : "text-slate-300"
                                }
                              >
                                {row.teacherScore !== null
                                  ? row.teacherScore
                                  : "—"}
                              </span>
                              <button
                                onClick={() => {
                                  setEditingAdjustment(row.key);
                                  setAdjustmentInput(
                                    row.teacherScore !== null
                                      ? String(row.teacherScore)
                                      : "",
                                  );
                                }}
                                className="rounded p-1 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50"
                                title="老師評分（0–100），最終 = (老師 + 同學平均) / 2"
                              >
                                <Edit3 size={12} />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`text-base font-bold ${
                              row.teacherScore !== null
                                ? "text-indigo-600"
                                : "text-slate-500"
                            }`}
                          >
                            {row.finalScore}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* ── Individual grade list ── */
            <div className="space-y-3">
              {filteredGrades.map((g) => (
                <div key={g.id} className="card p-0! overflow-hidden">
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

      {/* ─── Settings ─── */}
      {tab === "settings" && (
        <div className="max-w-lg space-y-4">
          {!selectedClassId && (
            <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-700">
              請先從上方下拉選單選擇一個班級，再調整該班的評分開關。
            </div>
          )}
          <div className="card space-y-5">
            <div>
              <h2 className="font-semibold text-slate-700 mb-1">評分開關</h2>
              <p className="text-xs text-slate-400">
                開啟後學生才能提交該階段的評分；關閉後立即生效且拒絕新提交。
              </p>
            </div>

            {(
              [
                {
                  key: "midtermOpen" as keyof GradingSettings,
                  label: "期中報告",
                  desc: "開放學生提交期中評分",
                },
                {
                  key: "finalOpen" as keyof GradingSettings,
                  label: "期末報告",
                  desc: "開放學生提交期末評分",
                },
              ] as const
            ).map(({ key, label, desc }) => {
              const isOpen = gradingSettings[key];
              return (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-4"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-xl ${isOpen ? "bg-emerald-100" : "bg-slate-100"}`}
                    >
                      {isOpen ? (
                        <Unlock size={16} className="text-emerald-600" />
                      ) : (
                        <Lock size={16} className="text-slate-500" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">
                        {label}
                      </p>
                      <p className="text-xs text-slate-400">{desc}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => toggleSetting(key)}
                    disabled={savingSettings}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                      isOpen ? "bg-emerald-500" : "bg-slate-200"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        isOpen ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
