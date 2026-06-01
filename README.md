# HealthAI - AI-Integrated Healthcare System

![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white)
![Turborepo](https://img.shields.io/badge/Turborepo-EF4444?style=for-the-badge&logo=turborepo&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

## Description

**HealthAI** is a modern healthcare web platform designed to seamlessly connect patients and doctors while integrating Artificial Intelligence (AI) to assist in preliminary diagnosis and continuous health monitoring.

The project is built as a Monorepo utilizing Turborepo, featuring a robust NestJS Backend and two distinct ReactJS Frontends (Client App & Admin Dashboard).

### ✨ Features

- **🤖 AI Medical Assistant (RAG & Gemini):** A virtual medical assistant capable of conducting preliminary triage, asking symptom-related questions, and providing accurate medical information based on an internal knowledge base (Retrieval-Augmented Generation).
- **📊 Health Metrics Tracking:** Patients can log and track vital signs (heart rate, blood pressure, weight, etc.). The system automatically triggers alerts if abnormal metrics are detected.
- **💬 Real-time Consultation:** Seamless, real-time messaging between doctors and patients powered by WebSockets (Socket.IO).
- **📁 Secure File Management:** Support for uploading and sharing medical images, test results, and prescriptions via Cloudinary integration.
- **🛡️ Admin Dashboard:** A dedicated management module for administrators to verify doctor accounts, moderate AI content (blacklist keywords), and handle violation reports.
- **🔐 Authentication & Security:** Secure JWT authentication, Email OTP verification (Nodemailer), and strict Role-Based Access Control (Patient, Doctor, Admin).

## Installation

This project uses **pnpm** as the package manager within a **Turborepo** workspace.

### Requirements

- Node.js (v18.x or newer)
- [pnpm](https://pnpm.io/installation) (Install globally via `npm install -g pnpm`)
- MongoDB Instance (Local or MongoDB Atlas)
- Cloudinary Account (for file storage)
- Google Gemini API Key (for the AI Assistant)

### Setup Steps

1. **Clone the repository:**

   # HealthAI - AI-Integrated Healthcare System

   ![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white) ![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB) ![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)

   ![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white) ![Turborepo](https://img.shields.io/badge/Turborepo-EF4444?style=for-the-badge&logo=turborepo&logoColor=white) ![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

   ## Description

   HealthAI is a modern healthcare web platform that connects patients and doctors, augmented with AI to assist in preliminary diagnosis and continuous health monitoring.

   The repository is organized as a Turborepo monorepo and includes:
   - A NestJS backend (`apps/api`)
   - Two React frontends: patient/doctor client and admin dashboard (`apps/client`, `apps/admin`)

   ### Features
   - **AI Medical Assistant (RAG & Gemini):** Conducts preliminary triage, asks follow-up symptom questions, and provides information using a Retrieval-Augmented Generation pipeline.
   - **Health Metrics Tracking:** Log and track vitals (heart rate, blood pressure, weight, etc.) with automated alerts for abnormal values.
   - **Real-time Consultation:** Chat between doctors and patients powered by Socket.IO.
   - **Secure File Management:** Upload and share medical images, test results, and prescriptions via Cloudinary.
   - **Admin Dashboard:** Verify doctor accounts, moderate AI content, and manage reports.
   - **Authentication & Security:** JWT auth, email OTP (Nodemailer), and role-based access control (Patient, Doctor, Admin).

   ## Requirements
   - Node.js v18+ (recommended)
   - pnpm (install with `npm install -g pnpm`)
   - MongoDB (local or Atlas)
   - Cloudinary account (for file storage)
   - Google Gemini API key (for AI assistant)

   ## Setup

   Clone the repository and install dependencies from the repository root:

   ```bash
   git clone <your-repo-url>
   cd healthcare-monorepo
   pnpm install
   ```

   ### Environment variables

   Create `.env` files for each app (use provided `.env.example` files when available). Example for the API service (`apps/api/.env`):

   ```env
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/healthcare
   JWT_SECRET=your_jwt_secret
   CLOUDINARY_CLOUD_NAME=your_name
   CLOUDINARY_API_KEY=your_key
   CLOUDINARY_API_SECRET=your_secret
   GEMINI_API_KEY=your_gemini_key
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password
   ```

   Adjust variables per environment (development, staging, production).

   ### Optional: Seed database

   To populate the API with sample data (admins, demo users), run:

   ```bash
   pnpm run seed --filter=api
   ```

   ## Development

   Start all apps (root of the monorepo):

   ```bash
   pnpm dev
   ```

   Default local URLs:
   - Backend API: `http://localhost:3000`
   - Client (patient/doctor): `http://localhost:5173`
   - Admin dashboard: `http://localhost:5174`

   ### Useful commands
   - Install dependencies: `pnpm install`
   - Run dev servers: `pnpm dev`
   - Run API seeds: `pnpm run seed --filter=api`
   - Lint the codebase: `pnpm run lint`

   ## Example workflow
   1. Open the client at `http://localhost:5173` and register as a Patient.
   2. Log health metrics on the dashboard to begin tracking.
   3. Use the AI Chat to upload an image or describe symptoms for a preliminary analysis.
   4. Book a consultation and chat in real-time with a verified doctor.

   ## Support

   If you run into issues:
   - Open an issue on this repository.
   - Contact the development team: 23520657@gm.uit.edu.vn or 23520682@gm.uit.edu.vn

   ## Roadmap
   - [ ] Video call (WebRTC) integration for consultations
   - [ ] Improved AI image pre-processing (Gemini Vision)
   - [ ] Cross-platform mobile app (React Native)

   ## Authors & Acknowledgments

   Course Project (SE121.Q21) — Faculty of Software Engineering, University of Information Technology (UIT), VNU-HCM
   - Vu Quoc Huy (Student ID: 23520657) — Fullstack Developer
   - Do Dinh Khang (Student ID: 23520682) — Fullstack Developer

   Special thanks to our instructor, MSc. Tran Anh Dung.

   ## License

   This project is licensed under the MIT License.
