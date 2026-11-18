import { statSync } from "node:fs"
import { createKeyPool } from "./key-pool.js"
import { mergeKeys, readKeysFile } from "./settings.js"

export function createKeyring(settings, log) {
  const file = settings.keysFile
  let stamp
  let fileKeys = []
  let failing = false

  function readFileIfChanged() {
    if (!file) return false
    try {
      const stat = statSync(file)
      const next = `${stat.mtimeMs}:${stat.size}`
      if (next === stamp) return false
      fileKeys = readKeysFile(file)
      stamp = next
      failing = false
      return true
    } catch (error) {
      if (!failing) log(`could not read keys file, keeping the current keys: ${error.message}`)
      failing = true
      return false
    }
  }

  readFileIfChanged()
  const pool = createKeyPool(mergeKeys(fileKeys, settings.envKeys), { cooldownMs: settings.cooldownMs })

  return {
    pool,
    enabled: Boolean(file) || pool.size > 0,

    sync() {
      if (!readFileIfChanged()) return
      pool.replace(mergeKeys(fileKeys, settings.envKeys))
      log(`keys file changed, ${pool.size} key(s) loaded`)
    },
  }
}
