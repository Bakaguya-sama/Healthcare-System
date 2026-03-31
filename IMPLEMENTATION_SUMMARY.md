# 🎯 TÓMLƯỢC - WEBSOCKET + FILE UPLOAD IMPLEMENTATION

**Ngày:** March 31, 2026  
**Tác vụ:** WebSocket Notification + Cloudinary File Upload  
**Status:** ✅ READY TO IMPLEMENT

---

## 📝 CÁC BƯỚC ĐÃ HOÀN THÀNH

### **PHẦN 1: Dependencies & Configuration ✅**
- [x] Cài đặt: `cloudinary`, `multer`, `@types/multer`
- [x] Cập nhật `.env` với Cloudinary credentials
- [x] Thêm MAX_FILE_SIZE, ALLOWED_FILE_TYPES config

### **PHẦN 2: Cloudinary Service ✅**
- [x] Tạo `cloudinary.service.ts` (6 methods)
  - `uploadFile()` - Upload 1 file
  - `uploadMultiple()` - Upload nhiều files
  - `deleteFile()` - Delete 1 file
  - `deleteMultiple()` - Delete nhiều files
  - `getFileInfo()` - Lấy file info
  - Validation file size & type

### **PHẦN 3: WebSocket Gateway ✅**
- [x] Tạo `notifications.gateway.ts` (7 methods)
  - Connection/Disconnect handlers
  - JWT token validation
  - User room management (`user_${userId}`)
  - `sendNotificationToUser()` - Gửi 1 user
  - `broadcastNotification()` - Gửi nhiều users
  - `broadcastToAll()` - Gửi tất cả
  - Online status tracking

### **PHẦN 4: File Upload Controller ✅**
- [x] Tạo `upload.controller.ts` (5 endpoints)
  - POST `/upload/single` - Upload 1 file
  - POST `/upload/multiple` - Upload nhiều files
  - GET `/upload/:publicId` - Get file info
  - DELETE `/upload/:publicId` - Delete file
  - POST `/upload/delete-multiple` - Delete multiple

### **PHẦN 5: Updated Entities & DTOs ✅**
- [x] Updated `notification.entity.ts` - Thêm attachments, metadata
- [x] Created `upload-file.dto.ts` - Upload DTOs
- [x] Added `markAsRead()` method to service

### **PHẦN 6: Module Setup ✅**
- [x] Updated `notifications.module.ts`
  - Import JWT Module
  - Register CloudinaryService
  - Register NotificationsGateway

### **PHẦN 7: Frontend Guide ✅**
- [x] Tạo `WEBSOCKET_FILE_UPLOAD_GUIDE.md`
  - Socket.IO client setup
  - Notification examples
  - File upload examples
  - React components
  - Error handling
  - Best practices

---

## 🚀 CÁCH SỬ DỤNG

### **1. BACKEND: Send Notification to User**

```typescript
// Ở bất kỳ service nào (VD: SessionsService, HealthMetricsService)

constructor(
  // ... other dependencies
  private notificationsGateway: NotificationsGateway,
) {}

async createSession(patientId: string, doctorId: string) {
  // ... tạo session logic
  
  // ✅ Send WebSocket notification to patient
  this.notificationsGateway.sendNotificationToUser(patientId, {
    title: 'New Session Request',
    message: `Dr. Tran wants to consult with you`,
    type: NotificationType.INFO,
    metadata: {
      relatedEntityId: sessionId,
      relatedEntityType: 'session',
    },
  });

  // ✅ Send to doctor too
  this.notificationsGateway.sendNotificationToUser(doctorId, {
    title: 'Session Created',
    message: `Consultation session with patient started`,
    type: NotificationType.SUCCESS,
  });
}
```

### **2. BACKEND: Handle Health Alert with Attachment**

```typescript
// HealthMetricsService
async createHealthMetric(patientId: string, metric: HealthMetricCreateDto) {
  const savedMetric = await this.healthMetricModel.create(metric);

  // Check if value is abnormal
  if (this.isAbnormal(savedMetric)) {
    // ✅ Upload chart image to Cloudinary
    const chartImage = await this.generateChart(savedMetric);
    const uploadResult = await this.cloudinaryService.uploadFile(
      chartImage,
      'healthcare/documents/health',
      'image'
    );

    // ✅ Send notification with attachment
    this.notificationsGateway.sendNotificationToUser(patientId, {
      title: '⚠️ Health Alert',
      message: 'Your blood pressure is 160/100 (High)',
      type: NotificationType.CRITICAL,
      attachments: [
        {
          url: uploadResult.secureUrl,
          publicId: uploadResult.publicId,
          fileName: 'bp_chart.png',
          fileType: 'image',
          size: uploadResult.size,
          uploadedAt: uploadResult.uploadedAt,
        },
      ],
    });
  }
}
```

### **3. FRONTEND: Connect to WebSocket**

```typescript
// App.tsx or main layout
import { useEffect } from 'react';
import notificationService from './services/NotificationService';

function App() {
  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    
    // Connect to WebSocket
    notificationService.connect(token)
      .then(() => {
        // Subscribe to notifications
        const unsubscribe = notificationService.onNotification((notif) => {
          console.log('📬 New notification:', notif);
          
          // Update notification state
          // Show toast/alert
          // Play sound
        });

        return unsubscribe;
      })
      .catch(err => console.error('Connection failed:', err));

    return () => notificationService.disconnect();
  }, []);

  return (
    <div>
      {/* Your app */}
    </div>
  );
}
```

### **4. FRONTEND: Upload File**

```typescript
// Component
async function uploadProfilePicture(file: File) {
  try {
    const response = await fetch('/api/v1/upload/single', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: (() => {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('folder', 'healthcare/profiles');
        fd.append('fileType', 'image');
        return fd;
      })(),
    });

    const data = await response.json();
    console.log('✅ Uploaded:', data.data.files[0].secureUrl);

    // Use the URL
    updateUserProfile({ 
      avatarUrl: data.data.files[0].secureUrl 
    });
  } catch (error) {
    console.error('❌ Upload failed:', error);
  }
}
```

---

## 📊 FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│                       CLIENT (React/Vue)                         │
│                                                                   │
│  1. Connect WebSocket                                           │
│     socket.connect(token) ─┐                                    │
│                             │                                    │
│  2. Listen for notifications                                    │
│     socket.on('notification') ◄─┐                              │
│                                  │                              │
│  3. Upload file                  │                              │
│     POST /upload/single ─┐       │                              │
│                          │       │                              │
└──────────────────────────┼───────┼──────────────────────────────┘
                           │       │
                           ▼       │
            ┌──────────────────────┴───────────────┐
            │      BACKEND (NestJS)               │
            │                                      │
            │  1. WebSocket Gateway (JWT verify)  │
            │     handleConnection() ◄─ Token     │
            │     join room: user_{userId}        │
            │                                      │
            │  2. File Upload Controller           │
            │     POST /upload/single              │
            │     → Cloudinary Service             │
            │     ├─ Validate file                 │
            │     ├─ Stream to Cloudinary          │
            │     └─ Return URL + publicId         │
            │                                      │
            │  3. Services (emit notifications)    │
            │     HealthMetricsService             │
            │     SessionsService                  │
            │     → Detect abnormal value          │
            │     → Send WebSocket notification    │
            │                  │                   │
            │                  ▼                   │
            │     notificationsGateway             │
            │     .sendNotificationToUser()        │
            │     → Emit to room: user_{userId}   │
            │                  │                   │
            └──────────────────┼───────────────────┘
                               │
                    ┌──────────┴─────────────┐
                    │                        │
                    ▼                        ▼
        ┌─────────────────────┐  ┌────────────────────┐
        │   CLIENT:           │  │   CLOUDINARY:      │
        │ Receive real-time   │  │ Store files        │
        │ notification        │  │ in cloud           │
        │ + attachment URLs   │  │                    │
        └─────────────────────┘  └────────────────────┘
```

---

## 🔑 KEY FEATURES

### **WebSocket Notifications**
- ✅ Real-time push (không cần polling)
- ✅ JWT authentication
- ✅ Room-based delivery (specific user)
- ✅ Fallback to polling nếu WebSocket fail
- ✅ Auto reconnect
- ✅ Online status tracking

### **File Upload**
- ✅ Single & multiple file upload
- ✅ Cloudinary cloud storage
- ✅ File type validation
- ✅ File size validation (50MB max)
- ✅ Auto-generate public ID
- ✅ HTTPS URLs (secure)
- ✅ Delete capability (clean up storage)

### **Notification Entity**
- ✅ Title, message, type (critical/warning/info)
- ✅ Attachments (images, documents, URLs)
- ✅ Metadata (link to related entity)
- ✅ Read/unread tracking
- ✅ Expiration (auto-cleanup)

---

## 📁 FILE STRUCTURE

```
apps/api/src/
├── core/
│   └── services/
│       └── cloudinary.service.ts ✨ NEW
├── modules/
│   └── notifications/
│       ├── notifications.gateway.ts ✨ NEW (WebSocket)
│       ├── upload.controller.ts ✨ NEW (File upload endpoints)
│       ├── notifications.module.ts (UPDATED)
│       ├── notifications.service.ts (UPDATED + markAsRead)
│       ├── entities/
│       │   └── notification.entity.ts (UPDATED + attachments)
│       └── dto/
│           └── upload-file.dto.ts ✨ NEW
```

---

## ✅ TESTING CHECKLIST

### **WebSocket**
- [ ] Client connects with valid JWT
- [ ] Client disconnects on invalid JWT
- [ ] Notification received real-time
- [ ] Mark as read works
- [ ] User room isolation (can't receive other user's notifs)
- [ ] Typing indicator works
- [ ] Reconnect after disconnect

### **File Upload**
- [ ] Upload single image works
- [ ] Upload multiple documents works
- [ ] File size validation (reject > 50MB)
- [ ] File type validation (only allowed types)
- [ ] URL returned is accessible
- [ ] Delete file works
- [ ] Delete multiple files works
- [ ] Cloudinary folder organization works

### **Integration**
- [ ] Health metric alert sends notification + chart
- [ ] Session request sends notification to both users
- [ ] Doctor verification sends document with notification
- [ ] Notification with attachment displays correctly in UI
- [ ] Error handling graceful (no crash)
- [ ] Cleanup on logout

---

## 🚨 IMPORTANT NOTES

1. **Cloudinary Credentials:**
   - Get from `https://cloudinary.com`
   - Add to `.env`: CLOUDINARY_CLOUD_NAME, API_KEY, API_SECRET
   - In dev: use free tier (75 requests/hour)

2. **CORS Configuration:**
   - WebSocket endpoint: `/notifications`
   - Allowed origins: http://localhost:5173 (dev), production domain
   - Already set in gateway config

3. **JWT in WebSocket:**
   - Token passed via `auth: { token }` or `query: { token }`
   - Same JWT_SECRET as REST API
   - Verify in `handleConnection()`

4. **File Storage:**
   - All files stored in Cloudinary (not local disk)
   - Keep publicId for deletion later
   - Cloudinary deletes after TTL if set

5. **Database Migrations:**
   - Notification schema updated (new fields)
   - Run seed to test with sample data
   - Existing notifications still work (new fields optional)

---

## 🎓 LEARNING RESOURCES

- Socket.IO Docs: https://socket.io/docs/
- Cloudinary Docs: https://cloudinary.com/documentation
- NestJS WebSockets: https://docs.nestjs.com/websockets/gateways
- NestJS File Upload: https://docs.nestjs.com/techniques/file-upload

---

## 📞 SUPPORT

**Issues:**
- Check browser console for WebSocket errors
- Check server logs: `npm run start:dev`
- Verify Cloudinary credentials in `.env`
- Make sure JWT_SECRET matches across services

**Common Errors:**
```
❌ "Invalid token" → JWT expired or wrong secret
❌ "File size exceeds" → Upload file > 50MB
❌ "Connection refused" → Backend not running
❌ "CORS error" → Check allowed origins in gateway
```

---

**Tạo ngày:** March 31, 2026  
**Hoàn thành:** ✅ Backend implementation ready  
**Tiếp theo:** Frontend integration + testing
