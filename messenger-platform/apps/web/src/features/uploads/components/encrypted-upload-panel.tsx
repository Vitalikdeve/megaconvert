"use client";

import { motion } from "framer-motion";
import {
  Copy,
  Download,
  FolderUp,
  Pause,
  Play,
  RefreshCcw,
  Trash2
} from "lucide-react";
import { useRef } from "react";

import { GlassButton, GlassCard, SectionEyebrow } from "@messenger/ui";

import {
  useEncryptedMultipartUpload,
  type UploadTransferItem
} from "../use-encrypted-multipart-upload";

const formatBytes = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unitIndex]}`;
};

const statusLabel: Record<UploadTransferItem["status"], string> = {
  preparing: "Preparing",
  uploading: "Uploading",
  paused: "Paused",
  completed: "Complete",
  error: "Attention",
  cancelled: "Cancelled"
};

export interface EncryptedUploadPanelProps {
  conversationId: string;
  authToken?: string;
  deviceId?: string;
}

export const EncryptedUploadPanel = ({
  conversationId,
  authToken,
  deviceId
}: EncryptedUploadPanelProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const {
    uploads,
    queueFiles,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    refreshDownloadLink
  } = useEncryptedMultipartUpload({
    conversationId,
    authToken,
    deviceId
  });

  return (
    <GlassCard accent="emerald" className="px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <SectionEyebrow>Encrypted Transfer Vault</SectionEyebrow>
          <p className="mt-3 font-display text-2xl text-white">
            10 GB resumable multipart uploads
          </p>
          <p className="mt-2 text-sm leading-6 text-white/60">
            Files are encrypted in the browser, split into parallel chunks, and
            stored as opaque ciphertext in S3-compatible storage.
          </p>
        </div>
        <div className="shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files) {
                queueFiles(event.target.files);
              }

              event.target.value = "";
            }}
          />
          <GlassButton
            variant="secondary"
            size="sm"
            icon={<FolderUp className="h-4 w-4" />}
            onClick={() => fileInputRef.current?.click()}
          >
            Add Files
          </GlassButton>
        </div>
      </div>

      {uploads.length === 0 ? (
        <GlassCard className="mt-5 p-4">
          <p className="font-display text-lg text-white">No active transfers</p>
          <p className="mt-2 text-sm leading-6 text-white/58">
            Start an encrypted upload to see live chunk progress, pause/resume
            controls, and signed download links.
          </p>
        </GlassCard>
      ) : (
        <div className="mt-5 space-y-3">
          {uploads.map((upload) => (
            <motion.div
              key={upload.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 24 }}
            >
              <GlassCard className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg text-white">
                      {upload.fileName}
                    </p>
                    <p className="mt-1 text-sm text-white/56">
                      {formatBytes(upload.bytesUploaded)} /{" "}
                      {formatBytes(upload.sizeBytes)} · {upload.completedPartCount}/
                      {upload.requiredPartCount} chunks
                    </p>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-white/72">
                    {statusLabel[upload.status]}
                  </div>
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/8">
                  <motion.div
                    className="h-full rounded-full bg-[linear-gradient(90deg,rgba(104,249,199,0.85),rgba(176,250,219,0.9))] shadow-[0_0_28px_rgba(98,247,196,0.28)]"
                    animate={{ width: `${upload.progress}%` }}
                    transition={{ type: "spring", stiffness: 180, damping: 22 }}
                  />
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.22em] text-white/42">
                  <span>{upload.progress}% uploaded</span>
                  <span>{upload.mimeType}</span>
                </div>

                {upload.error ? (
                  <p className="mt-3 text-sm text-amber-200">{upload.error}</p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  {upload.status === "uploading" ? (
                    <GlassButton
                      variant="secondary"
                      size="sm"
                      icon={<Pause className="h-4 w-4" />}
                      onClick={() => pauseUpload(upload.id)}
                    >
                      Pause
                    </GlassButton>
                  ) : null}

                  {(upload.status === "paused" ||
                    upload.status === "error" ||
                    upload.status === "preparing") && (
                    <GlassButton
                      variant="secondary"
                      size="sm"
                      icon={<Play className="h-4 w-4" />}
                      onClick={() => resumeUpload(upload.id)}
                    >
                      Resume
                    </GlassButton>
                  )}

                  {upload.status !== "completed" &&
                  upload.status !== "cancelled" ? (
                    <GlassButton
                      variant="ghost"
                      size="sm"
                      icon={<Trash2 className="h-4 w-4" />}
                      onClick={() => void cancelUpload(upload.id)}
                    >
                      Cancel
                    </GlassButton>
                  ) : null}

                  {upload.status === "completed" && upload.downloadUrl ? (
                    <a
                      href={upload.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <GlassButton
                        variant="primary"
                        size="sm"
                        icon={<Download className="h-4 w-4" />}
                      >
                        Download Link
                      </GlassButton>
                    </a>
                  ) : null}

                  {upload.status === "completed" ? (
                    <GlassButton
                      variant="ghost"
                      size="sm"
                      icon={<RefreshCcw className="h-4 w-4" />}
                      onClick={() => void refreshDownloadLink(upload.id)}
                    >
                      Refresh Link
                    </GlassButton>
                  ) : null}

                  {upload.status === "completed" && upload.downloadUrl ? (
                    <GlassButton
                      variant="ghost"
                      size="sm"
                      icon={<Copy className="h-4 w-4" />}
                      onClick={() => {
                        if (upload.downloadUrl) {
                          void navigator.clipboard.writeText(upload.downloadUrl);
                        }
                      }}
                    >
                      Copy Link
                    </GlassButton>
                  ) : null}
                </div>

                {upload.downloadExpiresAt ? (
                  <p className="mt-3 text-xs uppercase tracking-[0.2em] text-white/34">
                    Link expires {new Date(upload.downloadExpiresAt).toLocaleTimeString()}
                  </p>
                ) : null}
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}
    </GlassCard>
  );
};
