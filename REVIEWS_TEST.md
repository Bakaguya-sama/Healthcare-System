# ⭐ **REVIEWS API - HƯỚNG DẪN TEST**

## 🚀 **Chuẩn Bị**

**Điều kiện:**
- ✅ Server đang chạy: `pnpm start:dev`
- ✅ Đã đăng ký & đăng nhập với 2 role:
  - **1 Patient** (để tạo review & quản lý)
  - **1 Doctor** (để bị đánh giá)
- ✅ Có 2 tokens: `patientToken` + `doctorToken`
- ✅ Có `doctorId` & `sessionId` (từ Sessions API)
- ✅ Postman hoặc cURL sẵn sàng

---

## 🧪 **11 Endpoints - Test Từng Bước**

### **1️⃣ CREATE REVIEW (Patient tạo đánh giá)**

**Endpoint:**
```
POST /reviews
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
  "sessionId": "{{sessionId}}",
  "rating": 5,
  "comment": "Excellent doctor, very professional and caring. Highly recommended!"
}
```

**Response (201 Created):**
```json
{
  "statusCode": 201,
  "message": "Review created successfully",
  "data": {
    "_id": "65f789ghi012jkl345678901",
    "patientId": {
      "_id": "65e456def...",
      "name": "Nguyen Van Patient",
      "email": "patient@example.com",
      "avatarUrl": "https://..."
    },
    "doctorId": {
      "_id": "65e789xyz...",
      "name": "Dr. Tran Thi Doctor",
      "specialization": "Cardiology",
      "avatarUrl": "https://..."
    },
    "rating": 5,
    "comment": "Excellent doctor, very professional and caring. Highly recommended!",
    "status": "active",
    "helpfulCount": 0,
    "isVerifiedPurchase": true,
    "createdAt": "2026-03-16T20:30:00Z"
  }
}
```

⚠️ **QUAN TRỌNG:** 
- Comment phải từ 10-500 ký tự
- Rating phải 1-5
- sessionId là optional (nếu có = verified purchase)
- Mỗi patient chỉ được review 1 doctor 1 lần

✅ **Copy `_id` để dùng ở bước sau (lưu vào biến `reviewId`)**

---

### **2️⃣ GET ALL REVIEWS (Danh sách review)**

**Endpoint:**
```
GET /reviews?doctorId=&status=active&page=1&limit=10&sortBy=createdAt&sortOrder=-1
```

**Query Parameters:**
| Param | Kiểu | Required | Ví dụ |
|-------|------|----------|-------|
| `doctorId` | string | ❌ | 65e456def789abc012345678 |
| `patientId` | string | ❌ | 65e789ghi012jkl345678901 |
| `status` | enum | ❌ | active, hidden, flagged |
| `rating` | number | ❌ | 5 (lọc rating cụ thể) |
| `page` | number | ❌ | 1 (default) |
| `limit` | number | ❌ | 10 (default) |
| `sortBy` | string | ❌ | createdAt (default) |
| `sortOrder` | -1 \| 1 | ❌ | -1 (desc), 1 (asc) |

**Response (200 OK):**
```json
{
  "statusCode": 200,
  "message": "Reviews retrieved successfully",
  "data": [
    {
      "_id": "65f789ghi012jkl345678901",
      "patientId": {
        "_id": "65e456def...",
        "name": "Nguyen Van Patient",
        "avatarUrl": "https://..."
      },
      "doctorId": {
        "_id": "65e789xyz...",
        "name": "Dr. Tran Thi Doctor",
        "specialization": "Cardiology",
        "avatarUrl": "https://..."
      },
      "rating": 5,
      "comment": "Excellent doctor...",
      "status": "active",
      "helpfulCount": 3,
      "isVerifiedPurchase": true,
      "createdAt": "2026-03-16T20:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 15,
    "pages": 2
  }
}
```

---

### **3️⃣ GET DOCTOR REVIEWS (Reviews của doctor)**

**Endpoint:**
```
GET /reviews/doctor/:doctorId?page=1&limit=10
```

**Headers:**
```
Authorization: Bearer {{patientToken}}
```

**Response (200 OK):**
```json
{
  "statusCode": 200,
  "message": "Doctor reviews retrieved successfully",
  "data": [
    {
      "_id": "65f789ghi...",
      "patientId": {
        "_id": "65e456def...",
        "name": "Nguyen Van Patient",
        "avatarUrl": "https://..."
      },
      "rating": 5,
      "comment": "Excellent doctor...",
      "helpfulCount": 5,
      "createdAt": "2026-03-16T20:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 8,
    "pages": 1
  }
}
```

---

### **4️⃣ GET DOCTOR RATING STATISTICS (Điểm trung bình)**

**Endpoint:**
```
GET /reviews/doctor/:doctorId/rating
```

**Headers:**
```
Authorization: Bearer {{patientToken}}
```

**Response (200 OK):**
```json
{
  "statusCode": 200,
  "message": "Doctor rating retrieved successfully",
  "data": {
    "doctorId": "65e789xyz...",
    "averageRating": 4.7,
    "totalReviews": 15,
    "starDistribution": {
      "fiveStar": 12,
      "fourStar": 2,
      "threeStar": 1,
      "twoStar": 0,
      "oneStar": 0
    }
  }
}
```

---

### **5️⃣ GET REVIEW BY ID (Chi tiết 1 review)**

**⚠️ QUAN TRỌNG:** Thay `{{reviewId}}` bằng ID từ Endpoint 1

**Endpoint:**
```
GET /reviews/:id
```

**Headers:**
```
Authorization: Bearer {{patientToken}}
```

**Response (200 OK):**
```json
{
  "statusCode": 200,
  "message": "Review retrieved successfully",
  "data": {
    "_id": "65f789ghi012jkl345678901",
    "patientId": {
      "_id": "65e456def...",
      "name": "Nguyen Van Patient",
      "email": "patient@example.com",
      "avatarUrl": "https://..."
    },
    "doctorId": {
      "_id": "65e789xyz...",
      "name": "Dr. Tran Thi Doctor",
      "email": "doctor@example.com",
      "specialization": "Cardiology",
      "avatarUrl": "https://..."
    },
    "rating": 5,
    "comment": "Excellent doctor, very professional and caring. Highly recommended!",
    "status": "active",
    "helpfulCount": 3,
    "isVerifiedPurchase": true,
    "createdAt": "2026-03-16T20:30:00Z",
    "updatedAt": "2026-03-16T20:30:00Z"
  }
}
```

---

### **6️⃣ UPDATE REVIEW (Patient cập nhật)**

**⚠️ QUAN TRỌNG:**
- Thay `{{reviewId}}` bằng ID từ Endpoint 1
- Chỉ patient tạo review mới có thể update
- Có thể update rating hoặc comment

**Endpoint:**
```
PATCH /reviews/:id
```

**Headers:**
```
Authorization: Bearer {{patientToken}}
Content-Type: application/json
```

**Body:**
```json
{
  "rating": 4,
  "comment": "Updated comment - Still excellent service!"
}
```

**Response (200 OK):**
```json
{
  "statusCode": 200,
  "message": "Review updated successfully",
  "data": {
    "_id": "65f789ghi012jkl345678901",
    "rating": 4,
    "comment": "Updated comment - Still excellent service!"
  }
}
```

---

### **7️⃣ MARK REVIEW AS HELPFUL (Đánh dấu hữu ích)**

**⚠️ QUAN TRỌNG:**
- Bất kỳ user nào cũng có thể mark
- Mỗi user chỉ mark 1 lần
- Không thể mark cùng review nhiều lần

**Endpoint:**
```
POST /reviews/:id/helpful
```

**Headers:**
```
Authorization: Bearer {{patientToken}}
```

**Response (200 OK):**
```json
{
  "statusCode": 200,
  "message": "Review marked as helpful",
  "data": {
    "helpfulCount": 4
  }
}
```

---

### **8️⃣ UNMARK REVIEW AS HELPFUL (Bỏ đánh dấu)**

**Endpoint:**
```
DELETE /reviews/:id/helpful
```

**Headers:**
```
Authorization: Bearer {{patientToken}}
```

**Response (200 OK):**
```json
{
  "statusCode": 200,
  "message": "Review unmarked as helpful",
  "data": {
    "helpfulCount": 3
  }
}
```

---

### **9️⃣ GET TOP REVIEWED DOCTORS (Top doctors)**

**Endpoint:**
```
GET /reviews/top/doctors?limit=10
```

**Headers:**
```
Authorization: Bearer {{patientToken}}
```

**Response (200 OK):**
```json
{
  "statusCode": 200,
  "message": "Top doctors retrieved successfully",
  "data": [
    {
      "doctorId": "65e789xyz...",
      "doctorName": "Dr. Tran Thi Doctor",
      "specialization": "Cardiology",
      "avatarUrl": "https://...",
      "averageRating": 4.8,
      "totalReviews": 25
    },
    {
      "doctorId": "65e456def...",
      "doctorName": "Dr. Nguyen Van Doctor",
      "specialization": "Pediatrics",
      "avatarUrl": "https://...",
      "averageRating": 4.6,
      "totalReviews": 18
    }
  ]
}
```

---

### **🔟 DELETE REVIEW (Patient xóa)**

**⚠️ QUAN TRỌNG:**
- Chỉ patient tạo review mới có thể xóa
- Xóa vĩnh viễn khỏi DB

**Endpoint:**
```
DELETE /reviews/:id
```

**Headers:**
```
Authorization: Bearer {{patientToken}}
```

**Response (200 OK):**
```json
{
  "statusCode": 200,
  "message": "Review deleted successfully"
}
```

---

### **1️⃣1️⃣ FLAG REVIEW (Admin đánh dấu vi phạm)**

**⚠️ QUAN TRỌNG:**
- Dùng để đánh dấu review không hợp lệ
- Thay đổi status thành "flagged"

**Endpoint:**
```
POST /reviews/:id/flag
```

**Headers:**
```
Authorization: Bearer {{patientToken}}
Content-Type: application/json
```

**Body:**
```json
{
  "adminNotes": "Inappropriate language detected"
}
```

**Response (200 OK):**
```json
{
  "statusCode": 200,
  "message": "Review flagged successfully",
  "data": {
    "_id": "65f789ghi012jkl345678901",
    "status": "flagged",
    "adminNotes": "Inappropriate language detected"
  }
}
```

---

## 📮 **Cách Test Với Postman**

### **Bước 1: Import Collection**
1. Mở Postman
2. Click **Import**
3. Chọn: `Healthcare-Reviews-API.postman_collection.json`
4. Click **Import**

### **Bước 2: Cấu Hình Token & ID**
1. Click **Variables** tab
2. Paste `patientToken` vào **Current Value**
3. Paste `doctorToken` vào **Current Value**
4. Paste `doctorId` vào **Current Value**
5. Paste `sessionId` vào **Current Value** (từ Sessions API)
6. Click **Save**

### **Bước 3: Thêm Script Auto-Save ID**

Vào Endpoint 1 (Create Review), click tab **Tests**, paste:
```javascript
if (pm.response.code === 201) {
    var jsonData = pm.response.json();
    pm.variables.set("reviewId", jsonData.data._id);
    console.log("✅ Review ID saved:", jsonData.data._id);
}
```

### **Bước 4: Test Lần Lượt**

**Test Order (Kịch bản đầy đủ):**
```
1. Create Review (Patient) - auto-save reviewId
   ↓
2. Get All Reviews
   ↓
3. Get Doctor Reviews
   ↓
4. Get Doctor Rating Statistics
   ↓
5. Get Review by ID
   ↓
6. Update Review (Patient cập nhật)
   ↓
7. Mark Review as Helpful
   ↓
8. Unmark Review as Helpful
   ↓
9. Get Top Reviewed Doctors
   ↓
10. Delete Review (Patient xóa)
```

---

## 📊 **Review Status (Trạng thái)**

```
- active      (Hiển thị bình thường)
- hidden      (Ẩn khỏi danh sách)
- flagged     (Bị đánh dấu vi phạm)
```

---

## ⭐ **Review Rating (Sao)**

```
1 - Rất tệ
2 - Tệ
3 - Bình thường
4 - Tốt
5 - Rất tốt
```

---

## 🔗 **cURL Examples**

### **1. Create Review:**
```bash
curl -X POST http://localhost:3000/api/v1/reviews \
  -H "Authorization: Bearer PATIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "doctorId": "DOCTOR_ID",
    "sessionId": "SESSION_ID",
    "rating": 5,
    "comment": "Excellent doctor, very professional and caring!"
  }'
```

### **2. Get All Reviews:**
```bash
curl -X GET "http://localhost:3000/api/v1/reviews?doctorId=DOCTOR_ID&status=active&page=1" \
  -H "Authorization: Bearer PATIENT_TOKEN"
```

### **3. Get Doctor Reviews:**
```bash
curl -X GET "http://localhost:3000/api/v1/reviews/doctor/DOCTOR_ID?page=1&limit=10" \
  -H "Authorization: Bearer PATIENT_TOKEN"
```

### **4. Get Doctor Rating:**
```bash
curl -X GET http://localhost:3000/api/v1/reviews/doctor/DOCTOR_ID/rating \
  -H "Authorization: Bearer PATIENT_TOKEN"
```

### **5. Get Review by ID:**
```bash
curl -X GET http://localhost:3000/api/v1/reviews/REVIEW_ID \
  -H "Authorization: Bearer PATIENT_TOKEN"
```

### **6. Update Review:**
```bash
curl -X PATCH http://localhost:3000/api/v1/reviews/REVIEW_ID \
  -H "Authorization: Bearer PATIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rating":4,"comment":"Updated - Still good!"}'
```

### **7. Mark as Helpful:**
```bash
curl -X POST http://localhost:3000/api/v1/reviews/REVIEW_ID/helpful \
  -H "Authorization: Bearer PATIENT_TOKEN"
```

### **8. Unmark as Helpful:**
```bash
curl -X DELETE http://localhost:3000/api/v1/reviews/REVIEW_ID/helpful \
  -H "Authorization: Bearer PATIENT_TOKEN"
```

### **9. Get Top Doctors:**
```bash
curl -X GET "http://localhost:3000/api/v1/reviews/top/doctors?limit=10" \
  -H "Authorization: Bearer PATIENT_TOKEN"
```

### **10. Delete Review:**
```bash
curl -X DELETE http://localhost:3000/api/v1/reviews/REVIEW_ID \
  -H "Authorization: Bearer PATIENT_TOKEN"
```

### **11. Flag Review:**
```bash
curl -X POST http://localhost:3000/api/v1/reviews/REVIEW_ID/flag \
  -H "Authorization: Bearer PATIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"adminNotes":"Inappropriate content"}'
```

---

## ⚠️ **Lỗi Thường Gặp & Cách Fix**

| Lỗi | Nguyên Nhân | Fix |
|-----|-----------|-----|
| 401 Unauthorized | Token không hợp lệ | Login lại, copy token mới |
| 400 "Already reviewed" | Đã review doctor này rồi | Chọn doctor khác hoặc update review cũ |
| 400 "Comment too short" | Comment < 10 ký tự | Viết comment dài hơn (min 10, max 500) |
| 400 "Invalid rating" | Rating không 1-5 | Chỉ nhập 1, 2, 3, 4, hoặc 5 |
| 403 Forbidden | "Not authorized" | Chỉ author review mới update/delete |
| 404 Not Found | Review không tồn tại | Copy đúng reviewId |
| 400 "Already marked helpful" | Đã mark rồi | Không thể mark lại, phải unmark trước |

---

## 🎯 **Kịch Bản Test Đầy Đủ**

### **Scenario 1: Tạo → Cập nhật → Xóa (Full lifecycle)**
```
1. Patient tạo review (status: active)
   ✓ API 1: POST /reviews
   ↓
2. Patient xem chi tiết
   ✓ API 5: GET /reviews/:id
   ↓
3. Patient cập nhật rating/comment
   ✓ API 6: PATCH /reviews/:id
   ↓
4. Patient xóa review
   ✓ API 10: DELETE /reviews/:id
```

### **Scenario 2: Xem đánh giá doctors**
```
1. Xem tất cả review
   ✓ API 2: GET /reviews
   ↓
2. Xem review của doctor cụ thể
   ✓ API 3: GET /reviews/doctor/:id
   ↓
3. Xem điểm trung bình doctor
   ✓ API 4: GET /reviews/doctor/:id/rating
   ↓
4. Xem top 10 doctors
   ✓ API 9: GET /reviews/top/doctors
```

### **Scenario 3: Helpful voting system**
```
1. Xem review
   ✓ API 5: GET /reviews/:id
   ↓
2. Mark as helpful (helpfulCount++)
   ✓ API 7: POST /reviews/:id/helpful
   ↓
3. Unmark (helpfulCount--)
   ✓ API 8: DELETE /reviews/:id/helpful
```

---

## 📋 **Danh Sách Endpoints & HTTP Methods**

| # | Endpoint | Method | Token | Điều kiện |
|---|----------|--------|-------|----------|
| 1 | /reviews | POST | patientToken | Chưa review doctor này |
| 2 | /reviews | GET | patientToken | - |
| 3 | /reviews/doctor/:id | GET | patientToken | - |
| 4 | /reviews/doctor/:id/rating | GET | patientToken | - |
| 5 | /reviews/:id | GET | patientToken | - |
| 6 | /reviews/:id | PATCH | patientToken | Author của review |
| 7 | /reviews/:id/helpful | POST | patientToken | Chưa mark |
| 8 | /reviews/:id/helpful | DELETE | patientToken | Đã mark trước |
| 9 | /reviews/top/doctors | GET | patientToken | - |
| 10 | /reviews/:id | DELETE | patientToken | Author của review |
| 11 | /reviews/:id/flag | POST | patientToken | Admin/Moderator |

---

## ✅ **Checklist Test**

- [ ] **Setup:** Copy 2 tokens vào Postman Variables
- [ ] **Setup:** Copy doctorId & sessionId vào Variables
- [ ] **API 1:** Create Review → copy reviewId
- [ ] **API 2:** Get All Reviews
- [ ] **API 3:** Get Doctor Reviews
- [ ] **API 4:** Get Doctor Rating Statistics
- [ ] **API 5:** Get Review by ID
- [ ] **API 6:** Update Review
- [ ] **API 7:** Mark as Helpful
- [ ] **API 8:** Unmark as Helpful
- [ ] **API 9:** Get Top Doctors
- [ ] **API 10:** Delete Review
- [ ] **API 11:** Flag Review (test inappropriate)

---

## 🚀 **Quick Start (5 phút)**

### **Step 1: Use Existing Tokens**
Từ Sessions API test, bạn đã có:
- `patientToken`
- `doctorToken`
- `doctorId`
- `sessionId`

### **Step 2: Create Review**
```bash
curl -X POST http://localhost:3000/api/v1/reviews \
  -H "Authorization: Bearer PATIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "doctorId": "DOCTOR_ID",
    "sessionId": "SESSION_ID",
    "rating": 5,
    "comment": "Excellent doctor, very professional and caring!"
  }'
```

### **Step 3: Save Review ID**
Copy `_id` từ response → paste vào `reviewId` variable

### **Step 4: Test Endpoints**
1. Get All Reviews
2. Get Doctor Reviews
3. Get Doctor Rating
4. Update Review
5. Mark Helpful
6. Delete Review

✅ **Done!**

---

**Xong! Bây giờ bạn có thể test Reviews API! ⭐**
