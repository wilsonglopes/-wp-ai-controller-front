export async function callWpApi(
  wpUrl: string,
  apiKey: string,
  endpoint: string,
  method: "GET" | "POST" = "POST",
  body?: Record<string, unknown>
): Promise<unknown> {
  const base = wpUrl.replace(/\/$/, "")
  const url = `${base}/wp-json/ai-controller/v1${endpoint}`

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

  const text = await res.text()

  if (!res.ok) {
    throw new Error(`WP API ${res.status}: ${text.slice(0, 300)}`)
  }

  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}
