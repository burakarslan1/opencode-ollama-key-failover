# opencode-ollama-key-failover

An [OpenCode](https://opencode.ai) plugin for people who have more than one Ollama Cloud API key.
It keeps using one key until Ollama reports that the key has reached its limit, then moves the
request to the next key without interrupting your session.

It runs on both OpenCode 1 (1.18.29 or newer) and OpenCode 2 from the same package.

## How it behaves

| Ollama answers with | What the plugin does |
| --- | --- |
| `429` or `402` | Puts the key aside until `Retry-After` passes (or for `cooldownMinutes` when Ollama sends no hint), then retries the request with the next key. |
| `401` or `403` | Treats the key as invalid and skips it until OpenCode restarts. |
| anything else | Passes the response through untouched. |

- The plugin stays on the same key while it works. It does not spread requests across keys.
- When every key is set aside, the request goes out with the key that becomes available soonest,
  so OpenCode shows Ollama's own error.
- The keys file is checked before each request. When you add, remove or replace keys and save
  the file, the next request uses the new list; no restart is needed. Keys that are still in the
  list keep their state, and the plugin stays on the current key if it is still there.
- If the keys file cannot be read for a moment (while an editor saves it, say), the plugin keeps
  the keys it already has.
- Keys from environment variables are read once, when OpenCode starts.
- The plugin never writes keys to disk and logs them only by position (`key #2`).

## Provide your keys

Use one or both of these sources. Keys are de-duplicated and tried in the order listed.

1. **A file**, one key per line, anywhere on disk. Lines starting with `#` are ignored, and both
   Unix and Windows line endings work.

   ```text
   # ollama-keys.txt
   first-key
   second-key
   ```

   Set the path with the `keysFile` option. A leading `~/` or `~\` means your home directory.
   The file may be empty or missing when OpenCode starts; the plugin picks the keys up once the
   file has them.
   Keep the file readable only by you: `chmod 600 <file>` on macOS and Linux; on Windows, keep it
   inside your user profile, which other standard users cannot read.

2. **An environment variable**, `OLLAMA_API_KEYS` by default, with keys separated by commas or
   whitespace:

   ```bash
   export OLLAMA_API_KEYS="first-key,second-key"
   ```

   ```powershell
   [Environment]::SetEnvironmentVariable("OLLAMA_API_KEYS", "first-key,second-key", "User")
   ```

   `OLLAMA_API_KEY`, if set, is added to the end of the list.

   OpenCode 2 can run its server as a background service. A variable exported in your shell does
   not reach a service that was started elsewhere, so prefer `keysFile` there, or restart the
   service from a shell that has the variable (`opencode service restart`).

## Install on OpenCode 2

1. Connect Ollama Cloud once, with any one of your keys, so the provider is active: run
   `/connect` and pick Ollama Cloud.
2. Add the plugin:

   ```bash
   opencode plugin add github:burakarslan1/opencode-ollama-key-failover
   ```

   `opencode plugin add` keeps your other settings and plugins, but it rewrites the `plugins`
   array in its own format and drops comments inside that array. If you keep comments there,
   add the entry by hand as shown in the next step instead of running the command.

3. To pass options, use the object form in your global `opencode.jsonc`. Run
   `opencode debug paths` to see where your config directory is.

   ```jsonc
   {
     "plugins": [
       {
         "package": "github:burakarslan1/opencode-ollama-key-failover",
         "options": { "keysFile": "~/ollama-keys.txt" }
       }
     ]
   }
   ```

   On Windows, write paths with forward slashes or doubled backslashes, for example
   `"C:/Users/me/ollama-keys.txt"` or `"C:\\Users\\me\\ollama-keys.txt"`.

## Install on OpenCode 1

1. Clone the repository somewhere permanent:

   ```bash
   git clone https://github.com/burakarslan1/opencode-ollama-key-failover.git ~/.local/share/opencode-ollama-key-failover
   ```

   ```powershell
   git clone https://github.com/burakarslan1/opencode-ollama-key-failover.git "$HOME\.local\share\opencode-ollama-key-failover"
   ```

2. Add the cloned folder to the `plugin` list in your global `opencode.json`
   (`~/.config/opencode/opencode.json`). An entry is either a path or a `[path, options]` pair:

   ```jsonc
   {
     "plugin": [
       ["/Users/me/.local/share/opencode-ollama-key-failover", { "keysFile": "~/ollama-keys.txt" }]
     ]
   }
   ```

   Use the full path. On Windows, write it with forward slashes, for example
   `"C:/Users/me/.local/share/opencode-ollama-key-failover"`.

3. OpenCode 1 only hands requests to the plugin when Ollama Cloud has a saved login. Check with
   `opencode auth list`. If Ollama Cloud is already listed, skip this step.

   If it is not listed, run `opencode auth login`, choose Ollama Cloud, and enter any value when
   asked for a key. While the plugin is installed, this login stores a placeholder instead of the
   value you type; the real keys still come from your key sources.

   > **Warning:** Do not run this login if Ollama Cloud already has a saved key. The placeholder
   > replaces that key, and Ollama Cloud stops working without the plugin until you log in again.
   > See [Uninstall](#uninstall).

## Update

Your config and keys file stay as they are; only the plugin code changes.

**OpenCode 2**

1. Update the plugin, either from the `/plugins` screen or with:

   ```bash
   opencode plugin update
   ```

2. Restart OpenCode, or run `opencode reload`.

If you pinned the plugin to a tag, for example `github:burakarslan1/opencode-ollama-key-failover#v0.1.0`,
the update keeps that tag. Change the tag in your config to the version you want.

**OpenCode 1**

1. Pull the latest code into your clone:

   ```bash
   git -C ~/.local/share/opencode-ollama-key-failover pull
   ```

2. Restart OpenCode.

## Uninstall

The plugin writes no files of its own, so removing it leaves nothing behind except what
OpenCode itself stored.

**OpenCode 2**

1. Remove the plugin:

   ```bash
   opencode plugin remove github:burakarslan1/opencode-ollama-key-failover
   ```

   If you added the entry by hand, delete it from `plugins` instead. The command leaves an empty
   `"plugins": []` behind when it was the only entry.
2. OpenCode keeps a cached copy of the plugin under its cache directory, in `npm/` (see
   `opencode debug paths`). You can delete the `git-opencode-ollama-key-failover-*` folder there.
3. Your saved Ollama Cloud login is untouched, so Ollama Cloud keeps working with that key.

**OpenCode 1**

1. Delete the plugin entry from the `plugin` list in your `opencode.json`.
2. Delete the cloned folder, for example `~/.local/share/opencode-ollama-key-failover`.
3. If you ran `opencode auth login` for this plugin, Ollama Cloud still has the placeholder.
   Replace it with a real key:

   ```bash
   opencode auth logout ollama-cloud
   opencode auth login
   ```

   Choose Ollama Cloud and paste a real key. Without the plugin installed, this is the normal
   OpenCode login again.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `provider` | `ollama-cloud` | Provider ID whose requests the plugin handles. |
| `keysFile` | none | Path to a file with one key per line. `~` is expanded. |
| `keysEnv` | `OLLAMA_API_KEYS` | Environment variable that holds a list of keys. |
| `cooldownMinutes` | `30` | How long a limited key is set aside when Ollama gives no `Retry-After`. |
| `providerLabel` | `Ollama Cloud (pool)` | Name OpenCode shows for the provider while the plugin is active, so you can see at a glance that it is loaded. Set to `false` to keep the original name. |

## Limitations

- OpenCode 2 marks its HTTP hooks as experimental, so a future OpenCode 2 release may change them.
- On OpenCode 1, a request whose body is a stream cannot be sent twice. It fails over on the next
  request instead.
- The plugin keeps its state in memory. After a restart it starts again from the first key, and
  keys that were set aside are tried again.

## License

[MIT](LICENSE)
