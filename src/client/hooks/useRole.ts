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
    let cancelled = false;
    const loadRole = () => {
    api
      .get<MeResponse>("/api/me")
      .then((data) => {
        if (cancelled) return;
        setRole(data.role);
        setDisplayName(data.displayName);
        setUserId(data.userId);
      })
      .catch(() => {
        if (cancelled) return;
        setRole("student");
        setDisplayName("Guest");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    };

    loadRole();
    window.addEventListener("coffee-shop-guest-auth-changed", loadRole);
    return () => {
      cancelled = true;
      window.removeEventListener("coffee-shop-guest-auth-changed", loadRole);
    };
  }, []);

  return { role, displayName, userId, loading };
}
