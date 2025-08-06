import { APIEvent } from "@solidjs/start/server";
import { readFileSync } from "fs";
import { resolve } from "path";

export async function GET(event: APIEvent) {
  try {
    // Read the favicon.ico file from the public directory
    const faviconPath = resolve(process.cwd(), "public", "favicon.ico");
    const faviconContent = readFileSync(faviconPath);
    
    return new Response(faviconContent, {
      status: 200,
      headers: {
        "Content-Type": "image/x-icon",
        "Cache-Control": "public, max-age=604800", // 7 days
      },
    });
  } catch (error) {
    console.error("Error serving favicon.ico:", error);
    return new Response("Not Found", { status: 404 });
  }
}