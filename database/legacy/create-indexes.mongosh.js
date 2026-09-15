// Archived RF-1 baseline only. Do not use as the deployment migration mechanism.
// ==========================================================
// MONGODB — CREATE COLLECTIONS & INDEXES (camelCase, khớp Mongoose schema)
// Chạy: mongosh "<connection_string>" create_indexes.js
// ==========================================================

// ------------------------------------------------------------
// 1. USERS
// ------------------------------------------------------------
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ role: 1, accountStatus: 1 });
db.users.createIndex({ "doctorProfile.specialty": 1 });
db.users.createIndex({ "doctorProfile.verificationStatus": 1 });
db.users.createIndex({ "doctorProfile.averageRating": -1 });

// ------------------------------------------------------------
// 2. HEALTH_METRICS (Time Series Collection)
// ------------------------------------------------------------
db.createCollection("healthMetrics", {
    timeseries: {
        timeField: "createdAt",
        metaField: "meta",       // meta: { patientId, metricType, unit }
        granularity: "seconds"
    }
});
db.healthMetrics.createIndex(
    { "meta.patientId": 1, "meta.metricType": 1, createdAt: -1 }
);

// ------------------------------------------------------------
// 3. AI_SESSIONS / AI_MESSAGES
// ------------------------------------------------------------
db.aiSessions.createIndex({ patientId: 1, status: 1, createdAt: -1 });

db.aiMessages.createIndex({ aiSessionId: 1, sentAt: 1 });

// ------------------------------------------------------------
// 4. DOCTOR_SESSIONS / DOCTOR_MESSAGES
// ------------------------------------------------------------
db.doctorSessions.createIndex({ patientId: 1, status: 1, createdAt: -1 });
db.doctorSessions.createIndex({ doctorId: 1, status: 1, createdAt: -1 });
db.doctorSessions.createIndex({ doctorId: 1, "review.rating": -1 });

db.doctorMessages.createIndex({ doctorSessionId: 1, createdAt: 1 });
db.doctorMessages.createIndex({ senderId: 1 });

// ------------------------------------------------------------
// 5. VIOLATION_REPORTS
// ------------------------------------------------------------
db.violationReports.createIndex({ status: 1, createdAt: -1 });
db.violationReports.createIndex({ reportedUserId: 1 });
db.violationReports.createIndex({ reporterId: 1 });

// ------------------------------------------------------------
// 6. AI CORE: DOCUMENTS / CHUNKS / KEYWORDS
// ------------------------------------------------------------
db.blacklistKeywords.createIndex({ keyword: 1 }, { unique: true });

db.aiDocuments.createIndex({ uploadedBy: 1 });
db.aiDocuments.createIndex({ status: 1 });

db.aiDocumentChunks.createIndex({ documentId: 1, chunkIndex: 1 });
db.aiDocumentChunks.createIndex({ isActive: 1 });
// Vector Search Index cho RAG (Atlas 6.0.11+/7.0+)
db.aiDocumentChunks.createSearchIndex(
    "vector_index",
    {
        type: "vectorSearch",
        fields: [
            {
                type: "vector",
                path: "embedding",
                numDimensions: 768,      // đổi theo model embedding thực tế
                similarity: "cosine"
            },
            { type: "filter", path: "isActive" },
            { type: "filter", path: "documentId" }
        ]
    }
);

// ------------------------------------------------------------
// 7. NOTIFICATIONS / NOTIFICATION_CAMPAIGNS
// ------------------------------------------------------------
db.notifications.createIndex({ userId: 1, isRead: 1, createdAt: -1 });
db.notifications.createIndex({ campaignId: 1 });

db.notificationCampaigns.createIndex({ createdBy: 1 });
db.notificationCampaigns.createIndex({ targetType: 1, createdAt: -1 });

// ------------------------------------------------------------
// 8. AI_HEALTH_INSIGHTS
// ------------------------------------------------------------
db.aiHealthInsights.createIndex({ patientId: 1, createdAt: -1 });
db.aiHealthInsights.createIndex({ patientId: 1, riskLevel: 1 });

print("✅ Đã tạo xong collections & indexes.");
