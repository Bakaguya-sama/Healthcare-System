# 📚 Healthcare System API - Postman Collection Guide

**Phiên bản:** 2.0.0  
**Tổng Endpoints:** 130+  
**Tổng Collections:** 18  
**Ngày cập nhật:** 2026-03-17

---

## 🎯 Mục Lục

1. [📥 Nhập Postman Collection](#-nhập-postman-collection)
2. [🔧 Cấu Hình Environment Variables](#-cấu-hình-environment-variables)
3. [🔑 Xác Thực & JWT Token](#-xác-thực--jwt-token)
4. [📋 Danh Sách Collections & Endpoints](#-danh-sách-collections--endpoints)
5. [🚀 Hướng Dẫn Sử Dụng Từng Module](#-hướng-dẫn-sử-dụng-từng-module)
6. [💡 Các Trường Hợp Kiểm Thử Phổ Biến](#-các-trường-hợp-kiểm-thử-phổ-biến)
7. [⚠️ Xử Lý Lỗi](#-xử-lý-lỗi)
8. [🔒 Bảo Mật & Best Practices](#-bảo-mật--best-practices)

---

## 📥 Nhập Postman Collection

### Bước 1: Tải Postman
- Tải [Postman](https://www.postman.com/downloads/) từ trang chính thức
- Cài đặt và mở ứng dụng

### Bước 2: Import Collection
1. Mở **Postman**
2. Nhấn **File** → **Import**
3. Chọn file `Healthcare-API-Complete.postman_collection.json`
4. Nhấn **Import**

### Bước 3: Xác Nhận Collection
Bạn sẽ thấy collection với **18 folders**:
```
✅ 1️⃣ AUTH
✅ 2️⃣ USERS
✅ 3️⃣ PATIENTS
✅ 4️⃣ ADMINS
✅ 5️⃣ NOTIFICATIONS
✅ 6️⃣ CHAT
✅ 7️⃣ SESSIONS
✅ 8️⃣ REVIEWS
✅ 9️⃣ HEALTH-METRICS
✅ 🔟 AI-ASSISTANT
✅ 1️⃣1️⃣ ADMIN (Phase 1)
✅ 1️⃣2️⃣ AI_SESSIONS
✅ 1️⃣3️⃣ AI_MESSAGES
✅ 1️⃣4️⃣ AI_FEEDBACKS
✅ 1️⃣5️⃣ AI_DOCUMENTS
✅ 1️⃣6️⃣ AI_DOCUMENT_CHUNKS
✅ 1️⃣7️⃣ BLACKLIST_KEYWORDS
✅ 1️⃣8️⃣ AI_HEALTH_INSIGHTS
```

---

## 🔧 Cấu Hình Environment Variables

### Bước 1: Tạo Environment
1. Nhấn **Environment** (biểu tượng mắt)
2. Nhấn **Create Environment**
3. Đặt tên: `Healthcare-Dev`

### Bước 2: Thêm Variables
Sao chép các biến này vào Environment:

```json
{
  "base_url": "localhost:3000/api/v1",
  "jwt_token": "your_jwt_token_here",
  "user_id": "user_object_id",
  "session_id": "session_object_id",
  "document_id": "document_object_id",
  "doctor_id": "doctor_object_id",
  "patient_id": "patient_object_id",
  "other_user_id": "other_user_object_id"
}
```

### Bước 3: Sử Dụng Variables
Trong requests, sử dụng `{{base_url}}`:
```
POST {{base_url}}/auth/login
```

---

## 🔑 Xác Thực & JWT Token

### Bước 1: Đăng Nhập
1. Mở **1️⃣ AUTH** → **Login**
2. Điền credentials:
```json
{
  "email": "patient@test.com",
  "password": "Password123!"
}
```
3. Nhấn **Send**

### Bước 2: Lấy JWT Token
Response sẽ trả về token:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "patient@test.com",
    "role": "patient"
  }
}
```

### Bước 3: Thiết Lập JWT Token Tự Động
1. Chọn tab **Tests**
2. Thêm script:
```javascript
if (pm.response.code === 200) {
  var jsonData = pm.response.json();
  pm.environment.set("jwt_token", jsonData.access_token);
  pm.environment.set("user_id", jsonData.user.id);
}
```
3. Chạy lại request → Token sẽ tự lưu vào `{{jwt_token}}`

### Bước 4: Sử Dụng Token Ở Các Requests Khác
Token sẽ tự động gắn trong header:
```
Authorization: Bearer {{jwt_token}}
```

---

## 📋 Danh Sách Collections & Endpoints

### 1️⃣ AUTH - Authentication (8 endpoints)

| # | Method | Endpoint | Mô Tả |
|---|--------|----------|-------|
| 1 | POST | `/auth/register` | Đăng ký tài khoản mới |
| 2 | POST | `/auth/login` | Đăng nhập & nhận JWT token |
| 3 | POST | `/auth/refresh` | Làm mới token |
| 4 | POST | `/auth/logout` | Đăng xuất |
| 5 | GET | `/auth/me` | Lấy thông tin người dùng hiện tại |
| 6 | POST | `/auth/change-password` | Đổi mật khẩu |
| 7 | POST | `/auth/forgot-password` | Yêu cầu đặt lại mật khẩu |
| 8 | POST | `/auth/confirm-otp` | Xác nhận OTP & đặt mật khẩu mới |

**Ví dụ:**
```bash
# Đăng nhập
POST http://localhost:3000/api/v1/auth/login
Content-Type: application/json

{
  "email": "doctor@test.com",
  "password": "Password123!"
}
```

---

### 2️⃣ USERS - User Management (6 endpoints)

| # | Method | Endpoint | Mô Tả |
|---|--------|----------|-------|
| 1 | GET | `/users?page=1&limit=10` | Danh sách tất cả người dùng |
| 2 | GET | `/users/doctors?verified=true` | Danh sách bác sĩ đã xác minh |
| 3 | GET | `/users/me` | Lấy profile của tôi |
| 4 | GET | `/users/:id` | Lấy thông tin người dùng theo ID |
| 5 | PATCH | `/users/me` | Cập nhật profile của tôi |
| 6 | DELETE | `/users/:id` | Xóa tài khoản người dùng |

**Ví dụ:**
```bash
# Lấy danh sách bác sĩ
GET http://localhost:3000/api/v1/users/doctors?verified=true&page=1&limit=10
Authorization: Bearer {{jwt_token}}

# Cập nhật profile
PATCH http://localhost:3000/api/v1/users/me
Authorization: Bearer {{jwt_token}}
Content-Type: application/json

{
  "name": "John Updated",
  "phoneNumber": "0987654321"
}
```

---

### 3️⃣ PATIENTS - Patient Management (5 endpoints)

| # | Method | Endpoint | Mô Tả |
|---|--------|----------|-------|
| 1 | POST | `/patients` | Tạo hồ sơ bệnh nhân |
| 2 | GET | `/patients/profile` | Lấy hồ sơ bệnh nhân hiện tại |
| 3 | GET | `/patients?page=1&limit=10` | Danh sách tất cả bệnh nhân |
| 4 | PATCH | `/patients/profile` | Cập nhật hồ sơ bệnh nhân |
| 5 | DELETE | `/patients/profile` | Xóa hồ sơ bệnh nhân |

**Ví dụ:**
```bash
# Tạo hồ sơ bệnh nhân
POST http://localhost:3000/api/v1/patients
Authorization: Bearer {{jwt_token}}
Content-Type: application/json

{
  "fullName": "John Patient",
  "dateOfBirth": "1990-01-15",
  "gender": "male",
  "bloodType": "O",
  "allergies": ["Penicillin"],
  "medicalHistory": "Hypertension"
}
```

---

### 4️⃣ ADMINS - Admin Management (4 endpoints)

| # | Method | Endpoint | Mô Tả |
|---|--------|----------|-------|
| 1 | POST | `/admins` | Tạo admin mới |
| 2 | GET | `/admins?page=1&limit=10` | Danh sách admins |
| 3 | PATCH | `/admins/:id` | Cập nhật admin |
| 4 | DELETE | `/admins/:id` | Xóa admin |

**Yêu cầu:** SUPER_ADMIN role

---

### 5️⃣ NOTIFICATIONS - Notification Management (7 endpoints)

| # | Method | Endpoint | Mô Tả |
|---|--------|----------|-------|
| 1 | POST | `/notifications` | Tạo thông báo |
| 2 | GET | `/notifications?page=1&limit=20` | Danh sách thông báo |
| 3 | GET | `/notifications/:id` | Chi tiết thông báo (tự đánh dấu đã đọc) |
| 4 | PATCH | `/notifications/:id` | Cập nhật thông báo |
| 5 | PATCH | `/notifications/mark-all-as-read` | Đánh dấu tất cả là đã đọc |
| 6 | DELETE | `/notifications/:id` | Xóa thông báo |
| 7 | GET | `/notifications/unread/count` | Đếm số thông báo chưa đọc |

**Ví dụ:**
```bash
# Tạo thông báo
POST http://localhost:3000/api/v1/notifications
Authorization: Bearer {{jwt_token}}
Content-Type: application/json

{
  "userId": "{{user_id}}",
  "type": "SESSION_REMINDER",
  "title": "Cuộc hẹn sắp tới",
  "message": "Bạn có cuộc hẹn trong 1 giờ",
  "expiresIn": 86400
}
```

---

### 6️⃣ CHAT - Real-time Messaging (7 endpoints)

| # | Method | Endpoint | Mô Tả |
|---|--------|----------|-------|
| 1 | POST | `/chat/send` | Gửi tin nhắn |
| 2 | GET | `/chat/conversation/:otherId` | Lấy lịch sử chat với người khác |
| 3 | GET | `/chat/messages?page=1&limit=10` | Danh sách tất cả tin nhắn |
| 4 | GET | `/chat/messages/:id` | Chi tiết tin nhắn |
| 5 | PATCH | `/chat/messages/:id` | Cập nhật tin nhắn |
| 6 | DELETE | `/chat/messages/:id` | Xóa tin nhắn |
| 7 | PATCH | `/chat/messages/:id/read` | Đánh dấu đã đọc |

**Ví dụ:**
```bash
# Gửi tin nhắn
POST http://localhost:3000/api/v1/chat/send
Authorization: Bearer {{jwt_token}}
Content-Type: application/json

{
  "receiverId": "{{other_user_id}}",
  "content": "Xin chào! Bạn khỏe không?",
  "messageType": "text"
}
```

---

### 7️⃣ SESSIONS - Consultation Sessions (9 endpoints)

| # | Method | Endpoint | Mô Tả |
|---|--------|----------|-------|
| 1 | POST | `/sessions` | Tạo cuộc hẹn mới |
| 2 | GET | `/sessions?page=1&limit=10` | Danh sách cuộc hẹn |
| 3 | GET | `/sessions/upcoming?days=7` | Cuộc hẹn sắp tới (7 ngày tới) |
| 4 | GET | `/sessions/:id` | Chi tiết cuộc hẹn |
| 5 | PATCH | `/sessions/:id` | Cập nhật cuộc hẹn |
| 6 | PATCH | `/sessions/:id/start` | Bắt đầu cuộc hẹn |
| 7 | PATCH | `/sessions/:id/complete` | Hoàn thành cuộc hẹn |
| 8 | PATCH | `/sessions/:id/cancel` | Hủy cuộc hẹn |
| 9 | DELETE | `/sessions/:id` | Xóa cuộc hẹn |

**Ví dụ:**
```bash
# Tạo cuộc hẹn
POST http://localhost:3000/api/v1/sessions
Authorization: Bearer {{jwt_token}}
Content-Type: application/json

{
  "doctorId": "{{doctor_id}}",
  "patientId": "{{patient_id}}",
  "scheduledTime": "2026-03-20T10:00:00Z",
  "type": "online",
  "reason": "Khám bệnh định kỳ",
  "duration": 30
}
```

---

### 8️⃣ REVIEWS - Doctor Reviews & Ratings (8 endpoints)

| # | Method | Endpoint | Mô Tả |
|---|--------|----------|-------|
| 1 | POST | `/reviews` | Viết đánh giá bác sĩ |
| 2 | GET | `/reviews?page=1&limit=10` | Danh sách đánh giá |
| 3 | GET | `/reviews/doctor/:doctorId/rating` | Điểm trung bình của bác sĩ |
| 4 | GET | `/reviews/doctor/:doctorId` | Tất cả đánh giá của bác sĩ |
| 5 | GET | `/reviews/my-reviews?page=1&limit=10` | Đánh giá của tôi |
| 6 | PATCH | `/reviews/:id` | Cập nhật đánh giá |
| 7 | DELETE | `/reviews/:id` | Xóa đánh giá |
| 8 | GET | `/reviews/stats?doctorId={{doctor_id}}` | Thống kê đánh giá |

**Ví dụ:**
```bash
# Viết đánh giá
POST http://localhost:3000/api/v1/reviews
Authorization: Bearer {{jwt_token}}
Content-Type: application/json

{
  "doctorId": "{{doctor_id}}",
  "rating": 5,
  "title": "Bác sĩ tuyệt vời",
  "comment": "Rất chuyên nghiệp và tư vấn chi tiết"
}
```

---

### 9️⃣ HEALTH-METRICS - Health Data Tracking (8 endpoints)

| # | Method | Endpoint | Mô Tả |
|---|--------|----------|-------|
| 1 | POST | `/health-metrics` | Ghi nhận chỉ số sức khỏe |
| 2 | GET | `/health-metrics?page=1&limit=20` | Danh sách chỉ số |
| 3 | GET | `/health-metrics/statistics/:type` | Thống kê theo loại |
| 4 | GET | `/health-metrics/alerts` | Cảnh báo sức khỏe |
| 5 | GET | `/health-metrics/:id` | Chi tiết chỉ số |
| 6 | PATCH | `/health-metrics/:id` | Cập nhật chỉ số |
| 7 | DELETE | `/health-metrics/:id` | Xóa chỉ số |
| 8 | GET | `/health-metrics/latest?limit=5` | Chỉ số gần nhất |

**Ví dụ:**
```bash
# Ghi nhận huyết áp
POST http://localhost:3000/api/v1/health-metrics
Authorization: Bearer {{jwt_token}}
Content-Type: application/json

{
  "metricType": "blood_pressure",
  "value": 120,
  "unit": "mmHg",
  "recordedAt": "2026-03-17T10:00:00Z",
  "notes": "Đo tại nhà"
}
```

**Các loại chỉ số:**
- `blood_pressure` - Huyết áp
- `heart_rate` - Nhịp tim
- `weight` - Cân nặng
- `glucose` - Đường huyết
- `temperature` - Nhiệt độ
- `oxygen_saturation` - Độ bão hòa oxy

---

### 🔟 AI-ASSISTANT - AI Consultation (12 endpoints)

| # | Method | Endpoint | Mô Tả |
|---|--------|----------|-------|
| 1 | POST | `/ai-assistant/conversations/start` | Bắt đầu cuộc trò chuyện AI |
| 2 | POST | `/ai-assistant/conversations/:conversationId/message` | Gửi tin nhắn đến AI |
| 3 | GET | `/ai-assistant/my-conversations?page=1&limit=10` | Cuộc trò chuyện của tôi |
| 4 | GET | `/ai-assistant/conversations?page=1&limit=10` | Tất cả cuộc trò chuyện |
| 5 | GET | `/ai-assistant/conversations/:id` | Chi tiết cuộc trò chuyện |
| 6 | PATCH | `/ai-assistant/conversations/:id` | Cập nhật cuộc trò chuyện |
| 7 | PATCH | `/ai-assistant/conversations/:id/rate` | Đánh giá AI |
| 8 | PATCH | `/ai-assistant/conversations/:id/archive` | Lưu trữ cuộc trò chuyện |
| 9 | DELETE | `/ai-assistant/conversations/:id` | Xóa cuộc trò chuyện |
| 10 | GET | `/ai-assistant/conversations/:id/stats` | Thống kê cuộc trò chuyện |
| 11 | GET | `/ai-assistant/conversations/:id/export` | Xuất cuộc trò chuyện (PDF/JSON) |

**Ví dụ:**
```bash
# Bắt đầu trò chuyện AI
POST http://localhost:3000/api/v1/ai-assistant/conversations/start
Authorization: Bearer {{jwt_token}}
Content-Type: application/json

{
  "topic": "Tư vấn sức khỏe",
  "description": "Tôi cần lời khuyên về các triệu chứng"
}
```

---

### 1️⃣1️⃣ ADMIN (Phase 1) - Admin Control (14 endpoints)

**Yêu cầu:** ADMIN role

| # | Method | Endpoint | Mô Tả |
|---|--------|----------|-------|
| 1 | GET | `/admin/doctors/pending` | Danh sách bác sĩ chờ xác minh |
| 2 | POST | `/admin/doctors/:id/verify` | Xác minh bác sĩ |
| 3 | POST | `/admin/doctors/:id/reject` | Từ chối bác sĩ |
| 4 | POST | `/admin/users/:id/lock` | Khóa tài khoản |
| 5 | POST | `/admin/users/:id/unlock` | Mở khóa tài khoản |
| 6 | POST | `/admin/violations` | Tạo vi phạm |
| 7 | GET | `/admin/violations?page=1&limit=10` | Danh sách vi phạm |
| 8 | GET | `/admin/violations/:id` | Chi tiết vi phạm |
| 9 | PATCH | `/admin/violations/:id/note` | Thêm ghi chú |
| 10 | PATCH | `/admin/violations/:id/resolve` | Giải quyết vi phạm |
| 11 | GET | `/admin/sessions?page=1&limit=20` | Xem tất cả phiên |
| 12 | GET | `/admin/statistics` | Thống kê hệ thống |
| 13 | GET | `/admin/activity-logs?page=1&limit=20` | Lịch sử hoạt động |
| 14 | GET | `/admin/report/export?format=csv` | Xuất báo cáo |

**Ví dụ:**
```bash
# Xác minh bác sĩ
POST http://localhost:3000/api/v1/admin/doctors/:id/verify
Authorization: Bearer {{jwt_token}}
Content-Type: application/json

{
  "verificationNotes": "Giấy phép hợp lệ",
  "specializations": ["Nội khoa", "Tim mạch"]
}
```

---

### 1️⃣2️⃣ AI_SESSIONS - AI Session Management (8 endpoints)

| # | Method | Endpoint | Mô Tả |
|---|--------|----------|-------|
| 1 | POST | `/ai-sessions` | Tạo phiên AI |
| 2 | GET | `/ai-sessions/my-sessions?page=1&limit=10` | Phiên của tôi |
| 3 | GET | `/ai-sessions?page=1&limit=10` | Tất cả phiên |
| 4 | GET | `/ai-sessions/:id` | Chi tiết phiên |
| 5 | PATCH | `/ai-sessions/:id` | Cập nhật phiên |
| 6 | PATCH | `/ai-sessions/:id/complete` | Hoàn thành phiên |
| 7 | PATCH | `/ai-sessions/:id/archive` | Lưu trữ phiên |
| 8 | DELETE | `/ai-sessions/:id` | Xóa phiên |

---

### 1️⃣3️⃣ AI_MESSAGES - AI Message Management (9 endpoints)

| # | Method | Endpoint | Mô Tả |
|---|--------|----------|-------|
| 1 | POST | `/ai-messages` | Tạo tin nhắn AI |
| 2 | GET | `/ai-messages/session/:sessionId?page=1&limit=20` | Tin nhắn trong phiên |
| 3 | GET | `/ai-messages/my-messages?page=1&limit=10` | Tin nhắn của tôi |
| 4 | GET | `/ai-messages?page=1&limit=10` | Tất cả tin nhắn |
| 5 | GET | `/ai-messages/:id` | Chi tiết tin nhắn |
| 6 | PATCH | `/ai-messages/:id` | Cập nhật tin nhắn |
| 7 | PATCH | `/ai-messages/:id/feedback` | Thêm phản hồi |
| 8 | PATCH | `/ai-messages/:id/flag` | Cờ tin nhắn |
| 9 | DELETE | `/ai-messages/:id` | Xóa tin nhắn |

---

### 1️⃣4️⃣ AI_FEEDBACKS - AI Feedback Management (9 endpoints)

| # | Method | Endpoint | Mô Tả |
|---|--------|----------|-------|
| 1 | POST | `/ai-feedbacks` | Tạo phản hồi |
| 2 | GET | `/ai-feedbacks/my-feedbacks?page=1&limit=10` | Phản hồi của tôi |
| 3 | GET | `/ai-feedbacks/session/:sessionId?page=1&limit=20` | Phản hồi trong phiên |
| 4 | GET | `/ai-feedbacks/session/:sessionId/stats` | Thống kê phản hồi |
| 5 | GET | `/ai-feedbacks?page=1&limit=10` | Tất cả phản hồi |
| 6 | GET | `/ai-feedbacks/:id` | Chi tiết phản hồi |
| 7 | PATCH | `/ai-feedbacks/:id` | Cập nhật phản hồi |
| 8 | PATCH | `/ai-feedbacks/:id/helpful` | Đánh dấu hữu ích |
| 9 | PATCH | `/ai-feedbacks/:id/verify` | Xác minh phản hồi (ADMIN) |

---

### 1️⃣5️⃣ AI_DOCUMENTS - Document Management (7 endpoints)

| # | Method | Endpoint | Mô Tả |
|---|--------|----------|-------|
| 1 | POST | `/ai-documents` | Tạo tài liệu |
| 2 | GET | `/ai-documents?page=1&limit=10` | Danh sách tài liệu |
| 3 | GET | `/ai-documents/search/:query?page=1&limit=10` | Tìm kiếm tài liệu |
| 4 | GET | `/ai-documents/:id` | Chi tiết tài liệu |
| 5 | PATCH | `/ai-documents/:id` | Cập nhật tài liệu |
| 6 | PATCH | `/ai-documents/:id/index` | Đánh chỉ mục tài liệu |
| 7 | DELETE | `/ai-documents/:id` | Xóa tài liệu |

---

### 1️⃣6️⃣ AI_DOCUMENT_CHUNKS - RAG Chunks (8 endpoints)

| # | Method | Endpoint | Mô Tả |
|---|--------|----------|-------|
| 1 | POST | `/ai-document-chunks` | Tạo chunk |
| 2 | POST | `/ai-document-chunks/batch` | Tạo nhiều chunks |
| 3 | GET | `/ai-document-chunks/document/:documentId?page=1&limit=20` | Chunks của tài liệu |
| 4 | GET | `/ai-document-chunks/search/:query?page=1&limit=10` | Tìm kiếm chunks |
| 5 | GET | `/ai-document-chunks?page=1&limit=10` | Tất cả chunks |
| 6 | GET | `/ai-document-chunks/:id` | Chi tiết chunk |
| 7 | PATCH | `/ai-document-chunks/:id` | Cập nhật chunk |
| 8 | DELETE | `/ai-document-chunks/:id` | Xóa chunk |

---

### 1️⃣7️⃣ BLACKLIST_KEYWORDS - Content Filtering (7 endpoints)

| # | Method | Endpoint | Mô Tả |
|---|--------|----------|-------|
| 1 | POST | `/blacklist-keywords` | Tạo từ khóa |
| 2 | GET | `/blacklist-keywords?page=1&limit=10` | Danh sách từ khóa |
| 3 | POST | `/blacklist-keywords/check` | Kiểm tra nội dung |
| 4 | GET | `/blacklist-keywords/:id` | Chi tiết từ khóa |
| 5 | PATCH | `/blacklist-keywords/:id` | Cập nhật từ khóa |
| 6 | PATCH | `/blacklist-keywords/:id/deactivate` | Vô hiệu hóa từ khóa |
| 7 | DELETE | `/blacklist-keywords/:id` | Xóa từ khóa |

---

### 1️⃣8️⃣ AI_HEALTH_INSIGHTS - Health Insights (12 endpoints)

| # | Method | Endpoint | Mô Tả |
|---|--------|----------|-------|
| 1 | POST | `/ai-health-insights` | Tạo insight sức khỏe |
| 2 | GET | `/ai-health-insights/my-insights?page=1&limit=10` | Insights của tôi |
| 3 | GET | `/ai-health-insights/pending-notifications` | Insights chưa thông báo |
| 4 | GET | `/ai-health-insights/by-type/trend?page=1&limit=10` | Insights theo loại |
| 5 | GET | `/ai-health-insights/by-confidence/high?page=1&limit=10` | Insights theo độ tin cậy |
| 6 | GET | `/ai-health-insights/stats` | Thống kê insights |
| 7 | GET | `/ai-health-insights?page=1&limit=10` | Tất cả insights |
| 8 | GET | `/ai-health-insights/:id` | Chi tiết insight |
| 9 | PATCH | `/ai-health-insights/:id` | Cập nhật insight |
| 10 | PATCH | `/ai-health-insights/:id/acknowledge` | Xác nhận insight |
| 11 | PATCH | `/ai-health-insights/:id/notify` | Đánh dấu đã thông báo |
| 12 | DELETE | `/ai-health-insights/:id` | Xóa insight |

---

## 🚀 Hướng Dẫn Sử Dụng Từng Module

### Module AUTH
**Quy trình:**
1. `Register` → Tạo tài khoản mới
2. `Login` → Nhận JWT token
3. `Get Current User` → Xác minh token hoạt động
4. `Change Password` → Đổi mật khẩu
5. `Logout` → Đăng xuất

**Best Practice:**
- Luôn lưu JWT token sau khi login
- Refresh token trước khi hết hạn
- Đổi mật khẩu định kỳ

---

### Module PATIENTS
**Quy trình:**
1. Phải đăng nhập trước (AUTH)
2. `Create Patient Profile` → Tạo hồ sơ
3. `Get Patient Profile` → Xem hồ sơ
4. `Update Patient Profile` → Cập nhật
5. `Delete Patient Profile` → Xóa khi cần

**Dữ liệu ví dụ:**
```json
{
  "fullName": "Nguyễn Văn A",
  "dateOfBirth": "1990-01-15",
  "gender": "male",
  "bloodType": "O+",
  "allergies": ["Penicillin", "Aspirin"],
  "medicalHistory": "Huyết áp cao, Béo phì"
}
```

---

### Module SESSIONS
**Quy trình cuộc hẹn:**
1. `Create Session` → Bác sĩ/Bệnh nhân tạo cuộc hẹn
2. `Get Upcoming Sessions` → Xem hẹn sắp tới
3. `Start Session` → Bắt đầu (PATCH)
4. `Complete Session` → Hoàn thành (PATCH)
5. `Cancel Session` → Hủy nếu cần

**Statuses:**
- `pending` - Chờ xác nhận
- `confirmed` - Đã xác nhận
- `active` - Đang diễn ra
- `completed` - Hoàn thành
- `cancelled` - Hủy bỏ
- `missed` - Vắng mặt

---

### Module REVIEWS
**Quy trình:**
1. Hoàn thành cuộc hẹn (SESSIONS)
2. `Create Review` → Viết đánh giá
3. `Get Doctor Rating` → Xem điểm trung bình
4. `Get Reviews by Doctor` → Xem tất cả đánh giá

**Rating Scale:** 1-5 sao

---

### Module CHAT
**Quy trình:**
1. Biết ID của người cần chat
2. `Send Message` → Gửi tin nhắn
3. `Get Conversation` → Xem lịch sử
4. `Mark As Read` → Đánh dấu đã đọc

**Tính năng:**
- Real-time messaging
- Ghi lại lịch sử
- Đánh dấu đã/chưa đọc

---

### Module AI-ASSISTANT
**Quy trình:**
1. `Start Conversation` → Bắt đầu cuộc trò chuyện
2. `Send Message to AI` → Gửi câu hỏi
3. `Rate Conversation` → Đánh giá trả lời
4. `Export Conversation` → Xuất kết quả

**Tính năng:**
- Tư vấn sức khỏe tự động
- Lưu lịch sử hội thoại
- Xuất báo cáo

---

### Module ADMIN
**Yêu cầu:** ADMIN role

**Quy trình quản lý bác sĩ:**
1. `Get Pending Doctors` → Xem danh sách chờ
2. `Verify Doctor` → Phê duyệt hoặc
3. `Reject Doctor` → Từ chối

**Quản lý vi phạm:**
1. `Create Violation` → Ghi nhận vi phạm
2. `Add Violation Note` → Thêm ghi chú
3. `Resolve Violation` → Giải quyết

**Khóa tài khoản:**
1. `Lock User Account` → Khóa
2. `Unlock User Account` → Mở khóa

---

## 💡 Các Trường Hợp Kiểm Thử Phổ Biến

### 1️⃣ Quy Trình Đầu Tiên Của Bệnh Nhân

```
1. Register (AUTH)
   POST /auth/register
   {
     "email": "patient@example.com",
     "password": "Password123!",
     "name": "Bệnh Nhân A",
     "role": "patient"
   }

2. Login (AUTH)
   POST /auth/login
   {
     "email": "patient@example.com",
     "password": "Password123!"
   }
   → Lưu {{jwt_token}}

3. Create Patient Profile (PATIENTS)
   POST /patients
   {
     "fullName": "Bệnh Nhân A",
     "dateOfBirth": "1990-01-15",
     "gender": "male",
     "bloodType": "O",
     "allergies": []
   }

4. Browse Doctors (USERS)
   GET /users/doctors?verified=true

5. Create Session (SESSIONS)
   POST /sessions
   {
     "doctorId": "doctor_id",
     "scheduledTime": "2026-03-20T10:00:00Z",
     "reason": "Khám bệnh"
   }
```

---

### 2️⃣ Quy Trình Bác Sĩ Xác Minh

```
1. Register as Doctor (AUTH)
2. Login (AUTH)
3. Update Profile (USERS)
4. Wait for Admin to Verify (ADMIN)
5. Get Doctors List (USERS)
6. View Pending Sessions (SESSIONS)
7. Complete Session (SESSIONS)
```

---

### 3️⃣ Quy Trình Ghi Nhận Chỉ Số Sức Khỏe

```
1. Create Health Metric (HEALTH-METRICS)
   POST /health-metrics
   {
     "metricType": "blood_pressure",
     "value": 120,
     "unit": "mmHg"
   }

2. Get Statistics (HEALTH-METRICS)
   GET /health-metrics/statistics/blood_pressure

3. Check Alerts (HEALTH-METRICS)
   GET /health-metrics/alerts

4. AI Analyzes & Creates Insight (AI_HEALTH_INSIGHTS)
   Auto-generated by system

5. View Insights (AI_HEALTH_INSIGHTS)
   GET /ai-health-insights/my-insights
```

---

### 4️⃣ Quy Trình Chat Giữa Người Dùng

```
1. User A Login (AUTH)
2. User B Login (AUTH)

3. User A Sends Message (CHAT)
   POST /chat/send
   {
     "receiverId": "user_b_id",
     "content": "Hello!",
     "messageType": "text"
   }

4. User B Gets Conversation (CHAT)
   GET /chat/conversation/user_a_id

5. User B Sends Reply (CHAT)
   POST /chat/send
   {
     "receiverId": "user_a_id",
     "content": "Hi there!"
   }

6. Mark As Read (CHAT)
   PATCH /chat/messages/:id/read
```

---

### 5️⃣ Quy Trình AI Consultation

```
1. User Login (AUTH)

2. Start AI Conversation (AI-ASSISTANT)
   POST /ai-assistant/conversations/start
   {
     "topic": "Tư vấn sức khỏe",
     "description": "Tôi bị ho kéo dài"
   }

3. Send Message to AI (AI-ASSISTANT)
   POST /ai-assistant/conversations/:id/message
   {
     "content": "Tôi bị ho hơn 2 tuần..."
   }

4. AI Analyzes & Responds (Auto)

5. Rate Conversation (AI-ASSISTANT)
   PATCH /ai-assistant/conversations/:id/rate
   {
     "rating": 4,
     "feedback": "Lời khuyên tốt"
   }

6. Export Conversation (AI-ASSISTANT)
   GET /ai-assistant/conversations/:id/export
```

---

## ⚠️ Xử Lý Lỗi

### Lỗi Phổ Biến

| Code | Meaning | Giải Pháp |
|------|---------|----------|
| 400 | Bad Request | Kiểm tra request body |
| 401 | Unauthorized | Token hết hạn, login lại |
| 403 | Forbidden | Không có quyền, kiểm tra role |
| 404 | Not Found | ID không đúng |
| 409 | Conflict | Dữ liệu trùng lặp |
| 500 | Server Error | Liên hệ support |

### Xử Lý Token Hết Hạn

```javascript
// Postman Tests Script
if (pm.response.code === 401) {
  console.log("Token expired, refreshing...");
  
  // Send refresh request
  pm.sendRequest({
    url: pm.environment.get("base_url") + "/auth/refresh",
    method: "POST",
    header: {
      "Authorization": "Bearer " + pm.environment.get("jwt_token")
    }
  }, (err, response) => {
    if (!err) {
      var jsonData = response.json();
      pm.environment.set("jwt_token", jsonData.access_token);
    }
  });
}
```

---

## 🔒 Bảo Mật & Best Practices

### 1️⃣ JWT Token Management
- ✅ Không bao giờ commit token vào version control
- ✅ Lưu token trong Postman Environment
- ✅ Refresh token trước khi hết hạn
- ✅ Logout khi hoàn thành

### 2️⃣ Request Security
- ✅ Luôn sử dụng HTTPS (trừ localhost)
- ✅ Validate input data
- ✅ Không gửi sensitive data trong URL
- ✅ Sử dụng POST/PATCH/DELETE cho thay đổi dữ liệu

### 3️⃣ Role-Based Access
```
PATIENT:
- Tạo & xem profile
- Đặt cuộc hẹn
- Chat & review
- Ghi nhận chỉ số sức khỏe

DOCTOR:
- Xem bệnh nhân
- Hoàn thành cuộc hẹn
- Nhận tin nhắn

ADMIN:
- Quản lý tất cả
- Xác minh bác sĩ
- Quản lý vi phạm
```

### 4️⃣ Testing Best Practices
- ✅ Test trên environment nhỏ trước
- ✅ Kiểm tra mọi status code
- ✅ Validate response data
- ✅ Test error scenarios
- ✅ Sử dụng meaningful test data

### 5️⃣ API Rate Limiting
- ⚠️ Không spam requests
- ✅ Implement exponential backoff
- ✅ Cache responses khi có thể

---

## 📝 Tips & Tricks

### Postman Tips

**1. Pre-request Script (Tự động setup dữ liệu)**
```javascript
// Thêm timestamp vào request
pm.environment.set("timestamp", new Date().toISOString());
```

**2. Test Script (Tự động kiểm tra)**
```javascript
// Kiểm tra status 200
pm.test("Status is 200", function () {
  pm.response.to.have.status(200);
});

// Kiểm tra field tồn tại
pm.test("User ID exists", function () {
  var jsonData = pm.response.json();
  pm.expect(jsonData).to.have.property('id');
});
```

**3. Collection Variables**
- Lưu ObjectID từ previous request
- Tái sử dụng trong request tiếp theo
- Tự động cleanup test data

### API Tips

**1. Pagination Parameters**
```
?page=1&limit=10
- page: trang bắt đầu từ 1
- limit: số item trên 1 trang
```

**2. Filter Examples**
```
GET /users/doctors?verified=true&page=1&limit=10
GET /sessions?status=upcoming&page=1&limit=20
GET /health-metrics?metricType=blood_pressure&page=1&limit=50
```

**3. Search**
```
GET /ai-documents/search/medical?page=1&limit=10
GET /ai-document-chunks/search/diabetes?page=1&limit=20
```

---

## 🆘 Support & Debugging

### Debug Workflow

1. **Kiểm tra Request**
   - Đúng method? (GET, POST, PATCH, DELETE)
   - Đúng URL?
   - Headers đầy đủ?

2. **Kiểm tra Authentication**
   - Token còn hợp lệ?
   - Role có quyền truy cập?
   - Headers có "Authorization: Bearer {{jwt_token}}"?

3. **Kiểm tra Body**
   - JSON format đúng?
   - Trường bắt buộc có đầy đủ?
   - Kiểu dữ liệu đúng?

4. **Xem Response**
   - Status code?
   - Error message?
   - Response body?

### Log Network
```javascript
// Tests Script - In ra response
console.log(JSON.stringify(pm.response.json(), null, 2));
```

---

## 📊 Example Responses

### Success Response (200)
```json
{
  "statusCode": 200,
  "message": "OK",
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

### Error Response (400)
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": {
    "email": "Email is required"
  }
}
```

### Paginated Response
```json
{
  "statusCode": 200,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 150,
      "pages": 15
    }
  }
}
```

---

## 🎓 Học Tập Thêm

1. **REST API Best Practices** - [RESTful API Design](https://restfulapi.net/)
2. **Postman Learning** - [Postman Documentation](https://learning.postman.com/)
3. **JWT Token** - [JWT Introduction](https://jwt.io/)
4. **HTTP Status Codes** - [HTTP Status Reference](https://httpwg.org/specs/rfc7231.html#status.codes)

---

## 📞 Liên Hệ & Hỗ Trợ

- **API Base URL:** `http://localhost:3000/api/v1`
- **Documentation:** Xem [Swagger API Docs](http://localhost:3000/api/docs)
- **GitHub:** [Healthcare-System](https://github.com/Bakaguya-sama/Healthcare-System)

---

**Last Updated:** 2026-03-17  
**Version:** 2.0.0  
**Status:** ✅ Production Ready

---

## 🎯 Checklist Trước Khi Deploy

- [ ] Tất cả endpoints đã test
- [ ] JWT token management OK
- [ ] Error handling OK
- [ ] Pagination tested
- [ ] Authentication/Authorization OK
- [ ] Role-based access OK
- [ ] Database connection OK
- [ ] API rate limiting configured
- [ ] Logging enabled
- [ ] Security headers added

---

**Chúc bạn sử dụng Healthcare System API thành công! 🚀**
