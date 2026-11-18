import { createKeyring } from "./keyring.js"
import { LIMIT_STATUSES, PLUGIN_ID, REJECT_STATUSES, readSettings } from "./settings.js"

const STORED_PLACEHOLDER = `managed-by-${PLUGIN_ID}`

function createLogger(client) {
  return (message) => {
    const line = `[${PLUGIN_ID}] ${message}`
    const log = client?.app?.log
    if (typeof log !== "function") {
      console.warn(line)
      return
    }
    Promise.resolve(log.call(client.app, { body: { service: PLUGIN_ID, level: "warn", message } })).catch(() =>
      console.warn(line),
    )
  }
}

function retryAfterMs(headers) {
  const ms = Number(headers.get("retry-after-ms"))
  if (Number.isFinite(ms) && ms > 0) return ms

  const value = headers.get("retry-after")
  if (!value) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return seconds > 0 ? seconds * 1000 : undefined
  const date = Date.parse(value)
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now())
}

function canReplay(input, init) {
  const target = typeof input === "string" || input instanceof URL
  const body = init?.body
  return target && (body === undefined || body === null || typeof body === "string")
}

function createFailoverFetch(keyring, log) {
  const { pool } = keyring
  return async (input, init = {}) => {
    keyring.sync()
    const replayable = canReplay(input, init)
    const send = (key) => {
      const headers = new Headers(init.headers)
      headers.set("authorization", `Bearer ${key}`)
      return fetch(input, { ...init, headers })
    }

    if (!pool.current()) {
      const key = pool.soonest()
      return key ? send(key) : fetch(input, init)
    }

    while (true) {
      const key = pool.current()
      const response = await send(key)

      const status = response.status
      if (LIMIT_STATUSES.has(status)) {
        pool.rest(key, retryAfterMs(response.headers))
      } else if (REJECT_STATUSES.has(status)) {
        pool.reject(key)
      } else {
        return response
      }

      const next = pool.current()
      if (!next || !replayable) {
        log(`${pool.label(key)} failed with HTTP ${status}${next ? "" : " and no other key is available"}`)
        return response
      }

      log(`${pool.label(key)} failed with HTTP ${status}, switching to ${pool.label(next)}`)
      await response.body?.cancel().catch(() => {})
    }
  }
}

export async function server(input, options) {
  const log = createLogger(input?.client)

  const settings = readSettings(options)
  const keyring = createKeyring(settings, log)
  if (!keyring.enabled) {
    log("no API keys found, plugin is inactive")
    return {}
  }

  return {
    auth: {
      provider: settings.provider,
      methods: [
        {
          type: "api",
          label: "Use keys configured for ollama-key-failover",
          authorize: async () => ({ type: "success", key: STORED_PLACEHOLDER }),
        },
      ],
      loader: async () => ({
        apiKey: STORED_PLACEHOLDER,
        fetch: createFailoverFetch(keyring, log),
      }),
    },
  }
}
