import type { Request, Response, NextFunction } from "express";
import { allowUnsafeHeaderAuth } from "../config/runtime-mode";
import { authenticateBearerToken } from "../services/auth-token-service";
import { saveUserLocale } from "../services/user-locale-service";

export interface UserContext {
  userId: string;
  userName: string;
  locale?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: UserContext;
    }
  }
}

export function identityMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const userLocale = req.headers["x-teams-user-locale"] as string | undefined;
  const authHeader = req.headers.authorization;

  const finish = (user?: UserContext) => {
    if (user) {
      req.user = user;
      saveUserLocale(user.userId, userLocale);
    }
    next();
  };

  if (authHeader?.startsWith("Bearer ")) {
    authenticateBearerToken(authHeader.slice("Bearer ".length).trim(), userLocale)
      .then((user) => finish(user ?? undefined))
      .catch((error) => {
        console.warn("[Auth] Failed to validate bearer token:", error);
        finish();
      });
    return;
  }

  if (allowUnsafeHeaderAuth()) {
    const userId = req.headers["x-teams-user-id"] as string | undefined;
    const userName = req.headers["x-teams-user-name"] as string | undefined;

    if (userId) {
      finish({
        userId,
        userName: userName || "Unknown",
        locale: userLocale,
      });
      return;
    }
  }

  finish();
}
