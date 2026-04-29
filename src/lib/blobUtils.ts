// Decode a base64 string into a Blob. Slices into 8KB chunks so very large
// images don't allocate one giant ArrayBuffer.
export function base64ToBlob(data: string, mimeType: string): Blob {
  const binary = window.atob(data)
  const chunks: ArrayBuffer[] = []
  for (let offset = 0; offset < binary.length; offset += 8192) {
    const slice = binary.slice(offset, offset + 8192)
    const buffer = new ArrayBuffer(slice.length)
    const bytes = new Uint8Array(buffer)
    for (let i = 0; i < slice.length; i++) bytes[i] = slice.charCodeAt(i)
    chunks.push(buffer)
  }
  return new Blob(chunks, { type: mimeType })
}

// Strip the `data:<mime>;base64,` prefix from a data URL. Returns the input
// unchanged when no comma is present.
export function dataUrlToBase64(url: string): string {
  const idx = url.indexOf(',')
  return idx >= 0 ? url.slice(idx + 1) : url
}
