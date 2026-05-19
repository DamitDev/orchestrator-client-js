/**
 * Create a fetch implementation that ignores SSL certificate errors.
 *
 * Useful for connecting to orchestrator instances with self-signed or
 * internally-issued certificates during development or in isolated networks.
 *
 * Usage:
 *
 *   import { Orchestrator, createInsecureFetch } from "orchestrator-client";
 *
 *   const client = new Orchestrator({
 *     baseUrl: "https://orchestrator.internal:8443",
 *     fetch: await createInsecureFetch(),
 *   });
 *
 * Note: Only works in Node.js (uses `https.Agent` underneath).
 * In browser environments, the global `fetch` is returned as-is.
 */

let _insecureFetch: typeof globalThis.fetch | undefined

export async function createInsecureFetch(): Promise<typeof globalThis.fetch> {
  if (_insecureFetch) return _insecureFetch

  // Check if we're in Node.js
  if (
    typeof process === "undefined" ||
    process.versions?.node == null
  ) {
    // In browsers, SSL is handled by the browser — return global fetch
    _insecureFetch = globalThis.fetch
    return _insecureFetch
  }

  // Dynamic import — works with ESM and tsup bundling
  const https = await import("node:https")
  const http = await import("node:http")

  const agent = new https.Agent({ rejectUnauthorized: false })

  _insecureFetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const urlStr = typeof input === "string" ? input : input.toString()
    const urlObj = new URL(urlStr)
    const isHttps = urlObj.protocol === "https:"

    return new Promise<Response>((resolve, reject) => {
      const mod = isHttps ? https : http
      const req = mod.request(
        urlStr,
        {
          method: init?.method ?? "GET",
          headers: init?.headers as Record<string, string> | undefined,
          rejectUnauthorized: false,
          agent: isHttps ? agent : undefined,
        },
        (res: NodeJS.ReadableStream) => {
          const chunks: Buffer[] = []
          res.on("data", (chunk: Buffer) => chunks.push(chunk))
          res.on("end", () => {
            const body = Buffer.concat(chunks)
            const headers = new Headers()
            // Cast to access the headers object from Node's IncomingMessage
            const resHeaders = (res as unknown as { headers: Record<string, string | string[]> }).headers
            if (resHeaders) {
              for (const [key, value] of Object.entries(resHeaders)) {
                if (value != null) {
                  if (Array.isArray(value)) {
                    for (const v of value) headers.append(key, v)
                  } else {
                    headers.set(key, value)
                  }
                }
              }
            }
            resolve(
              new Response(body, {
                status: (res as unknown as { statusCode?: number }).statusCode,
                statusText: (res as unknown as { statusMessage?: string }).statusMessage,
                headers,
              }),
            )
          })
        },
      )

      req.on("error", reject)
      if (init?.body != null) {
        req.write(init.body)
      }
      req.end()
    })
  }

  return _insecureFetch
}
