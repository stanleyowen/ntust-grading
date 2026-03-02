"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Student } from "@/lib/types";
import { toStudentEmail } from "@/lib/utils";

const ADMIN_EMAILS = ["tswu@mail.ntust.edu.tw", "me@stanleyowen.com"];

interface AuthContextType {
  user: User | null;
  student: Student | null;
  loading: boolean;
  isAdmin: boolean;
  login: (studentId: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = !!user && ADMIN_EMAILS.includes(user.email ?? "");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser && !isAdminUser(firebaseUser)) {
        // Load student profile
        const snap = await getDoc(doc(db, "students_auth", firebaseUser.uid));
        if (snap.exists()) {
          setStudent(snap.data() as Student);
        }
      } else {
        setStudent(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  function isAdminUser(u: User) {
    return ADMIN_EMAILS.includes(u.email ?? "");
  }

  async function login(input: string, password: string) {
    // Full email → use directly; student ID only → append NTUST domain
    const email = input.includes("@") ? input : toStudentEmail(input);
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function register(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();

    // ── Admin self-registration ──────────────────────────────────────
    if (ADMIN_EMAILS.includes(normalizedEmail)) {
      await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      return;
    }

    // ── Student registration (must be NTUST mail) ────────────────────
    if (!normalizedEmail.endsWith("@mail.ntust.edu.tw")) {
      throw new Error(
        "請使用 NTUST 學生信箱（學號@mail.ntust.edu.tw）或授權的教師信箱。",
      );
    }

    const studentId = normalizedEmail
      .replace("@mail.ntust.edu.tw", "")
      .toUpperCase();
    const approvedRef = doc(db, "students", studentId);
    const approvedSnap = await getDoc(approvedRef);

    if (!approvedSnap.exists()) {
      throw new Error("此學號不在核准名單中，請聯絡老師。");
    }

    const approvedStudent = approvedSnap.data() as Student;

    if (approvedStudent.uid) {
      throw new Error("此帳號已被註冊，如有問題請聯絡老師。");
    }

    // Create Firebase account with the real NTUST email
    const credential = await createUserWithEmailAndPassword(
      auth,
      normalizedEmail,
      password,
    );
    const uid = credential.user.uid;

    await setDoc(
      approvedRef,
      { ...approvedStudent, uid, registeredAt: serverTimestamp() },
      { merge: true },
    );

    await setDoc(doc(db, "students_auth", uid), {
      studentId,
      name: approvedStudent.name,
      uid,
      registeredAt: serverTimestamp(),
    });

    setStudent({ id: studentId, studentId, name: approvedStudent.name, uid });
  }

  async function logout() {
    await signOut(auth);
    setStudent(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, student, loading, isAdmin, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
