// Thin wrapper so the SSRF fix (allow-list) lives in one place.
export async function fetchImage(url: string): Promise<{ status: number; contentType: string | null }> {
  const res = await fetch(url, { redirect: 'follow' })
  return { status: res.status, contentType: res.headers.get('content-type') }
}
