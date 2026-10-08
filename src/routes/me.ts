import { Router } from "express";
import type { Request, Response } from "express";
import { getStaffMember } from "../services/staff-service";
import { resolveGuestSession } from "../services/guest-auth-service";

const router = Router();

router.get("/", (req: Request, res: Response) => {
  if (!req.user) {
    const guestSessionHeader = req.headers["x-guest-session"];
    const guest = resolveGuestSession(
      typeof guestSessionHeader === "string" ? guestSessionHeader : undefined
    );
    res.json({
      role: "student",
      displayName: guest?.maskedPhone || "Guest",
      userId: "",
    });
    return;
  }

  const staff = getStaffMember(req.user.userId);

  if (staff) {
    res.json({ role: staff.role, displayName: staff.display_name, userId: req.user.userId });
  } else {
    res.json({ role: "student", displayName: req.user.userName, userId: req.user.userId });
  }
});

export default router;
