import { put, list } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

/**
 * Comments stored as small JSON blobs: comments/<photoId>/<timestamp>.json
 * Each contains { author, text, createdAt }.
 */
function photoId(url: string): string {
  return url.slice(-60).replace(/[^a-zA-Z0-9]/g, "_");
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { photoUrl, author, text } = body as {
    photoUrl?: string;
    author?: string;
    text?: string;
  };

  if (!photoUrl || !text?.trim()) {
    return NextResponse.json({ error: "photoUrl and text required" }, { status: 400 });
  }

  const comment = {
    author: (author || "Anonym").slice(0, 50),
    text: text.trim().slice(0, 500),
    createdAt: new Date().toISOString(),
  };

  const pid = photoId(photoUrl);
  const pathname = `comments/${pid}/${Date.now()}.json`;

  try {
    await put(pathname, JSON.stringify(comment), {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/json",
    });
    return NextResponse.json({ ok: true, comment });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: `Save failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const photoUrl = url.searchParams.get("photoUrl");

  if (!photoUrl) {
    return NextResponse.json({ error: "photoUrl param required" }, { status: 400 });
  }

  try {
    const pid = photoId(photoUrl);
    const { blobs } = await list({ prefix: `comments/${pid}/` });

    const comments = await Promise.all(
      blobs.map(async (b) => {
        try {
          const res = await fetch(b.url);
          if (!res.ok) return null;
          const data = await res.json();
          return {
            author: data.author || "Anonym",
            text: data.text || "",
            createdAt: data.createdAt || b.uploadedAt,
          };
        } catch {
          return null;
        }
      }),
    );

    return NextResponse.json({
      comments: comments
        .filter(Boolean)
        .sort((a, b) => new Date(a!.createdAt).getTime() - new Date(b!.createdAt).getTime()),
    });
  } catch {
    return NextResponse.json({ comments: [] });
  }
}
