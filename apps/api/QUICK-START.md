# 🚀 Quick Start - Healthcare System Setup

**Ngày:** 2026-03-17  
**Phiên bản:** 1.0.0

---

## 📌 3 Files Chính

| File | Mục Đích | Khi Nào Dùng |
|------|---------|-------------|
| **QUICK-SETUP-TESTS.postman_collection.json** | ✅ **TẠO & TẠO SẴN TEST** theo thứ tự logic | **LẦN ĐẦU TIÊN** |
| **Healthcare-API-Complete.postman_collection.json** | 📚 Collection đầy đủ 18 modules, 130+ endpoints | Sau khi setup xong |
| **ENVIRONMENT-SETUP-GUIDE.md** | 📖 Hướng dẫn chi tiết từng bước | Tham khảo chi tiết |

---

## ⚡ 5 Phút Setup (Quickest Way)

### Bước 1: Import Collection Setup
```
Postman → File → Import → Chọn "QUICK-SETUP-TESTS.postman_collection.json"
```

### Bước 2: Chạy 6 Bước Theo Thứ Tự

**BƯỚC 0: SETUP - Tạo 4 Tài Khoản**
```
1️⃣ Run: Register Patient
   ✅ Auto save: patient_id, patient_token

2️⃣ Run: Register Doctor #1
   ✅ Auto save: doctor_id, doctor_token

3️⃣ Run: Register Doctor #2 (Chat Partner)
   ✅ Auto save: other_user_id, doctor2_token

4️⃣ Run: Register Admin
   ✅ Auto save: admin_id, admin_token
```

**BƯỚC 1: VERIFICATION - Admin Duyệt**
```
✅ Run: Admin Verify Doctor #1
✅ Run: Admin Verify Doctor #2
```

**BƯỚC 2: PROFILE - Tạo Profile Bệnh Nhân**
```
✅ Run: Patient Create Profile
```

**BƯỚC 3: SESSION - Tạo Appointment**
```
✅ Run: Patient Create Session
✅ Run: Doctor Accept Session
   (Auto save: session_id)
```

**BƯỚC 4: CHAT - Tư Vấn Giữa Patient & Doctor**
```
✅ Run: Patient Send Message
✅ Run: Doctor Reply
✅ Run: Get Conversation
```

**BƯỚC 5: AI - Tạo Knowledge Base**
```
✅ Run: Create AI Document (Auto save: document_id)
✅ Run: Patient Start AI Consultation
✅ Run: Send Message to AI
```

**BƯỚC 6: VERIFY - Kiểm Tra Setup**
```
✅ Run: Check All IDs in Environment
   (Console sẽ show all IDs và tokens)
```

### Bước 3: Copy Environment Setup
```
File → Export Environment
(Hoặc dùng ENVIRONMENT-SETUP-GUIDE.md để tạo manual)
```

### Bước 4: Import Collection Hoàn Chỉnh
```
Postman → File → Import → "Healthcare-API-Complete.postman_collection.json"
```

### Bước 5: Chọn Environment & Test
```
Environment dropdown → Chọn Healthcare-Dev-Complete
Bắt đầu test 130+ endpoints! 🎉
```

---

## 📋 Tại Sao Doctor #2 Là "Other User ID"?

```
❌ SAIS: Chat với patient khác
✅ ĐÚNG: Doctor chat tư vấn với patient

WORKFLOW:
┌─ Patient ─ Appointment ─ Doctor #1
├─ Patient ─ Chat TƯỢNG ─ Doctor #2 ← (other_user_id)
└─ Patient ─ AI Consultation ─ AI
```

### Doctor #2 Roles:
- ✅ Tư vấn trực tiếp (Chat)
- ✅ Được Admin verify
- ✅ Bệnh nhân có thể nhắn tin

---

## 🔄 Thứ Tự Logic Setup

```
1️⃣ CREATE ACCOUNTS
   └─ Patient, Doctor#1, Doctor#2, Admin

2️⃣ VERIFY DOCTORS
   └─ Không có verified doctor → không tạo session được

3️⃣ CREATE PROFILE
   └─ Bệnh nhân cần profile trước khi tạo appointment

4️⃣ CREATE SESSION
   └─ Cần patient profile + verified doctor

5️⃣ CHAT & AI
   └─ Sau khi appointment tạo được thì chat/AI mới hoạt động

6️⃣ VERIFY & EXPORT
   └─ Kiểm tra tất cả environment variables
```

---

## 🎯 Kết Quả Sau Setup

### Environment Variables Đầy Đủ:

```
base_url: localhost:3000/api/v1

🧑‍⚕️ TOKENS:
patient_token: eyJhbGciOiJIUzI1...
doctor_token: eyJhbGciOiJIUzI1...
doctor2_token: eyJhbGciOiJIUzI1...
admin_token: eyJhbGciOiJIUzI1...

👥 IDs:
patient_id: 507f1f77bcf86cd799439011
doctor_id: 507f1f77bcf86cd799439012
other_user_id: 507f1f77bcf86cd799439013 ← Doctor #2
admin_id: 507f1f77bcf86cd799439014

📋 Records:
session_id: 507f1f77bcf86cd799439020
document_id: 507f1f77bcf86cd799439021
```

---

## 🧪 Test Cases Automatic

Mỗi request có **Postman Tests Script** tự động:

```javascript
✅ Auto extract IDs từ response
✅ Auto save tokens & IDs vào environment
✅ Auto verify response status code
✅ Console log results
```

Ví dụ:
```
1️⃣ Register Patient
   → Extract patient_id + patient_token
   → Save vào environment
   → Next request tự động dùng {{patient_token}}

2️⃣ Admin Verify Doctor
   → Log status "Doctor Verified"
   → Giờ doctor có thể tạo sessions
```

---

## 🔐 Security Notes

- ✅ Tokens tự động lưu trong Postman environment (local only)
- ✅ Không commit tokens vào Git
- ✅ Mỗi request dùng `Bearer {{jwt_token}}`
- ⚠️ Tokens hết hạn khoảng 1 giờ → Cần refresh hoặc login lại

---

## ❌ Common Mistakes

| ❌ Mistake | ✅ Fix |
|-----------|--------|
| Không chạy "Verify Doctors" step | 👉 Bước VERIFICATION bắt buộc |
| Không tạo Profile trước Session | 👉 PROFILE bước 2, SESSION bước 3 |
| Dùng Patient #2 thay vì Doctor #2 | 👉 other_user_id PHẢI là Doctor |
| Quên copy environment | 👉 Export sau bước 6 |
| Token expired | 👉 Chạy login lại |

---

## 📊 File Structure

```
c:\SE121\Healthcare-System\apps\api\
├── QUICK-SETUP-TESTS.postman_collection.json  ← START HERE
├── Healthcare-API-Complete.postman_collection.json
├── ENVIRONMENT-SETUP-GUIDE.md
├── POSTMAN-GUIDE.md
└── QUICK-START.md  ← YOU ARE HERE
```

---

## 🎓 Workflow Diagram

```
QUICK-SETUP-TESTS Collection
│
├─ 📋 BƯỚC 0: SETUP (4 requests)
│  ├─ Register Patient
│  ├─ Register Doctor #1
│  ├─ Register Doctor #2
│  └─ Register Admin
│
├─ 🔐 BƯỚC 1: VERIFICATION (2 requests)
│  ├─ Verify Doctor #1
│  └─ Verify Doctor #2
│
├─ 👤 BƯỚC 2: PROFILE (1 request)
│  └─ Create Patient Profile
│
├─ 📅 BƯỚC 3: SESSION (2 requests)
│  ├─ Create Session
│  └─ Start Session
│
├─ 💬 BƯỚC 4: CHAT (3 requests)
│  ├─ Send Message
│  ├─ Reply Message
│  └─ Get Conversation
│
├─ 📚 BƯỚC 5: AI (3 requests)
│  ├─ Create Document
│  ├─ Start AI Conversation
│  └─ Send Message to AI
│
└─ ✅ BƯỚC 6: VERIFY (1 request)
   └─ Check All IDs
```

---

## 🚀 Next Steps

### Sau Khi Setup Xong:

1. **Import Healthcare-API-Complete**
   ```
   Postman → File → Import → Healthcare-API-Complete.postman_collection.json
   ```

2. **Chọn Environment**
   ```
   Top right: Environment dropdown → Healthcare-Dev-Complete
   ```

3. **Run Collections**
   ```
   Collections → Chọn collection → Run
   ```

4. **View Results**
   ```
   Console (Ctrl+Alt+C) → Xem logs
   Tests tab → Xem test results
   ```

---

## 💡 Pro Tips

### 1️⃣ Automate Token Refresh
```javascript
// Add to Collection Pre-request Script
if (!pm.environment.get("patient_token")) {
  pm.sendRequest({
    url: pm.environment.get("base_url") + "/auth/login",
    method: "POST",
    header: {"Content-Type": "application/json"},
    body: {
      mode: "raw",
      raw: JSON.stringify({
        email: "patient@test.com",
        password: "Password123!"
      })
    }
  }, (err, response) => {
    if (!err) {
      pm.environment.set("patient_token", response.json().access_token);
    }
  });
}
```

### 2️⃣ Run All Tests
```
Collections → QUICK-SETUP-TESTS → Run Collection
(Tất cả 6 bước chạy tự động)
```

### 3️⃣ View Console Logs
```
Postman → View → Show Postman Console
(Ctrl+Alt+C)
```

---

## 📞 Troubleshooting

### ❓ Lỗi: "Doctor not verified"
- **Fix:** Chạy BƯỚC 1 (Verify Doctors)

### ❓ Lỗi: "Session creation failed"
- **Fix:** Kiểm tra doctors đã verified chưa

### ❓ Lỗi: "other_user_id invalid"
- **Fix:** other_user_id phải là Doctor #2, không phải patient

### ❓ Lỗi: Token hết hạn
- **Fix:** Chạy lại "Register Patient" để lấy token mới

### ❓ IDs không xuất hiện
- **Fix:** Check console logs (Ctrl+Alt+C)

---

## ✅ Final Checklist

- [ ] Import QUICK-SETUP-TESTS collection
- [ ] Chạy BƯỚC 0-6 theo thứ tự
- [ ] Tất cả requests pass ✅
- [ ] Environment variables filled
- [ ] Export environment
- [ ] Import Healthcare-API-Complete collection
- [ ] Chọn Healthcare-Dev-Complete environment
- [ ] Test 1 endpoint thành công
- [ ] Ready to test full system! 🎉

---

## 🎉 SUCCESS!

```
✅ 4 test accounts created
✅ Doctors verified by admin
✅ Patient profile created
✅ Session created & started
✅ Chat tư vấn working
✅ AI consultation setup
✅ Environment complete

→ Bạn đã sẵn sàng test toàn bộ 
   Healthcare System API! 🚀
```

---

**Happy Testing! 🎊**

**Support:** Xem `ENVIRONMENT-SETUP-GUIDE.md` hoặc `POSTMAN-GUIDE.md` để chi tiết hơn.
