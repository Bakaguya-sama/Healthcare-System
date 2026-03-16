# 💬 Chat Module - Testing Guide

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
receiverId=other_user_object_id
messageId=message_object_id
```

### Required Setup Steps
1. ✅ Ensure MongoDB is running
2. ✅ Start NestJS API server (`npm run start:dev`)
3. ✅ Have 2 user accounts (patient/doctor) created via Auth module
4. ✅ Get JWT tokens for both users via login endpoint
5. ✅ Import `Healthcare-Chat-API.postman_collection.json` to Postman

---

## API Endpoints Overview

| # | Method | Endpoint | Purpose | Auth |
|---|--------|----------|---------|------|
| 1 | `POST` | `/chat/send` | Send new message | ✅ |
| 2 | `GET` | `/chat/conversation/:otherId` | Get 2-way conversation | ✅ |
| 3 | `GET` | `/chat/messages` | Get all messages (filtered) | ✅ |
| 4 | `GET` | `/chat/messages/:id` | Get single message details | ✅ |
| 5 | `PATCH` | `/chat/messages/:id` | Update message (edit, reactions) | ✅ |
| 6 | `POST` | `/chat/messages/:id/read` | Mark message as read | ✅ |
| 7 | `POST` | `/chat/messages/:id/pin` | Pin message | ✅ |
| 8 | `POST` | `/chat/messages/:id/unpin` | Unpin message | ✅ |
| 9 | `DELETE` | `/chat/messages/:id` | Delete message (soft) | ✅ |
| 10 | `GET` | `/chat/unread-count` | Get all unread count | ✅ |
| 11 | `GET` | `/chat/unread-count?otherId=...` | Get unread from specific user | ✅ |
| 12 | `GET` | `/chat/conversation/:otherId/pinned` | Get pinned messages | ✅ |
| 13 | `POST` | `/chat/conversation/:otherId/mark-read` | Mark entire conversation as read | ✅ |
| 14 | `GET` | `/chat/conversation/:otherId/stats` | Get conversation statistics | ✅ |

---

## Testing Workflow

### 🔄 Basic Message Flow

#### **Step 1: Send Message (API 1)**
```bash
POST /chat/send
Authorization: Bearer {{accessToken}}

Body:
{
  "receiverId": "{{receiverId}}",
  "content": "Hello! How are you?",
  "type": "text"
}

✅ Expected Response (201 Created):
{
  "statusCode": 201,
  "message": "Message sent successfully",
  "data": {
    "_id": "67abc123def456...",
    "senderId": {
      "_id": "...",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "receiverId": {
      "_id": "...",
      "name": "Jane Smith",
      "email": "jane@example.com"
    },
    "content": "Hello! How are you?",
    "type": "text",
    "status": "sent",
    "isRead": false,
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

**💾 Save messageId from response for later tests**

---

#### **Step 2: Get Conversation (API 2)**
```bash
GET /chat/conversation/{{receiverId}}?page=1&limit=20&sortBy=createdAt&sortOrder=-1
Authorization: Bearer {{accessToken}}

✅ Expected Response (200 OK):
{
  "statusCode": 200,
  "message": "Conversation retrieved successfully",
  "data": [
    {
      "_id": "67abc123def456...",
      "senderId": { ... },
      "receiverId": { ... },
      "content": "Hello! How are you?",
      "type": "text",
      "status": "sent",
      "isRead": false,
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

---

#### **Step 3: Mark as Read (API 6)**
```bash
POST /chat/messages/{{messageId}}/read
Authorization: Bearer {{accessToken}}

✅ Expected Response (200 OK):
{
  "statusCode": 200,
  "message": "Message marked as read",
  "data": {
    "isRead": true,
    "readAt": "2024-01-15T10:35:00Z"
  }
}
```

---

### 📌 Advanced Message Features

#### **Pin Message (API 7)**
```bash
POST /chat/messages/{{messageId}}/pin
Authorization: Bearer {{accessToken}}

✅ Expected Response (200 OK):
{
  "statusCode": 200,
  "message": "Message pinned successfully",
  "data": {
    "isPinned": true
  }
}
```

#### **Get Pinned Messages (API 12)**
```bash
GET /chat/conversation/{{receiverId}}/pinned
Authorization: Bearer {{accessToken}}

✅ Expected Response (200 OK):
{
  "statusCode": 200,
  "message": "Pinned messages retrieved successfully",
  "data": [
    {
      "_id": "67abc123def456...",
      "content": "Important message",
      "isPinned": true,
      ...
    }
  ]
}
```

#### **Unpin Message (API 8)**
```bash
POST /chat/messages/{{messageId}}/unpin
Authorization: Bearer {{accessToken}}

✅ Expected Response (200 OK):
{
  "statusCode": 200,
  "message": "Message unpinned successfully",
  "data": {
    "isPinned": false
  }
}
```

---

#### **Edit Message (API 5)**
```bash
PATCH /chat/messages/{{messageId}}
Authorization: Bearer {{accessToken}}

Body:
{
  "content": "Hello! How are you? (edited message)"
}

✅ Expected Response (200 OK):
{
  "statusCode": 200,
  "message": "Message updated successfully",
  "data": {
    "_id": "67abc123def456...",
    "content": "Hello! How are you? (edited message)",
    "isEdited": true,
    "editedAt": "2024-01-15T10:40:00Z",
    "editHistory": [
      {
        "content": "Hello! How are you?",
        "editedAt": "2024-01-15T10:40:00Z"
      }
    ]
  }
}
```

---

#### **Delete Message (API 9)**
```bash
DELETE /chat/messages/{{messageId}}
Authorization: Bearer {{accessToken}}

✅ Expected Response (200 OK):
{
  "statusCode": 200,
  "message": "Message deleted successfully"
}
```

---

### 📊 Conversation Statistics & Unread Count

#### **Get Unread Count (All)**
```bash
GET /chat/unread-count
Authorization: Bearer {{accessToken}}

✅ Expected Response (200 OK):
{
  "statusCode": 200,
  "message": "Unread count retrieved successfully",
  "data": {
    "unreadCount": 5
  }
}
```

#### **Get Unread Count (From Specific User)**
```bash
GET /chat/unread-count?otherId={{receiverId}}
Authorization: Bearer {{accessToken}}

✅ Expected Response (200 OK):
{
  "statusCode": 200,
  "message": "Unread count retrieved successfully",
  "data": {
    "unreadCount": 2
  }
}
```

#### **Mark Entire Conversation as Read (API 13)**
```bash
POST /chat/conversation/{{receiverId}}/mark-read
Authorization: Bearer {{accessToken}}

✅ Expected Response (200 OK):
{
  "statusCode": 200,
  "message": "Conversation marked as read",
  "data": {
    "modifiedCount": 5
  }
}
```

#### **Get Conversation Stats (API 14)**
```bash
GET /chat/conversation/{{receiverId}}/stats
Authorization: Bearer {{accessToken}}

✅ Expected Response (200 OK):
{
  "statusCode": 200,
  "message": "Conversation stats retrieved successfully",
  "data": {
    "totalMessages": 15,
    "unreadMessages": 0,
    "messagesByType": ["text", "text", "image", "text"],
    "lastMessage": "2024-01-15T10:50:00Z",
    "firstMessage": "2024-01-15T09:00:00Z"
  }
}
```

---

#### **Get All Messages (with Filters) (API 3)**
```bash
GET /chat/messages?page=1&limit=20&type=text&status=read&sortBy=createdAt&sortOrder=-1
Authorization: Bearer {{accessToken}}

✅ Expected Response (200 OK):
{
  "statusCode": 200,
  "message": "Messages retrieved successfully",
  "data": [
    { ... },
    { ... }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "pages": 3
  }
}
```

---

## Error Handling & Solutions

### ❌ Error: Invalid receiver ID
```json
{
  "statusCode": 400,
  "message": "Invalid receiver ID"
}
```
**Solution:** Ensure `receiverId` is a valid MongoDB ObjectId. Copy from a user record via Auth API.

---

### ❌ Error: Cannot send message to yourself
```json
{
  "statusCode": 400,
  "message": "Cannot send message to yourself"
}
```
**Solution:** Use different user IDs. Set `receiverId` to another user's ID.

---

### ❌ Error: Message not found
```json
{
  "statusCode": 404,
  "message": "Message not found"
}
```
**Solution:** Verify `messageId` is correct. Copy from previous API response.

---

### ❌ Error: Not authorized to edit this message
```json
{
  "statusCode": 403,
  "message": "You are not authorized to edit this message"
}
```
**Solution:** Only sender can edit. Use the token of the user who sent the message.

---

### ❌ Error: Cannot edit deleted message
```json
{
  "statusCode": 400,
  "message": "Cannot edit deleted message"
}
```
**Solution:** The message was already deleted. Send a new message instead.

---

### ❌ Error: 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```
**Solution:** Ensure Bearer token is valid. Get fresh token via Login API.

---

## Advanced Scenarios

### 🎯 Scenario 1: Multi-Message Conversation
1. **User A sends 3 messages** to User B (API 1, repeat 3x)
   - Message 1: "Hi!"
   - Message 2: "How are you?"
   - Message 3: "Let me know!"
2. **Get conversation** (API 2) → See 3 messages
3. **Mark message 2 as read** (API 6)
4. **Pin message 1** (API 7)
5. **Get stats** (API 14) → Should show 3 total, 2 unread

---

### 🎯 Scenario 2: Edit & Delete Workflow
1. **Send message** (API 1) → Get messageId
2. **Edit message 3 times** (API 5)
   - Check `editHistory` grows
   - Check `isEdited` = true
3. **Delete message** (API 9)
4. **Try to edit deleted message** (API 5) → Should fail

---

### 🎯 Scenario 3: Unread Management
1. **User A sends 5 messages** to User B
2. **Check unread count for User B** (API 11) → Should be 5
3. **User B marks message 1 as read** (API 6)
4. **Check unread count again** (API 11) → Should be 4
5. **Mark entire conversation as read** (API 13)
6. **Check unread count** (API 11) → Should be 0

---

### 🎯 Scenario 4: Conversation Filtering & Pagination
1. **Send 25 messages** (various types: text, image, file)
2. **Get messages page 1** (API 3, page=1, limit=10) → 10 messages
3. **Get messages page 2** (API 3, page=2, limit=10) → 10 messages
4. **Get messages page 3** (API 3, page=3, limit=10) → 5 messages
5. **Filter by type=image** (API 3) → Only image messages
6. **Filter by status=read** (API 3) → Only read messages

---

### 🎯 Scenario 5: Pinned Messages Management
1. **Send 3 messages**
2. **Pin message 1** (API 7)
3. **Pin message 3** (API 7)
4. **Get pinned messages** (API 12) → Should show 2 messages
5. **Unpin message 1** (API 8)
6. **Get pinned messages** (API 12) → Should show 1 message

---

## 📝 Testing Checklist

- [ ] **Send Message** - Works with text, images, files
- [ ] **Conversation** - Shows full 2-way message history
- [ ] **Filtering** - Works by type, status, date range
- [ ] **Pagination** - Correct page/limit calculation
- [ ] **Mark as Read** - Updates isRead and status
- [ ] **Pin/Unpin** - Toggles isPinned correctly
- [ ] **Edit** - Tracks editHistory properly
- [ ] **Delete** - Soft delete (isDeleted flag set)
- [ ] **Authorization** - Only senders can edit/delete
- [ ] **Unread Count** - Accurate with multiple conversations
- [ ] **Stats** - Calculates totalMessages, unreadMessages, types
- [ ] **Error Handling** - Proper 400/403/404 responses

---

## 🚀 Performance Tips

1. **Limit query** - Use `limit=20` for conversations
2. **Date filtering** - Use `startDate` and `endDate` for large data
3. **Pagination** - Always use page/limit for list endpoints
4. **Sorting** - Use `sortBy=createdAt&sortOrder=-1` for latest first
5. **Unread query** - Check unread frequently to keep UI in sync

---

## 📚 Related Modules

- **Auth Module** - Get JWT tokens for testing
- **Users Module** - Get receiver IDs for messages
- **WebSocket Gateway** - Real-time message delivery (chat.gateway.ts)

---

**Last Updated:** 2024-01-15
**Module Version:** 1.0.0
**Testing Status:** ✅ Complete
