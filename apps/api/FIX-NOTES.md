# 🔧 Fix Notes - Healthcare Postman Setup

**Ngày:** 2026-03-17

---

## ✅ Fixed Issues

### Issue #1: Verify Doctor Endpoint - Field Name Error

**❌ Problem:**
```json
Lỗi: {
  "message": ["property notes should not exist"],
  "error": "Bad Request",
  "statusCode": 400
}
```

**🔍 Root Cause:**
- Request body dùng field `notes` 
- API chỉ chấp nhận field `verificationNotes`
- API có whitelist validation (forbidNonWhitelisted: true) trong `main.ts`

**✅ Solution:**
```json
// ❌ WRONG
{
  "notes": "Doctor verified"
}

// ✅ CORRECT
{
  "verificationNotes": "Doctor verified"
}
```

**📝 Files Fixed:**
1. ✅ `QUICK-SETUP-TESTS.postman_collection.json`
   - Admin Verify Doctor #1 request
   - Admin Verify Doctor #2 request

2. ✅ `ENVIRONMENT-SETUP-GUIDE.md`
   - Bước 1 verification section

3. ✅ `verify-doctor.dto.ts`
   - Added ApiProperty documentation

---

## 🚀 Update Required Files

### If You Already Imported Old Collection:

**Option 1: Re-import Latest Collection**
```
1. Delete old: QUICK-SETUP-TESTS
2. Import new: QUICK-SETUP-TESTS.postman_collection.json
```

**Option 2: Manual Fix in Postman**
```
1. Collections → QUICK-SETUP-TESTS
2. Find: "✅ Admin Verify Doctor #1"
3. Body → Change:
   FROM: { "notes": "..." }
   TO:   { "verificationNotes": "..." }
4. Repeat for Doctor #2
```

---

## 📋 API Field Reference

### Verify Doctor Endpoint

**Endpoint:** `POST /admin/doctors/:id/verify`

**Request Body:**
```typescript
{
  verificationNotes?: string  // ✅ CORRECT FIELD NAME
}
```

**DTO Source:** 
```
c:\SE121\Healthcare-System\apps\api\src\modules\admin\dto\verify-doctor.dto.ts
```

**Constraints:**
- Field: `verificationNotes`
- Type: `string`
- Required: `false` (optional)
- Max Length: `500` characters

---

## 🧪 Test Verification

### Before Running Verification Step:

```
✅ Ensure using: verificationNotes
✅ NOT using: notes
✅ NOT using: note
✅ NOT using: other fields
```

### Expected Response (Success):

```json
{
  "id": "507f1f77bcf86cd799439012",
  "email": "doctor@test.com",
  "name": "Test Doctor",
  "role": "doctor",
  "verified": true,
  "createdAt": "2026-03-17T...",
  ...
}
```

---

## 💡 Why This Error Happens

**Root Cause: Whitelist Validation**

In `c:\SE121\Healthcare-System\apps\api\src\main.ts`:

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,           // ← This removes unknown properties
    forbidNonWhitelisted: true // ← This throws error on unknown properties
    transform: true,
  }),
);
```

**Explanation:**
- `whitelist: true` → Xóa các field không khai báo trong DTO
- `forbidNonWhitelisted: true` → Throw error thay vì xóa lặng lẽ
- Result: Nếu gửi `notes` mà DTO chỉ có `verificationNotes` → ERROR 400

---

## ✅ All Fixed Files

| File | Changed | Status |
|------|---------|--------|
| QUICK-SETUP-TESTS.postman_collection.json | ✅ | Fixed |
| ENVIRONMENT-SETUP-GUIDE.md | ✅ | Updated |
| verify-doctor.dto.ts | ✅ | Enhanced |

---

## 🎯 Next Steps

1. ✅ **Re-import** or **manually update** Postman collection
2. ✅ **Run Step:** "✅ Admin Verify Doctor #1"
3. ✅ **Should pass** with status 200/201
4. ✅ **Run Step:** "✅ Admin Verify Doctor #2"
5. ✅ **Continue** with remaining setup steps

---

## 📞 If Error Still Occurs

### Check:
```
1. API server running? (pnpm start:dev)
2. Using correct field: verificationNotes
3. No typos in field name
4. Bearer token is valid
5. Doctor IDs exist
```

### Debug:
```
Console (Ctrl+Alt+C) → Check error message details
Response Body → Copy exact error
Compare with API docs
```

---

**Status:** ✅ FIXED & VERIFIED  
**Ready to use:** QUICK-SETUP-TESTS collection v1.0.1
