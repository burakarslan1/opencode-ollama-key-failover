export function createKeyPool(initialKeys, { cooldownMs, now = Date.now }) {
  let keys = [...initialKeys]
  const restingUntil = new Map()
  const rejected = new Set()
  let cursor = 0

  function usable(key) {
    if (rejected.has(key)) return false
    const until = restingUntil.get(key)
    if (until === undefined) return true
    if (until <= now()) {
      restingUntil.delete(key)
      return true
    }
    return false
  }

  return {
    get size() {
      return keys.length
    },

    current() {
      for (let step = 0; step < keys.length; step++) {
        const index = (cursor + step) % keys.length
        if (usable(keys[index])) {
          cursor = index
          return keys[index]
        }
      }
      return undefined
    },

    soonest() {
      let best
      let bestUntil = Infinity
      for (const key of keys) {
        if (rejected.has(key)) continue
        const until = restingUntil.get(key) ?? 0
        if (until < bestUntil) {
          best = key
          bestUntil = until
        }
      }
      return best
    },

    rest(key, waitMs) {
      if (!keys.includes(key)) return
      const ms = Number.isFinite(waitMs) && waitMs > 0 ? waitMs : cooldownMs
      restingUntil.set(key, now() + ms)
    },

    reject(key) {
      if (keys.includes(key)) rejected.add(key)
    },

    replace(nextKeys) {
      const active = keys[cursor]
      keys = [...nextKeys]
      for (const key of [...restingUntil.keys()]) if (!keys.includes(key)) restingUntil.delete(key)
      for (const key of [...rejected]) if (!keys.includes(key)) rejected.delete(key)
      const index = keys.indexOf(active)
      cursor = index === -1 ? 0 : index
    },

    label(key) {
      const index = keys.indexOf(key)
      return index === -1 ? "unknown key" : `key #${index + 1}`
    },
  }
}
