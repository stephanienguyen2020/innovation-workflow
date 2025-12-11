import { NextResponse, NextRequest } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function GET(request: NextRequest) {
  const imageUrl = request.nextUrl.searchParams.get("image_url");

  if (!imageUrl) {
    return NextResponse.json(
      { detail: "Image URL is required" },
      { status: 400 }
    );
  }

  try {
    // Get auth token from cookies
    const accessToken = cookies().get("access_token")?.value;

    const headers: HeadersInit = {};
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    // If the image_url is an internal /api/images/{id} URL, fetch directly from backend
    if (imageUrl.startsWith("/api/images/")) {
      const imageId = imageUrl.replace("/api/images/", "");
      const backendResponse = await fetch(`${API_URL}/api/images/${imageId}`, {
        headers,
      });

      if (!backendResponse.ok) {
        console.error(`Failed to fetch image: ${backendResponse.status}`);
        return new NextResponse(null, { status: backendResponse.status });
      }

      const imageBlob = await backendResponse.blob();
      return new NextResponse(imageBlob, {
        status: 200,
        headers: {
          "Content-Type":
            backendResponse.headers.get("Content-Type") || "image/png",
        },
      });
    }

    // For external URLs, use the backend proxy
    const backendResponse = await fetch(
      `${API_URL}/api/projects/image-proxy?image_url=${encodeURIComponent(
        imageUrl
      )}`,
      { headers }
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
