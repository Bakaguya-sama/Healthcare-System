import { useState, useEffect, useCallback } from "react";
import {
  getDoctorDocuments,
  approveDoctorDocument,
  rejectDoctorDocument,
  type DoctorApplicationQuery,
  type DoctorDocumentList,
} from "../services/doc-verification.service";

export function useGetDoctorDocuments(query: DoctorApplicationQuery) {
  const [isLoading, setLoading] = useState(false);
  const [data, setData] = useState<DoctorDocumentList | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await getDoctorDocuments(query);
      setData(res);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load pending doctors' documents",
      );
    } finally {
      setLoading(false);
    }
  }, [query]);

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

export function useApproveDoctor() {
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approve = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);

    if (!id) {
      setError("Invalid doctor ID");
      return null;
    }

    try {
      return await approveDoctorDocument(id);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to approve doctor",
      );
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    approve,
    isLoading,
    error,
  };
}

export function useRejectDoctor() {
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reject = useCallback(async (id: string, reason: string) => {
    setLoading(true);
    setError(null);

    if (!id) {
      setError("Invalid doctor ID");
      return null;
    }

    try {
      return await rejectDoctorDocument(id, reason);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to reject doctor",
      );
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    reject,
    isLoading,
    error,
  };
}
