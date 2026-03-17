# 📖 Healthcare System API - Comprehensive Testing Guide

## 📋 Mục Lục
1. [Giới Thiệu](#giới-thiệu)
2. [Chuẩn Bị Môi Trường](#chuẩn-bị-môi-trường)
3. [Setup Postman](#setup-postman)
4. [Chi Tiết Từng Collection](#chi-tiết-từng-collection)
5. [Quy Trình Testing](#quy-trình-testing)
6. [Xử Lý Lỗi Thường Gặp](#xử-lý-lỗi-thường-gặp)
7. [Tips & Tricks](#tips--tricks)

---

## 🎯 Giới Thiệu

File Postman Collection **Healthcare-API.postman_collection.json** chứa:
- **12 Collections** (theo 12 module backend)
- **76 API Endpoints** (tất cả CRUD operations)
- **Toàn bộ test cases** từ authentication đến health insights
- **Environment variables** để dễ config

### Cấu Trúc Collections:
```
1. AUTH (8 endpoints)
2. USERS (6 endpoints)
3. PATIENTS (5 endpoints)
4. ADMINS (4 endpoints)
5. NOTIFICATIONS (7 endpoints)
6. AI_SESSIONS (8 endpoints)
7. AI_MESSAGES (9 endpoints)
8. AI_FEEDBACKS (9 endpoints)
9. AI_DOCUMENTS (7 endpoints)
10. AI_DOCUMENT_CHUNKS (8 endpoints)
11. BLACKLIST_KEYWORDS (7 endpoints)
12. AI_HEALTH_INSIGHTS (12 endpoints)
```

---

## 🔧 Chuẩn Bị Môi Trường

### 1. **Yêu Cầu Hệ Thống**
- Node.js v18+ 
- MongoDB chạy (local hoặc remote)
- Postman (v10+)
- npm/pnpm package manager

### 2. **Start Backend Server**
```bash
cd c:\SE121\Healthcare-System\apps\api
pnpm install
pnpm start:dev
```

Kết quả mong đợi:
```
[Nest] 12345  - 03/17/2025, 10:30:00 AM     LOG [NestFactory] Starting Nest application...
...
[Nest] 12345  - 03/17/2025, 10:30:05 AM     LOG [RoutesResolver] AuthController {/api/v1/auth}
[Nest] 12345  - 03/17/2025, 10:30:05 AM     LOG [RoutesResolver] UsersController {/api/v1/users}
[Nest] 12345  - 03/17/2025, 10:30:05 AM     LOG Listening on port 3000
```

### 3. **Kiểm Tra Server Sống**
```bash
curl http://localhost:3000/api/v1/health
```

---

## 📮 Setup Postman

### 1. **Import Collection**
- Mở Postman
- Click **File** → **Import**
- Chọn file **Healthcare-API.postman_collection.json**
- Collection sẽ xuất hiện trong sidebar

### 2. **Configure Environment Variables**
Các biến cần set:
```
base_url = localhost:3000/api/v1
jwt_token = (sẽ lấy từ Login endpoint)
user_id = (sẽ lấy từ Create User)
session_id = (sẽ lấy từ Create Session)
document_id = (sẽ lấy từ Create Document)
```

**Cách set:**
- Click icon variable (gear icon) góc phải trên
- Tab **Variables** → Chỉnh sửa từng biến
- Hoặc auto-set bằng script (xem bên dưới)

### 3. **Setup Auto-Extract Variables**
Để tự động lấy JWT token từ response, thêm vào tab **Tests** của endpoint Login:

```javascript
// Lấy token từ response
if (pm.response.code === 200) {
    const jsonData = pm.response.json();
    pm.environment.set("jwt_token", jsonData.data.access_token);
    pm.environment.set("user_id", jsonData.data.user._id);
    console.log("✓ Token saved:", jsonData.data.access_token.substring(0, 20) + "...");
}
```

---

## 🔍 Chi Tiết Từng Collection

### **1️⃣ AUTH Module (8 endpoints)**

#### 📍 Thứ tự Test Khuyến Nghị:
```
Register → Login → Get Current User → Change Password
         → Refresh Token
         → Logout
         → Forgot Password → Confirm OTP
```

#### 🔑 Endpoints:

| Endpoint | Method | Mô Tả | Role | Auth |
|----------|--------|-------|------|------|
| `/auth/register` | POST | Tạo account mới | All | ❌ |
| `/auth/login` | POST | Đăng nhập | All | ❌ |
| `/auth/me` | GET | Lấy thông tin user hiện tại | All | ✅ |
| `/auth/refresh` | POST | Refresh JWT token | All | ✅ |
| `/auth/logout` | POST | Đăng xuất | All | ✅ |
| `/auth/change-password` | POST | Đổi password | All | ✅ |
| `/auth/forgot-password` | POST | Quên password | All | ❌ |
| `/auth/confirm-otp` | POST | Xác nhận OTP reset | All | ❌ |

#### 📝 Test Case Chi Tiết:

**Case 1: Register User**
```
POST /auth/register
Body:
{
  "email": "patient@test.com",
  "password": "Password123!",
  "name": "Test Patient",
  "role": "patient"
}

Expected Response (201):
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "patient@test.com",
    "name": "Test Patient",
    "role": "patient"
  }
}
```

**Case 2: Login**
```
POST /auth/login
Body:
{
  "email": "patient@test.com",
  "password": "Password123!"
}

Expected Response (200):
{
  "success": true,
  "message": "Login successful",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "email": "patient@test.com",
      "name": "Test Patient",
      "role": "patient"
    }
  }
}
```

**⚠️ Important**: Copy `access_token` vào biến `{{jwt_token}}`

---

### **2️⃣ USERS Module (6 endpoints)**

#### Thứ tự Test:
```
Get My Profile → Get All Users (Admin) → Get User By ID → Update Profile → Delete User
```

#### 📝 Test Case:

**Case: Update Profile**
```
PATCH /users/me
Auth: Bearer {{jwt_token}}

Body:
{
  "name": "Updated Name",
  "phoneNumber": "0987654321",
  "address": {
    "street": "123 Main St",
    "city": "Ho Chi Minh",
    "country": "Vietnam"
  }
}

Expected (200):
{
  "success": true,
  "message": "Profile updated successfully",
  "data": { ... }
}
```

---

### **3️⃣ PATIENTS Module (5 endpoints)**

#### Test Flow:
```
Create Patient → Get Profile → Update Profile → Delete Profile
```

#### Key Points:
- **Chỉ PATIENT role mới có thể tạo profile riêng**
- Mỗi patient 1-1 với 1 user
- Có tracking session stats

#### 📝 Example:
```
POST /patients
Body:
{
  "userId": "{{user_id}}",
  "fullName": "John Doe",
  "dateOfBirth": "1990-01-15",
  "gender": "male",
  "bloodType": "O",
  "allergies": ["Penicillin"],
  "medicalHistory": "Hypertension"
}

Expected (201): Patient object with sessionStats
```

---

### **4️⃣ ADMINS Module (4 endpoints)**

#### Role-Based:
- **SUPER_ADMIN**: Tạo, sửa, xóa admin
- **USER_MANAGER**: Quản lý user
- **AI_MANAGER**: Quản lý AI modules

#### Admin Roles:
```typescript
"super_admin" | "user_manager" | "ai_manager"
```

#### 📝 Test:
```
POST /admins (SUPER_ADMIN ONLY)
Body:
{
  "userId": "{{user_id}}",
  "fullName": "Admin User",
  "adminRole": "user_manager",
  "department": "User Management",
  "permissions": ["verify_doctors", "lock_users"],
  "isActive": true
}
```

---

### **5️⃣ NOTIFICATIONS Module (7 endpoints)**

#### Notification Types:
```
SESSION_REMINDER | APPOINTMENT_CONFIRMED | HEALTH_ALERT
ACHIEVEMENT_UNLOCKED | SYSTEM_UPDATE | FEEDBACK_REQUEST | GENERAL
```

#### Auto Features:
- **TTL Index**: Tự delete sau 24h (mặc định)
- **Auto Mark Read**: Khi GET detail, tự mark = read
- **Unread Count**: Endpoint riêng để lấy số unread

#### 📝 Test:
```
POST /notifications
Body:
{
  "userId": "{{user_id}}",
  "type": "SESSION_REMINDER",
  "title": "Upcoming Session",
  "message": "Your appointment is in 1 hour",
  "data": {
    "sessionId": "123",
    "doctorName": "Dr. Smith"
  }
}

GET /notifications/unread/count
Response: { "unreadCount": 5 }
```

---

### **6️⃣ AI_SESSIONS Module (8 endpoints)**

#### Session Lifecycle:
```
CREATE (active) → UPDATE info → COMPLETE (completed) → ARCHIVE (archived)
```

#### Session Status:
```
"active" | "completed" | "archived"
```

#### 📝 Test Flow:
```
1. POST /ai-sessions
   {
     "userId": "{{user_id}}",
     "sessionType": "consultation",
     "topic": "General health checkup"
   }
   → Save session _id

2. GET /ai-sessions/my-sessions
   → Verify session created

3. PATCH /ai-sessions/:id/complete
   {
     "keyFindings": "Patient shows symptoms",
     "recommendations": "See doctor"
   }

4. PATCH /ai-sessions/:id/archive
   → Move to archived
```

---

### **7️⃣ AI_MESSAGES Module (9 endpoints)**

#### Message Roles:
```
"user" | "assistant" | "system"
```

#### Key Operations:
- **Add Feedback**: Rate message từ 1-5 stars
- **Flag Message**: Report inappropriate content
- **Search by Session**: Lấy conversation history

#### 📝 Test:
```
POST /ai-messages
Body:
{
  "sessionId": "{{session_id}}",
  "role": "user",
  "content": "I have a headache for 3 days",
  "tokenCount": 8
}

PATCH /ai-messages/:id/feedback
Body:
{
  "feedbackType": "helpful",
  "rating": 5,
  "feedbackText": "Very helpful advice"
}
```

---

### **8️⃣ AI_FEEDBACKS Module (9 endpoints)**

#### Feedback Types:
```
"bug_report" | "suggestion" | "compliment" | "other"
```

#### Rating System:
- **1-5 Stars**: Đánh giá chất lượng
- **Verified**: Admin verify feedback
- **Helpful Count**: Track bao nhiêu người thấy helpful

#### 📝 Test:
```
POST /ai-feedbacks
Body:
{
  "sessionId": "{{session_id}}",
  "userId": "{{user_id}}",
  "feedbackType": "suggestion",
  "rating": 4,
  "text": "Need more details on medication"
}

PATCH /ai-feedbacks/:id/helpful
→ Increment helpful count

GET /ai-feedbacks/session/:sessionId/stats
→ Lấy average rating, total count, etc.
```

---

### **9️⃣ AI_DOCUMENTS Module (7 endpoints)**

#### Document Status Workflow:
```
draft → indexed → archived
```

#### Document Types:
```
"guideline" | "research_paper" | "medical_case" 
"faq" | "protocol" | "other"
```

#### 📝 Test:
```
1. POST /ai-documents
   {
     "title": "Medical Guidelines 2024",
     "documentType": "guideline",
     "fileUrl": "...",
     "status": "draft"
   }

2. PATCH /ai-documents/:id/index
   → Update status to "indexed"

3. GET /ai-documents/search/guideline
   → Search documents by keyword
```

---

### **🔟 AI_DOCUMENT_CHUNKS Module (8 endpoints)**

#### Use Case:
- **RAG (Retrieval Augmented Generation)**
- Split documents thành chunks nhỏ
- Vector embeddings cho similarity search

#### 📝 Test:
```
1. POST /ai-document-chunks/batch
   [
     {
       "documentId": "{{document_id}}",
       "content": "Chunk 1 content",
       "chunkIndex": 1,
       "tokenCount": 5,
       "embedding": [0.1, 0.2, 0.3]
     },
     ...
   ]

2. GET /ai-document-chunks/document/:documentId
   → Lấy tất cả chunks của document

3. GET /ai-document-chunks/search/heart%20disease
   → Full-text search chunks
```

---

### **1️⃣1️⃣ BLACKLIST_KEYWORDS Module (7 endpoints)**

#### Content Filtering:
- **Regex Pattern**: Flexible matching
- **Severity Level**: low, medium, high, critical
- **Category**: inappropriate, spam, harmful, etc.

#### 📝 Test:
```
POST /blacklist-keywords
Body:
{
  "keyword": "badword",
  "pattern": "^(badword|variant)$",
  "category": "inappropriate",
  "severity": "high",
  "isActive": true
}

POST /blacklist-keywords/check
Body:
{
  "content": "Some text with badword here"
}

Response:
{
  "isClean": false,
  "violations": [
    {
      "keyword": "badword",
      "severity": "high",
      "category": "inappropriate"
    }
  ]
}
```

---

### **1️⃣2️⃣ AI_HEALTH_INSIGHTS Module (12 endpoints)**

#### Insight Types:
```
"trend" | "anomaly" | "prediction" | "recommendation" 
| "alert" | "correlation"
```

#### Confidence Levels:
```
"low" | "medium" | "high" | "very_high"
```

#### 📝 Complete Test Flow:

**Step 1: Create Insight**
```
POST /ai-health-insights
Body:
{
  "userId": "{{user_id}}",
  "insightType": "trend",
  "metricType": "heart_rate",
  "title": "Elevated Heart Rate Trend",
  "description": "Your heart rate is elevated",
  "analysisData": {
    "averageHR": 85,
    "trend": "increasing"
  },
  "confidenceLevel": "high",
  "recommendedAction": "Consult with doctor",
  "periodStart": "2024-03-10",
  "periodEnd": "2024-03-17"
}
```

**Step 2: Get My Insights**
```
GET /ai-health-insights/my-insights?page=1&limit=10
```

**Step 3: Get Pending Notifications**
```
GET /ai-health-insights/pending-notifications
→ Insights chưa được thông báo cho user
```

**Step 4: Search by Type**
```
GET /ai-health-insights/by-type/trend?page=1&limit=10
```

**Step 5: Get Statistics**
```
GET /ai-health-insights/stats
→ Count by type, confidence level, etc.
```

**Step 6: Acknowledge Insight**
```
PATCH /ai-health-insights/:id/acknowledge
→ Mark as viewed by user
```

**Step 7: Mark As Notified**
```
PATCH /ai-health-insights/:id/notify
→ Admin marks as notified
```

---

## 🧪 Quy Trình Testing

### **Plan A: Quy Trình Linear (Khuyến Nghị Cho Người Mới)**

#### Ngày 1: Core Modules
```
1. AUTH
   ✓ Register patient/doctor/admin
   ✓ Login tất cả roles
   ✓ Get Current User
   ✓ Change Password
   ✓ Logout

2. USERS
   ✓ Get Profile
   ✓ Update Profile
   ✓ Get All Users (ADMIN)

3. NOTIFICATIONS
   ✓ Create notification
   ✓ Get unread count
   ✓ Mark all as read
```

#### Ngày 2: Business Logic
```
1. PATIENTS
   ✓ Create patient profile
   ✓ Get my profile
   ✓ Update profile

2. ADMINS
   ✓ Create admin (SUPER_ADMIN)
   ✓ Get all admins
   ✓ Update admin
```

#### Ngày 3: AI Sessions
```
1. AI_SESSIONS
   ✓ Create session
   ✓ Get my sessions
   ✓ Complete session
   ✓ Archive session

2. AI_MESSAGES
   ✓ Create message in session
   ✓ Get messages by session
   ✓ Add feedback
   ✓ Flag message

3. AI_FEEDBACKS
   ✓ Create feedback
   ✓ Get session stats
   ✓ Verify feedback (ADMIN)
```

#### Ngày 4: Knowledge Base
```
1. AI_DOCUMENTS
   ✓ Create document (ADMIN)
   ✓ Index document
   ✓ Search documents

2. AI_DOCUMENT_CHUNKS
   ✓ Batch create chunks
   ✓ Search chunks

3. BLACKLIST_KEYWORDS
   ✓ Create keyword (ADMIN)
   ✓ Check content against blacklist
```

#### Ngày 5: Health Insights
```
1. AI_HEALTH_INSIGHTS
   ✓ Create insight (DOCTOR/ADMIN)
   ✓ Get my insights
   ✓ Get pending notifications
   ✓ Search by type/confidence
   ✓ Acknowledge insight
   ✓ Statistics
```

---

### **Plan B: Quy Trình Role-Based (Cho Tester Nâng Cao)**

#### Test as PATIENT Role
```
1. Auth
   - Register as patient
   - Login
   
2. Profile
   - Create/Update patient profile
   - Get notifications
   
3. AI Sessions
   - Create consultation session
   - Send messages to AI
   - Rate AI responses
   - View health insights

4. Health Data
   - View personal health insights
   - View trends and recommendations
```

#### Test as DOCTOR Role
```
1. Auth
   - Login as doctor
   
2. View Data
   - Get all patients (if permission)
   - View patient health insights
   - View AI analysis
   
3. AI Management
   - Create health insights for patients
   - Review AI session quality
```

#### Test as ADMIN Role
```
1. Auth
   - Login as super_admin
   
2. User Management
   - Get all users
   - View all patients
   - Create/manage admins
   
3. Content Management
   - Upload knowledge base documents
   - Index documents
   - Manage blacklist keywords
   
4. System Admin
   - Monitor all sessions
   - View all feedbacks
   - Verify system feedback
   - View system statistics
```

---

### **Plan C: Automated Testing**

Tạo folder `tests` với test scripts:

#### 1. **Basic Smoke Test**
```javascript
// tests/smoke.test.js
describe('Smoke Tests', () => {
  it('should register user', () => {
    // Register test
  });
  
  it('should login user', () => {
    // Login test
  });
  
  it('should get current user', () => {
    // Get user test
  });
});
```

#### 2. **Run từ Postman**
- Tab **Tests** mỗi request
- Viết assertions với `pm.test()`
- Run collection → View results

---

## ❌ Xử Lý Lỗi Thường Gặp

### **Error 1: 401 Unauthorized**
```
Nguyên nhân: JWT token hết hạn hoặc sai
Giải pháp:
1. Login lại để lấy token mới
2. Copy token vào {{jwt_token}}
3. Hoặc dùng Refresh Token endpoint
```

### **Error 2: 403 Forbidden**
```
Nguyên nhân: User không có quyền truy cập endpoint này
Giải pháp:
1. Check endpoint yêu cầu role nào
2. Login bằng account có role thích hợp
3. Ví dụ: ADMIN endpoints cần ADMIN role
```

### **Error 3: 404 Not Found**
```
Nguyên nhân: Resource không tồn tại
Giải pháp:
1. Verify :id parameter đúng
2. Verify resource đã được tạo
3. Check :id format (ObjectId - 24 chars hex)
```

### **Error 4: 400 Bad Request**
```
Nguyên nhân: Payload/query params sai format
Giải pháp:
1. Check required fields (marked with *)
2. Verify enum values (chỉ dùng allowed values)
3. Validate date format: YYYY-MM-DD
4. Validate email format: user@example.com
```

### **Error 5: 409 Conflict**
```
Nguyên nhân: Duplicate unique field (e.g., email)
Giải pháp:
1. Dùng email mới chưa được register
2. Hoặc delete user cũ trước
```

### **Error 6: 500 Internal Server Error**
```
Nguyên nhân: Server error
Giải pháp:
1. Check server logs: pnpm start:dev console
2. Restart server
3. Verify MongoDB connection
4. Check .env file config
```

---

## 💡 Tips & Tricks

### **Tip 1: Quick JWT Token Extract**
```bash
# Sau khi login, copy response token
# Linux/Mac:
export JWT_TOKEN=$(curl -s http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test123!"}' | jq -r '.data.access_token')

# Dùng: curl -H "Authorization: Bearer $JWT_TOKEN"
```

### **Tip 2: Postman Collection Runner**
```
1. Click Collections tab
2. Right-click Healthcare-API collection
3. Run Collection
4. Set requests to run sequentially
5. View results in real-time
```

### **Tip 3: Save Responses as Examples**
```
1. Send request
2. Right-click response
3. Save as example
4. Dùng cho documentation
```

### **Tip 4: Pre-request Script Template**
```javascript
// Generate random email
const randomEmail = `test${Date.now()}@example.com`;
pm.environment.set("random_email", randomEmail);

// Generate ObjectId-like string
const objectId = "507f1f77bcf86cd799" + Math.floor(Math.random() * 1000000);
pm.environment.set("random_id", objectId);
```

### **Tip 5: Conditional Logic**
```javascript
// In Tests tab
if (pm.response.code === 200) {
    const data = pm.response.json();
    pm.test("Response has data", () => {
        pm.expect(data).to.have.property('data');
    });
} else {
    pm.test("Error handling", () => {
        pm.expect(pm.response.code).to.be.oneOf([400, 401, 403]);
    });
}
```

### **Tip 6: Monitor API Performance**
```javascript
// In Tests tab
const responseTime = pm.response.responseTime;
pm.test("Response time < 1s", () => {
    pm.expect(responseTime).to.be.below(1000);
});
```

---

## 📊 Testing Checklist

### **Pre-Testing Checklist**
- [ ] Server running: `pnpm start:dev`
- [ ] MongoDB connection OK
- [ ] Postman collection imported
- [ ] Environment variables set
- [ ] No API errors in console

### **AUTH Module Tests**
- [ ] Register successful
- [ ] Login returns JWT token
- [ ] Get current user with token
- [ ] Change password works
- [ ] Refresh token works
- [ ] Logout succeeds
- [ ] Invalid credentials rejected (401)
- [ ] Expired token rejected (401)

### **USER Module Tests**
- [ ] Get my profile works
- [ ] Update profile updates data
- [ ] Get all users (ADMIN only)
- [ ] Get user by ID works
- [ ] Delete user removes data
- [ ] Non-admin can't get all users (403)

### **PATIENT Module Tests**
- [ ] Create patient profile
- [ ] Get patient profile
- [ ] Update patient info
- [ ] Delete patient profile
- [ ] Session stats tracked

### **NOTIFICATION Module Tests**
- [ ] Create notification
- [ ] List notifications (paginated)
- [ ] Get notification detail (auto-marks read)
- [ ] Update notification status
- [ ] Mark all as read
- [ ] Unread count accurate
- [ ] Delete notification

### **AI Session Tests**
- [ ] Create session (status = active)
- [ ] Get my sessions filtered
- [ ] Complete session (status = completed)
- [ ] Archive session (status = archived)
- [ ] Can't archive active session
- [ ] Delete session removes data

### **AI Message Tests**
- [ ] Create message in session
- [ ] Get messages by session (paginated)
- [ ] Add feedback to message
- [ ] Flag message for moderation
- [ ] Message history preserved

### **Health Insights Tests**
- [ ] Create insight (DOCTOR/ADMIN)
- [ ] Get my insights (PATIENT)
- [ ] Get all insights (ADMIN)
- [ ] Search by type
- [ ] Search by confidence level
- [ ] Acknowledge insight
- [ ] Statistics calculated correctly
- [ ] Notification pending count

---

## 🔐 Security Testing

### Để Test Bảo Mật:

```bash
# 1. Test Missing Auth Header
curl -X GET http://localhost:3000/api/v1/users/me
# Expected: 401 Unauthorized

# 2. Test Invalid Token
curl -X GET http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer invalid_token"
# Expected: 401 Unauthorized

# 3. Test Expired Token
# Tạo token cũ, sau 24h expired
curl -X GET http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer expired_token"
# Expected: 401 Unauthorized

# 4. Test Role-Based Access
# Login as PATIENT, try access ADMIN endpoint
curl -X GET http://localhost:3000/api/v1/admins
# Expected: 403 Forbidden

# 5. Test CSRF (nếu có)
# Send request without CSRF token
# Expected: 403 Forbidden
```

---

## 📈 Performance Testing

### Load Test Sample:
```bash
# Dùng Apache Bench
ab -n 100 -c 10 http://localhost:3000/api/v1/notifications

# Kết quả mong đợi:
# Response time < 200ms
# Error rate = 0%
# Requests per second > 50
```

---

## 📝 Test Report Template

```markdown
# Test Report - Healthcare API v1.0

## Summary
- Total Endpoints Tested: 76
- Passed: 74
- Failed: 2
- Success Rate: 97.4%

## Passed Collections
- ✅ AUTH (8/8)
- ✅ USERS (6/6)
- ✅ PATIENTS (5/5)
- ✅ ADMINS (4/4)
- ✅ NOTIFICATIONS (7/7)
- ✅ AI_SESSIONS (8/8)
- ✅ AI_MESSAGES (9/9)
- ✅ AI_FEEDBACKS (9/9)
- ✅ AI_DOCUMENTS (7/7)
- ✅ AI_DOCUMENT_CHUNKS (8/8)
- ✅ BLACKLIST_KEYWORDS (7/7)
- ✅ AI_HEALTH_INSIGHTS (12/12)

## Failed Endpoints
1. POST /ai-documents (500 - Server Error)
2. GET /blacklist-keywords/search (400 - Bad Request)

## Issues Found
1. Document upload endpoint timeout after 30s
2. Search query not properly URL-encoded

## Recommendations
1. Implement request timeout handling
2. Add URL encoding middleware
3. Add rate limiting
4. Improve error messages
```

---

## 🚀 Next Steps

Sau khi test xong:
1. ✅ Verify tất cả 76 endpoints hoạt động
2. ✅ Check error handling
3. ✅ Test role-based access control
4. ✅ Performance testing
5. ✅ Security testing
6. 📝 Document bất kỳ issues tìm được
7. 🔄 Fix issues
8. ✅ Re-test
9. 📊 Generate test report
10. 🚀 Deploy to production

---

## 📞 Support & Debugging

### Khi gặp vấn đề:

**1. Check Server Logs**
```bash
# Terminal đang chạy pnpm start:dev
# Xem error message chi tiết
```

**2. Check Database**
```bash
# Dùng MongoDB Compass
# Connect: mongodb://localhost:27017
# View collections trong database
```

**3. Use Postman Console**
```bash
# Postman → View → Show Postman Console
# Xem request/response chi tiết
# Network timeline
```

**4. Enable Debug Mode**
```typescript
// Thêm vào main.ts
app.useLogger(new Logger());
app.enable('trust proxy');
```

---

## 📚 Tài Liệu Tham Khảo

- Postman Docs: https://learning.postman.com/
- NestJS Docs: https://docs.nestjs.com/
- MongoDB Docs: https://docs.mongodb.com/
- JWT Info: https://jwt.io/
- REST API Best Practices: https://restfulapi.net/

---

**✨ Chúc bạn test API thành công!**

Nếu có bất kỳ câu hỏi, vui lòng kiểm tra phần "Xử Lý Lỗi Thường Gặp" hoặc liên hệ team development.
