import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { requireAdmin } from "@/lib/auth";

const allowed: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

const maxBytes = 10 * 1024 * 1024; // 10 MB per attachment

export async function POST(request: Request) {
  try {
    requireAdmin(request); // Replace placeholder with real session-based authorization.
    const body = await request.json();
    const mimeType = String(body.mimeType ?? "");
    const size = Number(body.size ?? 0);
    const originalName = String(body.fileName ?? "attachment").slice(0, 180);

    if (!allowed[mimeType]) {
      return NextResponse.json({ error: "Unsupported file type. Allowed: PNG, JPG, WEBP, PDF, DOC, DOCX, XLS, XLSX." }, { status: 415 });
    }
    if (!Number.isFinite(size) || size <= 0 || size > maxBytes) {
      return NextResponse.json({ error: "File must be between 1 byte and 10 MB." }, { status: 413 });
    }

    const required = ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"];
    if (required.some(k => !process.env[k])) {
      return NextResponse.json({ error: "Private object storage is not configured." }, { status: 503 });
    }

    const client = new S3Client({
      region: process.env.S3_REGION || "auto",
      endpoint: process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
    });

    const key = `pallerlamudi/attachments/${randomUUID()}.${allowed[mimeType]}`;
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      ContentType: mimeType,
      ContentLength: size,
      Metadata: { "original-name": encodeURIComponent(originalName) },
    });
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });

    return NextResponse.json({
      uploadUrl,
      storageKey: key,
      expiresInSeconds: 300,
      maxBytes,
      requiredHeaders: { "Content-Type": mimeType },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload request failed";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
