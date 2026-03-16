# 🔧 **FIX: Invalid Metric ID Error (Endpoint 3, 7, 8)**

## ❌ **Lỗi Bạn Gặp**
```json
{
  "message": "Invalid metric ID",
  "error": "Bad Request",
  "statusCode": 400
}
```

---

## 🔍 **Nguyên Nhân**

Endpoint 3, 7, 8 cần **MongoDB ObjectId** format (24 ký tự hex):
- ✅ Đúng: `65f123abc789def012345678`
- ❌ Sai: `METRIC_ID_HERE` (placeholder text)

Bạn đang dùng placeholder text thay vì ID thực!

---

## ✅ **3 Cách Fix**

### **Fix #1: Manual Copy-Paste (Đơn giản nhất)**

**Bước 1:** Chạy Endpoint 1 (Create Metric)
```
POST /health-metrics
```

**Bước 2:** Response trả về:
```json
{
  "statusCode": 201,
  "data": {
    "_id": "65f456abc789def012345678",  ← COPY CÁI NÀY
    ...
  }
}
```

**Bước 3:** Paste vào URL của endpoint 3, 7, 8

**Endpoint 3:**
```
GET /health-metrics/65f456abc789def012345678
```

**Endpoint 7:**
```
POST /health-metrics/65f456abc789def012345678/review
```

**Endpoint 8:**
```
DELETE /health-metrics/65f456abc789def012345678
```

---

### **Fix #2: Postman Variables (Tự động - Recommended)**

**Bước 1:** Vào Endpoint 1, click tab **Tests**

**Bước 2:** Paste script này:
```javascript
if (pm.response.code === 201) {
    var jsonData = pm.response.json();
    pm.variables.set("metricId", jsonData.data._id);
    console.log("✅ Metric ID saved:", jsonData.data._id);
}
```

**Bước 3:** Save & Run Endpoint 1

**Bước 4:** Lúc này, ID sẽ tự lưu vào biến `metricId`

**Bước 5:** Sửa URL ở endpoint 3, 6, 7, 8 từ:
```
/health-metrics/METRIC_ID_HERE
```

Thành:
```
/health-metrics/{{metricId}}
```

**Bước 6:** Giờ chạy endpoint 3, 7, 8 → sẽ work! ✅

---

### **Fix #3: cURL (Command Line)**

```bash
# 1. Create metric
RESPONSE=$(curl -X POST http://localhost:3000/api/v1/health-metrics \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "blood_pressure",
    "value": 120,
    "systolic": 120,
    "diastolic": 80,
    "unit": "mmHg"
  }')

# 2. Extract ID
METRIC_ID=$(echo $RESPONSE | jq -r '.data._id')
echo "Metric ID: $METRIC_ID"

# 3. Get by ID (Endpoint 3)
curl -X GET http://localhost:3000/api/v1/health-metrics/$METRIC_ID \
  -H "Authorization: Bearer YOUR_TOKEN"

# 4. Mark as reviewed (Endpoint 7)
curl -X POST http://localhost:3000/api/v1/health-metrics/$METRIC_ID/review \
  -H "Authorization: Bearer YOUR_TOKEN"

# 5. Delete (Endpoint 8)
curl -X DELETE http://localhost:3000/api/v1/health-metrics/$METRIC_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🎯 **Recommended: Fix #2 (Postman Variables)**

**Vì sao?**
- ✅ Tự động, không cần copy-paste
- ✅ Tiết kiệm thời gian
- ✅ Ít lỗi
- ✅ Chuyên nghiệp

**Các bước:**
1. Endpoint 1 → Tab **Tests** → Paste script
2. Run Endpoint 1 → ID tự lưu
3. Endpoint 3, 7, 8 → Đổi URL thành `{{metricId}}`
4. Run các endpoint → ✅ Success!

---

## ✅ **Verify Fix**

Nếu thành công, bạn sẽ thấy:

**Endpoint 3 Response:**
```json
{
  "statusCode": 200,
  "message": "Health metric retrieved successfully",
  "data": {
    "_id": "65f456abc789def012345678",
    "type": "blood_pressure",
    "value": 120,
    ...
  }
}
```

**NOT:**
```json
{
  "message": "Invalid metric ID",
  "error": "Bad Request",
  "statusCode": 400
}
```

---

## 📝 **Updated File**

File `HEALTH_METRICS_TEST.md` đã cập nhật với hướng dẫn tự động này!

---

**Bây giờ test lại endpoint 3, 7, 8 nhé! 🚀**
