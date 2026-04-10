import { useState, useCallback, useEffect } from "react";
import {
  getKeywordList,
  addKeyword,
  updateKeyword,
  deleteKeyword,
  type ApiKeywordList,
} from "../services/blacklist-keywords.service";

export function useGetKeywords() {
  const [isLoading, setLoading] = useState(false);
  const [data, setData] = useState<ApiKeywordList | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await getKeywordList();
      setData(res);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load keyword list",
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

export function useAddKeyword() {
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitAddKeyword = useCallback(async (newKeyword: string) => {
    setLoading(true);
    setError(null);

    if (!newKeyword) {
      const message = "New keyword is empty!";
      setError(message);
      throw new Error(message);
    }

    try {
      return await addKeyword(newKeyword);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Failed to add keyword";
      setError(message);
      throw loadError;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    submitAddKeyword,
    isLoading,
    error,
  };
}

export function useUpdateKeyword() {
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitUpdateKeyword = useCallback(
    async (id: string, newKeyword: string) => {
      setLoading(true);
      setError(null);

      if (!id) {
        const message = "Invalid keyword ID";
        setError(message);
        throw new Error(message);
      }

      if (!newKeyword) {
        const message = "New keyword is empty!";
        setError(message);
        throw new Error(message);
      }

      try {
        return await updateKeyword(id, newKeyword);
      } catch (loadError) {
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Failed to update keyword";
        setError(message);
        throw loadError;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    submitUpdateKeyword,
    isLoading,
    error,
  };
}

export function useDeleteKeyword() {
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitDeleteKeyword = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);

    if (!id) {
      const message = "Invalid keyword ID";
      setError(message);
      throw new Error(message);
    }

    try {
      return await deleteKeyword(id);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Failed to delete keyword";
      setError(message);
      throw loadError;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    submitDeleteKeyword,
    isLoading,
    error,
  };
}
