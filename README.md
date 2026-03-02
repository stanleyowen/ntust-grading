# NTUST 同儕互評系統

A peer grading system for NTUST built with **Next.js**, **Firebase**, and **Tailwind CSS**.

## Features

- **Student auth** — register & login using student ID; only students on the teacher-approved list can sign up
- **Grading form** — grade peers on 5 criteria for midterm or final report
- **Admin panel** — teacher adds/removes students and views all submitted grades
- **Clean UI** — simple, modern, responsive design

---

## Setup Guide

### 1. Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/) → create a new project
2. Enable **Authentication → Email/Password**
3. Enable **Firestore Database** (test mode is fine for development)
4. Create a **Web App** and copy the config

### 2. Environment Variables

```bash
cp .env.local.example .env.local
```

Fill in the Firebase config values in `.env.local`.

### 3. Create the Admin/Teacher Accounts

Admin emails are hardcoded in the app (`tswu@mail.ntust.edu.tw` and `me@stanleyowen.com`). Admins self-register through the app:

1. Go to `/register`
2. Enter the admin email and choose a password
3. The app recognises the email and creates the account — no student list check needed
4. Admins log in at `/login` with their full email address

### 4. Create Classes First (Admin Panel)

Before adding any students, create your classes:

1. Log in as admin → go to `/admin` → **班級管理** tab
2. Enter a class name (e.g. `資工3甲 週一 8:00`) and optional description, then click **新增**
3. Repeat for each class you teach

### 5. Add Students (Admin Panel)

Once at least one class exists → **學生名單** tab:

- Select the target class from the **班級篩選** dropdown at the top before adding students
- Add one by one, or bulk import (format: `學號 姓名` one per line)
- Example: `B1234567 張小明`
- Students added while a class is selected are automatically assigned to that class

Students then go to `/register`, enter their NTUST email (`學號@mail.ntust.edu.tw`) and set a password — the system looks up their name and class from the student list automatically.

### 5. Firestore Security Rules

The rules below cover the multi-class structure added in the latest update.
Copy and paste them wholesale into **Firestore → Rules** in the Firebase Console.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ── Helpers ──────────────────────────────────────────────────────
    function isAdmin() {
      return request.auth != null
          && (request.auth.token.email == "tswu@mail.ntust.edu.tw"
           || request.auth.token.email == "me@stanleyowen.com");
    }

    // Looks up the correct settings doc:
    //   - students assigned to a class → settings/{classId}
    //   - legacy accounts with no class → settings/grading
    function isStageOpen(stage, classId) {
      let settingsId = (classId != null && classId != '') ? classId : 'grading';
      let s = get(/databases/$(database)/documents/settings/$(settingsId)).data;
      return (stage == 'midterm' && s.midtermOpen == true)
          || (stage == 'final'   && s.finalOpen   == true);
    }

    // ── Classes ──────────────────────────────────────────────────────
    match /classes/{classId} {
      allow read: if request.auth != null;   // students need to read class names
      allow write: if isAdmin();
    }

    // ── Per-class (and legacy global) grading settings ────────────────
    // Document IDs are either a classId or the legacy "grading" sentinel.
    match /settings/{settingsId} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }

    // ── Approved student roster ───────────────────────────────────────
    match /students/{studentId} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }

    // ── Student auth profiles (created on registration) ───────────────
    match /students_auth/{uid} {
      allow read, create, update: if request.auth != null && request.auth.uid == uid;
    }

    // ── Grade submissions ─────────────────────────────────────────────
    match /grades/{gradeId} {
      allow create: if request.auth != null
                    && isStageOpen(
                         request.resource.data.stage,
                         request.resource.data.classId   // may be null for legacy
                       );
      allow read: if isAdmin();
    }

    // ── Teacher score adjustments ─────────────────────────────────────
    match /adjustments/{docId} {
      allow read, write: if isAdmin();
    }
  }
}
```

---

## Running Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deploy

Deploy to [Vercel](https://vercel.com) — add all `NEXT_PUBLIC_*` env vars in project settings.

## Project Structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx       # Login page
│   │   └── register/page.tsx    # Registration page
│   ├── grade/page.tsx           # Grading form (auth required)
│   ├── admin/page.tsx           # Teacher admin panel
│   └── page.tsx                 # Redirects based on auth state
├── components/Header.tsx
├── contexts/AuthContext.tsx
└── lib/
    ├── firebase.ts
    ├── types.ts
    └── utils.ts
```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
