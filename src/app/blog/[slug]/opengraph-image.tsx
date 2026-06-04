import { ImageResponse } from "next/og";
import { getPost } from "@/lib/blog";

export const runtime = "edge";
export const alt = "Blog post cover";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: { slug: string } }) {
  const post = getPost(params.slug);
  if (!post) {
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            backgroundColor: "#FAF7F2",
            color: "#1a1a1a",
            fontFamily: "serif",
            fontSize: 48,
          }}
        >
          First Light
        </div>
      ),
      { ...size }
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          backgroundColor: "#FAF7F2",
          padding: "60px 80px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div
            style={{
              fontSize: 14,
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              color: "#a67c52",
            }}
          >
            First Light · Blog
          </div>
          <div
            style={{
              fontSize: 52,
              fontWeight: 600,
              color: "#1a1a1a",
              lineHeight: 1.15,
              maxWidth: "900px",
            }}
          >
            {post.title}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <div
            style={{
              fontSize: 18,
              color: "#666",
              maxWidth: "700px",
              lineHeight: 1.4,
            }}
          >
            {post.description}
          </div>
          <div
            style={{
              fontSize: 16,
              color: "#a67c52",
              fontWeight: 500,
            }}
          >
            firstlight.to
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
