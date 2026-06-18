// Decoding image sources to pixel data for color extraction. Lives UI-side: the
// main thread has no canvas. Sources that hand us bytes directly (File from
// drag/upload, Blob from a pasted image) never hit CORS; a URL goes through
// fetch and is best-effort — a host without CORS headers will reject the read.

// Longest-side cap (px) for the sampled bitmap. k-means runs on this downsample,
// not the full image: ~256² ≈ 64k pixels keeps clustering fast while staying
// representative. The on-screen preview uses the original bytes, not this.
export const DOWNSAMPLE_MAX = 256

export interface DecodedImage {
  // Downsampled RGBA pixels for extraction.
  imageData: ImageData
  // Object URL of the original bytes, for the full-quality on-screen preview.
  // The caller must revoke it when done.
  previewUrl: string
}

// Draw `blob` onto a canvas scaled to DOWNSAMPLE_MAX and read its pixels. The
// blob's own bytes back the preview URL, so the displayed image is never
// CORS-tainted (we already hold the data).
async function decodeBlob(blob: Blob): Promise<DecodedImage> {
  if (!blob.type.startsWith('image/')) {
    throw new Error('That doesn’t look like an image.')
  }

  const bitmap = await createImageBitmap(blob)
  try {
    const scale = Math.min(1, DOWNSAMPLE_MAX / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (ctx === null) throw new Error('Couldn’t read image pixels.')
    ctx.drawImage(bitmap, 0, 0, width, height)

    return {
      imageData: ctx.getImageData(0, 0, width, height),
      previewUrl: URL.createObjectURL(blob),
    }
  } finally {
    bitmap.close()
  }
}

// Decode a File (drag-drop or upload). File is a Blob, so this never hits CORS.
export function imageFromFile(file: File): Promise<DecodedImage> {
  return decodeBlob(file)
}

// Decode an image at a direct URL. Best-effort: fetch is subject to the host's
// CORS policy, so a public CDN that sends permissive headers works, while a host
// that doesn't will reject — surfaced as a clear, actionable error.
export async function imageFromUrl(url: string): Promise<DecodedImage> {
  let response: Response
  try {
    response = await fetch(url)
  } catch {
    throw new Error('Couldn’t load that link (the host may block cross-origin access).')
  }
  if (!response.ok) {
    throw new Error(`Couldn’t load that link (HTTP ${response.status}).`)
  }
  return decodeBlob(await response.blob())
}
