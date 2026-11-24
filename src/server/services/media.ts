import "server-only";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp, { type Metadata } from "sharp";
import { AwsClient } from "aws4fetch";
import { env } from "../env";
import { AppError } from "../lib/errors";
import type { ImageVariants } from "../db/schema";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "avif", "heif"]);
const SIZES = { thumb: 320, md: 800, lg: 1600 } as const;

/** Magic-byte sniffing — never trust the client's declared content type or filename. */
export function sniffImage(buf: Uint8Array): string | null {
  const b = buf;
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "webp";
  const box = String.fromCharCode(b[4], b[5], b[6], b[7]);
  if (box === "ftyp") {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
    if (brand.startsWith("avi")) return "avif";
    if (["heic", "heix", "mif1", "msf1"].includes(brand)) return "heif";
  }
  return null;
}

// ------------------------------------------------------------ storage drivers

interface Storage {
  put(key: string, body: Buffer, contentType: string): Promise<string>;
  remove(key: string): Promise<void>;
}

/** Local uploads dir (served at /uploads by nginx in production, by Next in dev). */
const uploadDir = () => env().UPLOAD_DIR ?? path.join(process.cwd(), "public", "uploads");

const localStorage: Storage = {
  async put(key, body) {
    const file = path.join(uploadDir(), key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
    return `/uploads/${key}`;
  },
  async remove(key) {
    await unlink(path.join(uploadDir(), key)).catch(() => undefined);
  },
};

function s3Storage(): Storage {
  const e = env();
  const client = new AwsClient({ accessKeyId: e.S3_ACCESS_KEY_ID!, secretAccessKey: e.S3_SECRET_ACCESS_KEY!, region: e.S3_REGION, service: "s3" });
  const objectUrl = (key: string) => `${e.S3_ENDPOINT!.replace(/\/$/, "")}/${e.S3_BUCKET}/${key}`;
  return {
    async put(key, body, contentType) {
      const res = await client.fetch(objectUrl(key), {
        method: "PUT",
        body: new Uint8Array(body),
        headers: { "content-type": contentType, "cache-control": "public, max-age=31536000, immutable" },
      });
      if (!res.ok) throw new Error(`Storage upload failed (${res.status})`);
      return `${e.MEDIA_PUBLIC_URL!.replace(/\/$/, "")}/${key}`;
    },
    async remove(key) {
      await client.fetch(objectUrl(key), { method: "DELETE" }).catch(() => undefined);
    },
  };
}

const storage = (): Storage => (env().STORAGE_DRIVER === "s3" ? s3Storage() : localStorage);

// ------------------------------------------------------------ processing

export interface ProcessedImage {
  url: string;
  variants: ImageVariants;
  storageKey: string;
  width: number;
  height: number;
}

/**
 * Validates and optimizes an uploaded image: magic-byte check, decode with a
 * pixel cap (decompression-bomb guard), EXIF auto-rotate then metadata strip,
 * and WebP renditions at 320/800/1600 px (never upscaled).
 */
export async function processImageUpload(buf: Buffer, prefix: string): Promise<ProcessedImage> {
  if (buf.length === 0) throw new AppError("BAD_REQUEST", "Empty file");
  if (buf.length > MAX_UPLOAD_BYTES) throw new AppError("PAYLOAD_TOO_LARGE", "Images must be 10 MB or smaller");
  const kind = sniffImage(buf);
  if (!kind || !ALLOWED_FORMATS.has(kind)) throw new AppError("UNSUPPORTED_MEDIA", "Upload a JPEG, PNG, WebP or AVIF image");

  const base = sharp(buf, { limitInputPixels: MAX_PIXELS, failOn: "error" });
  let meta: Metadata;
  try {
    meta = await base.metadata();
  } catch {
    throw new AppError("UNSUPPORTED_MEDIA", "The image could not be decoded");
  }
  if (!meta.width || !meta.height) throw new AppError("UNSUPPORTED_MEDIA", "The image could not be decoded");

  const id = randomUUID();
  const safePrefix = prefix.replace(/[^a-z0-9-]/gi, "").slice(0, 60) || "media";
  const keyBase = `${safePrefix}/${id}`;
  const store = storage();
  const urls = {} as ImageVariants;
  for (const [name, width] of Object.entries(SIZES) as [keyof ImageVariants, number][]) {
    const out = await sharp(buf, { limitInputPixels: MAX_PIXELS })
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: name === "thumb" ? 72 : 80, effort: 4 })
      .toBuffer();
    urls[name] = await store.put(`${keyBase}-${name}.webp`, out, "image/webp");
  }
  const oriented = meta.orientation && meta.orientation >= 5;
  return {
    url: urls.lg,
    variants: urls,
    storageKey: keyBase,
    width: oriented ? meta.height : meta.width,
    height: oriented ? meta.width : meta.height,
  };
}

export async function deleteStoredImage(storageKey: string | null) {
  if (!storageKey) return;
  const store = storage();
  await Promise.all(Object.keys(SIZES).map((n) => store.remove(`${storageKey}-${n}.webp`)));
}
