import { api } from "@/lib/api";

type DocumentStatus = "processing" | "error" | "active" | "inactive";
type DocumentType = "pdf" | "doc" | "docx" | "txt";

type DocumentItem = {
  id: string;
  title: string;
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
    title: item.title ?? "Untitled document",
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

export async function createAiDocument(file: File, title?: string) {
  const formData = new FormData();
  formData.append("file", file);

  const normalizedTitle = title?.trim();
  if (normalizedTitle) {
    formData.append("title", normalizedTitle);
  }

  const response = await api.post<ApiDocumentItem>("/ai-documents", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

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
