# dsh-guard

Intercepts tool calls **before** they run and asks you to confirm four kinds of operations that already caused real damage.

## Why

Ordinary plugins register a tool and wait. This one hooks the pre-execution gate: a match pauses the call and hands the decision to you.

The rules come from a real incident: an assistant tried to click a button on the user's behalf by sending raw mouse events at screen coordinates. One click landed on the taskbar and opened the Start menu; another landed in a different window and switched an unrelated app to fullscreen. The user's workspace was disturbed twice before anything could be said.

The common property: **the damage happens before anyone can interrupt**. So the guard must stand before execution, not report afterwards.

## What it intercepts

| Category | Patterns | Why |
|---|---|---|
| Simulated input | `SendKeys`, `mouse_event`, `SetCursorPos`, `keybd_event`, `SendInput` | Real input goes to whatever window is focused |
| System configuration | writing `drivers\etc\hosts`, `reg add`, `netsh interface`, `schtasks /ru SYSTEM`, `bcdedit` | Needs admin, affects the whole machine, awkward to undo |
| Irreversible delete | `Remove-Item -Recurse -Force` on a system path, `del /s /q C:\`, `rm -rf /`, `format X:` | Gone is gone |
| Plaintext credentials | `ghp_…`, `github_pat_…`, `sk-…` in a command line | Leaks into shell history, logs and process lists |

## Ask, not deny

A hard denial removes the user's ability to proceed — and some workflows genuinely need simulated input for programs without an API. A match therefore returns `ask`: the UI explains what matched and why, and the user decides.

## No false positives

The test suite pins a set of ordinary commands that must always pass:

```
node tests/run.mjs
git status --short
Get-ChildItem -Force
npm run build
echo hello
curl -s https://api.github.com/user
pwsh -c "Get-Process | Select-Object -First 3"
```

## Scope

- Shell tools (`pwsh` / `bash` / `sh` / `shell` / `cmd`): inspects `command` / `cmd` / `script` / `code`
- File tools (`write` / `edit` / `read`): inspects the target path only
- Everything else is untouched

## Limitations

- Pattern matching, not semantic analysis — obfuscated commands (split strings, base64) get through.
- Covers four known categories; new incidents need new rules.
- Whether the call actually runs depends on the approval layer: under the `never` policy an `ask` is auto-rejected.
- Not a sandbox and not a replacement for the permission system — only a pause before execution.

## Install

```bash
pnpm add git+https://github.com/drdrdr666/dsh-guard.git
```

Then add `dsh-guard` to the profile bundle list.

## License

MIT
