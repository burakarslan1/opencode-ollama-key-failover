import { createKeyring } from "./keyring.js"
import { LIMIT_STATUSES, PLUGIN_ID, REJECT_STATUSES, readSettings } from "./settings.js"

function warn(message) {
  console.warn(`[${PLUGIN_ID}] ${message}`)
}

export async function setup(ctx) {
  const settings = readSettings(ctx.options)
  const keyring = createKeyring(settings, warn)
  if (!keyring.enabled) {
    warn("no API keys found, plugin is inactive")
    return
  }

  const { pool } = keyring
  const lastKeyBySession = new Map()
  const scope = { providerID: settings.provider }

  const registrations = [
    await ctx.session.hook(
      "http.request",
      (event) => {
        keyring.sync()
        const key = pool.current() ?? pool.soonest()
        if (!key) return
        lastKeyBySession.set(event.sessionID, key)
        event.request.headers.set("authorization", `Bearer ${key}`)
      },
      scope,
    ),

    await ctx.session.hook(
      "retry",
      (event) => {
        const status = event.error.status
        const used = lastKeyBySession.get(event.sessionID)
        if (!used || status === undefined) return

        if (LIMIT_STATUSES.has(status)) {
          pool.rest(used, event.error.retryAfterMs)
        } else if (REJECT_STATUSES.has(status)) {
          pool.reject(used)
        } else {
          return
        }

        const next = pool.current()
        if (!next) {
          warn(`${pool.label(used)} failed with HTTP ${status} and no other key is available`)
          return
        }
        warn(`${pool.label(used)} failed with HTTP ${status}, switching to ${pool.label(next)}`)
        event.decision = { retry: true, delay: 0 }
      },
      scope,
    ),
  ]

  return async () => {
    for (const registration of registrations) await registration.dispose()
    lastKeyBySession.clear()
  }
}
