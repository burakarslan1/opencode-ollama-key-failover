import { PLUGIN_ID } from "./lib/settings.js"
import { server } from "./lib/v1.js"
import { setup } from "./lib/v2.js"

export default {
  id: PLUGIN_ID,
  setup,
  server,
}
