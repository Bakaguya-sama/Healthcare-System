# 📅 **SESSIONS API - HƯỚNG DẪN TEST**

## 🚀 **Chuẩn Bị**

**Điều kiện:**
- ✅ Server đang chạy: `pnpm start:dev`
- ✅ Đã đăng ký & đăng nhập với 2 role:
  - **1 Patient** (để**Headers:**
```
Authorization: Bearer {{patientToken}}
```

⚠️ **LƯU Ý:** Dùng token của patient/doctor để xem sessions của họ session & xóa)
  - **1 Doctor** (để confirm/start/complete)
- ✅ Có 2 tokens: `patientToken` + `doctorToken`
- ✅ Postman hoặc cURL sẵn sàng

### 📌 **Bước 1: Tạo 2 Account (Patient + Doctor)**

#### **Register Patient:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "patient1@example.com",
    "password": "StrongPass123!",
    "name": "Nguyen Van Patient",
    "role": "patient",
    "phoneNumber": "+84912345678"
  }'
```

**Response:**
```json
{
  "statusCode": 201,
  "message": "User registered successfully",
  "data": {
    "_id": "65f123...",
    "email": "patient1@example.com",
    "name": "Nguyen Van Patient",
    "role": "patient"
  }
}
```

#### **Login Patient:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "patient1@example.com",
    "password": "StrongPass123!"
  }'
```

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "user": {
      "_id": "65f123...",
      "email": "patient1@example.com",
      "role": "patient"
    }
  }
}
```

✅ **Copy `patientToken = accessToken` & `patientId = _id`**

---

#### **Register Doctor:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "doctor1@example.com",
    "password": "DoctorPass123!",
    "name": "Dr. Tran Thi Doctor",
    "role": "doctor",
    "phoneNumber": "+84987654321"
  }'
```

#### **Login Doctor:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "doctor1@example.com",
    "password": "DoctorPass123!"
  }'
```

✅ **Copy `doctorToken = accessToken` & `doctorId = _id`**

---

### 📌 **Bước 2: Lưu Tokens vào Postman Variables**

1. Mở Postman
2. Click **Variables** tab
3. Thêm:
   - `patientToken` = (paste từ patient login)
   - `doctorToken` = (paste từ doctor login)
   - `patientId` = (paste patient _id)
   - `doctorId` = (paste doctor _id)
   - `baseUrl` = http://localhost:3000/api/v1
4. Click **Save**

---

### 📌 **Bước 3: Import Postman Collection**

1. Mở Postman → **Import**
2. Chọn `Healthcare-Sessions-API.postman_collection.json`
3. ✅ Bây giờ có thể test các endpoints

---

## 🧪 **10 Endpoints - Test Từng Bước**

### **1️⃣ CREATE SESSION (Đặt lịch hẹn)**

**Endpoint:**
```
POST /sessions
```

**Headers:**
```
Authorization: Bearer {{patientToken}}
Content-Type: application/json
```

**Body:**
```json
{
  "doctorId": "{{doctorId}}",
  "type": "consultation",
  "title": "Initial Consultation",
  "description": "Patient complains about headaches",
  "scheduledAt": "2026-03-20T10:00:00Z",
  "duration": 30,
  "note": "First time visiting"
}
```

⚠️ **QUAN TRỌNG:** Đây là request từ **Patient** (dùng patientToken)

**Response (201 Created):**
```json
{
  "statusCode": 201,
  "message": "Session scheduled successfully",
  "data": {
    "_id": "65f789ghi012jkl345678901",
    "patientId": "65e456def...",
    "doctorId": "65e456def789abc012345678",
    "type": "consultation",
    "title": "Initial Consultation",
    "description": "Patient complains about headaches",
    "scheduledAt": "2026-03-20T10:00:00Z",
    "duration": 30,
    "status": "pending",
    "createdAt": "2026-03-16T20:30:00Z"
  }
}
```

✅ **Copy `_id` để dùng ở bước sau (lưu vào biến `sessionId`)**

---

### **2️⃣ GET ALL SESSIONS (Danh sách session)**

**Endpoint:**
```
GET /sessions?status=pending&type=consultation&page=1&limit=10&sortBy=scheduledAt&sortOrder=-1
```

**Headers:**
```
Authorization: Bearer {{patientToken}}
```

⚠️ **LƯU Ý:** Dùng `{{patientToken}}` nếu là patient, `{{doctorToken}}` nếu là doctor
- Patient sẽ chỉ thấy sessions họ là **patientId**
- Doctor sẽ chỉ thấy sessions họ là **doctorId**
| Param | Kiểu | Required | Ví dụ |
|-------|------|----------|-------|
| `status` | enum | ❌ | pending, confirmed, in_progress, completed, cancelled, rescheduled |
| `type` | enum | ❌ | consultation, follow_up, emergency, routine_checkup |
| `doctorId` | string | ❌ | 65e456def789abc012345678 |
| `patientId` | string | ❌ | 65e789ghi012jkl345678901 |
| `startDate` | ISO date | ❌ | 2026-03-01T00:00:00Z |
| `endDate` | ISO date | ❌ | 2026-03-31T23:59:59Z |
| `page` | number | ❌ | 1 (default) |
| `limit` | number | ❌ | 10 (default) |
| `sortBy` | string | ❌ | scheduledAt (default) |
| `sortOrder` | -1 \| 1 | ❌ | -1 (desc), 1 (asc) |

**Response (200 OK):**
```json
{
  "statusCode": 200,
  "message": "Sessions retrieved successfully",
  "data": [
    {
      "_id": "65f789ghi012jkl345678901",
      "patientId": {
        "_id": "65e456def...",
        "name": "Nguyen Van A",
        "email": "patient@example.com"
      },
      "doctorId": {
        "_id": "65e789xyz...",
        "name": "Dr. Tran Thi B",
        "specialization": "Cardiology"
      },
      "type": "consultation",
      "status": "pending",
      "scheduledAt": "2026-03-20T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 3,
    "pages": 1
  }
}
```

---

### **3️⃣ GET UPCOMING SESSIONS (Sessions sắp tới)**

**Endpoint:**
```
GET /sessions/upcoming?days=7
```

**Headers:**
```
Authorization: Bearer {{patientToken}}
```

**Query Parameters:**
- `days` (optional): Số ngày tính từ bây giờ (default: 7)

**Response (200 OK):**
```json
{
  "statusCode": 200,
  "message": "Upcoming sessions retrieved successfully",
  "data": [
    {
      "_id": "65f789ghi...",
      "type": "consultation",
      "title": "Initial Consultation",
      "status": "confirmed",
      "scheduledAt": "2026-03-19T14:00:00Z",
      "doctorId": {
        "name": "Dr. Tran Thi B",
        "email": "doctor@example.com"
      }
    }
  ],
  "count": 2
}
```

---

### **4️⃣ GET SESSION BY ID (Chi tiết 1 session)**

**⚠️ QUAN TRỌNG:** Thay `{{sessionId}}` bằng ID từ Endpoint 1

**Endpoint:**
```
GET /sessions/:id
```

**Example:**
```
GET /sessions/65f789ghi012jkl345678901
```

**Response (200 OK):**
```json
{
  "statusCode": 200,
  "message": "Session retrieved successfully",
  "data": {
    "_id": "65f789ghi012jkl345678901",
    "patientId": {
      "_id": "65e456def...",
      "name": "Nguyen Van A",
      "email": "patient@example.com"
    },
    "doctorId": {
      "_id": "65e789xyz...",
      "name": "Dr. Tran Thi B",
      "specialization": "Cardiology",
      "email": "doctor@example.com"
    },
    "type": "consultation",
    "title": "Initial Consultation",
    "description": "Patient complains about headaches",
    "status": "pending",
    "scheduledAt": "2026-03-20T10:00:00Z",
    "duration": 30,
    "note": "First time visiting",
    "createdAt": "2026-03-16T20:30:00Z",
    "updatedAt": "2026-03-16T20:30:00Z"
  }
}
```

---

### **5️⃣ UPDATE SESSION (Cập nhật)**

**⚠️ QUAN TRỌNG:** Thay `{{sessionId}}` bằng ID từ Endpoint 1

**Endpoint:**
```
PATCH /sessions/:id
```

**Headers:**
```
Authorization: Bearer {{patientToken}}
Content-Type: application/json
```

⚠️ **LƯU Ý:** Dùng token của patient hoặc doctor để update

**Body:**
```json
{
  "title": "Follow-up Consultation",
  "note": "Patient requested to reschedule from morning to afternoon"
}
```

**Response (200 OK):**
```json
{
  "statusCode": 200,
  "message": "Session updated successfully",
  "data": {
    "_id": "65f789ghi012jkl345678901",
    "title": "Follow-up Consultation",
    "note": "Patient requested to reschedule from morning to afternoon"
  }
}
```

---

### **6️⃣ CONFIRM SESSION (Doctor xác nhận)**

**⚠️ QUAN TRỌNG:** 
- Thay `{{sessionId}}` bằng ID từ Endpoint 1
- Phải dùng token của **Doctor** (người tạo session)
- Session phải ở trạng thái **pending**

**Endpoint:**
```
POST /sessions/:id/confirm
```

**Headers:**
```
Authorization: Bearer {{doctorToken}}
```

**Body:** (trống)

**Response (200 OK):**
```json
{
  "statusCode": 200,
  "message": "Session confirmed successfully",
  "data": {
    "_id": "65f789ghi012jkl345678901",
    "status": "confirmed"
  }
}
```

---

### **7️⃣ START SESSION (Doctor bắt đầu)**

**⚠️ QUAN TRỌNG:** 
- Thay `{{sessionId}}` bằng ID từ Endpoint 1
- Phải dùng token của **Doctor**
- Session phải ở trạng thái **confirmed**

**Endpoint:**
```
POST /sessions/:id/start
```

**Headers:**
```
Authorization: Bearer {{doctorToken}}
```

**Body:** (trống)

**Response (200 OK):**
```json
{
  "statusCode": 200,
  "message": "Session started successfully",
  "data": {
    "_id": "65f789ghi012jkl345678901",
    "status": "in_progress",
    "startedAt": "2026-03-20T10:00:00Z"
  }
}
```

---

### **8️⃣ COMPLETE SESSION (Doctor kết thúc)**

**⚠️ QUAN TRỌNG:** 
- Thay `{{sessionId}}` bằng ID từ Endpoint 1
- Phải dùng token của **Doctor**
- Session phải ở trạng thái **in_progress**

**Endpoint:**
```
POST /sessions/:id/complete
```

**Headers:**
```
Authorization: Bearer {{doctorToken}}
Content-Type: application/json
```

**Body:**
```json
{
  "diagnosis": "Migraine headache",
  "prescription": "Aspirin 500mg twice daily for 7 days"
}
```

**Response (200 OK):**
```json
{
  "statusCode": 200,
  "message": "Session completed successfully",
  "data": {
    "_id": "65f789ghi012jkl345678901",
    "status": "completed",
    "diagnosis": "Migraine headache",
    "prescription": "Aspirin 500mg twice daily for 7 days",
    "endedAt": "2026-03-20T10:30:00Z"
  }
}
```

---

### **9️⃣ CANCEL SESSION (Hủy)**

**⚠️ QUAN TRỌNG:**
- Patient hoặc Doctor đều có thể cancel
- Session phải chưa completed
- Sau cancel, session chuyển sang **cancelled** status

**Endpoint:**
```
POST /sessions/:id/cancel
```

**Headers:**
```
Authorization: Bearer {{patientToken}}
Content-Type: application/json
```

**Body:**
```json
{
  "cancelReason": "Patient has urgent work meeting"
}
```

**Response (200 OK):**
```json
{
  "statusCode": 200,
  "message": "Session cancelled successfully",
  "data": {
    "_id": "65f789ghi012jkl345678901",
    "status": "cancelled",
    "cancelReason": "Patient has urgent work meeting",
    "cancelledBy": "65e456def..."
  }
}
```

---

### **🔟 RESCHEDULE SESSION (Đổi lịch)**

**⚠️ QUAN TRỌNG:**
- Patient hoặc Doctor đều có thể reschedule
- Session phải chưa **completed** hoặc **cancelled**
- Sau reschedule, session quay về trạng thái **pending**
- Nếu session đã **cancelled**, phải create session mới (không thể reschedule)

**Endpoint:**
```
POST /sessions/:id/reschedule
```

**Headers:**
```
Authorization: Bearer {{patientToken}}
Content-Type: application/json
```

**Body:**
```json
{
  "scheduledAt": "2026-03-22T14:00:00Z"
}
```

**Response (200 OK):**
```json
{
  "statusCode": 200,
  "message": "Session rescheduled successfully",
  "data": {
    "_id": "65f789ghi012jkl345678901",
    "status": "pending",
    "scheduledAt": "2026-03-22T14:00:00Z"
  }
}
```

---

### **1️⃣1️⃣ DELETE SESSION (Xóa)**

**⚠️ QUAN TRỌNG:** 
- Chỉ **Patient** có thể xóa
- Session phải ở trạng thái **pending** (chưa confirm)
- Nếu muốn xóa session ở trạng thái khác, phải **cancel** trước, sau đó create session mới

**Endpoint:**
```
DELETE /sessions/:id
```

**Headers:**
```
Authorization: Bearer {{patientToken}}
```

**Response (200 OK):**
```json
{
  "statusCode": 200,
  "message": "Session deleted successfully"
}
```

---

## 📮 **Cách Test Với Postman**

### **Bước 1: Import Collection**
1. Mở Postman
2. Click **Import**
3. Chọn: `Healthcare-Sessions-API.postman_collection.json`
4. Click **Import**

### **Bước 2: Cấu Hình Token & ID**
1. Click **Variables** tab
2. Paste `patientToken` vào **Current Value**
3. Paste `doctorToken` vào **Current Value**
4. Paste `patientId` vào **Current Value**
5. Paste `doctorId` vào **Current Value**
6. Click **Save**

### **Bước 3: Thêm Script Auto-Save ID**

Vào Endpoint 1 (Create Session), click tab **Tests**, paste:
```javascript
if (pm.response.code === 201) {
    var jsonData = pm.response.json();
    pm.variables.set("sessionId", jsonData.data._id);
    console.log("✅ Session ID saved:", jsonData.data._id);
}
```

### **Bước 4: Test Lần Lượt**

**Test Order (Kịch bản đầy đủ):**
```
1. Create Session (Patient) - auto-save sessionId
   ↓
2. Get All Sessions (Patient xem)
   ↓
3. Get Upcoming Sessions (Patient xem)
   ↓
4. Get Session by ID (Patient xem chi tiết)
   ↓
5. Update Session (Patient cập nhật)
   ↓
6. Confirm Session (Doctor xác nhận) - pending→confirmed
   ↓
7. Start Session (Doctor bắt đầu) - confirmed→in_progress
   ↓
8. Complete Session (Doctor kết thúc) - in_progress→completed
   ↓
9a. Nếu muốn DELETE: CANCEL trước (completed→cancelled), rồi tạo session mới
   ↓
9b. Hoặc: Tạo session mới → DELETE trực tiếp (pending)
```

---

## 📊 **Session Types (Loại)**

```
- consultation      (Tư vấn)
- follow_up        (Tái khám)
- emergency        (Khẩn cấp)
- routine_checkup  (Kiểm tra định kỳ)
```

---

## 🔴 **Session Status (Trạng thái)**

```
- pending       (Chờ xác nhận)
- confirmed     (Đã xác nhận)
- in_progress   (Đang diễn ra)
- completed     (Hoàn thành)
- cancelled     (Hủy)
- rescheduled   (Đổi lịch)
```

---

## 🔗 **cURL Examples**

### **1. Register & Login Patient:**
```bash
# Register
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"patient1@test.com","password":"Pass123!","name":"Patient 1","role":"patient"}'

# Login (copy accessToken)
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"patient1@test.com","password":"Pass123!"}'
```

### **2. Register & Login Doctor:**
```bash
# Register
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"doctor1@test.com","password":"Pass123!","name":"Dr. 1","role":"doctor"}'

# Login (copy accessToken)
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"doctor1@test.com","password":"Pass123!"}'
```

### **3. Create Session (Patient):**
```bash
curl -X POST http://localhost:3000/api/v1/sessions \
  -H "Authorization: Bearer PATIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "doctorId": "DOCTOR_ID",
    "type": "consultation",
    "title": "Initial Consultation",
    "description": "Headache consultation",
    "scheduledAt": "2026-03-20T10:00:00Z",
    "duration": 30
  }'
```

### **4. Get All Sessions (Patient):**
```bash
curl -X GET "http://localhost:3000/api/v1/sessions?status=pending&page=1" \
  -H "Authorization: Bearer PATIENT_TOKEN"
```

### **5. Get Session by ID (Patient):**
```bash
curl -X GET http://localhost:3000/api/v1/sessions/SESSION_ID \
  -H "Authorization: Bearer PATIENT_TOKEN"
```

### **6. Confirm Session (Doctor):**
```bash
curl -X POST http://localhost:3000/api/v1/sessions/SESSION_ID/confirm \
  -H "Authorization: Bearer DOCTOR_TOKEN"
```

### **7. Start Session (Doctor):**
```bash
curl -X POST http://localhost:3000/api/v1/sessions/SESSION_ID/start \
  -H "Authorization: Bearer DOCTOR_TOKEN"
```

### **8. Complete Session (Doctor):**
```bash
curl -X POST http://localhost:3000/api/v1/sessions/SESSION_ID/complete \
  -H "Authorization: Bearer DOCTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"diagnosis":"Migraine","prescription":"Aspirin 500mg"}'
```

### **9. Cancel Session (Patient or Doctor):**
```bash
curl -X POST http://localhost:3000/api/v1/sessions/SESSION_ID/cancel \
  -H "Authorization: Bearer PATIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cancelReason":"Urgent meeting"}'
```

### **10. Reschedule Session (Patient or Doctor - session not cancelled/completed):**
```bash
curl -X POST http://localhost:3000/api/v1/sessions/SESSION_ID/reschedule \
  -H "Authorization: Bearer PATIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"scheduledAt":"2026-03-22T14:00:00Z"}'
```

### **11. Delete Session (Patient - pending only):**
```bash
curl -X DELETE http://localhost:3000/api/v1/sessions/SESSION_ID \
  -H "Authorization: Bearer PATIENT_TOKEN"
```

---

## ⚠️ **Lỗi Thường Gặp & Cách Fix**

| Lỗi | Nguyên Nhân | Fix |
|-----|-----------|-----|
| 401 Unauthorized | Token không hợp lệ/hết hạn | Login lại, copy token mới |
| 403 Forbidden | "Only doctor can complete" | Dùng doctorToken (API 6, 7, 8) |
| 403 Forbidden | "Only patient can delete" | Dùng patientToken để delete |
| 400 "Not pending" | API 6: Session không ở pending | Dùng session mới (status=pending) |
| 400 "Not confirmed" | API 7: Session không confirm | Chạy API 6 trước (confirm) |
| 400 "Not in progress" | API 8: Session không in_progress | Chạy API 7 trước (start) |
| 400 "Cannot reschedule" | API 10: Session đã completed/cancelled | Nếu cancelled, tạo session mới; nếu completed, không thể reschedule |
| 400 "Not pending sessions" | API 11: Session không pending | Nếu completed/in_progress, không thể xóa; tạo session mới rồi xóa |
| 404 Session not found | ID không tồn tại | Copy đúng sessionId từ bước Create |
| 400 Invalid ID format | ID format sai | Dùng MongoDB ObjectId (24 hex chars) |

---

## 🎯 **Kịch Bản Test Đầy Đủ**

### **Scenario 1: Tạo → Confirm → Start → Complete (Toàn bộ quy trình)**
```
1. Patient tạo session (status: pending)
   ✓ API 1: POST /sessions
   ↓
2. Doctor xác nhận (status: confirmed)
   ✓ API 6: POST /sessions/:id/confirm
   ↓
3. Doctor bắt đầu (status: in_progress)
   ✓ API 7: POST /sessions/:id/start
   ↓
4. Doctor hoàn thành (status: completed)
   ✓ API 8: POST /sessions/:id/complete
   ↓
5. Session hoàn thành - không thể reschedule/delete
```

### **Scenario 2: Tạo → Reschedule (Đổi lịch)**
```
1. Patient tạo session (status: pending)
   ✓ API 1: POST /sessions
   ↓
2. Patient/Doctor đổi lịch (status: pending lại)
   ✓ API 10: POST /sessions/:id/reschedule
   ↓
3. Có thể confirm/start/complete lại
```

### **Scenario 3: Tạo → Cancel (Hủy cuộc hẹn)**
```
1. Patient tạo session (status: pending)
   ✓ API 1: POST /sessions
   ↓
2. Patient/Doctor hủy (status: cancelled)
   ✓ API 9: POST /sessions/:id/cancel
   ↓
3. Không thể reschedule - tạo session mới thay vì
```

### **Scenario 4: Tạo → Delete (Xóa ngay)**
```
1. Patient tạo session (status: pending)
   ✓ API 1: POST /sessions
   ↓
2. Patient xóa session (chỉ pending)
   ✓ API 11: DELETE /sessions/:id
   ↓
3. Session bị xóa hoàn toàn khỏi DB
```

---

## 📋 **Danh Sách Endpoints & Token Cần Dùng**

| # | Endpoint | Method | Token | Điều kiện Session |
|---|----------|--------|-------|------------------|
| 1 | /sessions | POST | patientToken | - |
| 2 | /sessions | GET | patientToken/doctorToken | - |
| 3 | /sessions/upcoming | GET | patientToken/doctorToken | - |
| 4 | /sessions/:id | GET | patientToken/doctorToken | - |
| 5 | /sessions/:id | PATCH | patientToken/doctorToken | không completed/cancelled |
| 6 | /sessions/:id/confirm | POST | **doctorToken** | **pending** |
| 7 | /sessions/:id/start | POST | **doctorToken** | **confirmed** |
| 8 | /sessions/:id/complete | POST | **doctorToken** | **in_progress** |
| 9 | /sessions/:id/cancel | POST | patientToken/doctorToken | không completed |
| 10 | /sessions/:id/reschedule | POST | patientToken/doctorToken | không completed/cancelled |
| 11 | /sessions/:id | DELETE | **patientToken** | **pending** |

---

## ✅ **Checklist Test**

- [ ] **Setup:** Đăng ký 2 account (Patient + Doctor)
- [ ] **Setup:** Copy 2 tokens vào Postman Variables
- [ ] **API 1:** Create Session (Patient) → copy sessionId
- [ ] **API 2:** Get All Sessions (Patient)
- [ ] **API 3:** Get Upcoming Sessions (Patient)
- [ ] **API 4:** Get Session by ID (Patient)
- [ ] **API 5:** Update Session (Patient)
- [ ] **API 6:** Confirm Session (Doctor) - pending→confirmed
- [ ] **API 7:** Start Session (Doctor) - confirmed→in_progress
- [ ] **API 8:** Complete Session (Doctor) - in_progress→completed
- [ ] **API 9:** Test Cancel (tạo session mới, rồi cancel)
- [ ] **API 10:** Test Reschedule (tạo session mới, rồi reschedule - pending)
- [ ] **API 11:** Test Delete (tạo session mới, xóa luôn khi pending)

---

## 🚀 **Quick Start (5 phút)**

### **Step 1: Register Patient**
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"p1@test.com","password":"Pass123!","name":"Patient 1","role":"patient"}'
```

### **Step 2: Register Doctor**
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"d1@test.com","password":"Pass123!","name":"Doctor 1","role":"doctor"}'
```

### **Step 3: Login Patient & Copy Token**
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"p1@test.com","password":"Pass123!"}'
```

### **Step 4: Login Doctor & Copy Token**
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"d1@test.com","password":"Pass123!"}'
```

### **Step 5: Save Tokens + IDs**
Paste vào biến:
- `patientToken` = (từ patient login)
- `doctorToken` = (từ doctor login)
- `patientId` = (patient _id)
- `doctorId` = (doctor _id)

### **Step 6: Test Endpoints**
1. Create → Get All → Get Upcoming → Get By ID → Update
2. Confirm (Doctor) → Start (Doctor) → Complete (Doctor)

✅ **Done!**
