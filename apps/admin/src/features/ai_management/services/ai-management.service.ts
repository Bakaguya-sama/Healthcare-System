import { api } from "@/lib/api";

type DocumentStatus = "processing" | "error" | "active" | "inactive";
type DocumentType = "pdf" | "doc" | "docx" | "txt";

type UploadFileType = "image" | "document";

type CloudinaryUploadResponse = {
  statusCode: number;
  message: string;
  data: {
    files: Array<{
      originalName: string;
      publicId: string;
      url: string;
      secureUrl: string;
      size: number;
    }>;
    uploadedAt: string;
    totalSize: number;
  };
};

type CreateDocumentPayload = {
  title: string;
  fileUrl: string;
  fileType: DocumentType;
};

type DocumentItem = {
  id: string;
  title?: string;
  fileUrl: string;
  fileType: DocumentType;
  status: DocumentStatus;
  uploadedBy: string;
  createdAt: string;
  isEnabled: boolean;
};

type ApiDocumentItem = {
  _id: string;
  title?: string;
  fileUrl: string;
  fileType: DocumentType;
  status: DocumentStatus;
  uploadedBy: string;
  createdAt: string;
  __v: number;
  updatedAt: string;
};

interface ApiDocumentList {
  data: ApiDocumentItem[];
  total: number;
}

export interface DocumentListReceiver {
  documentList: DocumentItem[];
}

function resolveJoinedDate(value?: string) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function mapApitoUi(item: ApiDocumentItem): DocumentItem | null {
  if (!item._id) return null;

  return {
    id: item._id,
    title: item.title,
    fileUrl: item.fileUrl,
    fileType: item.fileType,
    status: item.status,
    uploadedBy: item.uploadedBy,
    createdAt: resolveJoinedDate(item.createdAt),
    isEnabled: item.status === "active" ? true : false,
  };
}

export async function getDocumentList(): Promise<DocumentListReceiver> {
  const res = await api.get<ApiDocumentList>("/ai-documents");

  return {
    documentList: res.data.data
      .map(mapApitoUi)
      .filter((item): item is DocumentItem => item !== null),
  };
}

function getDocumentTypeFromName(fileName: string): DocumentType {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "doc") return "doc";
  if (ext === "docx") return "docx";
  return "txt";
}

function getUploadFileType(fileName: string): UploadFileType {
  return getDocumentTypeFromName(fileName) === "pdf" ? "document" : "document";
}

export async function uploadAiDocumentFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", "healthcare/ai/knowledge-base");
  formData.append("fileType", getUploadFileType(file.name));

  const response = await api.post<CloudinaryUploadResponse>(
    "/upload/single",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );

  return response.data;
}

export async function createAiDocument(payload: CreateDocumentPayload) {
  const response = await api.post<ApiDocumentItem>("/ai-documents", payload);
  return response.data;
}

export async function toggleDocumentStatus(id: string, status: string) {
  const res = await api.patch(`/ai-documents/${id}`, {
    status: status,
  });

  return res.data;
}

export async function deleteDocument(id: string) {
  const res = await api.delete(`/ai-documents/${id}`);

  return res.data;
}
