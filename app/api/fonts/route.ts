import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const family = searchParams.get("family");
  const weight = searchParams.get("weight") || "400";
  const italic = searchParams.get("italic") === "true";

  if (!family) {
    return new NextResponse("Missing family", { status: 400 });
  }

  let cssUrl = "";
  if (italic) {
    cssUrl = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:ital,wght@1,${weight}&display=swap`;
  } else {
    cssUrl = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}&display=swap`;
  }

  try {
    const cssRes = await fetch(cssUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/534.59.10 (KHTML, like Gecko) Version/5.1.9 Safari/534.59.10"
      }
    });

    if (!cssRes.ok) {
      throw new Error(`Google Fonts CSS failed: ${cssRes.status}`);
    }

    const css = await cssRes.text();
    
    const match = css.match(/url\((https:\/\/[^)]+\.ttf)\)/);
    if (!match || !match[1]) {
      return new NextResponse("Could not find TTF url in Google Fonts response", { status: 404 });
    }

    const ttfUrl = match[1];

    const fontRes = await fetch(ttfUrl);
    if (!fontRes.ok) throw new Error("Failed to download TTF");

    const fontBuffer = await fontRes.arrayBuffer();

    return new NextResponse(fontBuffer, {
      headers: {
        "Content-Type": "font/ttf",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  } catch (err) {
    return new NextResponse(`Error: ${err instanceof Error ? err.message : "Unknown error"}`, { status: 500 });
  }
}
