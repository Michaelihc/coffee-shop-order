import fs from "fs";
import path from "path";

export function getUploadsDir(): string {
  return process.env.DB_PATH
    ? path.join(path.dirname(process.env.DB_PATH), "images")
    : path.join(process.cwd(), "data", "images");
}

export function ensureUploadsDir(): string {
  const uploadsDir = getUploadsDir();
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  return uploadsDir;
}

export function getStoredImagePath(imageUrl: string): string {
  return path.join(getUploadsDir(), path.basename(imageUrl));
}
