import { useCallback, useState } from "react";
import {
  createAdmin,
  type AdminCreate,
  changeAdminRole,
  type AdminChangeRole,
} from "../services/admin-management.service";

export function useCreateAdmin() {
  const [response, setResponse] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitCreateAdmin = useCallback(async (payload: AdminCreate) => {
    if (
      !payload.fullName ||
      !payload.email ||
      !payload.password ||
      !payload.assignedRole
    ) {
      setError("Empty required fields!");
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await createAdmin(payload);
      setResponse(res);
      return res;
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to create",
      );
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    submitCreateAdmin,
    response,
    isLoading,
    error,
  };
}

export function useChangeAdminRole() {
  const [response, setResponse] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitChangeAdminRole = useCallback(
    async (payload: AdminChangeRole) => {
      if (!payload.id || !payload.assignedRole) {
        setError("Empty required fields!");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const res = await changeAdminRole(payload);
        setResponse(res);
        return res;
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to change role",
        );
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return {
    submitChangeAdminRole,
    response,
    isLoading,
    error,
  };
}
