import { ImageResponse } from "next/og";

export const alt = "Moritz — Operations command centre";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function loadGoogleFont(
  family: string,
  weight: number,
  text: string
): Promise<ArrayBuffer> {
  const cssUrl =
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}` +
    `:wght@${weight}&text=${encodeURIComponent(text)}`;
  const css = await (await fetch(cssUrl)).text();
  const match = css.match(
    /src:\s*url\(([^)]+)\)\s*format\('(opentype|truetype|woff2?)'\)/
  );
  if (!match?.[1]) {
    throw new Error(`Could not resolve font file for ${family} ${weight}`);
  }
  return (await fetch(match[1])).arrayBuffer();
}

export default async function Image() {
  const wordmark = "Moritz";
  const line = "Operations command centre";

  const [display, sans] = await Promise.all([
    loadGoogleFont("Cormorant Garamond", 600, wordmark),
    loadGoogleFont("Manrope", 500, line),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          // snow-50 — cool near-white from the product token set
          background: "#F7F8FA",
          color: "#1A1D21",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              // fjord-500
              background: "#3D9B8F",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              fontSize: 18,
              fontFamily: "Manrope",
              fontWeight: 500,
            }}
          >
            M
          </div>
          <div
            style={{
              fontFamily: "Cormorant Garamond",
              fontSize: 92,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            {wordmark}
          </div>
        </div>
        <div
          style={{
            fontFamily: "Manrope",
            fontSize: 32,
            fontWeight: 500,
            // snow-500-ish secondary
            color: "#6B7280",
            letterSpacing: "-0.01em",
          }}
        >
          {line}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Cormorant Garamond",
          data: display,
          style: "normal",
          weight: 600,
        },
        {
          name: "Manrope",
          data: sans,
          style: "normal",
          weight: 500,
        },
      ],
    }
  );
}
