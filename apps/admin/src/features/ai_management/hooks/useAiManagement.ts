import { useState, useCallback, useEffect } from "react";
import {
  getDocumentList,
  toggleDocumentStatus,
  deleteDocument,
  type DocumentListReceiver,
} from "../services/ai-management.service";

export function useGetDocumentList() {
  const [isLoading, setLoading] = useState(false);
  const [data, setData] = useState<DocumentListReceiver | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await getDocumentList();
      setData(res);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load documents",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  return {
    data,
    isLoading,
    error,
    refresh: loadList,
  };
}

export function useToggleDocumentStatus() {
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleStatus = useCallback(async (id: string, status: string) => {
    setLoading(true);
    setError(null);

    if (!id) {
      setError("Invalid document ID");
      return null;
    }

    try {
      return await toggleDocumentStatus(id, status);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to change document status",
      );
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    toggleStatus,
    isLoading,
    error,
  };
}

export function useDeleteDocument() {
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteDoc = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);

    if (!id) {
      setError("Invalid document ID");
      return null;
    }

    try {
      return await deleteDocument(id);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to delete document",
      );
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    deleteDoc,
    isLoading,
    error,
  };
}
