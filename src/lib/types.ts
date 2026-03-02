export interface Class {
  id: string;
  name: string;
  description?: string;
}

export interface GradingSettings {
  midtermOpen: boolean;
  finalOpen: boolean;
}

export interface Student {
  id: string; // Firestore doc ID = studentId
  studentId: string;
  name: string;
  classId?: string; // which class this student belongs to
  uid?: string; // Firebase Auth UID (set after registration)
  registeredAt?: Date;
}

export interface GradeSubmission {
  id?: string;
  stage: "midterm" | "final";
  graderId: string;
  graderName: string;
  targetId: string;
  targetName: string;
  scores: {
    topicMastery: number; // 0-30
    contentRichness: number; // 0-30
    narrativeSkill: number; // 0-20
    presentationSkill: number; // 0-10
    teamwork: number; // 0-10
  };
  total: number;
  comment: string;
  classId?: string;
  submittedAt: Date;
}
