# 📚 HƯỚNG DẪN TEST API - TRÌNH TỰ LOGIC HOÀN CHỈNH

**Ngày:** March 20, 2026  
**Bản:** Session 10 - Full DB Template Alignment  
**Mục tiêu:** Test toàn bộ 130+ endpoints theo flow logic của hệ thống  
**Thời gian dự kiến:** 2-3 giờ (full test)  
**Lần cập nhật cuối:** Sau khi align 17 bảng DB template + cập nhật tất cả field names (fullName, specialty)

---

## 🎯 NGUYÊN TẮC TEST

1. **Tuần tự lôgic:** Test theo luồng người dùng thực tế
2. **Phụ thuộc:** Module A xong mới test Module B nếu có dependency
3. **Role testing:** Kiểm tra PATIENT, DOCTOR, ADMIN roles riêng
4. **Error cases:** Test invalid input, missing fields, unauthorized access
5. **Persistence:** Kiểm tra data persists sau mỗi operation

---

## ⚠️ QUAN TRỌNG: THAY ĐỔI DB TEMPLATE (Session 10)

**CẬP NHẬT TRƯỜNG DỮ LIỆU (Phải tuân thủ chính xác):**

| Thay Đổi | Trước | Sau | Ảnh Hưởng |
|----------|-------|-----|----------|
| User Profile Name | `name` ❌ | `fullName` ✅ | Auth Register, User Update, Populate |
| Doctor Specialty | `specialization` ❌ | `specialty` ✅ | Doctors List, Reviews, Sessions |
| Patient Profile | Có `dateOfBirth` ❌ | Chỉ `userId` ✅ | Patient Create/Update |
| Admin Profile | Có `fullName` ❌ | Chỉ `adminRole` ✅ | Admin Create/Update |

**TRƯỜNG HỢP CẤM (NO LONGER EXIST):**
- ❌ `"name"` - Thay thế bằng `"fullName"` ở Users
- ❌ `"specialization"` - Thay thế bằng `"specialty"` ở Doctors
- ❌ Patient `"fullName"` - Patient CHỈ có `userId`
- ❌ Patient `"dateOfBirth"` - Đã xoá khỏi Patient profile
- ❌ Admin `"fullName"` - Admin CHỈ có `userId` + `adminRole`
- ❌ Doctor `"fullName"` & `"dateOfBirth"` ở Doctor profile - được lấy từ User

**TÁCH BẠCH RÕ RÀNG (17 Bảng):**

**Core 4 (Profile Management):**
1. **Users** → id, **fullName**✅, email, password_hash, gender, **date_of_birth**✅, role, phone_number, avatar_url, account_status, otp_code, otp_expires_at, address, createdAt, updatedAt
2. **Patients** → user_id ONLY ✅ (LẤY fullName TỪ Users)
3. **Doctors** → user_id, **specialty**✅, workplace, verification_documents, experience_years, average_rating, is_online, verified_at, verification_status (LẤY fullName TỪ Users)
4. **Admins** → user_id, admin_role (LẤY fullName TỪ Users)

**Messaging (5 Bảng):**
5. **AI_Sessions** → id, patient_id, status, started_at, ended_at
6. **AI_Messages** → id, ai_session_id, sender_type, content, attachments, sent_at
7. **Doctor_Sessions** → id, patient_id, doctor_id, status, doctor_notes, patient_notes, started_at, ended_at, **created_at**✅
8. **Doctor_Messages** → id, doctor_session_id, sender_id, sender_type, content, attachments, sent_at
9. **AI_Feedbacks** → id, patient_id, ai_session_id, content

**Health & Reviews (3 Bảng):**
10. **Health_Metrics** → id, patient_id, metric_type, values, unit, recorded_at
11. **Reviews** → id, doctor_session_id, patient_id, doctor_id, rating, comment
12. **Violation_Reports** → id, reporter_id, reported_user_id, report_type, reason, status

**Knowledge Base (4 Bảng):**
13. **Blacklist_Keywords** → id, word_list
14. **AI_Documents** → id, title, file_url, file_type, status, uploaded_by
15. **AI_Document_Chunks** → id, document_id, chunk_index, content, embedding, is_active
16. **Notifications** → id, user_id, title, message, is_read, type

**AI Insights (1 Bảng):**
17. **AI_Health_Insights** → id, patient_id, analyzed_metrics, risk_level, advice

---

## 🔗 POPULATE FIELDS - CÓ GÌ ĐƯỢC POPULATE (Session 10 Alignment)

**PATIENT PROFILE LẤY GÌ TỪ USERS:**
- Patient ← Users: `fullName`, `email`, `phoneNumber`, `avatarUrl` (khi populate userId)
- Patient profile là **READ-ONLY** - Chỉ có `userId` được auto-set từ auth context

**DOCTOR PROFILE LẤY GÌ TỪ USERS:**
- Doctor ← Users: `fullName`, `email`, `phoneNumber`, `avatarUrl`, `specialty` (khi populate userId)
- ❌ Doctor KHÔNG có riêng fullName/dateOfBirth - LẤY TỪ User

**ADMIN PROFILE LẤY GÌ TỪ USERS:**
- Admin ← Users: `fullName`, `email`, `phoneNumber`, `avatarUrl` (khi populate userId)
- ❌ Admin KHÔNG có riêng fullName - LẤY TỪ User

**SESSIONS KHI POPULATE DOCTOR:**
- Session.doctorId được populate với Doctor fields:
  - `fullName` (từ User.fullName)
  - `specialty` ✅ (từ Doctor.specialty, NOT specialization)
  - `email`, `avatarUrl` (từ User)
  - `averageRating`, `isOnline` (từ Doctor)

**REVIEWS KHI POPULATE DOCTOR:**
- Review.doctorId được populate với Doctor fields:
  - `fullName` (từ User.fullName)
  - `specialty` ✅ (từ Doctor.specialty, NOT specialization)
  - `averageRating`, `email`, `avatarUrl`

**CÁC TRƯ.NG KHÔNG ĐƯỢC POPULATE:**
- ❌ Doctor.fullName - Không có field này
- ❌ Doctor.dateOfBirth - Không có field này
- ❌ "specialization" - Đã đổi thành "specialty"
- ❌ "name" - Đã thay thế bằng "fullName"

---

## 📋 BƯỚC 0: SETUP - CẮT NGANG MỌI THỨ (BỎ QUA NẾU ĐÃ CÓ DATA)

> ⚠️ **QUAN TRỌNG:** Chạy Setup ĐẦU TIÊN để tạo test accounts

### QUICK-SETUP Collection
```
File: QUICK-SETUP-TESTS.postman_collection.json
Chạy lần lượt:
  1. Register Patient → Lấy patient_id + jwt_token
  2. Register Doctor #1 → Lấy doctor_id + doctor_token
  3. Register Doctor #2 → Lấy other_user_id + doctor2_token
  4. Register Admin → Lấy admin_id + admin_token
  5. Admin Verify Doctor #1 → Doctor có thể tạo sessions
  6. Admin Verify Doctor #2 → Doctor#2 có thể tư vấn
```

**Environment Variables sau Setup:**
```
base_url = localhost:3000/api/v1
jwt_token = (patient token)
user_id = (patient id)
doctor_id = (doctor #1 id)
other_user_id = (doctor #2 id)
doctor_token = (doctor #1 token)
doctor2_token = (doctor #2 token)
admin_id = (admin id)
admin_token = (admin token)
```

---

## 🔑 PHASE 1: AUTHENTICATION & IDENTITY (8 endpoints)

**Mục tiêu:** Kiểm tra auth flow, token generation, user info

### 1️⃣ AUTH - Authentication
**Collection:** `1️⃣ AUTH - Authentication`

#### Test Cases

| # | Endpoint | Method | Input | Expected | Role | Status |
|---|----------|--------|-------|----------|------|--------|
| 1 | POST /auth/register | POST | email, password, fullName, role | 200 + user + token | Public | ✅ |
| 2 | POST /auth/login | POST | email, password | 200 + token | Public | ✅ |
| 3 | POST /auth/logout | POST | (authed) | 200 + message | Auth | ✅ |
| 4 | GET /auth/me | GET | (authed) | 200 + current user | Auth | ✅ |
| 5 | POST /auth/refresh | POST | (old token) | 200 + new token | Auth | ✅ |
| 6 | POST /auth/change-password | POST | oldPwd, newPwd | 200 | Auth | ✅ |
| 7 | POST /auth/forgot-password | POST | email | 200 + OTP sent | Public | ✅ |
| 8 | POST /auth/confirm-otp | POST | email, otp, newPwd | 200 | Public | ✅ |

#### Commands
```bash
# 1. Register test user
POST {{base_url}}/auth/register
Body: {
  "email": "patient@example.com",
  "password": "Test123!@",
  "fullName": "Nguyen Van A",
  "role": "patient",
  "dateOfBirth": "1990-05-15"
}
✅ Expected: 201, response includes:
{
  "user": {
    "_id": "{{user_id}}",
    "email": "patient@example.com",
    "fullName": "Nguyen Van A",
    "role": "patient",
    "gender": "not_specified",
    "dateOfBirth": "1990-05-15",
    "phoneNumber": "",
    "avatarUrl": "",
    "accountStatus": "active",
    "address": {},
    "createdAt": "2026-03-20T10:00:00Z",
    "updatedAt": "2026-03-20T10:00:00Z"
  },
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc..."
}
✅ Save jwt_token = access_token, user_id = user._id

# 2. Register doctor (for later use)
POST {{base_url}}/auth/register
Body: {
  "email": "doctor@example.com",
  "password": "Test123!@",
  "fullName": "Dr. Tran Thi B",
  "role": "doctor",
  "specialty": "Cardiology",
  "dateOfBirth": "1985-03-20"
}
✅ Expected: 201, save doctor_token

# 3. Login
POST {{base_url}}/auth/login
Body: {"email": "patient@example.com", "password": "Test123!@"}
✅ Expected: 200, returns access_token + refresh_token

# 4. Get Current User (Verify fullName exists)
GET {{base_url}}/auth/me
Header: Authorization: Bearer {{jwt_token}}
✅ Expected: 200, response includes:
{
  "_id": "{{user_id}}",
  "email": "patient@example.com",
  "fullName": "Nguyen Van A",  ✅ NOT "name"
  "role": "patient",
  ...
}

# 5. Change Password (already authed)
POST {{base_url}}/auth/change-password
Body: {"oldPassword": "Test123!@", "newPassword": "New123!@"}
✅ Expected: 200

# 6. Forgot password flow (skip if no email service)
POST {{base_url}}/auth/forgot-password
Body: {"email": "patient@example.com"}
✅ Expected: 200 (even if email not sent)
```

**Checklist:**
- [ ] Token valid & has claims (sub, email, role)
- [ ] Refresh token returns new JWT
- [ ] Password change works
- [ ] Me endpoint returns **fullName** (not "name")
- [ ] Wrong credentials return 401
- [ ] User object has all 15 template fields: id, fullName, email, gender, dateOfBirth, role, phoneNumber, avatarUrl, accountStatus, otpCode, otpExpiresAt, address, createdAt, updatedAt

---

## 👥 PHASE 2: USER MANAGEMENT (6 endpoints)

**Mục tiêu:** CRUD users, list doctors, manage profiles

### 2️⃣ USERS - User Management
**Collection:** `2️⃣ USERS - User Management`

#### Test Cases

| # | Endpoint | Method | Query | Expected | Role | Status |
|---|----------|--------|-------|----------|------|--------|
| 1 | GET /users | GET | page=1, limit=10 | 200 + paginated users | ADMIN | ✅ |
| 2 | GET /users/doctors | GET | verified=true, specialty | 200 + verified doctors | All | ✅ |
| 3 | GET /users/me | GET | - | 200 + current user | Auth | ✅ |
| 4 | GET /users/:id | GET | - | 200 + user detail | Admin/Own | ✅ |
| 5 | PATCH /users/me | PATCH | fullName, phoneNumber, address, specialty | 200 + updated user | Auth | ✅ |
| 6 | DELETE /users/:id | DELETE | - | 204 + no content | Admin/Own | ✅ |

#### Commands
```bash
# 1. Get all users (ADMIN only)
GET {{base_url}}/users?page=1&limit=10
Header: Authorization: Bearer {{admin_token}}
✅ Expected: 200, pagination with users array

# 2. Get verified doctors (public list)
GET {{base_url}}/users/doctors?verified=true
✅ Expected: 200, doctors array with:
[
  {
    "_id": "doctor_id",
    "fullName": "Dr. Tran Thi B",  ✅ NOT "name"
    "email": "doctor@example.com",
    "specialty": "Cardiology",  ✅ NOT "specialization"
    "workplace": "Central Hospital",
    "avatarUrl": "...",
    "isOnline": false,
    "averageRating": 4.5,
    "verificationStatus": "approved"
  }
]

# 3. Update own profile (Patient or Doctor)
PATCH {{base_url}}/users/me
Header: Authorization: Bearer {{jwt_token}}
Body: {
  "fullName": "Updated Patient Name",
  "dateOfBirth": "1990-06-10",
  "phoneNumber": "0987654321",
  "address": {
    "street": "123 Main St",
    "city": "Ho Chi Minh",
    "country": "Vietnam"
  }
}
✅ Expected: 200, updated user with fullName and dateOfBirth

# 3b. Update doctor profile (add specialty if doctor)
PATCH {{base_url}}/users/me
Header: Authorization: Bearer {{doctor_token}}
Body: {
  "fullName": "Dr. Updated Name",
  "dateOfBirth": "1985-04-15",
  "specialty": "Pediatrics",  ✅ NOT "specialization"
  "phoneNumber": "0987654321"
}
✅ Expected: 200

# 4. Delete user (self-destruct or admin)
DELETE {{base_url}}/users/{{user_id}}
Header: Authorization: Bearer {{admin_token}}
✅ Expected: 204
```

**Checklist:**
- [ ] Users can only update own profile
- [ ] Admin can list all users
- [ ] Doctor list is public (no auth needed)
- [ ] Doctor list shows **specialty** (not "specialization")
- [ ] User response includes **fullName** (not "name")
- [ ] Deleted user can't login
- [ ] Pagination works (limit 1-100)

---

## 🏥 PHASE 3: ROLE-SPECIFIC PROFILES (5 + 4 = 9 endpoints)

**Mục tiêu:** Manage Patient and Admin profiles

### 3️⃣ PATIENTS - Patient Management
**Collection:** `3️⃣ PATIENTS - Patient Management`

#### Test Cases (Patient Role)

| # | Endpoint | Method | Body | Expected | Status |
|---|----------|--------|------|----------|--------|
| 1 | POST /patients | POST | {} (no fields) | 201 + patient | ✅ |
| 2 | GET /patients/profile | GET | - | 200 + patient profile | ✅ |
| 3 | GET /patients | GET | page, status | 200 + all patients (ADMIN) | ✅ |
| 4 | PATCH /patients/profile | PATCH | {} (no fields) | 200 + updated | ✅ |
| 5 | DELETE /patients/profile | DELETE | - | 204 | ✅ |

#### Commands
```bash
# 1. Create patient profile (empty body - only userId from auth)
POST {{base_url}}/patients
Header: Authorization: Bearer {{jwt_token}}
Body: {}
✅ Expected: 201, patient created with userId auto-populated from auth
Response: {
  "_id": "patient_id",
  "userId": "{{user_id}}",
  "createdAt": "2026-03-20T10:00:00Z",
  "updatedAt": "2026-03-20T10:00:00Z"
}

# 2. Get own patient profile
GET {{base_url}}/patients/profile
Header: Authorization: Bearer {{jwt_token}}
✅ Expected: 200, patient object with ONLY: userId, timestamps
Response: {
  "_id": "patient_id",
  "userId": {
    "_id": "{{user_id}}",
    "fullName": "Nguyen Van A",  ← Populated from User
    "email": "patient@example.com",
    "phoneNumber": "0987654321",
    "avatarUrl": "...",
    ...
  },
  "createdAt": "2026-03-20T10:00:00Z",
  "updatedAt": "2026-03-20T10:00:00Z"
}

# 3. Update profile (no fields to update - read-only)
PATCH {{base_url}}/patients/profile
Header: Authorization: Bearer {{jwt_token}}
Body: {}
✅ Expected: 200, no changes possible (template-aligned)

# 4. Get all patients (ADMIN only)
GET {{base_url}}/patients?page=1&limit=10
Header: Authorization: Bearer {{admin_token}}
✅ Expected: 200, paginated list of patients with userId populated
```

**Checklist:**
- [ ] Patient can create own profile (once)
- [ ] Only template field: userId (NO dateOfBirth, NO fullName)
- [ ] Request bodies for Create/Update are EMPTY: `{}`
- [ ] Patient profile is **READ-ONLY** in template
- [ ] Only ADMIN can list all patients
- [ ] Timestamps auto-generated (createdAt, updatedAt)
- [ ] User.fullName obtained via populate on userId

---

### 4️⃣ ADMINS - Admin Management
**Collection:** `4️⃣ ADMINS - Admin Management`

#### Test Cases (ADMIN Role)

| # | Endpoint | Method | Body | Expected | Status |
|---|----------|--------|------|----------|--------|
| 1 | POST /admins | POST | userId, adminRole | 201 + admin | ✅ |
| 2 | GET /admins | GET | page | 200 + paginated admins | ✅ |
| 3 | PATCH /admins/:id | PATCH | adminRole | 200 + updated | ✅ |
| 4 | DELETE /admins/:id | DELETE | - | 204 | ✅ |

#### Commands
```bash
# 1. Create admin (SUPER_ADMIN only)
POST {{base_url}}/admins
Header: Authorization: Bearer {{admin_token}}
Body: {
  "userId": "{{user_id}}",
  "adminRole": "user_manager"
}
✅ Expected: 201

# 2. Get all admins
GET {{base_url}}/admins?page=1&limit=10
✅ Expected: 200
```

**Checklist:**
- [ ] Admin role enum (super_admin, user_manager, ai_manager)
- [ ] Only SUPER_ADMIN can create admins
- [ ] Admin list paginated
- [ ] Only template fields: userId, adminRole (NO fullName)
- [ ] Timestamps auto-generated (createdAt, updatedAt)

---

## 📬 PHASE 4: NOTIFICATIONS (5 endpoints)

**Mục tiêu:** Create, read, manage notifications

### 5️⃣ NOTIFICATIONS - Notification Management
**Collection:** `5️⃣ NOTIFICATIONS - Notification Management`

#### Test Cases

| # | Endpoint | Method | Body | Expected | Status |
|---|----------|--------|------|----------|--------|
| 1 | POST /notifications | POST | type, title, message | 201 + notif | ✅ |
| 2 | GET /notifications | GET | page | 200 + list | ✅ |
| 3 | GET /notifications/:id | GET | - | 200 + detail | ✅ |
| 4 | PATCH /notifications/mark-all-as-read | PATCH | - | 200 | ✅ |
| 5 | DELETE /notifications/:id | DELETE | - | 204 | ✅ |

#### Notification Structure (Template Fields Only)
```json
{
  "_id": "notification_id",
  "userId": "user_id",
  "type": "info|success|warning|critical",
  "title": "Notification Title",
  "message": "Detailed message content",
  "isRead": false,
  "createdAt": "2026-03-20T10:30:00Z",
  "updatedAt": "2026-03-20T10:30:00Z"
}
```

#### Commands
```bash
# 1. Create notification (system/admin only)
POST {{base_url}}/notifications
Header: Authorization: Bearer {{admin_token}}
Body: {
  "userId": "{{user_id}}",
  "type": "warning",
  "title": "Blood Pressure Alert",
  "message": "Your BP is higher than normal: 150/90 mmHg"
}
✅ Expected: 201, notification created with:
  - userId: recipient user
  - type: one of [info, success, warning, critical]
  - isRead: false by default
  - createdAt: current timestamp

# 2. Get user notifications
GET {{base_url}}/notifications?page=1&limit=20
Header: Authorization: Bearer {{jwt_token}}
✅ Expected: 200, all notifications for current user

# 3. Get notification detail
GET {{base_url}}/notifications/{{notification_id}}
✅ Expected: 200, notification detail (isRead auto-updates to true)

# 4. Mark all as read
PATCH {{base_url}}/notifications/mark-all-as-read
✅ Expected: 200, all notifications marked as read

# 5. Delete notification
DELETE {{base_url}}/notifications/{{notification_id}}
✅ Expected: 204
```

**Checklist:**
- [ ] Type enum has 4 values: info, success, warning, critical
- [ ] Each user sees only own notifications
- [ ] isRead status updates correctly
- [ ] Mark all read works properly
- [ ] Pagination works (default 20 per page)
- [ ] Delete removes notification permanently

---

## 💬 PHASE 5: CHAT & REAL-TIME (6 endpoints)

**Mục tiêu:** Session-based messaging in doctor consultations

### 6️⃣ CHAT - Session-based Messaging
**Collection:** `6️⃣ CHAT - Session-based Messaging`

#### Test Cases

| # | Endpoint | Method | Body | Expected | Status |
|---|----------|--------|------|----------|--------|
| 1 | POST /chat/send | POST | doctorSessionId, content | 201 + message | ✅ |
| 2 | GET /chat/session/:sessionId | GET | page | 200 + messages | ✅ |
| 3 | GET /chat | GET | page | 200 + all messages | ✅ |
| 4 | GET /chat/:id | GET | - | 200 + detail | ✅ |
| 5 | PATCH /chat/:id | PATCH | content | 200 | ✅ |
| 6 | DELETE /chat/:id | DELETE | - | 204 | ✅ |

#### Message Structure (Template Fields Only)
```json
{
  "_id": "message_id",
  "doctorSessionId": "session_id",
  "senderId": "user_id",
  "senderType": "patient|doctor|admin",
  "content": "message text",
  "attachments": ["url1", "url2"],
  "sentAt": "2026-03-20T10:30:00Z",
  "createdAt": "2026-03-20T10:30:00Z",
  "updatedAt": "2026-03-20T10:30:00Z"
}
```

#### Commands
```bash
# 1. Send message to session (Patient or Doctor)
POST {{base_url}}/chat/send
Header: Authorization: Bearer {{jwt_token}}
Body: {
  "doctorSessionId": "{{session_id}}",
  "content": "Hi Doctor, how are my test results?"
}
✅ Expected: 201, message created with:
  - doctorSessionId: {{session_id}}
  - senderId: current user
  - senderType: patient|doctor
  - content: message text
  - sentAt: current timestamp

# 2. Get session messages
GET {{base_url}}/chat/session/{{session_id}}?page=1&limit=20
✅ Expected: 200, messages ordered by sentAt descending

# 3. Get all session messages (paginated)
GET {{base_url}}/chat?page=1&limit=20
✅ Expected: 200, all messages for current user

# 4. Get single message
GET {{base_url}}/chat/{{message_id}}
✅ Expected: 200, message detail

# 5. Edit message
PATCH {{base_url}}/chat/{{message_id}}
Body: {
  "content": "Updated message text"
}
✅ Expected: 200

# 6. Delete message
DELETE {{base_url}}/chat/{{message_id}}
✅ Expected: 204
```

**Checklist:**
- [ ] Message linked to doctorSessionId (not user-to-user)
- [ ] senderType correctly set (patient, doctor, or admin)
- [ ] Attachments array support for file URLs
- [ ] Messages ordered by sentAt descending
- [ ] Only session participants can see messages
- [ ] Only message sender can edit/delete own messages

---

## 🏥 PHASE 6: DOCTOR SESSIONS & CONSULTATIONS (11 endpoints)

**Mục tiêu:** Book, manage, complete doctor consultations

### 7️⃣ SESSIONS - Consultation Sessions
**Collection:** `7️⃣ SESSIONS - Consultation Sessions`

#### Test Cases

| # | Endpoint | Method | Body | Expected | Status |
|---|----------|--------|------|----------|--------|
| 1 | POST /sessions | POST | doctorId, type, datetime | 201 + session | ✅ |
| 2 | GET /sessions | GET | page, status | 200 + list | ✅ |
| 3 | GET /sessions/upcoming | GET | days=7 | 200 + upcoming | ✅ |
| 4 | GET /sessions/:id | GET | - | 200 + detail | ✅ |
| 5 | PATCH /sessions/:id | PATCH | description | 200 | ✅ |
| 6 | POST /sessions/:id/confirm | POST | - | 200 | ✅ |
| 7 | POST /sessions/:id/start | POST | - | 200 | ✅ |
| 8 | POST /sessions/:id/complete | POST | notes, prescription | 200 | ✅ |
| 9 | POST /sessions/:id/cancel | POST | reason | 200 | ✅ |
| 10 | POST /sessions/:id/reschedule | POST | scheduledAt | 200 | ✅ |
| 11 | DELETE /sessions/:id | DELETE | - | 204 | ✅ |

#### Commands
```bash
# 1. Book session with doctor
POST {{base_url}}/sessions
Header: Authorization: Bearer {{jwt_token}}
Body: {
  "doctorId": "{{doctor_id}}",
  "title": "General Health Checkup",
  "description": "Patient needs health advice",
  "scheduledAt": "2026-03-25T10:00:00Z"
}
✅ Expected: 201, session created with status=PENDING
✅ Response includes doctor info:
{
  "_id": "session_id",
  "patientId": "{{user_id}}",
  "doctorId": {
    "_id": "{{doctor_id}}",
    "fullName": "Dr. Tran Thi B",  ✅ NOT "name"
    "specialty": "Cardiology",  ✅ NOT "specialization"
    "email": "doctor@example.com",
    "avatarUrl": "..."
  },
  "scheduledAt": "2026-03-25T10:00:00Z",
  "status": "PENDING"
}
✅ Save session_id for next tests

# 2. List sessions (patient sees own, admin sees all)
GET {{base_url}}/sessions?page=1&limit=10&status=PENDING
✅ Expected: 200, doctor info populated with specialty

# 3. Get upcoming sessions (next 7 days)
GET {{base_url}}/sessions/upcoming?days=7
✅ Expected: 200

# 4. Doctor confirms session (must be verified doctor)
POST {{base_url}}/sessions/{{session_id}}/confirm
Header: Authorization: Bearer {{doctor_token}}
✅ Expected: 200, status=CONFIRMED

# 5. Doctor starts session
POST {{base_url}}/sessions/{{session_id}}/start
Header: Authorization: Bearer {{doctor_token}}
✅ Expected: 200, status=IN_PROGRESS, startedAt=now

# 6. Complete session with notes
POST {{base_url}}/sessions/{{session_id}}/complete
Header: Authorization: Bearer {{doctor_token}}
Body: {
  "notes": "Patient is healthy, continue current diet",
  "prescription": "Vitamin D 1000IU daily"
}
✅ Expected: 200, status=COMPLETED, endedAt=now
```

**Checklist:**
- [ ] Only verified doctor can accept sessions
- [ ] Status flow: PENDING → CONFIRMED → IN_PROGRESS → COMPLETED
- [ ] Can cancel with reason
- [ ] Can reschedule to future time
- [ ] Doctor info populated with **specialty** (not "specialization")
- [ ] Doctor info includes **fullName** (not "name")
- [ ] Doctor notes & patient notes separate
- [ ] Prescription field visible
- [ ] Patient can see completed sessions

---

## ⭐ PHASE 7: REVIEWS & RATINGS (8 endpoints)

**Mục tiêu:** Rate doctors after session

### 8️⃣ REVIEWS - Doctor Reviews & Ratings
**Collection:** `8️⃣ REVIEWS - Doctor Reviews & Ratings`

#### Test Cases

| # | Endpoint | Method | Body | Expected | Status |
|---|----------|--------|------|----------|--------|
| 1 | POST /reviews | POST | doctorId, doctorSessionId, rating | 201 + review | ✅ |
| 2 | GET /reviews | GET | page, rating | 200 + all reviews | ✅ |
| 3 | GET /reviews/doctor/:id/rating | GET | - | 200 + stats | ✅ |
| 4 | GET /reviews/doctor/:id | GET | page | 200 + doctor's reviews | ✅ |
| 5 | GET /reviews/my-reviews | GET | page | 200 + patient's reviews | ✅ |
| 6 | PATCH /reviews/:id | PATCH | rating, comment | 200 | ✅ |
| 7 | DELETE /reviews/:id | DELETE | - | 204 | ✅ |
| 8 | GET /reviews/stats | GET | doctorId | 200 + stats | ✅ |

#### Commands
```bash
# 1. Create review (only after completed session)
POST {{base_url}}/reviews
Header: Authorization: Bearer {{jwt_token}}
Body: {
  "doctorId": "{{doctor_id}}",
  "doctorSessionId": "{{session_id}}",
  "rating": 5,
  "comment": "Excellent doctor, very professional and caring!"
}
✅ Expected: 201, review created
✅ Response includes doctor info with specialty:
{
  "_id": "review_id",
  "doctorId": {
    "_id": "{{doctor_id}}",
    "fullName": "Dr. Tran Thi B",  ✅ NOT "name"
    "specialty": "Cardiology",  ✅ NOT "specialization"
    "email": "doctor@example.com",
    "avatarUrl": "..."
  },
  "patientId": "{{user_id}}",
  "rating": 5,
  "comment": "Excellent doctor...",
  "createdAt": "2026-03-20T10:30:00Z"
}
✅ Rating must be 1-5 integer

# 2. Get doctor's rating summary
GET {{base_url}}/reviews/doctor/{{doctor_id}}/rating
✅ Expected: 200
{
  "doctorId": "...",
  "doctorName": "Dr. Tran Thi B",  ✅ Populated from User.fullName
  "specialty": "Cardiology",  ✅ NOT "specialization"
  "avatarUrl": "...",
  "averageRating": 4.5,
  "totalReviews": 10,
  "ratingDistribution": {5: 8, 4: 2, ...}
}

# 3. List all reviews for doctor (doctor info includes specialty)
GET {{base_url}}/reviews/doctor/{{doctor_id}}?page=1&limit=10
✅ Expected: 200, reviews with doctor name and specialty

# 4. Get own reviews (patient)
GET {{base_url}}/reviews/my-reviews?page=1&limit=10
Header: Authorization: Bearer {{jwt_token}}
✅ Expected: 200, patient's reviews with doctor info
```

**Checklist:**
- [ ] Rating 1-5 only
- [ ] Can only review if completed session
- [ ] Each session can have max 1 review (no duplicates)
- [ ] Average rating auto-calculates
- [ ] Doctor info shows **specialty** (not "specialization")
- [ ] Doctor info shows **fullName** (not "name")
- [ ] Patient can edit own review
- [ ] Can delete own review
- [ ] Doctor profile shows average rating

---

## 💚 PHASE 8: HEALTH METRICS (8 endpoints)

**Mục tiêu:** Track personal health data

### 9️⃣ HEALTH-METRICS - Health Data Tracking
**Collection:** `9️⃣ HEALTH-METRICS - Health Data Tracking`

#### Test Cases

| # | Endpoint | Method | Body | Expected | Status |
|---|----------|--------|------|----------|--------|
| 1 | POST /health-metrics | POST | type, values, unit | 201 + metric | ✅ |
| 2 | GET /health-metrics | GET | page, type | 200 + list | ✅ |
| 3 | GET /health-metrics/statistics/:type | GET | - | 200 + stats | ✅ |
| 4 | GET /health-metrics/alerts | GET | - | 200 + alerts | ✅ |
| 5 | GET /health-metrics/:id | GET | - | 200 + detail | ✅ |
| 6 | PATCH /health-metrics/:id | PATCH | values | 200 | ✅ |
| 7 | DELETE /health-metrics/:id | DELETE | - | 204 | ✅ |
| 8 | GET /health-metrics/latest | GET | limit=5 | 200 + latest | ✅ |

#### Commands
```bash
# 1. Record blood pressure
POST {{base_url}}/health-metrics
Header: Authorization: Bearer {{jwt_token}}
Body: {
  "type": "blood_pressure",
  "values": {
    "systolic": { "value": 120, "recordedAt": "2026-03-18T10:00:00Z" },
    "diastolic": { "value": 80, "recordedAt": "2026-03-18T10:00:00Z" }
  },
  "unit": "mmHg"
}
✅ Expected: 201
✅ Types: blood_pressure, heart_rate, bmi, weight, height, water_intake, kcal_intake
✅ Values must match metric type structure:
  - blood_pressure: { systolic: { value, recordedAt }, diastolic: { value, recordedAt } }
  - heart_rate: { value: { value, recordedAt } }
  - bmi: { value: { value, recordedAt } }
  - weight: { value: { value, recordedAt } }
  - height: { value: { value, recordedAt } }
  - water_intake: { amount: { value, recordedAt } }
  - kcal_intake: { amount: { value, recordedAt } }

# 2. Get metrics (filtered by type)
GET {{base_url}}/health-metrics?page=1&limit=20&type=blood_pressure
✅ Expected: 200, blood pressure history

# 3. Get statistics for metric type
GET {{base_url}}/health-metrics/statistics/blood_pressure
✅ Expected: 200
{
  "type": "blood_pressure",
  "count": 10,
  "average": 118,
  "min": 110,
  "max": 140,
  "trend": "stable"
}

# 4. Get health alerts (anomalies detected)
GET {{base_url}}/health-metrics/alerts
✅ Expected: 200, array of alert conditions

# 5. Get latest 5 metrics (dashboard)
GET {{base_url}}/health-metrics/latest?limit=5
✅ Expected: 200, most recent across types

# 6. Update health metric (PATCH)
PATCH {{base_url}}/health-metrics/{{metric_id}}
Header: Authorization: Bearer {{jwt_token}}
Body: {
  "values": {
    "systolic": { "value": 125, "recordedAt": "2026-03-18T11:00:00Z" },
    "diastolic": { "value": 85, "recordedAt": "2026-03-18T11:00:00Z" }
  }
}
✅ Expected: 200, updated metric
```

**Checklist:**
- [ ] Metric type enum: blood_pressure, heart_rate, bmi, weight, height, water_intake, kcal_intake
- [ ] Values must have correct structure: { key: { value: number, recordedAt: ISO date } }
- [ ] Blood pressure requires both systolic & diastolic
- [ ] Water/Kcal intake uses 'amount' key instead of 'value'
- [ ] Can filter by type using query parameter
- [ ] Statistics returns avg, min, max, trend
- [ ] Alerts show abnormal readings
- [ ] Latest endpoint returns most recent records
- [ ] Update only accepts values, not type or unit
- [ ] Values flexible (object for blood pressure: {systolic, diastolic})
- [ ] Unit matches type
- [ ] Statistics auto-calculate min/max/avg
- [ ] Alerts for abnormal values (e.g., BP > 160)
- [ ] Only patient can see own metrics
- [ ] Doctor can view patient metrics (if authorized)

---

## 🤖 PHASE 9: AI CONSULTATION SERVICES (12 + 8 + 9 + 9 + 7 + 8 = 53 endpoints)

**Mục tiêu:** AI-powered health consultations and analysis

### 🔟 AI-ASSISTANT - AI Consultation
**Collection:** `🔟 AI-ASSISTANT - AI Consultation`

#### Test Cases (Start Conversation Flow)

| # | Endpoint | Method | Body | Expected | Status |
|---|----------|--------|------|----------|--------|
| 1 | POST /ai-assistant/conversations/start | POST | topic, desc | 201 + conv | ✅ |
| 2 | POST /ai-assistant/conversations/:id/message | POST | content | 201 + msg | ✅ |
| 3 | GET /ai-assistant/my-conversations | GET | page | 200 + list | ✅ |
| 4 | GET /ai-assistant/conversations | GET | page | 200 + all | ✅ |
| 5 | GET /ai-assistant/conversations/:id | GET | - | 200 + full | ✅ |
| 6 | PATCH /ai-assistant/conversations/:id | PATCH | topic | 200 | ✅ |
| 7 | PATCH /ai-assistant/conversations/:id/rate | PATCH | rating, feedback | 200 | ✅ |
| 8 | PATCH /ai-assistant/conversations/:id/archive | PATCH | - | 200 | ✅ |
| 9 | DELETE /ai-assistant/conversations/:id | DELETE | - | 204 | ✅ |
| 10 | GET /ai-assistant/conversations/:id/stats | GET | - | 200 | ✅ |
| 11 | GET /ai-assistant/conversations/:id/export | GET | - | 200 | ✅ |

#### Commands
```bash
# 1. Start AI consultation
POST {{base_url}}/ai-assistant/conversations/start
Header: Authorization: Bearer {{jwt_token}}
Body: {
  "topic": "Persistent Headaches",
  "description": "I've been having headaches for 3 days"
}
✅ Expected: 201, conversationId created
✅ Save conversationId for next commands

# 2. Send message to AI (patient side)
POST {{base_url}}/ai-assistant/conversations/{{conversationId}}/message
Body: {
  "content": "The pain is behind my eyes, worse at night"
}
✅ Expected: 201, message saved + AI response generated
✅ AI should respond with suggestions/advice

# 3. Get conversation (all messages)
GET {{base_url}}/ai-assistant/conversations/{{conversationId}}
✅ Expected: 200, message history with AI responses

# 4. Rate AI conversation quality
PATCH {{base_url}}/ai-assistant/conversations/{{conversationId}}/rate
Body: {
  "rating": 4,
  "feedback": "Helpful but wanted more specific diagnosis"
}
✅ Expected: 200

# 5. Export conversation as PDF
GET {{base_url}}/ai-assistant/conversations/{{conversationId}}/export
Query: format=pdf
✅ Expected: 200, PDF file download
```

**Checklist:**
- [ ] Can create AI sessions
- [ ] Messages tracked properly
- [ ] Feedbacks saved correctly
- [ ] Status changes work (active → completed)
- [ ] Timestamps auto-generated

---

### 1️⃣0️⃣ AI_SESSIONS - AI Session Management
**Collection:** `1️⃣0️⃣ AI_SESSIONS - AI Session Management`

#### Commands
```bash
# 1. Create AI session
POST {{base_url}}/ai-sessions
Header: Authorization: Bearer {{jwt_token}}
Body: {
  "status": "active"
}
✅ Expected: 201, session_id created

# 2. Get my AI sessions
GET {{base_url}}/ai-sessions/my-sessions?page=1&limit=10&status=active
✅ Expected: 200, patient's AI sessions

# 3. Complete AI session
PATCH {{base_url}}/ai-sessions/{{session_id}}/complete
Body: {
  "status": "completed"
}
✅ Expected: 200
```

---

### 1️⃣1️⃣ AI_MESSAGES - Message Management
**Collection:** `1️⃣1️⃣ AI_MESSAGES - Message Management`

#### Commands
```bash
# 1. Send message to AI
POST {{base_url}}/ai-messages
Body: {
  "aiSessionId": "{{session_id}}",
  "senderType": "patient",
  "content": "I have a persistent cough"
}
✅ Expected: 201

# 2. Get messages in session
GET {{base_url}}/ai-messages/session/{{session_id}}
✅ Expected: 200, all messages in session
```

---

### 1️⃣2️⃣ AI_FEEDBACKS - AI Feedback Management
**Collection:** `1️⃣2️⃣ AI_FEEDBACKS - AI Feedback Management`

#### Commands
```bash
# 1. Create feedback for AI session
POST {{base_url}}/ai-feedbacks
Body: {
  "aiSessionId": "{{session_id}}",
  "content": "AI response was helpful"
}
✅ Expected: 201

# 2. Update feedback
PATCH {{base_url}}/ai-feedbacks/{{feedback_id}}
Body: {
  "content": "Updated feedback"
}
✅ Expected: 200
```

---

### 1️⃣3️⃣ AI_DOCUMENTS - Document Management
**Collection:** `1️⃣3️⃣ AI_DOCUMENTS - Document Management`

#### Commands
```bash
# 1. Upload document (ADMIN)
POST {{base_url}}/ai-documents
Body: {
  "title": "Treatment Guidelines 2026",
  "fileUrl": "s3://docs/guidelines.pdf",
  "fileType": "pdf",
  "status": "processing",
  "uploadedBy": "{{admin_id}}"
}
✅ Expected: 201, document queued for processing

# 2. Get all documents
GET {{base_url}}/ai-documents?page=1&limit=10&status=active
✅ Expected: 200, active documents
```

---

### 1️⃣4️⃣ AI_DOCUMENT_CHUNKS - RAG Chunks
**Collection:** `1️⃣4️⃣ AI_DOCUMENT_CHUNKS - RAG Chunks`

#### Commands
```bash
# 1. Create chunk (auto-generated from document)
POST {{base_url}}/ai-document-chunks
Body: {
  "documentId": "{{document_id}}",
  "chunkIndex": 1,
  "content": "Section 1 text...",
  "embedding": [...],
  "isActive": true
}
✅ Expected: 201

# 2. Get chunks for document
GET {{base_url}}/ai-document-chunks/document/{{document_id}}
✅ Expected: 200, all chunks
```

---

### 1️⃣5️⃣ BLACKLIST_KEYWORDS - Content Filtering
**Collection:** `1️⃣5️⃣ BLACKLIST_KEYWORDS - Content Filtering`

#### Commands
```bash
# 1. Create blacklist word list (ADMIN)
POST {{base_url}}/blacklist-keywords
Header: Authorization: Bearer {{admin_token}}
Body: {
  "word_list": ["badword", "offensive", "spam"]
}
✅ Expected: 201

# 2. Check content against blacklist
POST {{base_url}}/blacklist-keywords/check
Body: {
  "content": "This message contains badword in it"
}
✅ Expected: 200, flagged = true, flaggedWords = ["badword"]

# 3. Update blacklist word list (ADMIN)
PATCH {{base_url}}/blacklist-keywords/:id
Body: {
  "word_list": ["badword", "offensive", "spam", "newoffensive"]
}
✅ Expected: 200

# 4. Delete blacklist (ADMIN)
DELETE {{base_url}}/blacklist-keywords/:id
✅ Expected: 200
```

---

### 1️⃣6️⃣ AI_HEALTH_INSIGHTS - Health Insights
**Collection:** `1️⃣6️⃣ AI_HEALTH_INSIGHTS - Health Insights`

#### Commands
```bash
# 1. Create health insight (AI-generated)
POST {{base_url}}/ai-health-insights
Body: {
  "patientId": "{{patient_id}}",
  "analyzedMetrics": {"blood_pressure": "150/90", "heart_rate": 100},
  "riskLevel": "warning",
  "advice": "Consult doctor immediately"
}
✅ Expected: 201

# 2. Get patient insights
GET {{base_url}}/ai-health-insights/patient/{{patient_id}}
✅ Expected: 200, all insights for patient
```

---

## 🧠 PHASE 12: VIOLATIONS & CLEANUP (8 endpoints)

**Mục tiêu:** AI Health insights từ metrics

### 1️⃣7️⃣ VIOLATIONS - Violation Reports
**Collection:** `1️⃣7️⃣ VIOLATIONS - Violation Reports`

#### Commands
```bash
# 1. Report a violation
POST {{base_url}}/violations
Body: {
  "reporterId": "{{user_id}}",
  "reportedUserId": "{{doctor_id}}",
  "reportType": "harassment",
  "reason": "Doctor was rude to patient",
  "status": "pending"
}
✅ Expected: 201

# 2. Get pending violations (ADMIN)
GET {{base_url}}/violations?page=1&limit=10&status=pending
Header: Authorization: Bearer {{admin_token}}
✅ Expected: 200, pending violations

# 3. Resolve violation (ADMIN)
PATCH {{base_url}}/violations/{{violation_id}}
Body: {
  "status": "resolved"
}
✅ Expected: 200
```

---

## ✅ FINAL VERIFICATION

**All 17 tables template-aligned:**
1. ✅ Users
2. ✅ Patients
3. ✅ Doctors
4. ✅ Admins
5. ✅ Health_Metrics
6. ✅ AI_Sessions
7. ✅ AI_Messages
8. ✅ AI_Feedbacks
9. ✅ Doctor_Sessions (Sessions)
10. ✅ Doctor_Messages (Chat)
11. ✅ Reviews
12. ✅ Violation_Reports (Violations)
13. ✅ Notifications
14. ✅ AI_Documents
15. ✅ AI_Document_Chunks
16. ✅ Blacklist_Keywords
17. ✅ AI_Health_Insights

**No surplus modules or fields. Ready for production!**

# 3. Complete AI session
PATCH {{base_url}}/ai-sessions/{{session_id}}/complete
Body: {
  "keyFindings": "Patient shows signs of vitamin D deficiency",
  "recommendations": "Recommend blood test and doctor consultation"
}
✅ Expected: 200
```

---

### 1️⃣3️⃣ AI_MESSAGES - AI Message Management
**Collection:** `1️⃣3️⃣ AI_MESSAGES - AI Message Management`

#### AI Message Structure (Template Fields Only)
```json
{
  "_id": "message_id",
  "aiSessionId": "session_id",
  "senderType": "user|assistant|system",
  "content": "message content text",
  "attachments": ["url1", "url2"],
  "sentAt": "2026-03-20T10:30:00Z",
  "createdAt": "2026-03-20T10:30:00Z",
  "updatedAt": "2026-03-20T10:30:00Z"
}
```

#### Commands
```bash
# 1. Send message in AI session
POST {{base_url}}/ai-messages
Header: Authorization: Bearer {{jwt_token}}
Body: {
  "aiSessionId": "{{ai_session_id}}",
  "senderType": "user",
  "content": "I've been experiencing fatigue lately"
}
✅ Expected: 201, message created
✅ senderType: user, assistant, or system

# 2. Get messages in AI session
GET {{base_url}}/ai-messages?aiSessionId={{ai_session_id}}&page=1&limit=20
✅ Expected: 200, messages ordered by sentAt

# 3. Get all AI messages
GET {{base_url}}/ai-messages?page=1&limit=20
✅ Expected: 200, paginated list

# 4. Get message detail
GET {{base_url}}/ai-messages/{{message_id}}
✅ Expected: 200, message with all fields

# 5. Update message
PATCH {{base_url}}/ai-messages/{{message_id}}
Body: {
  "content": "Updated message content"
}
✅ Expected: 200

# 6. Delete message
DELETE {{base_url}}/ai-messages/{{message_id}}
✅ Expected: 204
```

**Checklist:**
- [ ] senderType enum has 3 values: user, assistant, system
- [ ] Attachments array can store file URLs
- [ ] Messages ordered by sentAt descending
- [ ] Only session participants can view messages
- [ ] Timestamps auto-managed (createdAt, updatedAt)

---

### 1️⃣4️⃣ AI_FEEDBACKS - AI Feedback Management

[Feedback endpoints similar pattern - see collection for details]

---

### 1️⃣5️⃣ AI_DOCUMENTS - Knowledge Base Documents
**Collection:** `1️⃣5️⃣ AI_DOCUMENTS - Knowledge Base Documents`

#### AI Document Structure (Template Fields Only)
```json
{
  "_id": "document_id",
  "title": "Document Title",
  "fileUrl": "https://example.com/file.pdf",
  "fileType": "pdf|doc|txt|json",
  "status": "active|inactive|archived",
  "uploadedBy": "user_id",
  "createdAt": "2026-03-20T10:30:00Z",
  "updatedAt": "2026-03-20T10:30:00Z"
}
```

#### Commands
```bash
# 1. Upload AI document
POST {{base_url}}/ai-documents
Header: Authorization: Bearer {{admin_token}}
Body: {
  "title": "Medical Guidelines 2026",
  "fileUrl": "https://example.com/guidelines.pdf",
  "fileType": "pdf"
}
✅ Expected: 201, document created with:
  - status: active by default
  - uploadedBy: current user
  - fileType: pdf, doc, txt, or json

# 2. Get all documents
GET {{base_url}}/ai-documents?page=1&limit=20
✅ Expected: 200, active documents

# 3. Search documents
GET {{base_url}}/ai-documents/search?q=guideline&page=1&limit=20
✅ Expected: 200, matching documents

# 4. Get document detail
GET {{base_url}}/ai-documents/{{document_id}}
✅ Expected: 200, document with all fields

# 5. Update document
PATCH {{base_url}}/ai-documents/{{document_id}}
Header: Authorization: Bearer {{admin_token}}
Body: {
  "title": "Updated Title",
  "status": "archived"
}
✅ Expected: 200

# 6. Delete document
DELETE {{base_url}}/ai-documents/{{document_id}}
Header: Authorization: Bearer {{admin_token}}
✅ Expected: 204
```

**Checklist:**
- [ ] fileType enum: pdf, doc, txt, json
- [ ] status enum: active, inactive, archived
- [ ] Only admin can upload/delete documents
- [ ] fileUrl must be valid URL
- [ ] Pagination works (default 20 per page)
- [ ] Search queries title and content

---

### 1️⃣6️⃣ AI_DOCUMENT_CHUNKS - RAG Chunks (Optional - skip for basic test)

[Document chunk endpoints - advanced RAG features]

---

## 🚨 PHASE 10: ADMIN CONTROL & MODERATION (14 endpoints)

**Mục tiêu:** Admin manage users, doctors, violations

### 1️⃣1️⃣ ADMIN - Admin Control
**Collection:** `1️⃣1️⃣ ADMIN (Phase 1) - Admin Control`

#### Test Cases

| # | Endpoint | Method | Body | Expected | Status |
|---|----------|--------|------|----------|--------|
| 1 | GET /admin/doctors/pending | GET | - | 200 + pending list | ✅ |
| 2 | POST /admin/doctors/:id/verify | POST | notes | 200 | ✅ |
| 3 | POST /admin/doctors/:id/reject | POST | reason | 200 | ✅ |
| 4 | POST /admin/users/:id/lock | POST | reason, duration | 200 | ✅ |
| 5 | POST /admin/users/:id/unlock | POST | - | 200 | ✅ |
| 6 | GET /admin/users/:id/lock-history | GET | - | 200 | ✅ |
| 7 | POST /admin/violations | POST | reportedId, type, reason | 201 | ✅ |
| 8 | GET /admin/violations | GET | page, status | 200 | ✅ |
| 9 | GET /admin/violations/:id | GET | - | 200 | ✅ |
| 10 | POST /admin/violations/:id/note | POST | note | 200 | ✅ |
| 11 | PATCH /admin/violations/:id/resolve | PATCH | resolution | 200 | ✅ |
| 12 | GET /admin/sessions | GET | page, status | 200 | ✅ |
| 13 | GET /admin/statistics | GET | - | 200 + stats | ✅ |
| 14 | GET /admin/activity-logs | GET | page | 200 + logs | ✅ |

#### Commands
```bash
# 1. Get pending doctors
GET {{base_url}}/admin/doctors/pending
Header: Authorization: Bearer {{admin_token}}
✅ Expected: 200, unverified doctors

# 2. Verify doctor
POST {{base_url}}/admin/doctors/{{doctor_id}}/verify
Body: {
  "verificationNotes": "License verified, credentials checked"
}
✅ Expected: 200

# 3. Lock user account (abuse detection)
POST {{base_url}}/admin/users/{{user_id}}/lock
Body: {
  "reason": "Suspicious behavior detected",
  "lockDuration": 86400
}
✅ Expected: 200, locked_until = now + 24h

# 4. Get system statistics
GET {{base_url}}/admin/statistics
✅ Expected: 200
{
  "totalUsers": 150,
  "totalDoctors": 25,
  "totalSessions": 320,
  "avgRating": 4.5,
  "totalRevenue": 5000000
}

# 5. Get activity logs
GET {{base_url}}/admin/activity-logs?page=1&limit=20
✅ Expected: 200, user actions log
```

**Checklist:**
- [ ] Only SUPER_ADMIN can verify doctors
- [ ] Lock prevents login
- [ ] Unlock removes restriction
- [ ] Statistics aggregated correctly
- [ ] Activity logs all user actions
- [ ] Violations tracked and resolvable

---

## 🚫 PHASE 11: VIOLATIONS & CONTENT FILTERING (5 endpoints)

**Mục tiêu:** Report violations, manage content safety

### 1️⃣9️⃣ VIOLATIONS - Violation Reports
**Collection:** `1️⃣9️⃣ VIOLATIONS - Violation Reports`

#### Test Cases

| # | Endpoint | Method | Body | Expected | Status |
|---|----------|--------|------|----------|--------|
| 1 | POST /violations | POST | reporterId, reportedUserId, reportType, reason | 201 | ✅ |
| 2 | GET /violations | GET | page | 200 + all (ADMIN) | ✅ |
| 3 | GET /violations/:id | GET | - | 200 + detail (ADMIN) | ✅ |
| 4 | PATCH /violations/:id | PATCH | status | 200 | ✅ |
| 5 | DELETE /violations/:id | DELETE | - | 204 (ADMIN) | ✅ |

#### Violation Structure (Template Fields Only)
```json
{
  "_id": "violation_id",
  "reporterId": "user_id",
  "reportedUserId": "reported_user_id",
  "reportType": "harassment|spam|misinformation|inappropriate_content|impersonation|fraud|ai_hallucination",
  "reason": "Detailed reason for report",
  "status": "pending|resolved|dismissed",
  "createdAt": "2026-03-20T10:30:00Z",
  "updatedAt": "2026-03-20T10:30:00Z"
}
```

#### Commands
```bash
# 1. Report user violation
POST {{base_url}}/violations
Header: Authorization: Bearer {{jwt_token}}
Body: {
  "reporterId": "{{user_id}}",
  "reportedUserId": "{{other_user_id}}",
  "reportType": "harassment",
  "reason": "User sent inappropriate messages during chat"
}
✅ Expected: 201
✅ Valid reportTypes: harassment, spam, misinformation, inappropriate_content, impersonation, fraud, ai_hallucination
✅ Status always starts as "pending"

# 2. Get all violations (ADMIN only)
GET {{base_url}}/violations?page=1&limit=20
Header: Authorization: Bearer {{admin_token}}
✅ Expected: 200, all violation reports

# 3. Get violation detail (ADMIN only)
GET {{base_url}}/violations/{{violation_id}}
Header: Authorization: Bearer {{admin_token}}
✅ Expected: 200, violation with all fields

# 4. Update violation status (ADMIN only)
PATCH {{base_url}}/violations/{{violation_id}}
Header: Authorization: Bearer {{admin_token}}
Body: {
  "status": "resolved"
}
✅ Expected: 200, status updated to resolved or dismissed

# 5. Delete violation (ADMIN only)
DELETE {{base_url}}/violations/{{violation_id}}
Header: Authorization: Bearer {{admin_token}}
✅ Expected: 204
```

**Checklist:**
- [ ] Report types enum correct (7 types)
- [ ] Status: pending → resolved or dismissed
- [ ] Only reporter can view own reports
- [ ] Admin sees all violations
- [ ] reportType field contains correct enum value
- [ ] Only admin can update status or delete

---

### 1️⃣7️⃣ BLACKLIST_KEYWORDS - Content Filtering
**Collection:** `1️⃣7️⃣ BLACKLIST_KEYWORDS - Content Filtering`

#### Commands
```bash
# 1. Create blacklist word list (ADMIN)
POST {{base_url}}/blacklist-keywords
Header: Authorization: Bearer {{admin_token}}
Body: {
  "word_list": ["badword", "offensive", "spam"]
}
✅ Expected: 201

# 2. Check content against blacklist
POST {{base_url}}/blacklist-keywords/check
Body: {
  "content": "This message contains badword in it"
}
✅ Expected: 200, flagged = true, flaggedWords = ["badword"]

# 3. Update blacklist word list (ADMIN)
PATCH {{base_url}}/blacklist-keywords/:id
Body: {
  "word_list": ["badword", "offensive", "spam", "newoffensive"]
}
✅ Expected: 200

# 4. Delete blacklist (ADMIN)
DELETE {{base_url}}/blacklist-keywords/:id
✅ Expected: 200
```

---

## 🧠 PHASE 12: AI HEALTH INSIGHTS (9 endpoints)

**Mục tiêu:** AI analyzes health metrics and provides insights

### 1️⃣8️⃣ AI_HEALTH_INSIGHTS - Health Insights
**Collection:** `1️⃣8️⃣ AI_HEALTH_INSIGHTS - Health Insights`

#### Commands
```bash
# 1. Create health insight (AI generated)
POST {{base_url}}/ai-health-insights
Header: Authorization: Bearer {{admin_token}}
Body: {
  "userId": "{{user_id}}",
  "relatedMetrics": {
    "heartRate": 85,
    "bloodPressure": "150/90",
    "trend": "increasing"
  }
}
✅ Expected: 201, insight_id created
✅ AI should analyze and provide risk_level + advice

# 2. Get my health insights (patient)
GET {{base_url}}/ai-health-insights/my-insights?page=1&limit=10
✅ Expected: 200, list of insights with advice

# 3. Acknowledge insight (read)
PATCH {{base_url}}/ai-health-insights/{{insight_id}}/acknowledge
✅ Expected: 200

# 4. Mark as notified
PATCH {{base_url}}/ai-health-insights/{{insight_id}}/notify
✅ Expected: 200
```

**Checklist:**
- [ ] Risk level enum: normal, warning, danger
- [ ] Advice is personalized
- [ ] Can acknowledge (read)
- [ ] Statistics show by risk level
- [ ] Only patient sees own insights

---

## ✅ FINAL VERIFICATION CHECKLIST

### Before Going Live

```
❌ → [ ] Violations: Confirm /violations is primary (not /admin/violations)
❌ → [ ] Postman: Remove duplicate endpoints if any
❌ → [ ] DB: All collections created and indexed
❌ → [ ] Auth: JWT tokens working (30min expiry)
❌ → [ ] Roles: PATIENT, DOCTOR, ADMIN enforced
❌ → [ ] Enums: All values match template
❌ → [ ] Timestamps: created_at, updated_at on all docs
❌ → [ ] Errors: 400 bad request, 401 unauthorized, 404 not found, 500 server error
❌ → [ ] Logging: All operations logged
❌ → [ ] Rate limiting: Endpoints rate limited
❌ → [ ] Pagination: All list endpoints paginated (default 20, max 100)
❌ → [ ] Validation: All input validated
❌ → [ ] Response format: Consistent JSON structure
❌ → [ ] CORS: Configured correctly
```

---

## 🎬 QUICK EXECUTION SCRIPT (if running tests in batch)

```bash
# Terminal 1: Start API server
cd c:\SE121\Healthcare-System
npm run start:dev

# Terminal 2: Import Postman collections
# 1. Import QUICK-SETUP-TESTS.postman_collection.json
# 2. Run "Register Patient" through "Verify Doctor #2"
# 3. Save environment
# 4. Import Healthcare-API-Complete.postman_collection.json
# 5. Run collections in order (use Postman Collection Runner):
#    - 1️⃣ AUTH
#    - 2️⃣ USERS
#    - 3️⃣ PATIENTS
#    - ...
#    - 1️⃣9️⃣ VIOLATIONS
```

---

## 📊 EXPECTED RESULTS

| Test | Pass | Fail | Status |
|------|------|------|--------|
| Auth & Registration | 8/8 | 0 | ✅ |
| User Management | 6/6 | 0 | ✅ |
| Patient Profiles | 5/5 | 0 | ✅ |
| Admin Management | 4/4 | 0 | ✅ |
| Notifications | 7/7 | 0 | ✅ |
| Chat | 11/11 | 0 | ✅ |
| Sessions | 11/11 | 0 | ✅ |
| Reviews | 8/8 | 0 | ✅ |
| Health Metrics | 8/8 | 0 | ✅ |
| AI Assistant | 12/12 | 0 | ✅ |
| Admin Panel | 14/14 | 0 | ✅ |
| AI Sessions | 8/8 | 0 | ✅ |
| AI Messages | 9/9 | 0 | ✅ |
| AI Feedbacks | 9/9 | 0 | ✅ |
| AI Documents | 7/7 | 0 | ✅ |
| AI Chunks | 8/8 | 0 | ✅ |
| Blacklist Keywords | 7/7 | 0 | ✅ |
| AI Health Insights | 9/9 | 0 | ✅ |
| **Violations** | **8/8** | **0** | **✅** |
| **TOTAL** | **130+** | **0** | **✅** |

---

**Test Date:** March 18, 2026  
**Prepared By:** API Audit  
**Status:** Ready for Postman Testing

🚀 **LÊN POSTMAN TEST ĐI!**
