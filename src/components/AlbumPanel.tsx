"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { upload } from "@vercel/blob/client";
import MuxPlayer from "@mux/mux-player-react";
import { site } from "@/lib/site";

const NAME_KEY = `${site.slug}-name`;

interface PhotoItem {
  id: string;
  name: string;
  thumbnailUrl: string;
  fullUrl: string;
  fullResUrl: string;
  date: string;
  source: "blob" | "mux";
  kind: "image" | "video";
  muxPlaybackId?: string;
  muxStatus?: "preparing" | "ready" | "errored";
  downloadUrl?: string;
}

interface Comment {
  author: string;
  text: string;
  createdAt: string;
}

function formatStorage(usedMB: number, limitMB: number): string {
  const fmt = (mb: number) =>
    mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
  return `${fmt(usedMB)} / ${fmt(limitMB)}`;
}

/** PUT a video file to a Mux Direct Upload URL with progress reporting. */
function uploadToMux(
  url: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Mux upload ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Mux upload network error"));
    xhr.send(file);
  });
}

/** Compress image client-side before upload: max 2400px, JPEG 0.82. */
async function compressImage(file: File): Promise<File> {
  if (file.size < 500_000) return file;
  return new Promise((resolve) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 2400;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const r = Math.min(MAX / width, MAX / height);
        width = Math.round(width * r);
        height = Math.round(height * r);
      }
      const c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      c.getContext("2d")!.drawImage(img, 0, 0, width, height);
      c.toBlob(
        (blob) => {
          if (blob && blob.size < file.size) {
            resolve(new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }));
          } else {
            resolve(file);
          }
        },
        "image/jpeg",
        0.82,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

export default function AlbumPanel() {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [storage, setStorage] = useState<{ usedMB: number; limitMB: number; percent: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [showUploadSheet, setShowUploadSheet] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoCameraInputRef = useRef<HTMLInputElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const fetchPhotos = useCallback(async () => {
    setLoading(true);
    setError(null);
    const all: PhotoItem[] = [];

    try {
      const res = await fetch("/api/album");
      if (res.ok) {
        const data = await res.json();
        if (data.storage) setStorage(data.storage);
        for (const p of data.photos || []) {
          const isMux = !!p.muxPlaybackId;
          all.push({
            id: isMux ? `m-${p.muxPlaybackId}` : `b-${p.url}`,
            name: p.name,
            thumbnailUrl: p.url,
            fullUrl: p.url,
            fullResUrl: p.fullResUrl || p.url,
            date: p.uploadedAt,
            source: isMux ? "mux" : "blob",
            kind: p.kind === "video" ? "video" : "image",
            muxPlaybackId: p.muxPlaybackId,
            muxStatus: p.muxStatus,
            downloadUrl: p.downloadUrl,
          });
        }
      }
    } catch {
      /* ok */
    }

    all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setPhotos(all);
    setLoading(false);
    setHasFetched(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ob = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasFetched) fetchPhotos();
      },
      { threshold: 0.1 },
    );
    const el = document.getElementById("album");
    if (el) ob.observe(el);
    return () => ob.disconnect();
  }, [fetchPhotos, hasFetched]);

  // Poll while any Mux video is still preparing (typically 5–30s).
  useEffect(() => {
    const preparing = photos.some((p) => p.source === "mux" && p.muxStatus !== "ready");
    if (!preparing) return;
    const t = setTimeout(() => fetchPhotos(), 5000);
    return () => clearTimeout(t);
  }, [photos, fetchPhotos]);

  const uploadFiles = async (files: FileList | File[]) => {
    setShowUploadSheet(false);
    setUploading(true);
    setError(null);
    const arr = Array.from(files);

    const progress = arr.map(() => 0);
    const statuses = arr.map(() => "väntar") as string[];
    const updateLabel = () => {
      const done = statuses.filter((s) => s === "klar").length;
      const avg = Math.round(progress.reduce((s, p) => s + p, 0) / arr.length);
      setUploadProgress(`${done}/${arr.length} klart · ${avg}%`);
    };

    let lastErr = "";
    const results = await Promise.all(
      arr.map(async (file, i) => {
        const isVideo = file.type.startsWith("video/");
        try {
          if (isVideo) {
            statuses[i] = "video";
            const tokenRes = await fetch("/api/album/mux-upload", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ filename: file.name }),
            });
            if (!tokenRes.ok) throw new Error(`Mux token: ${tokenRes.status}`);
            const { uploadUrl } = await tokenRes.json();
            if (!uploadUrl) throw new Error("Inget upload-URL från Mux");
            await uploadToMux(uploadUrl, file, (pct) => {
              progress[i] = pct;
              updateLabel();
            });
          } else {
            statuses[i] = "bild";
            const prepared = await compressImage(file);
            const safeName = prepared.name.replace(/[^a-zA-Z0-9._-]/g, "_");
            const pathname = `album/${Date.now()}-${i}-${safeName}`;
            await upload(pathname, prepared, {
              access: "public",
              handleUploadUrl: "/api/album/upload",
              onUploadProgress: ({ percentage }) => {
                progress[i] = Math.round(percentage);
                updateLabel();
              },
            });
          }
          progress[i] = 100;
          statuses[i] = "klar";
          updateLabel();
          return true;
        } catch (e) {
          lastErr = `Fel: ${e instanceof Error ? e.message : String(e)}`;
          return false;
        }
      }),
    );

    const uploaded = results.filter(Boolean).length;
    setUploading(false);
    setUploadProgress("");
    if (uploaded === 0 && lastErr) setError(lastErr);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (videoCameraInputRef.current) videoCameraInputRef.current.value = "";
    if (uploaded > 0) {
      setPhotos([]);
      setHasFetched(false);
      fetchPhotos();
    }
  };

  const goNext = useCallback(
    () => setLightboxIdx((i) => (i !== null && i < photos.length - 1 ? i + 1 : i)),
    [photos.length],
  );
  const goPrev = useCallback(() => setLightboxIdx((i) => (i !== null && i > 0 ? i - 1 : i)), []);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    touchStartRef.current = null;
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
    if (dx < 0) goNext();
    else goPrev();
  };

  useEffect(() => {
    if (lightboxIdx === null) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "Escape") setLightboxIdx(null);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [lightboxIdx, goNext, goPrev]);

  return (
    <section id="album" className="relative py-16 sm:py-24 px-5 max-w-5xl mx-auto">
      <div className="text-center reveal">
        <p className="micro text-amber mb-2">Minnen från resan</p>
        <h2 className="font-display text-3xl sm:text-5xl font-bold text-ink">
          Delat album
        </h2>
        <div className="fancy-rule w-32 mx-auto mt-4" />
        <p className="text-warm text-sm sm:text-base max-w-2xl mx-auto mt-4">
          Tryck på + nere till höger för att lägga upp bilder och videor. Allt sparas
          delat – alla i sällskapet ser samma album, kan kommentera och ladda ner
          originalen efteråt.
        </p>
      </div>

      <div className="mt-10 card p-5 sm:p-7 reveal">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[0.7rem] uppercase tracking-[0.2em] text-warm">
            {photos.length > 0
              ? <><span className="font-mono">{photos.length}</span> objekt</>
              : "Inget uppladdat ännu"}
            {storage && <> · <span className="font-mono">{formatStorage(storage.usedMB, storage.limitMB)}</span></>}
          </p>
          <button
            onClick={() => {
              setPhotos([]);
              setHasFetched(false);
              fetchPhotos();
            }}
            className="text-[0.65rem] uppercase tracking-[0.2em] text-faint hover:text-amber transition-colors"
            title="Uppdatera album"
          >
            ↻ uppdatera
          </button>
        </div>

        {storage && (
          <div className="mb-4 w-full h-1 rounded-full bg-tag overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                storage.percent > 90 ? "bg-wine" : storage.percent > 70 ? "bg-amber" : "bg-teal"
              }`}
              style={{ width: `${Math.min(storage.percent, 100)}%` }}
            />
          </div>
        )}

        {uploading && (
          <div className="flex items-center gap-3 mb-4 px-4 py-3 rounded-xl bg-amber/10 border border-amber/30">
            <div className="w-4 h-4 border-2 border-amber/30 border-t-amber rounded-full animate-spin shrink-0" />
            <span className="text-sm text-amber font-medium font-mono">{uploadProgress}</span>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-3 py-8 text-warm text-sm">
            <div className="w-4 h-4 border-2 border-amber/30 border-t-amber rounded-full animate-spin" />
            Laddar album…
          </div>
        )}

        {error && !loading && (
          <div className="rounded-lg bg-wine/10 border border-wine/40 p-4 text-[0.78rem] text-wine">{error}</div>
        )}

        {hasFetched && !loading && !error && photos.length === 0 && !uploading && (
          <div className="text-center py-12 text-warm">
            <span className="text-5xl block mb-3">📸</span>
            <p className="text-sm font-medium mb-1 text-ink">Inget uppladdat ännu</p>
            <p className="text-[0.72rem]">
              Tryck på <span className="text-amber font-bold">+</span> för att lägga upp första!
            </p>
          </div>
        )}

        {photos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {photos.map((photo, idx) => (
              <button
                key={photo.id}
                onClick={() => setLightboxIdx(idx)}
                className="relative aspect-square rounded-xl overflow-hidden bg-tag cursor-pointer hover:opacity-90 transition-opacity group"
              >
                {photo.kind === "video" ? (
                  <>
                    {photo.source === "mux" && photo.muxStatus !== "ready" ? (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-tag text-warm text-[0.65rem] uppercase tracking-[0.18em]">
                        <div className="w-5 h-5 border-2 border-amber/30 border-t-amber rounded-full animate-spin" />
                        Bearbetas…
                      </div>
                    ) : photo.source === "mux" && photo.muxPlaybackId ? (
                      <Image
                        src={photo.thumbnailUrl}
                        alt={photo.name}
                        width={400}
                        height={400}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <video
                        src={photo.thumbnailUrl}
                        preload="metadata"
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    )}
                    {(photo.source !== "mux" || photo.muxStatus === "ready") && (
                      <span className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-label="Video">
                        <span className="w-10 h-10 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center text-white text-sm">
                          ▶
                        </span>
                      </span>
                    )}
                  </>
                ) : (
                  <Image
                    src={photo.thumbnailUrl}
                    alt={photo.name}
                    width={400}
                    height={400}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-[0.6rem] text-white truncate">{photo.name}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hidden inputs */}
      <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => e.target.files && uploadFiles(e.target.files)} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files && uploadFiles(e.target.files)} />
      <input ref={videoCameraInputRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={(e) => e.target.files && uploadFiles(e.target.files)} />

      {/* Floating + button */}
      <button
        onClick={() => setShowUploadSheet(true)}
        disabled={uploading}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-amber shadow-[0_6px_24px_rgba(180,83,9,0.4)] text-white text-3xl font-light flex items-center justify-center cursor-pointer hover:bg-amber-deep hover:scale-105 active:scale-95 transition-all z-[78] disabled:opacity-60"
        style={{ bottom: "calc(24px + env(safe-area-inset-bottom))" }}
        aria-label="Lägg till bilder"
      >
        +
      </button>

      {showUploadSheet && (
        <div className="fixed inset-0 z-[79] bg-black/50 backdrop-blur-sm" onClick={() => setShowUploadSheet(false)}>
          <div
            className="absolute bottom-0 left-0 right-0 bg-card border-t border-line-soft rounded-t-3xl shadow-2xl p-6"
            style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-line mx-auto mb-5" />
            <h3 className="font-display text-xl font-bold text-ink mb-1">Lägg till bilder & video</h3>
            <p className="text-[0.72rem] text-warm mb-5">Bilder komprimeras automatiskt. Alla i sällskapet ser dem.</p>
            <div className="space-y-2.5">
              <button
                onClick={() => {
                  setShowUploadSheet(false);
                  cameraInputRef.current?.click();
                }}
                className="flex items-center gap-4 w-full px-4 py-3.5 rounded-xl bg-amber text-white hover:bg-amber-deep transition-colors cursor-pointer"
              >
                <span className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center text-xl shrink-0">📷</span>
                <div className="text-left">
                  <div className="text-sm font-bold">Ta en bild</div>
                  <div className="text-[0.68rem] opacity-90">Öppnar kameran direkt</div>
                </div>
              </button>
              <button
                onClick={() => {
                  setShowUploadSheet(false);
                  videoCameraInputRef.current?.click();
                }}
                className="flex items-center gap-4 w-full px-4 py-3.5 rounded-xl bg-amber text-white hover:bg-amber-deep transition-colors cursor-pointer"
              >
                <span className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center text-xl shrink-0">🎥</span>
                <div className="text-left">
                  <div className="text-sm font-bold">Spela in video</div>
                  <div className="text-[0.68rem] opacity-90">Öppnar kameran i videoläge</div>
                </div>
              </button>
              <button
                onClick={() => {
                  setShowUploadSheet(false);
                  fileInputRef.current?.click();
                }}
                className="flex items-center gap-4 w-full px-4 py-3.5 rounded-xl bg-panel border border-line-soft text-ink hover:bg-tag transition-colors cursor-pointer"
              >
                <span className="w-11 h-11 rounded-full bg-amber/15 flex items-center justify-center text-xl shrink-0">🖼️</span>
                <div className="text-left">
                  <div className="text-sm font-semibold">Välj från galleriet</div>
                  <div className="text-[0.68rem] text-warm">Bilder eller videor – flera samtidigt</div>
                </div>
              </button>
            </div>
            <button
              onClick={() => setShowUploadSheet(false)}
              className="w-full mt-4 py-2.5 rounded-xl text-sm text-warm font-medium hover:bg-tag transition-colors cursor-pointer"
            >
              Avbryt
            </button>
          </div>
        </div>
      )}

      {lightboxIdx !== null && photos[lightboxIdx] && (
        <Lightbox
          photos={photos}
          photoIdx={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onPrev={goPrev}
          onNext={goNext}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onGoTo={setLightboxIdx}
        />
      )}
    </section>
  );
}

function Lightbox({
  photos,
  photoIdx,
  onClose,
  onPrev,
  onNext,
  onTouchStart,
  onTouchEnd,
  onGoTo,
}: {
  photos: PhotoItem[];
  photoIdx: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onGoTo: (i: number) => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [authorName, setAuthorName] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem(NAME_KEY) || "" : "",
  );
  const [sending, setSending] = useState(false);

  const photo = photos[photoIdx];
  const totalPhotos = photos.length;

  useEffect(() => {
    [-1, 1, 2].forEach((offset) => {
      const idx = photoIdx + offset;
      if (idx >= 0 && idx < photos.length && photos[idx].kind === "image") {
        const img = new window.Image();
        img.src = photos[idx].fullUrl;
      }
    });
  }, [photoIdx, photos]);

  const fetchComments = useCallback(async () => {
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/album/comments?photoUrl=${encodeURIComponent(photo.fullUrl)}`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
      }
    } catch {
      /* ok */
    }
    setLoadingComments(false);
  }, [photo.fullUrl]);

  useEffect(() => {
    if (showComments) fetchComments();
  }, [showComments, fetchComments]);

  useEffect(() => {
    setComments([]);
    if (showComments) fetchComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo.id]);

  const handleSend = async () => {
    if (!newComment.trim()) return;
    const name = authorName.trim() || "Anonym";
    if (authorName.trim()) localStorage.setItem(NAME_KEY, authorName.trim());
    setSending(true);
    try {
      const res = await fetch("/api/album/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl: photo.fullUrl, author: name, text: newComment.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setComments((prev) => [...prev, data.comment]);
        setNewComment("");
      }
    } catch {
      /* ok */
    }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black flex flex-col select-none">
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <span className="text-white/70 text-sm font-mono">
          {photoIdx + 1} / {totalPhotos}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowComments((v) => !v)}
            className={`px-3 py-1.5 rounded-full text-[0.68rem] font-semibold transition-colors cursor-pointer ${
              showComments ? "bg-amber text-white" : "bg-white/10 text-white/70 hover:bg-white/20"
            }`}
          >
            💬 <span className="font-mono">{comments.length || ""}</span>
          </button>
          {(photo.source !== "mux" || photo.downloadUrl) && (
            <a
              href={photo.source === "mux" ? photo.downloadUrl : photo.fullResUrl}
              download={photo.name}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              title={photo.kind === "video" ? "Ladda ner video" : "Ladda ner originalbild"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </a>
          )}
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-lg cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex-1 relative min-h-0 overflow-hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {photoIdx > 0 && (
          <button onClick={(e) => { e.stopPropagation(); onPrev(); }} className="absolute left-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl flex items-center justify-center cursor-pointer z-10">
            ‹
          </button>
        )}
        {photoIdx < totalPhotos - 1 && (
          <button onClick={(e) => { e.stopPropagation(); onNext(); }} className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl flex items-center justify-center cursor-pointer z-10">
            ›
          </button>
        )}
        <div className="flex h-full w-[300%] transition-transform duration-200 ease-out will-change-transform" style={{ transform: "translateX(-33.333%)" }}>
          {[-1, 0, 1].map((offset) => {
            const idx = photoIdx + offset;
            const p = idx >= 0 && idx < totalPhotos ? photos[idx] : null;
            return (
              <div key={offset} className="w-1/3 flex items-center justify-center overflow-auto" style={{ touchAction: offset === 0 ? "pinch-zoom" : "none" }}>
                {p &&
                  (p.kind === "video" ? (
                    p.source === "mux" && p.muxStatus !== "ready" ? (
                      <div className="flex flex-col items-center gap-3 text-white/70 text-sm px-6 text-center">
                        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <p>Mux bearbetar videon — kommer igång om en stund</p>
                      </div>
                    ) : p.source === "mux" && p.muxPlaybackId ? (
                      <MuxPlayer
                        key={p.id}
                        playbackId={p.muxPlaybackId}
                        streamType="on-demand"
                        autoPlay={offset === 0}
                        muted={false}
                        style={{ maxWidth: "95vw", maxHeight: "100%", width: "100%", aspectRatio: "auto" }}
                        accentColor="#b45309"
                      />
                    ) : (
                      <video key={p.id} src={p.fullUrl} controls playsInline preload={offset === 0 ? "auto" : "metadata"} className="max-w-[95vw] max-h-full" />
                    )
                  ) : (
                    <Image src={p.fullUrl} alt={p.name} width={1600} height={1200} className="max-w-[95vw] max-h-full object-contain" unoptimized />
                  ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="shrink-0 text-center py-2">
        <p className="text-white/80 text-sm truncate px-4">{photo.name}</p>
        <p className="text-white/50 text-[0.6rem] font-mono">
          {new Date(photo.date).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" })}
        </p>
        {totalPhotos <= 20 && (
          <div className="flex justify-center gap-1.5 mt-2">
            {Array.from({ length: totalPhotos }).map((_, i) => (
              <button
                key={i}
                onClick={() => onGoTo(i)}
                className={`rounded-full transition-all cursor-pointer ${i === photoIdx ? "w-5 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/40"}`}
              />
            ))}
          </div>
        )}
      </div>

      {showComments && (
        <div className="shrink-0 max-h-[40vh] bg-card border-t border-line-soft flex flex-col" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {loadingComments && (
              <div className="flex items-center gap-2 text-warm text-sm">
                <div className="w-4 h-4 border-2 border-line border-t-amber rounded-full animate-spin" />
                Laddar…
              </div>
            )}
            {!loadingComments && comments.length === 0 && (
              <p className="text-warm text-sm text-center py-4">Inga kommentarer än – skriv första!</p>
            )}
            {comments.map((c, i) => (
              <div key={i}>
                <div className="flex items-baseline gap-2">
                  <span className="text-[0.72rem] font-semibold text-amber">{c.author}</span>
                  <span className="text-[0.6rem] text-faint font-mono">
                    {new Date(c.createdAt).toLocaleString("sv-SE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-[0.78rem] text-ink leading-snug">{c.text}</p>
              </div>
            ))}
          </div>

          <div className="border-t border-line px-4 py-2 flex gap-2 items-end shrink-0">
            <div className="flex-1 min-w-0">
              {!authorName && (
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="Ditt namn…"
                  className="w-full px-3 py-1.5 mb-1.5 rounded-lg bg-panel text-ink text-[0.72rem] border border-line-soft outline-none focus:border-amber placeholder:text-faint"
                />
              )}
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Skriv en kommentar…"
                className="w-full px-3 py-2 rounded-lg bg-panel text-ink text-sm border border-line-soft outline-none focus:border-amber placeholder:text-faint"
              />
            </div>
            <button
              onClick={handleSend}
              disabled={sending || !newComment.trim()}
              className="shrink-0 px-4 py-2 rounded-lg bg-amber text-white text-sm font-bold hover:bg-amber-deep transition-colors cursor-pointer disabled:opacity-40"
            >
              {sending ? "…" : "Skicka"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
