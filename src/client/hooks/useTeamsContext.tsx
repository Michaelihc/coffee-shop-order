import React, { createContext, useContext, ReactNode } from "react";
import type { app } from "@microsoft/teams-js";

interface TeamsUser {
  userId: string;
  userName: string;
}

interface TeamsContextValue {
  context: app.Context | null;
  user: TeamsUser;
  isInTeams: boolean;
}

const TeamsContext = createContext<TeamsContextValue>({
  context: null,
  user: { userId: "dev-user", userName: "Dev Student" },
  isInTeams: false,
});

export function TeamsContextProvider({
  context,
  children,
}: {
  context: app.Context | null;
  children: ReactNode;
}) {
  const user: TeamsUser = context?.user
    ? {
        userId: context.user.id || "unknown",
        userName:
          context.user.displayName ||
          context.user.userPrincipalName ||
          "Unknown",
      }
    : { userId: "dev-user", userName: "Dev Student" };

  return (
    <TeamsContext.Provider value={{ context, user, isInTeams: !!context }}>
      {children}
    </TeamsContext.Provider>
  );
}

export function useTeamsContext() {
  return useContext(TeamsContext);
}
