import { Router } from "express";
import type { Request, Response } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { requireStaff } from "../../middleware/authorization";
import {
  createInventoryItem,
  deleteInventoryItem,
  getInventoryItemRecord,
  inventoryItemExists,
  listInventoryData,
  patchInventoryItem,
  updateInventoryItem,
  updateInventoryItemImage,
} from "../../services/admin-inventory-service";
import { ensureUploadsDir, getStoredImagePath, getUploadsDir } from "../../services/file-storage-service";
import {
  validateInventoryCreatePayload,
  validateInventoryPatchPayload,
  validateInventoryUpdatePayload,
} from "../../validation/admin";

const router = Router();

router.use(requireStaff);

// GET /api/admin/inventory
router.get("/", (_req: Request, res: Response) => {
  res.json(listInventoryData());
});

// POST /api/admin/inventory — create new menu item
router.post("/", (req: Request, res: Response) => {
  const validation = validateInventoryCreatePayload(req.body);
  if (validation.ok === false) {
    res.status(400).json({ error: validation.error });
    return;
  }
  const { id } = validation.value;

  if (inventoryItemExists(id)) {
    res.status(409).json({ error: "Item with this ID already exists" });
    return;
  }

  res.status(201).json({ item: createInventoryItem(validation.value) });
});

// PUT /api/admin/inventory/:id — full update
router.put("/:id", (req: Request, res: Response) => {
  const item = getInventoryItemRecord(req.params.id as string);
  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  const validation = validateInventoryUpdatePayload(req.body);
  if (validation.ok === false) {
    res.status(400).json({ error: validation.error });
    return;
  }
  const { categoryId, name, description, priceCents, itemClass, stockCount, sortOrder } = validation.value;

  res.json({
    item: updateInventoryItem(req.params.id as string, item, {
      categoryId,
      name,
      description,
      priceCents,
      itemClass,
      stockCount,
      sortOrder,
    }),
  });
});

// DELETE /api/admin/inventory/:id — delete item (soft-delete if orders reference it)
router.delete("/:id", (req: Request, res: Response) => {
  const item = getInventoryItemRecord(req.params.id as string);
  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  res.json(deleteInventoryItem(req.params.id as string));
});

// PATCH /api/admin/inventory/:id
router.patch("/:id", (req: Request, res: Response) => {
  const validation = validateInventoryPatchPayload(req.body);
  if (validation.ok === false) {
    res.status(400).json({ error: validation.error });
    return;
  }
  const { stockCount, isAvailable } = validation.value;

  const item = getInventoryItemRecord(req.params.id as string);
  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  res.json({
    item: patchInventoryItem(req.params.id as string, {
      stockCount,
      isAvailable,
    }),
  });
});

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, ensureUploadsDir());
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.params.id}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

// POST /api/admin/inventory/:id/image — upload image
router.post("/:id/image", (req: Request, res: Response) => {
  const itemId = req.params.id as string;
  const existingItem = getInventoryItemRecord(itemId);
  if (!existingItem) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  upload.single("image")(req, res, (err: unknown) => {
    if (err) {
      const msg = err instanceof Error ? err.message : "Upload error";
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          res.status(413).json({ error: "File too large (max 2MB)" });
          return;
        }
        res.status(400).json({ error: msg });
        return;
      }
      res.status(400).json({ error: msg });
      return;
    }

    try {
      if (!req.file) {
        res.status(400).json({ error: "No image file provided" });
        return;
      }

      const previousImagePath = existingItem.image_url
        ? getStoredImagePath(existingItem.image_url)
        : null;
      const imageUrl = `/uploads/${req.file.filename}`;
      const updatedItem = updateInventoryItemImage(itemId, imageUrl);

      if (previousImagePath && fs.existsSync(previousImagePath)) {
        fs.unlinkSync(previousImagePath);
      }

      res.json({ item: updatedItem });
    } catch (e: unknown) {
      if (req.file) {
        const uploadedPath = path.join(getUploadsDir(), req.file.filename);
        if (fs.existsSync(uploadedPath)) {
          fs.unlinkSync(uploadedPath);
        }
      }
      const msg = e instanceof Error ? e.message : "Internal error";
      console.error("[image-upload] handler error:", msg, e);
      res.status(500).json({ error: msg });
    }
  });
});

// DELETE /api/admin/inventory/:id/image — remove image
router.delete("/:id/image", (req: Request, res: Response) => {
  const item = getInventoryItemRecord(req.params.id as string);
  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  if (item.image_url) {
    const imgPath = getStoredImagePath(item.image_url);
    if (fs.existsSync(imgPath)) {
      fs.unlinkSync(imgPath);
    }
  }

  res.json({ item: updateInventoryItemImage(req.params.id as string, null) });
});

export default router;
