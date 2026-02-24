import { NextResponse, NextRequest } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { detail: "Image ID is required" },
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

    // Fetch image from backend
    const backendResponse = await fetch(`${API_URL}/api/images/${id}`, {
      headers,
    });

    if (!backendResponse.ok) {
      console.error(`Failed to fetch image ${id}: ${backendResponse.status}`);
      return new NextResponse(null, { status: backendResponse.status });
    }

    const imageBlob = await backendResponse.blob();

    return new NextResponse(imageBlob, {
      status: 200,
      headers: {
        "Content-Type":
          backendResponse.headers.get("Content-Type") || "image/png",
        "Cache-Control": "public, max-age=31536000", // Cache for 1 year
      },
    });
  } catch (error) {
    console.error("Image fetch error:", error);
    return NextResponse.json(
      { detail: "An unexpected error occurred fetching the image" },
      { status: 500 }
    );
  }
}
