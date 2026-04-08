import type { NextFunction, Request, Response } from "express";
import { getStaffMember } from "../services/staff-service";

export function requireAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  next();
}

export function requireStaff(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  if (!getStaffMember(req.user.userId)) {
    res.status(403).json({ error: "Staff access required" });
    return;
  }

  next();
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  if (getStaffMember(req.user.userId)?.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  next();
}
