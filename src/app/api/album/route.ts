import { list } from "@vercel/blob";
import Mux from "@mux/mux-node";
import { NextResponse } from "next/server";

const VIDEO_EXT = /\.(mp4|mov|webm|mkv|m4v)$/i;

interface MediaItem {
  url: string;
  fullResUrl: string;
  name: string;
  uploadedAt: string;
  size: number;
  kind: "image" | "video";
  muxPlaybackId?: string;
  muxStatus?: "preparing" | "ready" | "errored";
  downloadUrl?: string;
}

interface MuxResult {
  items: MediaItem[];
  migratedBlobPaths: Set<string>;
}

async function listMuxVideos(): Promise<MuxResult> {
  const tokenId = process.env.MUX_TOKEN_ID;
  if (!tokenId || !process.env.MUX_TOKEN_SECRET) {
    return { items: [], migratedBlobPaths: new Set() };
  }
  const mux = new Mux({ tokenId, tokenSecret: process.env.MUX_TOKEN_SECRET });

  try {
    const items: MediaItem[] = [];
    const migratedBlobPaths = new Set<string>();
    const page = await mux.video.assets.list({ limit: 100 });
    for (const a of page.data) {
      const playbackId = a.playback_ids?.[0]?.id;
      const status =
        a.status === "ready"
          ? "ready"
          : a.status === "errored"
            ? "errored"
            : "preparing";
      const passthrough = a.passthrough || "";
      if (passthrough.startsWith("album/")) migratedBlobPaths.add(passthrough);
      const filename = passthrough
        ? passthrough.replace("album/", "").replace(/^\d+-/, "")
        : `video-${a.id.slice(0, 8)}`;
      const thumb = playbackId
        ? `https://image.mux.com/${playbackId}/animated.webp?width=480&height=480&fit_mode=smartcrop&start=0&end=3&fps=15`
        : "";
      const stream = playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : "";
      const mp4Enabled = a.mp4_support && a.mp4_support !== "none";
      const downloadUrl =
        playbackId && mp4Enabled
          ? `https://stream.mux.com/${playbackId}/capped-1080p.mp4`
          : undefined;

      items.push({
        url: thumb,
        fullResUrl: stream,
        name: filename,
        uploadedAt: a.created_at
          ? new Date(Number(a.created_at) * 1000).toISOString()
          : new Date().toISOString(),
        size: 0,
        kind: "video",
        muxPlaybackId: playbackId,
        muxStatus: status,
        downloadUrl,
      });
    }
    return { items, migratedBlobPaths };
  } catch {
    return { items: [], migratedBlobPaths: new Set() };
  }
}

interface BlobResult {
  items: MediaItem[];
  legacyVideoCount: number;
  totalBytes: number;
}

async function listBlobMedia(migratedPaths: Set<string>): Promise<BlobResult> {
  try {
    const { blobs } = await list({ prefix: "album/" });
    const items: MediaItem[] = [];
    let legacyVideoCount = 0;
    for (const b of blobs) {
      const isVideo = VIDEO_EXT.test(b.pathname);
      if (isVideo && migratedPaths.has(b.pathname)) continue;
      if (isVideo) legacyVideoCount++;
      items.push({
        url: b.url,
        fullResUrl: b.url,
        name: b.pathname.replace("album/", "").replace(/^\d+-/, ""),
        uploadedAt: b.uploadedAt as unknown as string,
        size: b.size,
        kind: isVideo ? "video" : "image",
      });
    }
    const totalBytes = blobs.reduce((s, b) => s + b.size, 0);
    return { items, legacyVideoCount, totalBytes };
  } catch {
    return { items: [], legacyVideoCount: 0, totalBytes: 0 };
  }
}

/** GET /api/album – list all uploaded media (images from Blob + videos from Mux). */
export async function GET() {
  const muxResult = await listMuxVideos();
  const blobResult = await listBlobMedia(muxResult.migratedBlobPaths);

  const all = [...blobResult.items, ...muxResult.items].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
  );

  const limitMB = 100 * 1024;
  const limitBytes = limitMB * 1024 * 1024;

  return NextResponse.json({
    photos: all,
    legacyVideoCount: blobResult.legacyVideoCount,
    storage: {
      usedBytes: blobResult.totalBytes,
      usedMB: Math.round((blobResult.totalBytes / 1024 / 1024) * 10) / 10,
      limitMB,
      percent: Math.round((blobResult.totalBytes / limitBytes) * 100),
    },
  });
}
