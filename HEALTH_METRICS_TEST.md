# 📊 **HEALTH METRICS API - HƯỚNG DẪN TEST**

## 🚀 **Chuẩn Bị**

**Điều kiện:**
- ✅ Server đang chạy: `pnpm start:dev`
- ✅ Đã đăng ký & đăng nhập (có `accessToken`)
- ✅ Biết `userId` của mình
- ✅ Postman hoặc cURL sẵn sàng

---

## 🧪 **8 Endpoints - Test Từng Bước**

### **1️⃣ CREATE METRIC (Ghi nhận chỉ số)**

**Endpoint:**
```
POST /health-metrics
```

**Headers:**
```
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```

**Body:**
```json
{
  "type": "blood_pressure",
  "value": 120,
  "systolic": 120,
  "diastolic": 80,
  "unit": "mmHg",
  "status": "normal",
  "note": "Morning measurement after breakfast",
  "recordedAt": "2026-03-16T08:00:00Z"
}
```

**Response (201 Created):**
```json
{
  "statusCode": 201,
  "message": "Health metric recorded successfully",
  "data": {
    "_id": "65f123abc...",
    "userId": "65e456def...",
    "type": "blood_pressure",
    "value": 120,
    "systolic": 120,
    "diastolic": 80,
    "unit": "mmHg",
    "status": "normal",
    "recordedAt": "2026-03-16T08:00:00.000Z",
    "createdAt": "2026-03-16T20:30:00.000Z",
    "updatedAt": "2026-03-16T20:30:00.000Z"
  }
}
```

✅ **Copy `_id` để dùng ở bước sau**

---

### **2️⃣ GET ALL METRICS (Danh sách chỉ số)**

**Endpoint:**
```
GET /health-metrics?type=blood_pressure&status=normal&page=1&limit=10&sortBy=recordedAt&sortOrder=-1
```

**Query Parameters:**
| Param | Kiểu | Required | Ví dụ |
|-------|------|----------|-------|
| `type` | enum | ❌ | blood_pressure, heart_rate, blood_sugar, weight, temperature, bmi, cholesterol, oxygen_level |
| `status` | enum | ❌ | normal, warning, critical |
| `startDate` | ISO date | ❌ | 2026-03-01T00:00:00Z |
| `endDate` | ISO date | ❌ | 2026-03-31T23:59:59Z |
| `page` | number | ❌ | 1 (default) |
| `limit` | number | ❌ | 10 (default) |
| `sortBy` | string | ❌ | recordedAt (default) |
| `sortOrder` | -1 \| 1 | ❌ | -1 (desc), 1 (asc) |

**Response (200 OK):**
```json
{
  "statusCode": 200,
  "message": "Health metrics retrieved successfully",
  "data": [
    {
      "_id": "65f123abc...",
      "userId": "65e456def...",
      "type": "blood_pressure",
      "value": 120,
      "systolic": 120,
      "diastolic": 80,
      "status": "normal"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "pages": 1
  }
}
```

---

### **3️⃣ GET METRIC BY ID (Chi tiết 1 chỉ số)**

**⚠️ QUAN TRỌNG:** Thay `METRIC_ID` bằng ID từ Endpoint 1 (Create)

**Endpoint:**
```
GET /health-metrics/:id
```

**Example (ID từ Endpoint 1 response):**
```
GET /health-metrics/65f123abc789def012345678
```

**⚠️ Format đúng:** 24 ký tự hex (ObjectId MongoDB)
- ✅ Đúng: `65f123abc789def012345678`
- ❌ Sai: `METRIC_ID_HERE`, `123`, `test`

**Response (200 OK):**
```json
{
  "statusCode": 200,
  "message": "Health metric retrieved successfully",
  "data": {
    "_id": "65f123abc...",
    "userId": "65e456def...",
    "type": "blood_pressure",
    "value": 120,
    "systolic": 120,
    "diastolic": 80,
    "unit": "mmHg",
    "status": "normal",
    "note": "Morning measurement",
    "recordedAt": "2026-03-16T08:00:00Z",
    "createdAt": "2026-03-16T20:30:00Z",
    "updatedAt": "2026-03-16T20:30:00Z"
  }
}
```

---

### **4️⃣ GET STATISTICS (Thống kê)**

**Endpoint:**
```
GET /health-metrics/statistics/:type
```

**Example:**
```
GET /health-metrics/statistics/blood_pressure
```

**Response (200 OK):**
```json
{
  "statusCode": 200,
  "message": "Statistics retrieved successfully",
  "data": {
    "type": "blood_pressure",
    "count": 5,
    "average": 120.8,
    "minimum": 118,
    "maximum": 125,
    "latest": {
      "_id": "65f123abc...",
      "value": 125,
      "recordedAt": "2026-03-16T20:00:00Z"
    }
  }
}
```

---

### **5️⃣ GET ALERTS (Cảnh báo)**

**Endpoint:**
```
GET /health-metrics/alerts
```

**Response (200 OK):**
```json
{
  "statusCode": 200,
  "message": "Alerts retrieved successfully",
  "data": [
    {
      "_id": "65f456ghi...",
      "type": "blood_pressure",
      "value": 160,
      "status": "critical",
      "isAlert": true,
      "recordedAt": "2026-03-16T15:30:00Z"
    }
  ],
  "count": 1
}
```

---

### **6️⃣ UPDATE METRIC (Cập nhật)**

**⚠️ QUAN TRỌNG:** Thay `METRIC_ID_HERE` bằng ID từ Endpoint 1 (Create)

**Endpoint:**
```
PATCH /health-metrics/:id
```

**Example (ID từ Endpoint 1 response):**
```
PATCH /health-metrics/65f123abc789def012345678
```

**Headers:**
```
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```

**Body:**
```json
{
  "status": "warning",
  "note": "Updated after consultation"
}
```

**Response (200 OK):**
```json
{
  "statusCode": 200,
  "message": "Health metric updated successfully",
  "data": {
    "_id": "65f123abc...",
    "status": "warning",
    "note": "Updated after consultation"
  }
}
```

---

### **7️⃣ MARK AS REVIEWED (Đánh dấu đã review)**

**⚠️ QUAN TRỌNG:** Thay `METRIC_ID_HERE` bằng ID từ Endpoint 1 (Create)

**Endpoint:**
```
POST /health-metrics/:id/review
```

**Example (ID từ Endpoint 1 response):**
```
POST /health-metrics/65f123abc789def012345678/review
```

**Headers:**
```
Authorization: Bearer {{accessToken}}
```

**Body:** (trống)

**Response (200 OK):**
```json
{
  "statusCode": 200,
  "message": "Metric marked as reviewed",
  "data": {
    "_id": "65f123abc...",
    "isAlert": false
  }
}
```

---

### **8️⃣ DELETE METRIC (Xóa)**

**⚠️ QUAN TRỌNG:** Thay `METRIC_ID_HERE` bằng ID từ Endpoint 1 (Create)

**Endpoint:**
```
DELETE /health-metrics/:id
```

**Example (ID từ Endpoint 1 response):**
```
DELETE /health-metrics/65f123abc789def012345678
```

**Headers:**
```
Authorization: Bearer {{accessToken}}
```

**Response (200 OK):**
```json
{
  "statusCode": 200,
  "message": "Health metric deleted successfully"
}
```

---

## 📮 **Cách Test Với Postman**

### **Bước 1: Import Collection**
1. Mở Postman
2. Click **Import**
3. Chọn: `Healthcare-Health-Metrics-API.postman_collection.json`
4. Click **Import**

### **Bước 2: Cấu Hình Token**
1. Click **Variables** tab
2. Paste `accessToken` vào **Current Value**
3. Click **Save**

### **Bước 3: Thêm Script Auto-Save ID**

Để tránh lỗi "Invalid metric ID", thêm script vào **Endpoint 1 (Create Metric)**:

1. Click tab **Tests** của Endpoint 1
2. Paste code này:
```javascript
if (pm.response.code === 201) {
    var jsonData = pm.response.json();
    pm.variables.set("metricId", jsonData.data._id);
    console.log("✅ Metric ID saved:", jsonData.data._id);
}
```
3. Click **Save**

Sau đó, ở endpoint 3, 6, 7, 8, thay thế URL từ:
```
/health-metrics/METRIC_ID_HERE
```
thành:
```
/health-metrics/{{metricId}}
```

### **Bước 4: Test Lần Lượt**

**Test Order:**
```
1. Create Metric (auto-save ID)
   ↓
2. Get All Metrics
   ↓
3. Get Metric by ID (dùng {{metricId}})
   ↓
4. Get Statistics (chọn type)
   ↓
5. Get Alerts
   ↓
6. Update Metric (dùng {{metricId}})
   ↓
7. Mark as Reviewed (dùng {{metricId}})
   ↓
8. Delete Metric (dùng {{metricId}})
```

---

## 🔗 **cURL Examples**

### **Create:**
```bash
curl -X POST http://localhost:3000/api/v1/health-metrics \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "blood_pressure",
    "value": 120,
    "systolic": 120,
    "diastolic": 80,
    "unit": "mmHg",
    "status": "normal"
  }'
```

### **Get All:**
```bash
curl -X GET "http://localhost:3000/api/v1/health-metrics?type=blood_pressure&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### **Get by ID:**
```bash
curl -X GET http://localhost:3000/api/v1/health-metrics/METRIC_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### **Statistics:**
```bash
curl -X GET http://localhost:3000/api/v1/health-metrics/statistics/blood_pressure \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### **Update:**
```bash
curl -X PATCH http://localhost:3000/api/v1/health-metrics/METRIC_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "warning"}'
```

### **Delete:**
```bash
curl -X DELETE http://localhost:3000/api/v1/health-metrics/METRIC_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📊 **Metric Types (Loại chỉ số)**

```
- blood_pressure     (Huyết áp)
- heart_rate         (Nhịp tim)
- blood_sugar        (Đường huyết)
- weight             (Cân nặng)
- temperature        (Nhiệt độ)
- bmi                (Chỉ số BMI)
- cholesterol        (Cholesterol)
- oxygen_level       (Nồng độ oxy)
```

---

## 🔴 **Metric Status (Trạng thái)**

```
- normal             (Bình thường)
- warning            (Cảnh báo)
- critical           (Nguy hiểm)
```

---

## ⚠️ **Lỗi Thường Gặp**

| Lỗi | Nguyên Nhân | Fix |
|-----|-----------|-----|
| 401 Unauthorized | Token không hợp lệ | Copy token mới từ Login |
| 400 Bad Request | Dữ liệu không đúng format | Kiểm tra Body JSON |
| 404 Not Found | Metric ID không tồn tại | Check ID từ bước Create |
| 400 Invalid user ID | userId sai format | Dùng ObjectId format |

---

## ✅ **Checklist Test**

- [ ] Import Postman collection
- [ ] Lưu accessToken vào Variables
- [ ] Test Create Metric → copy _id
- [ ] Test Get All Metrics
- [ ] Test Get by ID
- [ ] Test Get Statistics
- [ ] Test Get Alerts
- [ ] Test Update Metric
- [ ] Test Mark as Reviewed
- [ ] Test Delete Metric

---

## 🎯 **Quick Test (5 phút)**

```bash
# 1. Đăng nhập (từ Auth API)
# Copy accessToken

# 2. Create metric
curl -X POST http://localhost:3000/api/v1/health-metrics \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"blood_pressure","value":120,"systolic":120,"diastolic":80,"unit":"mmHg"}'

# 3. Copy _id từ response

# 4. Get metric
curl -X GET http://localhost:3000/api/v1/health-metrics/METRIC_ID \
  -H "Authorization: Bearer ACCESS_TOKEN"

# 5. Get all
curl -X GET http://localhost:3000/api/v1/health-metrics \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

---

**Xong! Bây giờ bạn có thể test Health Metrics API! 🚀**
