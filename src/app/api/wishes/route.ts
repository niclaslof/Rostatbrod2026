import { put, list } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

/**
 * Guestbook (gästbok).
 *
 * Each entry is its own JSON blob under wishes/<timestamp>.json with shape
 *   { author: string, message: string, createdAt: ISO-string }
 */

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { author, message } = body as { author?: string; message?: string };

  if (!message?.trim()) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  const wish = {
    author: (author || "Anonym").slice(0, 60),
    message: message.trim().slice(0, 600),
    createdAt: new Date().toISOString(),
  };

  const pathname = `wishes/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;

  try {
    await put(pathname, JSON.stringify(wish), {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/json",
    });
    return NextResponse.json({ ok: true, wish });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: `Save failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const { blobs } = await list({ prefix: "wishes/" });
    const wishes = await Promise.all(
      blobs.map(async (b) => {
        try {
          const res = await fetch(b.url);
          if (!res.ok) return null;
          const data = await res.json();
          return {
            author: data.author || "Anonym",
            message: data.message || "",
            createdAt: data.createdAt || b.uploadedAt,
          };
        } catch {
          return null;
        }
      }),
    );

    return NextResponse.json({
      wishes: wishes
        .filter(Boolean)
        .sort((a, b) => new Date(b!.createdAt).getTime() - new Date(a!.createdAt).getTime()),
    });
  } catch {
    return NextResponse.json({ wishes: [] });
  }
}
