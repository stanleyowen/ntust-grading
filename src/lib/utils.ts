import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toStudentEmail(studentId: string): string {
  return `${studentId.toLowerCase()}@mail.ntust.edu.tw`;
}
