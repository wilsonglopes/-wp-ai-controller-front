let _rpcId = 1

// ─── REST API client (original) ──────────────────────────────────────────────

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

// ─── MCP JSON-RPC 2.0 client ─────────────────────────────────────────────────

export async function callWpMcp(
  wpUrl: string,
  apiKey: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const base = wpUrl.replace(/\/$/, "")
  const url = `${base}/wp-json/ai-controller/v1/mcp`
  const id = _rpcId++

  const payload = {
    jsonrpc: "2.0",
    method: "tools/call",
    params: { name: toolName, arguments: args },
    id,
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify(payload),
  })

  const text = await res.text()

  if (!res.ok) {
    throw new Error(`MCP ${res.status}: ${text.slice(0, 300)}`)
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(text)
  } catch {
    return { raw: text }
  }

  // Surface JSON-RPC level errors
  if (parsed.error) {
    const err = parsed.error as Record<string, unknown>
    throw new Error(`MCP error ${err.code}: ${err.message}`)
  }

  // Unwrap MCP result envelope: { content: [{ type: "text", text: "..." }], isError }
  const result = parsed.result as Record<string, unknown> | undefined
  if (!result) return parsed

  const isError = result.isError as boolean | undefined
  const content = result.content as Array<{ type: string; text: string }> | undefined
  const textContent = content?.[0]?.text

  if (isError) {
    throw new Error(textContent ?? "MCP tool returned an error")
  }

  if (textContent) {
    try {
      return JSON.parse(textContent)
    } catch {
      return { raw: textContent }
    }
  }

  return result
}
