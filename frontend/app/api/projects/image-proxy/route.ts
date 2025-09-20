import { NextResponse, NextRequest } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function GET(request: NextRequest) {
  const imageUrl = request.nextUrl.searchParams.get("image_url");

  if (!imageUrl) {
    return NextResponse.json(
      { detail: "Image URL is required" },
      { status: 400 }
    );
  }

  try {
    const backendResponse = await fetch(
      `${API_URL}/api/projects/image-proxy?image_url=${encodeURIComponent(
        imageUrl
      )}`
    );

    if (!backendResponse.ok) {
      const errorData = await backendResponse.text();
      return new NextResponse(errorData, { status: backendResponse.status });
    }

    const imageBlob = await backendResponse.blob();

    return new NextResponse(imageBlob, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
      },
    });
  } catch (error) {
    console.error("Image proxy error:", error);
    return NextResponse.json(
      { detail: "An unexpected error occurred in the image proxy" },
      { status: 500 }
    );
  }
}
