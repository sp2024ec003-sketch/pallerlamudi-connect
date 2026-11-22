"use client";

import { useState } from "react";

type UploadedAttachment = { fileName: string; mimeType: string; size: number; storageKey: string };

const ACCEPT = ".png,.jpg,.jpeg,.webp,.pdf,.doc,.docx,.xls,.xlsx";
const MAX = 10 * 1024 * 1024;

export default function AttachmentUploader({
  onUploaded,
}: { onUploaded: (items: UploadedAttachment[]) => void }) {
  const [items, setItems] = useState<UploadedAttachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError("");
    const added: UploadedAttachment[] = [];
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX) throw new Error(`${file.name}: maximum file size is 10 MB.`);
        const sign = await fetch("/api/uploads/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: file.name, mimeType: file.type, size: file.size }),
        });
        const signed = await sign.json();
        if (!sign.ok) throw new Error(signed.error || "Could not prepare upload.");
        const put = await fetch(signed.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!put.ok) throw new Error(`Upload failed for ${file.name}.`);
        added.push({ fileName: file.name, mimeType: file.type, size: file.size, storageKey: signed.storageKey });
      }
      const next = [...items, ...added];
      setItems(next);
      onUploaded(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="card">
    <h3>Attachments</h3>
    <p className="muted">Attach photos, PNG/JPG/WEBP images, PDF documents, Word files and Excel files. Maximum 10 MB each.</p>
    <input type="file" multiple accept={ACCEPT} disabled={busy} onChange={e => { void upload(e.target.files); e.currentTarget.value = ""; }} />
    {busy && <p>Uploading attachments…</p>}
    {error && <p role="alert" style={{color:"crimson"}}>{error}</p>}
    <ul>{items.map(item => <li key={item.storageKey}>{item.fileName} — {Math.ceil(item.size / 1024)} KB</li>)}</ul>
  </section>;
}
