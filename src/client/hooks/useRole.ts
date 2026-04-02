import { useState, useEffect } from "react";
import { api } from "../api-client";
import type { MeResponse } from "../../types/api";

export type Role = "student" | "staff" | "admin";

export function useRole() {
  const [role, setRole] = useState<Role>("student");
  const [displayName, setDisplayName] = useState("Loading...");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<MeResponse>("/api/me")
      .then((data) => {
        setRole(data.role);
        setDisplayName(data.displayName);
        setUserId(data.userId);
      })
      .catch(() => {
        setRole("student");
        setDisplayName("Guest");
      })
      .finally(() => setLoading(false));
  }, []);

  return { role, displayName, userId, loading };
}
