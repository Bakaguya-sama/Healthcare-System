# 📸 CLOUDINARY API REFACTOR - COMPREHENSIVE ANALYSIS
**Date:** April 2, 2026  
**Status:** Planning Phase  
**Scope:** All 17 database tables with file/image upload related fields

---

## 🎯 OBJECTIVE
Refactor all APIs that handle `avatarUrl`, `verificationDocuments`, `fileUrl`, `file_url` fields to use Cloudinary uploaded file URLs instead of raw user input.

**Key Principle:**
- ✅ **Before:** Users pass URLs directly in request body
- ✅ **After:** Users upload files via Cloudinary, API stores returned URLs

---

## 📊 AFFECTED TABLES & FIELDS (17 Tables Total)

### **TIER 1: CORE PROFILE TABLES (Upload-Heavy)**

| Table | Fields with URLs | Current Issue | Required Fix |
|-------|-----------------|----------------|-------------|
| **Users** | `avatarUrl` | Users input URL directly ❌ | Should be from Cloudinary upload ✅ |
| **Doctors** | `verificationDocuments[]` | Users input URLs directly ❌ | Should be from Cloudinary batch upload ✅ |
| **Admins** | (inherits avatarUrl from Users) | N/A | N/A |
| **Patients** | (inherits avatarUrl from Users) | N/A | N/A |

### **TIER 2: MESSAGING TABLES (File Attachments)**

| Table | Fields with URLs | Current Issue | Required Fix |
|-------|-----------------|----------------|-------------|
| **Doctor_Messages** | `attachments[].fileUrl` | Users input URL directly ❌ | Should be from Cloudinary upload ✅ |
| **AI_Messages** | `attachments[].fileUrl` | Users input URL directly ❌ | Should be from Cloudinary upload ✅ |

### **TIER 3: KNOWLEDGE BASE TABLES (Document Management)**

| Table | Fields with URLs | Current Issue | Required Fix |
|-------|-----------------|----------------|-------------|
| **AI_Documents** | `fileUrl` | Admin inputs URL directly ❌ | Should be from Cloudinary upload ✅ |
| **AI_Document_Chunks** | (references AI_Documents) | N/A | N/A |
| **Blacklist_Keywords** | (no file fields) | N/A | N/A |

### **TIER 4: OTHER TABLES (No direct uploads)**

| Table | Status |
|-------|--------|
| Health_Metrics | ✅ No file fields |
| Notifications | ✅ No file fields |
| AI_Health_Insights | ✅ No file fields |
| Sessions (Doctor) | ✅ No file fields |
| AI_Sessions | ✅ No file fields |
| Reviews | ✅ No file fields |
| Violations | ✅ No file fields |

---

## 🔧 REQUIRED API CHANGES

### **GROUP A: User Profile Avatar Upload**

**Endpoints to Modify:**

1. **POST /auth/register** 
   - ❌ Current: Accepts `avatarUrl` string in body
   - ✅ New: Should NOT accept avatarUrl in body
   - ✅ Solution: User uploads avatar separately after registration

2. **PATCH /users/me**
   - ❌ Current: Accepts `avatarUrl` string in body
   - ✅ New: Should NOT accept avatarUrl in body
   - ✅ Solution: User uploads avatar separately via Cloudinary endpoint, then saves URL

3. **NEW ENDPOINT NEEDED: POST /upload/single**
   - ✅ Already exists in upload.controller.ts
   - ✅ Handles multipart file upload
   - ✅ Returns { file: { publicId, url, secureUrl, size } }
   - Usage: User uploads avatar → receives URL → calls PATCH /users/me { avatarUrl: url }

---

### **GROUP B: Doctor Verification Documents Upload**

**Endpoints to Modify:**

1. **POST /auth/register** (Doctor role)
   - ❌ Current: No way to upload verification docs during registration
   - ✅ New: Accept registrations without docs, then upload separately

2. **PATCH /users/me** (Doctor role)
   - ❌ Current: Accepts `verificationDocuments[]` URLs directly
   - ✅ New: Should NOT accept verificationDocuments in body
   - ✅ Solution: Doctor uploads documents separately, then saves array of URLs

3. **NEW ENDPOINT NEEDED: POST /upload/multiple**
   - ✅ Already exists in upload.controller.ts
   - ✅ Handles batch multipart file upload (max 3-5 files)
   - ✅ Returns { files: [{ publicId, url, secureUrl, size }, ...] }
   - Usage: Doctor uploads 2-3 certificates → receives URL array → calls PATCH /users/me { verificationDocuments: [...urls] }

4. **New dedicated endpoint: POST /doctors/:doctorId/upload-verification**
   - 🆕 Purpose: Specialized doctor verification document upload
   - 🆕 Role: DOCTOR only (can upload own docs) + ADMIN (can upload for doctors)
   - 🆕 Workflow: Upload files → auto-attach to doctor profile

---

### **GROUP C: Chat & AI Message Attachments**

**Endpoints to Modify:**

1. **POST /sessions/:sessionId/messages** (Doctor-Patient Chat)
   - ❌ Current: Accepts `attachments[{ fileUrl, fileName, fileSize, mimeType }]` directly
   - ✅ New: Require fileUrl to be Cloudinary URL (validate URL format)
   - ✅ Solution: Sender uploads file first → receives URL → sends message with URL

2. **POST /ai-sessions/:sessionId/messages** (AI Chat)
   - ❌ Current: Accepts `attachments[{ fileUrl, fileName, fileSize, mimeType }]` directly
   - ✅ New: Require fileUrl to be Cloudinary URL (validate URL format)
   - ✅ Solution: Patient uploads file first → receives URL → sends AI message with URL

3. **Pre-upload workflow (needed in frontend):**
   - Call POST /upload/single { file, folder: "healthcare/chat/attachments", fileType: "document" }
   - Receive URL
   - Call POST /sessions/:sessionId/messages { content, attachments: [{ fileUrl: url, fileName, ... }] }

---

### **GROUP D: AI Document Management (Admin Only)**

**Endpoints to Modify:**

1. **POST /ai-documents** (Admin - Upload Knowledge Base Document)
   - ❌ Current: Accepts `fileUrl` string directly
   - ✅ New: Require fileUrl to be Cloudinary URL (validate format)
   - ✅ Solution: Admin uploads document first → receives URL → creates AI document record

2. **PATCH /ai-documents/:id** (Admin - Update Document)
   - ❌ Current: Accepts `fileUrl` string directly
   - ✅ New: Optional fileUrl only if valid Cloudinary URL
   - ✅ Solution: Admin can re-upload document if needed

3. **Pre-upload workflow:**
   - Call POST /upload/single { file, folder: "healthcare/ai/documents", fileType: "document" }
   - Receive URL
   - Call POST /ai-documents { title, fileUrl: url, fileType: "pdf" }

---

## 📋 DETAILED ACTION ITEMS

### **STEP 1: Update DTOs (Remove direct URL acceptance)**

**Files to modify:**

1. `src/modules/auth/dto/register.dto.ts`
   - Remove: `avatarUrl?: string`
   
2. `src/modules/users/dto/update-user.dto.ts`
   - Change: `@IsUrl()` validation for `avatarUrl` → Keep but add comment: "Must be Cloudinary URL"
   - Change: `verificationDocuments` → Keep but add comment: "Array of Cloudinary URLs"

3. `src/modules/chat/dto/send-message.dto.ts`
   - Change: `attachments[].fileUrl` → Add validation: URL must start with Cloudinary domain
   
4. `src/modules/ai-messages/dto/create-ai-message.dto.ts`
   - Change: `attachments[].fileUrl` → Add validation: URL must be Cloudinary

5. `src/modules/ai-documents/dto/create-ai-document.dto.ts`
   - Change: `fileUrl` → Add validation: URL must be Cloudinary domain

---

### **STEP 2: Update Services (Add URL validation)**

Add utility function to validate Cloudinary URLs:
```typescript
// src/core/utils/cloudinary.utils.ts
export const isCloudinaryUrl = (url: string): boolean => {
  return url.includes('res.cloudinary.com') || url.includes('cloudinary.com');
};

export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};
```

---

### **STEP 3: Update Controllers (Add new upload endpoints)**

**New endpoints to create:**

1. **POST /doctors/:doctorId/upload-verification** (DOCTOR/ADMIN)
   - Multipart file upload
   - Max 5 files
   - Folder: healthcare/doctors/verification
   - Auto-appends URLs to doctor.verificationDocuments array

2. **POST /users/:userId/upload-avatar** (Own user/ADMIN)
   - Single file upload
   - Folder: healthcare/profiles
   - Auto-updates user.avatarUrl

---

### **STEP 4: Update Postman Collection**

Update request bodies to reflect Cloudinary URL requirements:

**Before:**
```json
{
  "avatarUrl": "https://example.com/random-url.jpg",
  "verificationDocuments": ["https://example.com/doc1.pdf"]
}
```

**After:**
```json
{
  "avatarUrl": "https://res.cloudinary.com/.../profile.jpg",
  "verificationDocuments": ["https://res.cloudinary.com/.../cert1.pdf"]
}
```

---

### **STEP 5: Update API Test Guide**

Add detailed workflow sections:

1. **Avatar Upload Workflow**
   - Step 1: POST /upload/single (upload avatar)
   - Step 2: PATCH /users/me (update profile with avatar URL)

2. **Doctor Verification Workflow**
   - Step 1: POST /upload/multiple (upload docs)
   - Step 2: PATCH /users/me (update doctor profile with doc URLs)

3. **Chat Attachment Workflow**
   - Step 1: POST /upload/single (upload file)
   - Step 2: POST /sessions/:id/messages (send message with file)

4. **AI Document Workflow**
   - Step 1: POST /upload/single (upload knowledge base doc)
   - Step 2: POST /ai-documents (create AI document record with URL)

---

## ⚠️ MIGRATION STRATEGY

### **Option 1: Strict (Breaking Change)**
- Remove `avatarUrl` from auth register immediately
- Require all URLs to be Cloudinary URLs
- Old URLs in DB become invalid (need migration)

### **Option 2: Gentle (Backward Compatible)**
- Add validation that URLs should be Cloudinary URLs
- Log warning if non-Cloudinary URLs are submitted
- Accept both for now, plan deprecation

**RECOMMENDATION: Option 2** (safer for existing data)

---

## 🔍 VALIDATION CHECKLIST

- [ ] All DTOs updated with URL validation
- [ ] Services have Cloudinary URL validators
- [ ] All upload endpoints return correct Cloudinary URLs
- [ ] Postman collection updated with Cloudinary workflows
- [ ] Test guide updated with step-by-step workflows
- [ ] Error messages guide users to upload first
- [ ] Seed data uses only Cloudinary URLs
- [ ] No hardcoded URLs in code (use validators)

---

## 📚 CLOUDINARY URL FORMAT REFERENCE

**Standard Cloudinary URL Pattern:**
```
https://res.cloudinary.com/{CLOUD_NAME}/{TYPE}/upload/{MODIFIERS}/{PUBLIC_ID}
```

**Example:**
```
https://res.cloudinary.com/healthcare-app/image/upload/c_fill,w_200,h_200/healthcare/profiles/user123.jpg
https://res.cloudinary.com/healthcare-app/raw/upload/healthcare/doctors/verification/license.pdf
```

**Validation Regex:**
```regex
^https:\/\/res\.cloudinary\.com\/[^\/]+\/(image|raw|video)\/upload\/.*$
```

---

## 📝 IMPLEMENTATION ORDER

1. ✅ Phase 1: Create URL validators + utility functions
2. ✅ Phase 2: Update DTOs with validation rules
3. ✅ Phase 3: Create dedicated upload endpoints
4. ✅ Phase 4: Update services to use validators
5. ✅ Phase 5: Update Postman collection
6. ✅ Phase 6: Update API test guide
7. ✅ Phase 7: Test complete workflows
8. ✅ Phase 8: Document migration guide for existing data

