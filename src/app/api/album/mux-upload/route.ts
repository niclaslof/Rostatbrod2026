import Mux from "@mux/mux-node";
import { NextResponse } from "next/server";

/** POST /api/album/mux-upload – creates a Mux Direct Upload and returns the
 *  upload URL. The browser PUTs the video directly to Mux, bypassing the
 *  serverless body limit. Mux handles transcoding, HLS, thumbnails and CDN. */
export async function POST(request: Request) {
  const tokenId = process.env.MUX_TOKEN_ID;
  if (!tokenId || !process.env.MUX_TOKEN_SECRET) {
    return NextResponse.json({ error: "Mux is not configured" }, { status: 500 });
  }

  const { filename } = (await request.json().catch(() => ({}))) as {
    filename?: string;
  };

  const mux = new Mux({ tokenId, tokenSecret: process.env.MUX_TOKEN_SECRET });

  try {
    const upload = await mux.video.uploads.create({
      cors_origin: "*",
      new_asset_settings: {
        playback_policy: ["public"],
        passthrough: filename || "",
        video_quality: "basic",
        mp4_support: "capped-1080p",
      },
    });

    return NextResponse.json({ uploadUrl: upload.url, uploadId: upload.id });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
