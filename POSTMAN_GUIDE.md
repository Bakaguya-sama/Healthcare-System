# 📮 **HƯỚNG DẪN TEST API VỚI POSTMAN**

## 🚀 **Bước 1: Import Collection**

1. Mở Postman
2. Click **Import**
3. Chọn file: `Healthcare-Auth-API.postman_collection.json`
4. Click **Import**

✅ Xong! Bạn sẽ có 8 endpoints ready

---

## 🧪 **Bước 2: Test từng Endpoint**

### **1️⃣ REGISTER (Tạo tài khoản)**

1. Click tab **1. Register**
2. Body đã có sẵn:
```json
{
  "email": "test@example.com",
  "password": "Test123456!",
  "name": "Nguyen Van A",
  "gender": "male",
  "phoneNumber": "+84912345678",
  "role": "patient",
  "address": {
    "street": "123 Nguyen Hue",
    "ward": "Ward 1",
    "district": "District 1",
    "city": "Ho Chi Minh",
    "country": "Vietnam"
  }
}
```
3. **Thay đổi email** (mỗi lần test dùng email khác)
4. Click **Send**

**Response sẽ có:**
```json
{
  "statusCode": 201,
  "message": "User registered successfully",
  "data": {
    "user": {
      "_id": "123abc...",
      "email": "test@example.com",
      "name": "Nguyen Van A"
    },
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

✅ **Copy 2 cái này:**
- `accessToken` → lưu vào `Variables` (accessToken)
- `refreshToken` → lưu vào `Variables` (refreshToken)
- `_id` → lưu vào `Variables` (userId)

---

### **2️⃣ LOGIN (Đăng nhập)**

1. Click tab **2. Login**
2. Body:
```json
{
  "email": "test@example.com",
  "password": "Test123456!"
}
```
3. Click **Send**

**Response:**
```json
{
  "statusCode": 200,
  "message": "Login successful",
  "data": {
    "user": {
      "_id": "123abc...",
      "email": "test@example.com"
    },
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

✅ **Cập nhật Variables:**
- Copy `accessToken` mới
- Copy `refreshToken` mới

---

### **3️⃣ GET PROFILE (Xem thông tin)**

1. Click tab **3. Get Profile (ME)**
2. Header đã có sẵn:
```
Authorization: Bearer {{accessToken}}
```
3. Click **Send**

**Response:**
```json
{
  "statusCode": 200,
  "message": "Profile retrieved successfully",
  "data": {
    "_id": "123abc...",
    "email": "test@example.com",
    "name": "Nguyen Van A",
    "gender": "male",
    "phoneNumber": "+84912345678",
    "role": "patient",
    "accountStatus": "active"
  }
}
```

---

### **4️⃣ CHANGE PASSWORD (Đổi mật khẩu)**

1. Click tab **4. Change Password**
2. Header: Authorization đã có
3. Body:
```json
{
  "oldPassword": "Test123456!",
  "newPassword": "NewTest789!"
}
```
4. Click **Send**

**Response:**
```json
{
  "statusCode": 200,
  "message": "Password changed successfully"
}
```

---

### **5️⃣ FORGOT PASSWORD (Quên mật khẩu - Gửi OTP)**

1. Click tab **5. Forgot Password (Send OTP)**
2. Body:
```json
{
  "email": "test@example.com"
}
```
3. Click **Send**

**Response:**
```json
{
  "statusCode": 200,
  "message": "OTP sent to email",
  "data": {
    "otpCode": "123456"  // ← Copy cái này (dev mode)
  }
}
```

✅ **Lưu OTP này để bước tiếp theo**

---

### **6️⃣ CONFIRM OTP (Xác nhận OTP - Reset mật khẩu)**

1. Click tab **6. Confirm OTP (Reset Password)**
2. Body:
```json
{
  "email": "test@example.com",
  "otpCode": "123456",  // ← Paste OTP từ bước trên
  "newPassword": "FinalPass789!"
}
```
3. Click **Send**

**Response:**
```json
{
  "statusCode": 200,
  "message": "Password reset successfully"
}
```

---

### **7️⃣ REFRESH TOKEN (Lấy access token mới)**

1. Click tab **7. Refresh Token**
2. Body:
```json
{
  "userId": "{{userId}}",
  "refreshToken": "{{refreshToken}}"
}
```
3. Click **Send**

**Response:**
```json
{
  "statusCode": 200,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "eyJhbGc..."  // ← Token mới
  }
}
```

✅ **Cập nhật accessToken mới**

---

### **8️⃣ LOGOUT (Đăng xuất)**

1. Click tab **8. Logout**
2. Header: Authorization đã có
3. Click **Send**

**Response:**
```json
{
  "statusCode": 200,
  "message": "Logout successful"
}
```

---

## 💾 **Cách Lưu Variables Trong Postman**

### **Method 1: Lưu thủ công**

1. Click **Variables** (tab trên cùng)
2. Tìm dòng `accessToken`
3. Paste token vào cột **Current Value**
4. Tương tự cho `refreshToken`, `userId`
5. Click **Save**

---

### **Method 2: Auto-lưu (Script)**

1. Click tab **2. Login** 
2. Scroll xuống → Tab **Tests**
3. Paste code này:
```javascript
if (pm.response.code === 200) {
    var jsonData = pm.response.json();
    pm.variables.set("accessToken", jsonData.data.accessToken);
    pm.variables.set("refreshToken", jsonData.data.refreshToken);
    pm.variables.set("userId", jsonData.data.user._id);
}
```
4. Click **Send**

✅ Token sẽ tự lưu vào Variables!

---

## 🔄 **Luồng Test Hoàn Chỉnh**

```
1. Register
   ↓ (lưu token + userId)
2. Get Profile
   ↓
3. Change Password
   ↓
4. Login (lại với mật khẩu cũ - không được)
   ↓
5. Forgot Password
   ↓ (lưu OTP)
6. Confirm OTP
   ↓
7. Refresh Token
   ↓ (lưu token mới)
8. Get Profile (lại với token mới)
   ↓
9. Logout
```

---

## ⚠️ **Lỗi Thường Gặp**

| Lỗi | Nguyên Nhân | Cách Fix |
|-----|-----------|---------|
| 401 Unauthorized | Token không đúng/hết hạn | Copy lại token mới từ Login |
| 409 Conflict | Email đã tồn tại | Dùng email khác |
| 400 Bad Request | Dữ liệu không đúng | Kiểm tra format JSON |
| 500 Internal Error | Server lỗi | Check console API server |

---

## 🎯 **Checklist**

- [ ] Import collection
- [ ] Chạy Register
- [ ] Lưu token vào Variables
- [ ] Test Get Profile
- [ ] Test Change Password
- [ ] Test Forgot Password
- [ ] Test Confirm OTP
- [ ] Test Refresh Token
- [ ] Test Logout

---

## 📌 **Lưu Ý**

✅ **API URL:** `http://localhost:3000/api/v1`  
✅ **Method:** POST/GET (như trong collection)  
✅ **Header:** Content-Type = application/json  
✅ **Token expiry:** 15 phút (access), 7 ngày (refresh)  

---

**Xong! Bây giờ bạn có thể test toàn bộ API trong Postman! 🚀**
