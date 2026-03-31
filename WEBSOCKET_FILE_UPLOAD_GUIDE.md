# 🔌 WEBSOCKET + FILE UPLOAD - FRONTEND INTEGRATION GUIDE

## 📋 MỤC LỤC
1. [Notification WebSocket](#notification-websocket)
2. [File Upload](#file-upload)
3. [Integration Examples](#integration-examples)
4. [Error Handling](#error-handling)

---

## 🔌 NOTIFICATION WEBSOCKET

### **Setup Socket.IO Client**

**Install package:**
```bash
npm install socket.io-client
```

**Create Socket Service (React/Vue):**
```typescript
import io, { Socket } from 'socket.io-client';

class NotificationService {
  private socket: Socket | null = null;

  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // ✅ Connect to WebSocket with auth
        this.socket = io('http://localhost:3000/notifications', {
          auth: {
            token, // JWT token từ login
          },
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 5,
        });

        // ✅ Listen for connect event
        this.socket.on('connect', () => {
          console.log('✅ Connected to notification service');
          resolve();
        });

        // ✅ Listen for connection error
        this.socket.on('connect_error', (error) => {
          console.error('❌ Connection error:', error);
          reject(error);
        });

        // ✅ Listen for disconnect
        this.socket.on('disconnect', () => {
          console.log('🔌 Disconnected from notification service');
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  // ✅ Subscribe to notifications (real-time)
  onNotification(
    callback: (notification: any) => void
  ): () => void {
    if (!this.socket) throw new Error('Socket not connected');

    // Listen for notification events
    this.socket.on('notification', callback);

    // Return unsubscribe function
    return () => {
      this.socket?.off('notification', callback);
    };
  }

  // ✅ Mark notification as read (WebSocket event)
  markAsRead(notificationId: string): void {
    if (!this.socket) throw new Error('Socket not connected');

    this.socket.emit('mark-as-read', { notificationId });

    // Listen for confirmation
    this.socket.once('notification-marked', (response) => {
      console.log('✅ Notification marked as read:', response);
    });
  }

  // ✅ Disconnect
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // ✅ Get socket connection status
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export default new NotificationService();
```

### **Use in React Component:**

```jsx
import { useEffect, useState } from 'react';
import notificationService from './services/NotificationService';

function NotificationCenter() {
  const [notifications, setNotifications] = useState([]);
  const token = localStorage.getItem('jwt_token');

  useEffect(() => {
    // ✅ Connect to WebSocket
    notificationService
      .connect(token)
      .then(() => {
        console.log('✅ WebSocket connected');

        // ✅ Subscribe to real-time notifications
        const unsubscribe = notificationService.onNotification(
          (notification) => {
            console.log('📬 New notification:', notification);
            setNotifications((prev) => [notification, ...prev]);

            // Show toast/alert
            showToast(notification.title, notification.message);
          }
        );

        return unsubscribe;
      })
      .catch((error) => {
        console.error('Connection failed:', error);
      });

    // ✅ Cleanup on unmount
    return () => {
      notificationService.disconnect();
    };
  }, []);

  const handleMarkAsRead = (notificationId: string) => {
    // ✅ Mark via WebSocket (instant)
    notificationService.markAsRead(notificationId);

    // Update local state
    setNotifications((prev) =>
      prev.map((n) =>
        n._id === notificationId ? { ...n, isRead: true } : n
      )
    );
  };

  return (
    <div className="notification-center">
      {notifications.map((notif) => (
        <div
          key={notif._id}
          className={`notification-item ${notif.isRead ? 'read' : 'unread'}`}
        >
          <h4>{notif.title}</h4>
          <p>{notif.message}</p>
          {!notif.isRead && (
            <button onClick={() => handleMarkAsRead(notif._id)}>
              Mark as read
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export default NotificationCenter;
```

---

## 📤 FILE UPLOAD

### **Upload Single File (Image or Document):**

```typescript
async function uploadFile(
  file: File,
  folder: 'healthcare/profiles' | 'healthcare/doctors/verification' | string,
  fileType: 'image' | 'document'
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);
  formData.append('fileType', fileType);

  const response = await fetch('/api/v1/upload/single', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('jwt_token')}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  return response.json();
}
```

### **Upload Multiple Files:**

```typescript
async function uploadMultipleFiles(
  files: File[],
  folder: string,
  fileType: 'image' | 'document'
): Promise<UploadResponse> {
  const formData = new FormData();

  // ✅ Append multiple files
  files.forEach((file) => {
    formData.append('files', file);
  });

  formData.append('folder', folder);
  formData.append('fileType', fileType);

  const response = await fetch('/api/v1/upload/multiple', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('jwt_token')}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  return response.json();
}
```

### **React Component for File Upload:**

```jsx
import { useState } from 'react';

function DocumentUploader({ onUploadSuccess }) {
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);

  const handleFileSelect = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setUploading(true);

    try {
      const response = await uploadMultipleFiles(
        files,
        'healthcare/doctors/verification',
        'document'
      );

      console.log('✅ Upload successful:', response);
      setUploadedFiles(response.data.files);
      onUploadSuccess(response.data.files);

      // Show success message
      alert(`Successfully uploaded ${files.length} files`);
    } catch (error) {
      console.error('❌ Upload failed:', error);
      alert(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="document-uploader">
      <input
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.jpg,.png"
        onChange={handleFileSelect}
        disabled={uploading}
      />

      {uploading && <p>📤 Uploading...</p>}

      {uploadedFiles.length > 0 && (
        <div className="uploaded-list">
          <h3>Uploaded Files:</h3>
          {uploadedFiles.map((file) => (
            <div key={file.publicId} className="file-item">
              <p>{file.originalName}</p>
              <p>Size: {(file.size / 1024 / 1024).toFixed(2)} MB</p>
              <a href={file.secureUrl} target="_blank" rel="noopener noreferrer">
                View
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DocumentUploader;
```

---

## 🔗 INTEGRATION EXAMPLES

### **Example 1: Health Alert Notification**

```typescript
// Backend (Health Metrics Service)
// When blood pressure is high
const notification = {
  title: 'Health Alert 🚨',
  message: 'Your blood pressure is 160/100 (High)',
  type: 'critical',
  attachments: [
    {
      url: 'https://cloudinary.com/...',
      fileName: 'bp_chart.png',
      fileType: 'image',
    },
  ],
};

// ✅ Send via WebSocket
notificationsGateway.sendNotificationToUser(userId, notification);
```

```jsx
// Frontend (React Component)
useEffect(() => {
  const unsubscribe = notificationService.onNotification((notif) => {
    if (notif.type === 'critical') {
      // Show red alert
      showAlert({
        severity: 'error',
        title: notif.title,
        message: notif.message,
        attachments: notif.attachments,
      });

      // Play alarm sound
      playAlarmSound();
    }
  });

  return unsubscribe;
}, []);
```

### **Example 2: Doctor Verification Document Upload**

```jsx
function DoctorVerificationForm() {
  const [credentials, setCredentials] = useState({
    license: null,
    certificate: null,
  });

  const handleUploadCredentials = async () => {
    const files = [credentials.license, credentials.certificate].filter(
      Boolean
    );

    try {
      const response = await uploadMultipleFiles(
        files,
        'healthcare/doctors/verification',
        'document'
      );

      console.log('✅ Credentials uploaded:', response.data.files);

      // Save to DB
      await fetch('/api/v1/doctors/verify-documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          verificationDocuments: response.data.files.map((f) => ({
            publicId: f.publicId,
            url: f.secureUrl,
            fileName: f.originalName,
          })),
        }),
      });

      alert('✅ Credentials submitted for verification');
    } catch (error) {
      alert(`❌ Upload failed: ${error.message}`);
    }
  };

  return (
    <div>
      <input
        type="file"
        onChange={(e) =>
          setCredentials({ ...credentials, license: e.target.files[0] })
        }
        accept=".pdf"
      />
      <input
        type="file"
        onChange={(e) =>
          setCredentials({ ...credentials, certificate: e.target.files[0] })
        }
        accept=".pdf"
      />
      <button onClick={handleUploadCredentials}>Submit for Verification</button>
    </div>
  );
}
```

### **Example 3: Profile Picture Upload**

```jsx
function ProfilePictureUpload() {
  const [uploading, setUploading] = useState(false);

  const handleProfilePicChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const response = await uploadFile(
        file,
        'healthcare/profiles',
        'image'
      );

      const imageUrl = response.data.files[0].secureUrl;
      const publicId = response.data.files[0].publicId;

      // Update user profile in DB
      await fetch('/api/v1/users/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          avatarUrl: imageUrl,
          avatarPublicId: publicId, // Save for deletion later
        }),
      });

      console.log('✅ Profile picture updated');
    } catch (error) {
      alert(`❌ Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={handleProfilePicChange}
        disabled={uploading}
      />
      {uploading && <p>📤 Uploading...</p>}
    </div>
  );
}
```

---

## ⚠️ ERROR HANDLING

### **Handle Upload Errors:**

```typescript
async function uploadFileWithErrorHandling(
  file: File,
  folder: string,
  fileType: 'image' | 'document'
) {
  try {
    // Validate file size (50MB max)
    if (file.size > 52428800) {
      throw new Error('File size exceeds 50MB');
    }

    // Validate file type
    const allowedTypes = ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx', 'txt'];
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!fileExt || !allowedTypes.includes(fileExt)) {
      throw new Error(`File type .${fileExt} not allowed`);
    }

    // Upload
    const response = await uploadFile(file, folder, fileType);
    return response;

  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('exceeds')) {
        console.error('❌ File too large');
      } else if (error.message.includes('not allowed')) {
        console.error('❌ Invalid file type');
      } else {
        console.error('❌ Upload failed:', error.message);
      }
    }
    throw error;
  }
}
```

### **Handle WebSocket Errors:**

```typescript
notificationService.socket.on('error', (error) => {
  console.error('❌ WebSocket error:', error);
  
  // Attempt to reconnect
  setTimeout(() => {
    notificationService.disconnect();
    notificationService.connect(token);
  }, 3000);
});

notificationService.socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error);
  
  if (error.message === 'Invalid token') {
    // Redirect to login
    window.location.href = '/login';
  }
});
```

---

## 🎯 BEST PRACTICES

✅ **DO:**
- Always close WebSocket connection on logout
- Validate file size/type before upload
- Use HTTPS for Cloudinary URLs
- Handle network disconnection gracefully
- Show upload progress to users

❌ **DON'T:**
- Don't upload large files without chunking
- Don't expose API keys in frontend code
- Don't send unencrypted sensitive data
- Don't block UI during upload (use async)
- Don't forget to handle errors

---

## 📚 API ENDPOINTS SUMMARY

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/upload/single` | Upload 1 file |
| POST | `/api/v1/upload/multiple` | Upload multiple files |
| GET | `/api/v1/upload/:publicId` | Get file info |
| DELETE | `/api/v1/upload/:publicId` | Delete file |
| POST | `/api/v1/upload/delete-multiple` | Delete multiple files |

**WebSocket Events:**
- `connected` - Client connected
- `notification` - New notification received
- `notification-marked` - Notification marked as read
- `user-typing` - User is typing
- `error` - WebSocket error
