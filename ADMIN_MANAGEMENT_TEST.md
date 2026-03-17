# 🛠️ Admin Management Module - API Testing Guide

**Module:** Healthcare Admin Management System  
**Version:** 1.0.0  
**Date:** 2026-03-17  
**Status:** Phase 1 - Critical Admin Features ✅

---

## 📋 Overview

This document provides comprehensive testing instructions for the Admin Management Module, which includes:
1. **Doctor Verification System** - Approve/reject doctor accounts
2. **Account Lock/Unlock** - Manage violating accounts
3. **Violation Management** - Report and track violations
4. **Sessions Admin View** - Monitor all consultations

---

## 🔑 Prerequisites

### Required Setup
```bash
# 1. Environment variables in .env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/healthcare
JWT_SECRET=your_secret_key
JWT_EXPIRATION=1h

# 2. Base URL (update Postman variable)
base_url = http://localhost:3000/api/v1

# 3. Test accounts needed
- Admin account (verified and created)
- Doctor account (pending verification)
- Patient account (for testing sessions)
- Another user (for testing violations)
```

### Tools Required
- Postman (for API testing)
- MongoDB Atlas (database)
- VS Code (code review)

---

## 🚀 Getting Started

### 1. Import Postman Collection
1. Open Postman
2. Click `Import` → Select `Healthcare-Admin-Management-API.postman_collection.json`
3. Collection will appear in left sidebar
4. Update `{{base_url}}` variable if needed

### 2. Set Variables in Postman
```javascript
// In Postman Pre-request Script (Tests tab)
pm.environment.set("admin_token", "your_admin_jwt_token");
pm.environment.set("doctor_id", "extracted_doctor_id");
pm.environment.set("user_id", "extracted_user_id");
pm.environment.set("violation_id", "extracted_violation_id");
pm.environment.set("session_id", "extracted_session_id");
```

### 3. Start the API Server
```bash
cd apps/api
npm run start:dev

# Expected output:
# [Nest] 3/17/26, 10:30:00 AM     LOG [NestFactory] Starting Nest application...
# [Nest] 3/17/26, 10:30:02 AM     LOG [InstanceLoader] MongooseModule dependencies initialized
# [Nest] 3/17/26, 10:30:02 AM     LOG [RoutesResolver] AdminController {/admin}:
# [Nest] 3/17/26, 10:30:02 AM     LOG Nest application successfully started
```

---

## 🧪 Test Scenarios

### Scenario 1: Doctor Verification Workflow ✅

**Objective:** Test complete doctor approval/rejection process

#### Step 1: Create Test Doctor Account
```bash
POST /auth/register
Body:
{
  "email": "dr.john@healthcare.com",
  "password": "SecurePass123!",
  "name": "Dr. John Smith",
  "role": "doctor",
  "phone": "0903123456",
  "specialization": "Cardiology",
  "licenseNumber": "LN123456789"
}

Expected Response: 201 Created
{
  "id": "doctor_id_here",
  "email": "dr.john@healthcare.com",
  "doctorVerificationStatus": "pending"
}
```

#### Step 2: Get Pending Doctors (Admin)
```bash
GET /admin/doctors/pending
Headers: Authorization: Bearer {{admin_token}}

Expected Response: 200 OK
[
  {
    "_id": "doctor_id_here",
    "name": "Dr. John Smith",
    "email": "dr.john@healthcare.com",
    "specialization": "Cardiology",
    "doctorVerificationStatus": "pending",
    "createdAt": "2026-03-17T10:00:00Z"
  }
]
```

#### Step 3: Verify Doctor (Approve)
```bash
POST /admin/doctors/{{doctor_id}}/verify
Headers: Authorization: Bearer {{admin_token}}
Body:
{
  "verificationNotes": "Credentials verified. Excellent academic background and 5+ years of experience."
}

Expected Response: 200 OK
{
  "_id": "doctor_id_here",
  "name": "Dr. John Smith",
  "doctorVerificationStatus": "approved",
  "verifiedBy": "admin_id_here",
  "verifiedAt": "2026-03-17T10:05:00Z",
  "verificationNotes": "Credentials verified..."
}
```

#### Step 4: Verify Doctor Can Now Create Sessions
After approval, doctor should be able to:
```bash
POST /sessions
{
  "patientId": "patient_id",
  "type": "consultation",
  "title": "Initial Consultation",
  "description": "Patient's first visit",
  "scheduledAt": "2026-03-20T14:00:00Z",
  "duration": 30
}

Expected Response: 201 Created (Doctor verified ✅)
```

#### Alternative: Reject Doctor
```bash
POST /admin/doctors/{{doctor_id}}/reject
Headers: Authorization: Bearer {{admin_token}}
Body:
{
  "reason": "Credentials could not be verified. License has expired."
}

Expected Response: 200 OK
{
  "doctorVerificationStatus": "rejected",
  "verificationNotes": "Credentials could not be verified..."
}
```

---

### Scenario 2: Account Lock/Unlock Workflow 🔒

**Objective:** Test account locking mechanism for violations

#### Step 1: Lock Account
```bash
POST /admin/users/{{user_id}}/lock
Headers: Authorization: Bearer {{admin_token}}
Body:
{
  "reason": "Violation of terms: Inappropriate behavior and harassment of other users."
}

Expected Response: 200 OK
{
  "_id": "user_id_here",
  "name": "User Name",
  "accountStatus": "banned",
  "lockHistory": [
    {
      "lockedAt": "2026-03-17T10:30:00Z",
      "lockedBy": "admin_id_here",
      "reason": "Violation of terms..."
    }
  ]
}
```

#### Step 2: Verify Account is Banned
Try to login with banned account:
```bash
POST /auth/login
Body:
{
  "email": "locked@user.com",
  "password": "password123"
}

Expected Response: 403 Forbidden
{
  "statusCode": 403,
  "message": "Account is banned. Please contact support.",
  "error": "Forbidden"
}
```

#### Step 3: View Lock History
```bash
GET /admin/users/{{user_id}}/lock-history
Headers: Authorization: Bearer {{admin_token}}

Expected Response: 200 OK
{
  "userId": "user_id_here",
  "name": "User Name",
  "accountStatus": "banned",
  "lockHistory": [
    {
      "lockedAt": "2026-03-17T10:30:00Z",
      "lockedBy": "admin_id_here",
      "reason": "Violation of terms: Inappropriate behavior..."
    }
  ]
}
```

#### Step 4: Unlock Account
```bash
POST /admin/users/{{user_id}}/unlock
Headers: Authorization: Bearer {{admin_token}}

Expected Response: 200 OK
{
  "_id": "user_id_here",
  "name": "User Name",
  "accountStatus": "active",
  "lockHistory": [
    {
      "lockedAt": "2026-03-17T10:30:00Z",
      "lockedBy": "admin_id_here",
      "reason": "Violation of terms...",
      "unlockedAt": "2026-03-17T11:00:00Z",
      "unlockedBy": "admin_id_here"
    }
  ]
}
```

#### Step 5: Verify Account Can Login Again
```bash
POST /auth/login
Body:
{
  "email": "locked@user.com",
  "password": "password123"
}

Expected Response: 200 OK
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "user": { "id": "user_id_here", "email": "locked@user.com" }
}
```

---

### Scenario 3: Violation Management Workflow ⚠️

**Objective:** Complete violation reporting and resolution

#### Step 1: Create Violation Report
```bash
POST /admin/violations
Headers: Authorization: Bearer {{admin_token}}
Body:
{
  "reportedUserId": "user_id",
  "type": "harassment",
  "reason": "Patient reported receiving abusive language from doctor in chat messages.",
  "evidence": "https://example.com/screenshots/chat-abuse.jpg"
}

Expected Response: 201 Created
{
  "_id": "violation_id_here",
  "reportedUserId": "user_id",
  "reporterId": "admin_id_here",
  "type": "harassment",
  "reason": "Patient reported receiving abusive language...",
  "status": "pending",
  "evidence": "https://example.com/screenshots/chat-abuse.jpg",
  "notes": [],
  "createdAt": "2026-03-17T10:30:00Z"
}
```

#### Step 2: Get All Violations (with Filters)
```bash
GET /admin/violations?page=1&limit=10&status=pending&sortOrder=desc
Headers: Authorization: Bearer {{admin_token}}

Expected Response: 200 OK
{
  "data": [
    {
      "_id": "violation_id_here",
      "reportedUserId": {
        "_id": "user_id",
        "name": "Dr. John Smith",
        "email": "dr.john@healthcare.com",
        "role": "doctor"
      },
      "type": "harassment",
      "reason": "Patient reported receiving abusive language...",
      "status": "pending",
      "notes": [],
      "createdAt": "2026-03-17T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "pages": 1
  }
}
```

#### Step 3: Get Violation Details
```bash
GET /admin/violations/{{violation_id}}
Headers: Authorization: Bearer {{admin_token}}

Expected Response: 200 OK
{
  "_id": "violation_id_here",
  "reportedUserId": {
    "_id": "user_id",
    "name": "Dr. John Smith",
    "email": "dr.john@healthcare.com",
    "role": "doctor",
    "phone": "+1234567890"
  },
  "reporterId": {
    "_id": "admin_id",
    "name": "Admin",
    "email": "admin@healthcare.com"
  },
  "type": "harassment",
  "reason": "Patient reported receiving abusive language from doctor in chat messages.",
  "status": "pending",
  "evidence": "https://example.com/screenshots/chat-abuse.jpg",
  "notes": [],
  "createdAt": "2026-03-17T10:30:00Z"
}
```

#### Step 4: Add Investigation Notes
```bash
POST /admin/violations/{{violation_id}}/note
Headers: Authorization: Bearer {{admin_token}}
Body:
{
  "note": "Reviewed chat logs. Evidence confirms harassment. Recommended action: 30-day account suspension."
}

Expected Response: 200 OK
{
  "_id": "violation_id_here",
  "notes": [
    {
      "note": "Reviewed chat logs. Evidence confirms harassment...",
      "addedBy": {
        "_id": "admin_id",
        "name": "Admin",
        "email": "admin@healthcare.com"
      },
      "addedAt": "2026-03-17T10:45:00Z"
    }
  ]
}
```

#### Step 5: Resolve Violation (Lock Account)
```bash
PATCH /admin/violations/{{violation_id}}/resolve
Headers: Authorization: Bearer {{admin_token}}
Body:
{
  "resolution": "Account locked for 30 days. Doctor account suspended pending review."
}

Expected Response: 200 OK
{
  "_id": "violation_id_here",
  "status": "resolved",
  "resolution": "Account locked for 30 days. Doctor account suspended pending review.",
  "resolvedAt": "2026-03-17T10:50:00Z",
  "resolvedBy": {
    "_id": "admin_id",
    "name": "Admin",
    "email": "admin@healthcare.com"
  }
}
```

#### Step 6: Then Lock the User Account
```bash
POST /admin/users/{{user_id}}/lock
Headers: Authorization: Bearer {{admin_token}}
Body:
{
  "reason": "Violation ID: {{violation_id}} - Harassment of patient. Account suspended for 30 days."
}

Expected Response: 200 OK
{
  "_id": "user_id",
  "accountStatus": "locked"
}
```

---

### Scenario 4: Sessions Admin View 📅

**Objective:** Test admin monitoring of all consultations

#### Step 1: Get All Sessions
```bash
GET /admin/sessions?page=1&limit=20&sortOrder=desc
Headers: Authorization: Bearer {{admin_token}}

Expected Response: 200 OK
{
  "data": [
    {
      "_id": "session_id_here",
      "patientId": {
        "_id": "patient_id",
        "name": "John Doe",
        "email": "john@patient.com",
        "phone": "0901234567"
      },
      "doctorId": {
        "_id": "doctor_id",
        "name": "Dr. Jane Smith",
        "email": "dr.jane@healthcare.com",
        "specialization": "Cardiology"
      },
      "type": "consultation",
      "title": "Initial Consultation",
      "description": "Patient's first visit for cardiac assessment",
      "scheduledAt": "2026-03-20T14:00:00Z",
      "duration": 30,
      "status": "pending",
      "createdAt": "2026-03-17T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 5,
    "page": 1,
    "limit": 20,
    "pages": 1
  }
}
```

#### Step 2: Filter Sessions by Doctor
```bash
GET /admin/sessions?page=1&limit=10&doctorId={{doctor_id}}
Headers: Authorization: Bearer {{admin_token}}

Expected Response: 200 OK
{
  "data": [
    // Sessions filtered by doctor
  ],
  "pagination": {
    "total": 3,
    "page": 1,
    "limit": 10,
    "pages": 1
  }
}
```

#### Step 3: Filter Sessions by Status
```bash
GET /admin/sessions?page=1&limit=10&status=pending
Headers: Authorization: Bearer {{admin_token}}

Expected Response: 200 OK
{
  "data": [
    // Pending sessions only
  ],
  "pagination": {
    "total": 2
  }
}
```

#### Step 4: Get Session Details
```bash
GET /admin/sessions/{{session_id}}
Headers: Authorization: Bearer {{admin_token}}

Expected Response: 200 OK
{
  "_id": "session_id_here",
  "patientId": {
    "_id": "patient_id",
    "name": "John Doe",
    "email": "john@patient.com",
    "phone": "0901234567",
    "dateOfBirth": "1990-05-15T00:00:00Z"
  },
  "doctorId": {
    "_id": "doctor_id",
    "name": "Dr. Jane Smith",
    "email": "dr.jane@healthcare.com",
    "specialization": "Cardiology",
    "licenseNumber": "LN123456789"
  },
  "type": "consultation",
  "title": "Initial Consultation",
  "description": "Patient's first visit for cardiac assessment",
  "scheduledAt": "2026-03-20T14:00:00Z",
  "duration": 30,
  "status": "pending",
  "startedAt": null,
  "endedAt": null,
  "note": null,
  "meetingUrl": null,
  "diagnosis": null,
  "prescription": null,
  "attachments": [],
  "isReminderSent": false,
  "createdAt": "2026-03-17T10:00:00Z",
  "updatedAt": "2026-03-17T10:00:00Z"
}
```

---

### Scenario 5: Dashboard Statistics 📊

**Objective:** Test admin dashboard stats

#### Get System Statistics
```bash
GET /admin/dashboard/stats
Headers: Authorization: Bearer {{admin_token}}

Expected Response: 200 OK
{
  "users": {
    "total": 45,
    "doctors": 8,
    "pendingDoctors": 2
  },
  "sessions": {
    "total": 123
  },
  "violations": {
    "pending": 3
  },
  "security": {
    "bannedAccounts": 1
  }
}
```

---

## 🔐 Authorization & Role Testing

### Test: Non-Admin Cannot Access Admin Endpoints
```bash
# Using patient token instead of admin token
GET /admin/doctors/pending
Headers: Authorization: Bearer {{patient_token}}

Expected Response: 403 Forbidden
{
  "statusCode": 403,
  "message": "Forbidden resource",
  "error": "Forbidden"
}
```

### Test: Missing Authorization Header
```bash
GET /admin/doctors/pending
# No Authorization header

Expected Response: 401 Unauthorized
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

---

## ❌ Error Handling Tests

### Test 1: Doctor Not Found
```bash
POST /admin/doctors/invalid_id/verify
Headers: Authorization: Bearer {{admin_token}}
Body: { "verificationNotes": "Test" }

Expected Response: 404 Not Found
{
  "statusCode": 404,
  "message": "Doctor not found",
  "error": "Not Found"
}
```

### Test 2: User Already Banned
```bash
# Ban user first, then try to ban again
POST /admin/users/{{user_id}}/lock
Headers: Authorization: Bearer {{admin_token}}
Body: { "reason": "Test" }

# Second request to same user
POST /admin/users/{{user_id}}/lock
Headers: Authorization: Bearer {{admin_token}}
Body: { "reason": "Test again" }

Expected Response: 400 Bad Request
{
  "statusCode": 400,
  "message": "Account is already banned",
  "error": "Bad Request"
}
```

### Test 3: Invalid Violation Type
```bash
POST /admin/violations
Headers: Authorization: Bearer {{admin_token}}
Body:
{
  "reportedUserId": "user_id",
  "type": "invalid_type",
  "reason": "Test"
}

Expected Response: 400 Bad Request
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

### Test 4: Doctor Not in Pending Status
```bash
# After verifying doctor
POST /admin/doctors/{{doctor_id}}/verify
Headers: Authorization: Bearer {{admin_token}}
Body: { "verificationNotes": "Approved" }

# Try to reject after already approved
POST /admin/doctors/{{doctor_id}}/reject
Headers: Authorization: Bearer {{admin_token}}
Body: { "reason": "Reject" }

Expected Response: 400 Bad Request
{
  "statusCode": 400,
  "message": "Doctor is not in pending status",
  "error": "Bad Request"
}
```

---

## 📈 Performance & Load Testing

### Query Large Volume of Violations
```bash
GET /admin/violations?page=1&limit=100
Headers: Authorization: Bearer {{admin_token}}

# Should return within 2 seconds
Response Time: < 2000ms
```

### Pagination Test
```bash
# Page 1
GET /admin/violations?page=1&limit=10

# Page 2
GET /admin/violations?page=2&limit=10

# Last page
GET /admin/violations?page={{last_page}}&limit=10

Expected: Each request returns correct subset of data
```

---

## ✅ Validation Tests

### Test: Email Validation
```bash
POST /auth/register
Body:
{
  "email": "invalid-email",
  "password": "Pass123!",
  "name": "Test",
  "role": "patient"
}

Expected Response: 400 Bad Request
{
  "statusCode": 400,
  "message": "Invalid email format",
  "error": "Bad Request"
}
```

### Test: String Length Validation
```bash
POST /admin/violations
Headers: Authorization: Bearer {{admin_token}}
Body:
{
  "reportedUserId": "user_id",
  "type": "harassment",
  "reason": "a" // Too short (should be min length)
}

Expected Response: 400 Bad Request
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

---

## 🐛 Troubleshooting

### Issue 1: "Only admin can verify doctors" Error
**Problem:** Using non-admin token
**Solution:**
1. Login as admin user
2. Copy JWT token from response
3. Set `{{admin_token}}` in Postman environment

### Issue 2: "User not found" Error
**Problem:** Using invalid user ID
**Solution:**
1. Create/register user first
2. Copy user ID from response
3. Use in subsequent requests

### Issue 3: 401 Unauthorized
**Problem:** Token expired
**Solution:**
1. Login again to get fresh token
2. Update `{{admin_token}}` variable

### Issue 4: MongoDB Connection Error
**Problem:** Database not accessible
**Solution:**
```bash
# Check .env file has correct MONGODB_URI
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/healthcare

# Verify network access in MongoDB Atlas
# - IP whitelist includes your machine
# - Database user credentials are correct
```

### Issue 5: Postman Variables Not Found
**Problem:** {{variable}} showing as empty
**Solution:**
1. Click "Edit" next to collection name
2. Go to "Variables" tab
3. Set initial and current values for:
   - base_url
   - admin_token
   - doctor_id
   - user_id
   - violation_id
   - session_id

---

## 📝 Testing Checklist

- [ ] Doctor Verification: Approve flow
- [ ] Doctor Verification: Reject flow
- [ ] Account Lock/Unlock: Lock flow
- [ ] Account Lock/Unlock: Unlock flow
- [ ] Account Lock/Unlock: View history
- [ ] Violations: Create report
- [ ] Violations: View all (with filters)
- [ ] Violations: View details
- [ ] Violations: Add notes
- [ ] Violations: Resolve
- [ ] Violations: Dismiss
- [ ] Sessions: View all
- [ ] Sessions: Filter by doctor
- [ ] Sessions: Filter by patient
- [ ] Sessions: Filter by status
- [ ] Sessions: View details
- [ ] Dashboard: Get stats
- [ ] Authorization: Deny non-admin access
- [ ] Error Handling: Test 404 errors
- [ ] Error Handling: Test 400 errors
- [ ] Error Handling: Test 403 errors

---

## 📞 Support & Contact

**Module Owner:** Healthcare Backend Team  
**Last Updated:** 2026-03-17  
**Environment:** Development & Testing

For issues or questions:
1. Check troubleshooting section above
2. Review error response messages
3. Verify all prerequisites are met
4. Check MongoDB connection

---

**Happy Testing! 🚀**
