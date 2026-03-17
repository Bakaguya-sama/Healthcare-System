# 🔧 Environment Variables Setup Guide - Healthcare System

**Phiên bản:** 1.0.0  
**Ngày:** 2026-03-17

---

## ⚠️ Câu Hỏi: Chỉ Tài Khoản Patient Có Đủ Không?

### 🔴 **Trả Lời: KHÔNG - Cần Nhiều Tài Khoản**

Chỉ tài khoản **patient** **KHÔNG ĐỦ** để điền tất cả các ID. Bạn cần tạo nhiều tài khoản với các role khác nhau.

---

## 📋 Danh Sách IDs Cần Thiết & Cách Lấy

| Variable | Cách Lấy | Yêu Cầu | Ghi Chú |
|----------|---------|--------|--------|
| `user_id` | Lấy từ response **Login** | Bất kỳ role | ID của người dùng hiện tại |
| `doctor_id` | Tạo tài khoản **DOCTOR** rồi login | Role DOCTOR | ID của bác sĩ (sau khi admin verify) |
| `patient_id` | Tạo tài khoản **PATIENT** | Role PATIENT | ID của bệnh nhân |
| `session_id` | Tạo cuộc hẹn (Sessions) | Doctor đã verify + Patient | ID của cuộc hẹn |
| `document_id` | Tạo tài liệu (AI_DOCUMENTS) | Role ADMIN | ID của tài liệu |
| `other_user_id` | Tạo tài khoản **DOCTOR** khác | Role DOCTOR | ID của bác sĩ để chat (sau verify) |

---

## 🚀 Setup Workflow (Từng Bước Chi Tiết) - THEO THỨ TỰ LOGIC

### **Bước 1: Tạo Tài Khoản Test (4 accounts) - Theo Thứ Tự**

#### 1️⃣ Tạo Tài Khoản Patient
```bash
POST http://localhost:3000/api/v1/auth/register
Content-Type: application/json

{
  "email": "patient@test.com",
  "password": "Password123!",
  "name": "Test Patient",
  "role": "patient"
}

# Response:
{
  "access_token": "eyJhbGci...",
  "user": {
    "id": "507f1f77bcf86cd799439011",  ← PATIENT_ID
    "email": "patient@test.com",
    "role": "patient"
  }
}

# 💾 Lưu vào Environment:
patient_id = 507f1f77bcf86cd799439011
patient_token = eyJhbGci...
```

---

#### 2️⃣ Tạo Tài Khoản Doctor #1 (Chờ Admin Verify)
```bash
POST http://localhost:3000/api/v1/auth/register

{
  "email": "doctor@test.com",
  "password": "Password123!",
  "name": "Test Doctor",
  "role": "doctor"
}

# Response:
{
  "access_token": "...",
  "user": {
    "id": "507f1f77bcf86cd799439012",  ← DOCTOR_ID
    "email": "doctor@test.com",
    "role": "doctor",
    "verified": false  ← CHƯA VERIFY
  }
}

# 💾 Lưu:
doctor_id = 507f1f77bcf86cd799439012
doctor_token = eyJhbGci...
```

---

#### 3️⃣ Tạo Tài Khoản Doctor #2 (Cho Chat) - Chờ Admin Verify
```bash
POST http://localhost:3000/api/v1/auth/register

{
  "email": "doctor2@test.com",
  "password": "Password123!",
  "name": "Second Doctor",
  "role": "doctor"
}

# Response:
{
  "access_token": "...",
  "user": {
    "id": "507f1f77bcf86cd799439013",  ← OTHER_USER_ID (Doctor để chat)
    "email": "doctor2@test.com",
    "role": "doctor",
    "verified": false
  }
}

# 💾 Lưu:
other_user_id = 507f1f77bcf86cd799439013
doctor2_token = eyJhbGci...
```

---

#### 4️⃣ Tạo Tài Khoản Admin
```bash
POST http://localhost:3000/api/v1/auth/register

{
  "email": "admin@test.com",
  "password": "Password123!",
  "name": "Test Admin",
  "role": "admin"
}

# Response:
{
  "access_token": "...",
  "user": {
    "id": "507f1f77bcf86cd799439014",  ← ADMIN_ID
    "email": "admin@test.com",
    "role": "admin"
  }
}

# 💾 Lưu:
admin_id = 507f1f77bcf86cd799439014
admin_token = eyJhbGci...
```

---

### **Bước 2: Admin Verify Doctors**

#### ✅ Admin Verify Doctor #1
```bash
POST http://localhost:3000/api/v1/admin/doctors/{{doctor_id}}/verify
Authorization: Bearer {{admin_token}}
Content-Type: application/json

{
  "verificationNotes": "Doctor verified for testing"
}

# Response: ✅ Doctor verified
{
  "id": "507f1f77bcf86cd799439012",
  "verified": true,
  ...
}
```

---

#### ✅ Admin Verify Doctor #2 (Cho Chat)
```bash
POST http://localhost:3000/api/v1/admin/doctors/{{other_user_id}}/verify
Authorization: Bearer {{admin_token}}
Content-Type: application/json

{
  "verificationNotes": "Second doctor verified"
}

# Response: ✅ Doctor verified
{
  "id": "507f1f77bcf86cd799439013",
  "verified": true,
  ...
}
```

---

### **Bước 3: Tạo Patient Profile**

#### Tạo Patient Profile
```bash
POST http://localhost:3000/api/v1/patients
Authorization: Bearer {{patient_token}}
Content-Type: application/json

{
  "userId": "{{patient_id}}",
  "fullName": "Test Patient",
  "dateOfBirth": "1990-01-15",
  "gender": "male",
  "bloodType": "O"
}

# Response: ✅ Profile created
{
  "id": "...",
  "user": {
    "id": "507f1f77bcf86cd799439011"
  },
  ...
}
```

---

### **Bước 4: Tạo Session (Patient + Verified Doctor)**

#### Tạo Cuộc Hẹn
```bash
POST http://localhost:3000/api/v1/sessions
Authorization: Bearer {{patient_token}}
Content-Type: application/json

{
  "doctorId": "{{doctor_id}}",
  "patientId": "{{patient_id}}",
  "scheduledTime": "2026-03-20T10:00:00Z",
  "type": "online",
  "reason": "General consultation",
  "duration": 30
}

# Response: ✅ Session created
{
  "id": "507f1f77bcf86cd799439020",  ← SESSION_ID
  "status": "scheduled",
  ...
}

# 💾 Lưu:
session_id = 507f1f77bcf86cd799439020
```

---

### **Bước 5: Tạo Tài Liệu (Admin)**

#### Tạo Tài Liệu
```bash
POST http://localhost:3000/api/v1/ai-documents
Authorization: Bearer {{admin_token}}
Content-Type: application/json

{
  "title": "Test Document",
  "documentType": "guideline",
  "fileUrl": "https://example.com/doc.pdf",
  "description": "Test document for AI knowledge base"
}

# Response: ✅ Document created
{
  "id": "507f1f77bcf86cd799439021",  ← DOCUMENT_ID
  ...
}

# 💾 Lưu:
document_id = 507f1f77bcf86cd799439021
```

---

## 📝 Postman Environment Setup

### Tạo Environment Mới Trong Postman:

**File Name:** `Healthcare-Dev-Complete`

```json
{
  "name": "Healthcare-Dev-Complete",
  "values": [
    {
      "key": "base_url",
      "value": "localhost:3000/api/v1",
      "enabled": true
    },
    {
      "key": "patient_token",
      "value": "eyJhbGci...",
      "enabled": true
    },
    {
      "key": "doctor_token",
      "value": "eyJhbGci...",
      "enabled": true
    },
    {
      "key": "admin_token",
      "value": "eyJhbGci...",
      "enabled": true
    },
    {
      "key": "patient_id",
      "value": "507f1f77bcf86cd799439011",
      "enabled": true
    },
    {
      "key": "doctor_id",
      "value": "507f1f77bcf86cd799439012",
      "enabled": true
    },
    {
      "key": "admin_id",
      "value": "507f1f77bcf86cd799439014",
      "enabled": true
    },
    {
      "key": "other_user_id",
      "value": "507f1f77bcf86cd799439013",
      "enabled": true,
      "description": "Doctor #2 ID (for chat consultation)"
    },
    {
      "key": "session_id",
      "value": "507f1f77bcf86cd799439020",
      "enabled": true
    },
    {
      "key": "document_id",
      "value": "507f1f77bcf86cd799439021",
      "enabled": true
    },
    {
      "key": "jwt_token",
      "value": "{{patient_token}}",
      "enabled": true,
      "description": "Default token (usually patient)"
    }
  ]
}
```

---

## 🎯 Tóm Tắt Cần Gì

### ✅ **Bắt Buộc Phải Tạo (4 Tài Khoản):**

| Tài Khoản | Email | Role | Lý Do |
|-----------|-------|------|-------|
| 1 | patient@test.com | patient | Tạo appointments, review, chat |
| 2 | doctor@test.com | doctor | **Verify bởi Admin** → Tạo/hoàn thành appointments |
| 3 | doctor2@test.com | doctor | **Verify bởi Admin** → Chat tư vấn với patient (other_user_id) |
| 4 | admin@test.com | admin | Verify doctors, tạo documents, violations |

### 📊 **Bắt Buộc Phải Tạo Records (Theo Thứ Tự):**

| Bước | Record | Endpoint | Actor | Dùng Cho |
|------|--------|----------|-------|---------|
| 1️⃣ | Doctor #1 Register | POST /auth/register | - | Setup |
| 2️⃣ | Doctor #2 Register | POST /auth/register | - | Setup |
| 3️⃣ | Verify Doctor #1 | POST /admin/doctors/:id/verify | Admin | Để tạo session |
| 4️⃣ | Verify Doctor #2 | POST /admin/doctors/:id/verify | Admin | Để chat |
| 5️⃣ | Create Session | POST /sessions | Patient | Test consultation flow |
| 6️⃣ | Create Document | POST /ai-documents | Admin | Test AI modules |

---

## ⚡ Quick Start Script

### Postman Pre-request Script (Tự Động Login)

```javascript
// Set base URL
pm.environment.set("base_url", "localhost:3000/api/v1");

// Auto login as patient
pm.sendRequest({
  url: pm.environment.get("base_url") + "/auth/login",
  method: "POST",
  header: {
    "Content-Type": "application/json"
  },
  body: {
    mode: "raw",
    raw: JSON.stringify({
      email: "patient@test.com",
      password: "Password123!"
    })
  }
}, (err, response) => {
  if (!err && response.code === 200) {
    var jsonData = response.json();
    pm.environment.set("patient_token", jsonData.access_token);
    pm.environment.set("patient_id", jsonData.user.id);
    pm.environment.set("jwt_token", jsonData.access_token);
    console.log("✅ Patient login successful");
  }
});
```

---

## 🔐 Role-Based Access Matrix

### Các Endpoints Cần Role Cụ Thể:

| Module | Endpoint | PATIENT | DOCTOR | ADMIN |
|--------|----------|---------|--------|-------|
| **USERS** | GET /users | ❌ | ❌ | ✅ |
| **PATIENTS** | POST /patients | ✅ | ✅ | ✅ |
| **ADMIN** | POST /admin/violations | ❌ | ❌ | ✅ |
| **SESSIONS** | POST /sessions | ✅ | ✅ | ✅ |
| **REVIEWS** | POST /reviews | ✅ | ❌ | ✅ |
| **CHAT** | POST /chat/send | ✅ | ✅ | ✅ |
| **AI-ASSISTANT** | POST /ai-assistant/conversations/start | ✅ | ✅ | ✅ |
| **AI_DOCUMENTS** | POST /ai-documents | ❌ | ❌ | ✅ |
| **NOTIFICATIONS** | POST /notifications | ✅ | ✅ | ✅ |

**Legend:** ✅ = Có quyền | ❌ = Không quyền

---

## 📋 Checklist Setup

- [ ] Tạo tài khoản Patient
- [ ] Lấy patient_token & patient_id
- [ ] Tạo tài khoản Doctor
- [ ] Lấy doctor_token & doctor_id
- [ ] Tạo tài khoản Admin
- [ ] Lấy admin_token & admin_id
- [ ] Tạo tài khoản Other User
- [ ] Lấy other_user_id
- [ ] Tạo Patient Profile
- [ ] Tạo Session
- [ ] Lấy session_id
- [ ] Tạo Document (Admin)
- [ ] Lấy document_id
- [ ] Setup Postman Environment
- [ ] Test Login với mỗi tài khoản

---

## 🧪 Test Cases Theo Role

### **Với Patient Token:**
```
✅ GET /auth/me
✅ GET /users/me
✅ POST /patients
✅ POST /sessions
✅ POST /chat/send
✅ POST /reviews
✅ POST /ai-assistant/conversations/start
❌ GET /users (Admin only)
❌ POST /admin/violations (Admin only)
❌ POST /ai-documents (Admin only)
```

### **Với Doctor Token:**
```
✅ GET /auth/me
✅ GET /users/me
✅ POST /patients
✅ PATCH /sessions/:id/complete
✅ POST /chat/send
❌ POST /reviews (Patient only)
❌ POST /admin/violations (Admin only)
```

### **Với Admin Token:**
```
✅ Tất cả endpoints
✅ GET /users
✅ POST /admin/violations
✅ POST /ai-documents
✅ POST /admin/doctors/:id/verify
```

---

## 💡 Pro Tips

### 1️⃣ **Lưu Tokens Vào File**
```bash
# file: test_accounts.txt
patient@test.com | Password123! | PATIENT
doctor@test.com | Password123! | DOCTOR
admin@test.com | Password123! | ADMIN
other@test.com | Password123! | PATIENT
```

### 2️⃣ **Tự Động Extract IDs**

**Postman Tests Script:**
```javascript
if (pm.response.code === 200 || pm.response.code === 201) {
  var jsonData = pm.response.json();
  
  // Auto set IDs từ response
  if (jsonData.user) {
    pm.environment.set("user_id", jsonData.user.id);
  }
  if (jsonData.id) {
    pm.environment.set("last_id", jsonData.id);
  }
}
```

### 3️⃣ **Collection-level Authorization**

Thay vì set token cho mỗi request, set ở collection level:
1. Mở **Healthcare-API-Complete** collection
2. Tab **Auth**
3. Type: **Bearer Token**
4. Token: `{{jwt_token}}`

---

## 🚨 Common Mistakes

| ❌ Mistake | ✅ Fix |
|-----------|--------|
| Chỉ dùng patient token để test admin endpoints | Tạo admin account riêng |
| Không lưu session_id sau khi tạo | Lưu từ response ngay lập tức |
| Quên Bearer prefix trong token | Luôn dùng `Bearer {{token}}` |
| Token hết hạn giữa test | Refresh token hoặc login lại |
| Mix-up patient_id với user_id | Chúng là một - từ response user |

---

## 📞 Troubleshooting

### ❓ Lỗi: "Unauthorized"
- **Nguyên nhân:** Token sai hoặc hết hạn
- **Fix:** Login lại, lấy token mới

### ❓ Lỗi: "Forbidden"
- **Nguyên nhân:** Role không có quyền
- **Fix:** Dùng token của role phù hợp

### ❓ Lỗi: "Not Found" ID
- **Nguyên nhân:** ID không tồn tại
- **Fix:** Tạo record mới, copy ID chính xác

### ❓ Lỗi: "Validation Failed"
- **Nguyên nhân:** Request body sai
- **Fix:** Kiểm tra format, required fields

---

## 🎓 Workflow Hoàn Chỉnh (Thứ Tự Logic)

```
📋 BƯỚC 0: SETUP - TẠO 4 TÀI KHOẢN
├─ 1️⃣ Patient Register
├─ 2️⃣ Doctor #1 Register
├─ 3️⃣ Doctor #2 Register (Chat partner)
└─ 4️⃣ Admin Register

🔐 BƯỚC 1: VERIFICATION - ADMIN DUYỆT DOCTOR
├─ 1️⃣ Admin Verify Doctor #1
└─ 2️⃣ Admin Verify Doctor #2

👤 BƯỚC 2: PROFILE - TẠO PROFILE BỆNH NHÂN
└─ Patient Create Profile

📅 BƯỚC 3: APPOINTMENT - TẠO CUỘC HẸN
├─ Patient Create Session (với Verified Doctor #1)
└─ Doctor Accept/Start Session

💬 BƯỚC 4: CHAT - TƯ VẤN GIỮA PATIENT & DOCTOR
├─ Patient Send Message
└─ Doctor #2 Chat (other_user_id)

📚 BƯỚC 5: AI - TẠO KNOWLEDGE BASE
├─ Admin Create Document
├─ Admin Create Chunks
└─ AI Use for Consultation

✅ READY: Test toàn bộ hệ thống!
```

---

## ✅ Final Checklist

- [ ] 4 tài khoản test đã tạo
- [ ] 4 tokens đã lưu
- [ ] patient_id, doctor_id, admin_id, other_user_id có sẵn
- [ ] Ít nhất 1 session_id tạo được
- [ ] Ít nhất 1 document_id tạo được
- [ ] Postman Environment setup xong
- [ ] Token auto-refresh configured
- [ ] Đã test 1 endpoint thành công

**Khi hoàn thành tất cả → Bạn đã sẵn sàng test toàn bộ hệ thống! 🎉**

---

**Ngày cập nhật:** 2026-03-17  
**Status:** ✅ Ready to Use
