import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

export const PLUGIN_ID = "ollama-key-failover"

const DEFAULT_PROVIDER = "ollama-cloud"
const DEFAULT_KEYS_ENV = "OLLAMA_API_KEYS"
const DEFAULT_COOLDOWN_MINUTES = 30
const DEFAULT_PROVIDER_LABEL = "Ollama Cloud (pool)"

export const LIMIT_STATUSES = new Set([402, 429])
export const REJECT_STATUSES = new Set([401, 403])

function text(value, fallback) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : fallback
}

function positive(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback
}

function expandHome(path) {
  if (path === "~") return homedir()
  if (path.startsWith("~/") || path.startsWith("~\\")) return join(homedir(), path.slice(2))
  return path
}

function splitKeys(raw) {
  return raw
    .split(/[\s,]+/)
    .map((key) => key.trim())
    .filter((key) => key !== "" && !key.startsWith("#"))
}

export function readKeysFile(path) {
  const content = readFileSync(path, "utf8")
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
}

export function mergeKeys(...lists) {
  return [...new Set(lists.flat().filter((key) => key !== ""))]
}

export function readSettings(options, env = process.env) {
  const source = options && typeof options === "object" ? options : {}
  const keysEnv = text(source.keysEnv, DEFAULT_KEYS_ENV)
  const keysFile = text(source.keysFile, undefined)

  const envKeys = []
  if (env[keysEnv]) envKeys.push(...splitKeys(env[keysEnv]))
  if (env.OLLAMA_API_KEY) envKeys.push(env.OLLAMA_API_KEY.trim())

  return {
    provider: text(source.provider, DEFAULT_PROVIDER),
    cooldownMs: positive(source.cooldownMinutes, DEFAULT_COOLDOWN_MINUTES) * 60_000,
    providerLabel: source.providerLabel === false ? undefined : text(source.providerLabel, DEFAULT_PROVIDER_LABEL),
    keysFile: keysFile ? expandHome(keysFile) : undefined,
    envKeys: mergeKeys(envKeys),
  }
}
