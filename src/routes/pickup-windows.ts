import { Router } from "express";
import type { Request, Response } from "express";
import { getPickupWindows } from "../services/capacity";

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  const windows = getPickupWindows();
  res.json({ windows });
});

export default router;
