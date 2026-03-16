# 🤖 AI Assistant Module - Testing Guide

## 📋 Table of Contents
1. [Setup & Prerequisites](#setup--prerequisites)
2. [API Endpoints Overview](#api-endpoints-overview)
3. [Testing Workflow](#testing-workflow)
4. [Error Handling & Solutions](#error-handling--solutions)
5. [Advanced Scenarios](#advanced-scenarios)

---

## Setup & Prerequisites

### Environment Variables
```env
baseUrl=http://localhost:3000/api/v1
accessToken=your_jwt_token_here
conversationId=conversation_object_id
```

### Required Setup Steps
1. ✅ Ensure MongoDB is running
2. ✅ Start NestJS API server (`npm run start:dev`)
3. ✅ Ensure `GEMINI_API_KEY` is set in `.env`
4. ✅ Have user account created via Auth module
5. ✅ Get JWT token via login endpoint
6. ✅ Import `Healthcare-AI-Assistant-API.postman_collection.json` to Postman

---

## API Endpoints Overview

| # | Method | Endpoint | Purpose | Auth |
|---|--------|----------|---------|------|
| 1 | `POST` | `/ai-assistant/conversations/start` | Start new conversation | ✅ |
| 2 | `POST` | `/ai-assistant/conversations/:id/message` | Send message to AI | ✅ |
| 3 | `GET` | `/ai-assistant/conversations` | Get all conversations | ✅ |
| 4 | `GET` | `/ai-assistant/conversations/:id` | Get conversation details | ✅ |
| 5 | `POST` | `/ai-assistant/conversations/:id/favorite` | Toggle favorite | ✅ |
| 6 | `POST` | `/ai-assistant/conversations/:id/archive` | Archive conversation | ✅ |
| 7 | `POST` | `/ai-assistant/conversations/:id/rate` | Rate conversation | ✅ |
| 8 | `PATCH` | `/ai-assistant/conversations/:id` | Update conversation info | ✅ |
| 9 | `DELETE` | `/ai-assistant/conversations/:id` | Delete conversation | ✅ |
| 10 | `GET` | `/ai-assistant/conversations/:id/stats` | Get conversation stats | ✅ |
| 11 | `GET` | `/ai-assistant/summary` | Get user summary | ✅ |
| 12 | `GET` | `/ai-assistant/search?q=...` | Search conversations | ✅ |

---

## Testing Workflow

### 🎯 Basic AI Assistant Flow

#### **Step 1: Start Conversation (API 1)**
```bash
POST /ai-assistant/conversations/start
Authorization: Bearer {{accessToken}}

Body:
{
  "type": "symptom_analysis",
  "initialQuestion": "Tôi bị đau đầu kéo dài 3 ngày, đi kèm với sốt nhẹ",
  "tags": ["headache", "fever", "urgent"]
}

✅ Expected Response (201 Created):
{
  "statusCode": 201,
  "message": "Conversation started successfully",
  "data": {
    "_id": "67abc123def456...",
    "userId": "...",
    "type": "symptom_analysis",
    "topic": "Tôi bị đau đầu kéo dài 3 ngày, đi kèm với sốt nhẹ",
    "messages": [
      {
        "role": "user",
        "content": "Tôi bị đau đầu kéo dài 3 ngày, đi kèm với sốt nhẹ",
        "timestamp": "2024-01-15T10:30:00Z"
      }
    ],
    "messageCount": 1,
    "totalTokensUsed": 0,
    "tags": ["headache", "fever", "urgent"],
    "status": "active",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

**💾 Save conversationId from response for later tests**

---

#### **Step 2: Send Message to AI (API 2)**
```bash
POST /ai-assistant/conversations/{{conversationId}}/message
Authorization: Bearer {{accessToken}}

Body:
{
  "message": "Huyết áp của tôi là 140/90. Đây có nguy hiểm không?",
  "conversationType": "health_inquiry"
}

✅ Expected Response (200 OK):
{
  "statusCode": 200,
  "message": "Message processed successfully",
  "data": {
    "conversationId": "67abc123def456...",
    "userMessage": "Huyết áp của tôi là 140/90. Đây có nguy hiểm không?",
    "aiResponse": "Huyết áp 140/90 mmHg được xem là cao (Stage 2 Hypertension)...",
    "messageCount": 3
  }
}
```

---

### 📌 Conversation Management

#### **Get All Conversations (API 3)**
```bash
GET /ai-assistant/conversations?page=1&limit=20&type=symptom_analysis&status=active
Authorization: Bearer {{accessToken}}

✅ Expected Response (200 OK):
{
  "statusCode": 200,
  "message": "Conversations retrieved successfully",
  "data": [
    {
      "_id": "...",
      "type": "symptom_analysis",
      "topic": "Tôi bị đau đầu...",
      "messageCount": 5,
      "isFavorite": false,
      "status": "active",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "pages": 1
  }
}
```

#### **Get Single Conversation (API 4)**
```bash
GET /ai-assistant/conversations/{{conversationId}}
Authorization: Bearer {{accessToken}}

✅ Expected Response (200 OK):
{
  "statusCode": 200,
  "message": "Conversation retrieved successfully",
  "data": {
    "_id": "67abc123def456...",
    "userId": "...",
    "type": "symptom_analysis",
    "topic": "Tôi bị đau đầu kéo dài 3 ngày",
    "messages": [
      {
        "role": "user",
        "content": "...",
        "timestamp": "2024-01-15T10:30:00Z"
      },
      {
        "role": "assistant",
        "content": "...",
        "timestamp": "2024-01-15T10:31:00Z"
      }
    ],
    "messageCount": 3,
    "totalTokensUsed": 250,
    "isFavorite": false,
    "rating": null
  }
}
```

---

#### **Toggle Favorite (API 5)**
```bash
POST /ai-assistant/conversations/{{conversationId}}/favorite
Authorization: Bearer {{accessToken}}

✅ Expected Response (200 OK):
{
  "statusCode": 200,
  "message": "Favorite status updated",
  "data": {
    "isFavorite": true
  }
}
```

#### **Archive Conversation (API 6)**
```bash
POST /ai-assistant/conversations/{{conversationId}}/archive
Authorization: Bearer {{accessToken}}

Body:
{
  "isArchived": true
}

✅ Expected Response (200 OK):
{
  "statusCode": 200,
  "message": "Conversation archived successfully",
  "data": {
    "isArchived": true
  }
}
```

#### **Rate Conversation (API 7)**
```bash
POST /ai-assistant/conversations/{{conversationId}}/rate
Authorization: Bearer {{accessToken}}

Body:
{
  "rating": 5,
  "comment": "Very helpful and informative"
}

✅ Expected Response (200 OK):
{
  "statusCode": 200,
  "message": "Conversation rated successfully",
  "data": {
    "rating": 5,
    "comment": "Very helpful and informative"
  }
}
```

---

#### **Update Conversation (API 8)**
```bash
PATCH /ai-assistant/conversations/{{conversationId}}
Authorization: Bearer {{accessToken}}

Body:
{
  "topic": "Updated topic",
  "internalNotes": "Follow up with doctor",
  "tags": ["urgent", "follow-up"],
  "status": "completed"
}

✅ Expected Response (200 OK):
{
  "statusCode": 200,
  "message": "Conversation updated successfully",
  "data": {
    "_id": "...",
    "topic": "Updated topic",
    "internalNotes": "Follow up with doctor",
    "tags": ["urgent", "follow-up"],
    "status": "completed"
  }
}
```

#### **Delete Conversation (API 9)**
```bash
DELETE /ai-assistant/conversations/{{conversationId}}
Authorization: Bearer {{accessToken}}

✅ Expected Response (200 OK):
{
  "statusCode": 200,
  "message": "Conversation deleted successfully"
}
```

---

### 📊 Analytics & Insights

#### **Get Conversation Statistics (API 10)**
```bash
GET /ai-assistant/conversations/{{conversationId}}/stats
Authorization: Bearer {{accessToken}}

✅ Expected Response (200 OK):
{
  "statusCode": 200,
  "message": "Conversation statistics retrieved successfully",
  "data": {
    "totalMessages": 6,
    "userMessages": 3,
    "assistantMessages": 3,
    "totalTokensUsed": 350,
    "averageMessageLength": 85,
    "conversationType": "symptom_analysis",
    "rating": 5,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T11:00:00Z"
  }
}
```

#### **Get User Summary (API 11)**
```bash
GET /ai-assistant/summary
Authorization: Bearer {{accessToken}}

✅ Expected Response (200 OK):
{
  "statusCode": 200,
  "message": "User summary retrieved successfully",
  "data": {
    "totalConversations": 5,
    "favoriteCount": 2,
    "archivedCount": 1,
    "totalMessages": 20,
    "totalTokensUsed": 1500,
    "averageRating": 4.5,
    "conversationsByType": [
      "symptom_analysis",
      "health_inquiry",
      "medication_info"
    ]
  }
}
```

#### **Search Conversations (API 12)**
```bash
GET /ai-assistant/search?q=headache&page=1&limit=20
Authorization: Bearer {{accessToken}}

✅ Expected Response (200 OK):
{
  "statusCode": 200,
  "message": "Search results retrieved successfully",
  "data": [
    {
      "_id": "...",
      "topic": "Tôi bị đau đầu kéo dài 3 ngày",
      "messageCount": 5,
      "rating": 5
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 3,
    "pages": 1
  }
}
```

---

## Error Handling & Solutions

### ❌ Error: Invalid user ID
```json
{
  "statusCode": 400,
  "message": "Invalid user ID"
}
```
**Solution:** Ensure token is valid and user ID is extracted correctly.

---

### ❌ Error: Conversation not found
```json
{
  "statusCode": 404,
  "message": "Conversation not found"
}
```
**Solution:** Verify `conversationId` is correct. Copy from API response.

---

### ❌ Error: Not authorized to access this conversation
```json
{
  "statusCode": 403,
  "message": "You are not authorized to access this conversation"
}
```
**Solution:** Use token of the user who created the conversation.

---

### ❌ Error: AI service unavailable
```json
{
  "statusCode": 400,
  "message": "AI service unavailable, please try again"
}
```
**Solution:** Check GEMINI_API_KEY is valid and Gemini API is accessible.

---

### ❌ Error: Rating must be between 1 and 5
```json
{
  "statusCode": 400,
  "message": "Rating must be between 1 and 5"
}
```
**Solution:** Provide rating value between 1-5 in rate endpoint.

---

### ❌ Error: 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```
**Solution:** Get fresh JWT token via Login API.

---

## Advanced Scenarios

### 🎯 Scenario 1: Complete Health Inquiry Flow
1. **Start conversation** (API 1) with symptom_analysis type
   - Topic: "Tôi bị đau đầu 3 ngày"
2. **Send 3 messages** (API 2) asking follow-up questions
   - Message 1: Initial symptom description
   - Message 2: Additional symptoms
   - Message 3: Ask about treatment options
3. **Get conversation** (API 4) to see full history
4. **Rate conversation** (API 7) → 5 stars
5. **Get stats** (API 10) → Should show 7 messages total

---

### 🎯 Scenario 2: Favorite & Archive Management
1. **Start 3 conversations** (API 1, repeat 3x)
2. **Toggle favorite on conversation 1** (API 5)
3. **Toggle favorite on conversation 2** (API 5)
4. **Get all conversations** (API 3) with `isFavorite=true` filter → Should show 2
5. **Archive conversation 3** (API 6)
6. **Get all conversations** (API 3) with `status=archived` → Should show 1

---

### 🎯 Scenario 3: Comprehensive Statistics
1. **Start conversation** (API 1)
2. **Send 5 messages** (API 2)
3. **Rate with 4 stars** (API 7)
4. **Get stats** (API 10) → Check all fields
5. **Get user summary** (API 11) → Verify totals

---

### 🎯 Scenario 4: Search & Filter
1. **Start 5 conversations** with different topics:
   - "Đau đầu" (headache)
   - "Huyết áp cao" (high blood pressure)
   - "Mất ngủ" (insomnia)
   - "Đau lưng" (back pain)
   - "Chóng mặt" (dizziness)
2. **Search "đau"** (API 12) → Should return 4 results
3. **Search "huyết"** (API 12) → Should return 1 result
4. **Filter by type** (API 3) → Only health_inquiry
5. **Sort by rating** (API 3) → Highest rated first

---

### 🎯 Scenario 5: Conversation Lifecycle
1. **Start conversation** (API 1) → `status: active`
2. **Send multiple messages** (API 2)
3. **Update to completed** (API 8) → `status: completed`
4. **Toggle favorite** (API 5)
5. **Rate conversation** (API 7)
6. **Archive conversation** (API 6) → `status: archived`
7. **Search archived** (API 12) → Should find it
8. **Delete conversation** (API 9)

---

## 📝 Testing Checklist

- [ ] **Start Conversation** - Creates with all fields
- [ ] **Send Message** - AI responds correctly
- [ ] **Get Conversations** - Lists all user conversations
- [ ] **Pagination** - Correct page/limit calculation
- [ ] **Filtering** - Works by type, status, favorite
- [ ] **Favorite Toggle** - Toggles correctly
- [ ] **Archive** - Archive and unarchive works
- [ ] **Rating** - Accepts 1-5 rating with comment
- [ ] **Update** - Updates topic, notes, tags, status
- [ ] **Delete** - Removes conversation
- [ ] **Statistics** - Calculates all metrics
- [ ] **Search** - Finds conversations by keywords
- [ ] **Authorization** - Only user's conversations accessible
- [ ] **Error Handling** - Proper 400/403/404 responses

---

## 🚀 Performance Tips

1. **Pagination** - Use `limit=20` for conversations
2. **Filtering** - Use type/status filters to narrow results
3. **Search** - Include specific keywords for faster results
4. **Sorting** - Use `sortBy=createdAt&sortOrder=-1` for latest
5. **Token Usage** - Monitor `totalTokensUsed` for AI costs

---

## 📚 Related Modules

- **Auth Module** - Get JWT tokens for testing
- **Users Module** - User profile information
- **Health Metrics Module** - Correlate with health data
- **Sessions Module** - Schedule follow-up appointments with doctors

---

## 🔧 Troubleshooting

**Issue:** AI response is empty or cut off
- **Solution:** Check message length limits (max 2000 chars)
- **Solution:** Verify Gemini API quota

**Issue:** "GEMINI_API_KEY not configured"
- **Solution:** Add `GEMINI_API_KEY` to `.env` file
- **Solution:** Get key from https://aistudio.google.com/

**Issue:** High token usage
- **Solution:** Shorter messages consume fewer tokens
- **Solution:** Archive old conversations to save on storage

---

**Last Updated:** 2024-01-15
**Module Version:** 1.0.0
**Testing Status:** ✅ Complete
