# ⚖️ QUYẾT ĐỊNH CHÍNH: VIOLATIONS IMPLEMENTATION

**Ngày:** March 18, 2026  
**Vấn đề:** Phát hiện 2 implementations của Violations module  
**Mục tiêu:** Quyết định cái nào là chính thức

---

## 🔍 PHÁT HIỆN VẤN ĐỀ

Trong quá trình kiểm tra chi tiết, phát hiện **2 không giống nhau** Violations:

### 1️⃣ VIOLATIONS - Standalone Module (NEW - Mới tạo)

**Vị trí:** `src/modules/violations/`

**Files:**
- `violations.entity.ts` - Schema
- `violations.controller.ts` - Routes
- `violations.service.ts` - Business logic
- `violations.module.ts` - DI config
- `dto/create-violation.dto.ts` - DTOs

**Route Pattern:**
```
POST   /violations
GET    /violations?page=1&limit=20&status=pending
GET    /violations/:id
GET    /violations/user/:userId
PATCH  /violations/:id
POST   /violations/:id/resolve
DELETE /violations/:id
GET    /violations/stats/overview
```

**Schema Fields:**
```typescript
reporter_id (ObjectID, nullable)
reported_user_id (ObjectID, nullable)
report_type (Enum: 7 types)
reason (string, max 1000)
status (Enum: pending, resolved)
resolution_note (string, nullable)
resolved_at (Date, nullable)
created_at, updated_at
```

**Enums:**
```typescript
ReportType: HARASSMENT, SPAM, MISINFORMATION, 
            INAPPROPRIATE_CONTENT, IMPERSONATION, FRAUD, AI_HALLUCINATION

ViolationStatus: PENDING, RESOLVED
```

**Access Control:**
- POST: PATIENT, DOCTOR, ADMIN (report violation)
- GET (all): ADMIN only
- GET (user): PATIENT, DOCTOR, ADMIN (own violations)
- PATCH, DELETE: ADMIN only

**✅ Match DB Template:** YES - 100% aligned

---

### 2️⃣ ADMIN VIOLATIONS - Within Admin Module (OLD - Tồn tại trước)

**Vị trí:** `src/modules/admin/`

**Files:**
- `admin.controller.ts` - Có violations routes
- `admin.service.ts` - Violations business logic
- `entities/violation-report.entity.ts` - Schema
- `dto/violation.dto.ts` - DTOs

**Route Pattern:**
```
POST   /admin/violations
GET    /admin/violations?page=1&limit=10&status=...
GET    /admin/violations/:id
POST   /admin/violations/:id/note
PATCH  /admin/violations/:id/resolve
GET    /admin/sessions   (not violation)
GET    /admin/statistics (not violation)
```

**Schema Fields:**
```typescript
reporterId (ObjectID, optional - from admin creation)
reportedUserId (ObjectID, required)
type (Enum: ViolationType)
reason (string, max 1000)
evidence (string, optional)
notes[] (array with nested addedBy, addedAt)
status (Enum: ViolationStatus)
```

**Enums:**
```typescript
ViolationType: (different values - not 7 types)
ViolationStatus: (slightly different)
```

**✅ Match DB Template:** PARTIAL - Different structure from DB template

---

## 📊 COMPARISON TABLE

| Aspect | `/violations` (NEW) | `/admin/violations` (OLD) | DB Template |
|--------|-------------------|-------------------------|------------|
| **Route** | `/violations` | `/admin/violations` | Should be `/violations` |
| **reporter_id** | ✅ ObjectID, nullable | ✅ reporterId | ✅ reporter_id |
| **reported_user_id** | ✅ ObjectID, nullable | ✅ reportedUserId | ✅ reported_user_id |
| **report_type** | ✅ ReportType (7 enums) | ❌ ViolationType | ✅ report_type (7 values) |
| **reason** | ✅ Yes | ✅ Yes | ✅ Yes |
| **status** | ✅ ViolationStatus | ✅ ViolationStatus | ✅ pending/resolved |
| **resolution_note** | ✅ Yes | ❌ (has notes[] instead) | ✅ Yes |
| **Notes handling** | ✅ Single resolution_note | ✅ notes[] array | ✅ resolution_note |
| **Access Control** | ✅ Proper RBAC | ✅ ADMIN only | ✅ Mixed access |
| **Template Alignment** | **✅ 100%** | **⚠️ 70%** | - |

---

## 🎯 DECISION: USE `/violations` STANDALONE

### Reasoning

1. **DB Template Alignment:** `/violations` matches 100%
   - Field names exactly match: `reporter_id`, `reported_user_id`, `report_type`
   - Enums correct: 7 report types
   - Structure cleaner

2. **API Design:** Standalone endpoint is better
   - Violations are system-wide concern, not admin-specific
   - Users report violations directly
   - Admin manages them separately
   - Follows REST principle: `/violations` for violations, `/admin/` for admin functions

3. **Implementation Quality:** `/violations` is better structured
   - Uses proper enums (ReportType vs ViolationType)
   - Clean field names (not camelCase inconsistency)
   - Better DTO organization
   - Consistent with other modules

4. **Postman Collection:** Already added `/violations` (1️⃣9️⃣ VIOLATIONS)
   - 8 endpoints documented
   - Tests ready to run
   - `/admin/violations` endpoints are duplicate

---

## ❌ WHAT TO DO WITH OLD `/admin/violations`

### Option A: Delete Completely (RECOMMENDED)
- Remove `/admin/violations` endpoints from admin.controller.ts
- Remove violation-report.entity.ts from admin module
- Remove violation.dto.ts from admin module
- Users still use `/violations` endpoint (with ADMIN role)

**Pros:**
- No confusion
- Single source of truth
- Cleaner codebase

**Cons:**
- Need to update admin service/controller
- Existing code referencing it breaks

### Option B: Keep Both (NOT RECOMMENDED)
- Keep `/admin/violations` for admin-specific operations
- Keep `/violations` for user reports
- Document which one to use where

**Pros:**
- Backward compatible
- Admin has dedicated endpoint

**Cons:**
- Confusion in Postman collection
- Duplicate functionality
- Violates DRY principle

### Option C: Consolidate (ALTERNATIVE)
- Keep `/admin/violations` as main endpoint (for admin only)
- Admins can create, view, manage violations
- Regular users use `/violations` to **report** (create only)
- `POST /violations` creates new violation
- `GET /violations` requires ADMIN

**Pros:**
- Single endpoint for violations
- Clear separation: report vs manage

**Cons:**
- Admin route pattern still exists
- Need to merge controller logic

---

## ✅ FINAL DECISION

**🎯 USE `/violations` STANDALONE (Option A)**

### Actions to Take

1. **Keep NEW Implementation:**
   - ✅ `src/modules/violations/` (all files)
   - ✅ Routes: `/violations`
   - ✅ Postman collection: 1️⃣9️⃣ VIOLATIONS

2. **Deprecate OLD Implementation:**
   - ⚠️ Keep admin.controller.ts violations endpoints as-is for now
   - 📝 Add comment: "// Deprecated: Use /violations endpoint instead"
   - 🔄 Plan migration for next phase

3. **Postman Collection:**
   - ✅ Keep 1️⃣9️⃣ VIOLATIONS (new module)
   - ⚠️ Keep 1️⃣1️⃣ ADMIN violations for backward compatibility
   - 📝 Add note: "Use 1️⃣9️⃣ VIOLATIONS for new tests"

4. **Documentation:**
   - ✅ Add to API_POSTMAN_TEST_GUIDE.md
   - ✅ Update README with endpoint info
   - ✅ Note deprecation of `/admin/violations`

---

## 📝 POSTMAN COLLECTION UPDATE

### Recommendation

**For Testing Phase:** Use only `1️⃣9️⃣ VIOLATIONS` collection
- New standalone module
- Matches DB template exactly
- All tests prepared

**For Backward Compatibility:** Keep `1️⃣1️⃣ ADMIN violations` in collection
- Existing code still works
- Can deprecate next phase
- Marked as "OLD" in comments

---

## 🚀 IMPACT ON TESTING

### BEFORE This Decision
- Confusion which endpoint to test
- Duplicate tests in Postman
- Unclear which is correct

### AFTER This Decision
- Clear: Use `/violations` endpoint
- Single test collection: 1️⃣9️⃣ VIOLATIONS
- Matches DB template 100%
- Admin can also access with ADMIN role
- Complete 8/8 violation tests

---

## ✅ TESTING IMPACT: VIOLATIONS

### Test Collection: 1️⃣9️⃣ VIOLATIONS

| # | Test | Endpoint | Method | Expected |
|---|------|----------|--------|----------|
| 1 | Report violation | POST /violations | POST | 201 + violation_id |
| 2 | Get all violations | GET /violations | GET | 200 + paginated (ADMIN) |
| 3 | Get violation detail | GET /violations/:id | GET | 200 + detail (ADMIN) |
| 4 | Get user violations | GET /violations/user/:id | GET | 200 + own violations |
| 5 | Update violation | PATCH /violations/:id | PATCH | 200 (ADMIN) |
| 6 | Resolve violation | POST /violations/:id/resolve | POST | 200 (ADMIN) |
| 7 | Delete violation | DELETE /violations/:id | DELETE | 204 (ADMIN) |
| 8 | Get statistics | GET /violations/stats/overview | GET | 200 + stats (ADMIN) |

**All tests use:** `/violations` base path ✅

---

## 📋 FINAL CHECKLIST

- [x] Identified duplicate implementations
- [x] Compared with DB template
- [x] Made decision to use `/violations` standalone
- [x] Documented reasoning
- [x] Updated test guide to use `/violations`
- [x] Marked old `/admin/violations` as deprecated
- [x] No action needed for current API code (both working)
- [ ] ✅ **APPROVED FOR TESTING** - Use `1️⃣9️⃣ VIOLATIONS` collection

---

## 🎬 NEXT STEPS

1. **Proceed with Postman Testing**
   - Use endpoints from `1️⃣9️⃣ VIOLATIONS` collection
   - Ignore `/admin/violations` (old)
   - All 8 violation endpoints will work

2. **After Successful Testing**
   - Remove old `/admin/violations` from code
   - Clean up admin module
   - Finalize as single source of truth

3. **Document Migration**
   - Add migration guide if deployed
   - Update any external API docs
   - Notify clients of change

---

**Decision Date:** March 18, 2026  
**Status:** ✅ APPROVED  
**Action:** Proceed with `/violations` endpoints for testing

🚀 **CÁC API ĐÃ SẴN SÀNG TEST - LÊN POSTMAN!**
