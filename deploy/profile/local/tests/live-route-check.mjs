/**
 * Live end-to-end check of the workspace-file-ops routes on the *running*
 * `dsh web`: create a scratch file inside the session's workspace, download it
 * through the real route, delete it through the real route, and confirm it is
 * gone. Touches nothing but the file it creates itself.
 *
 * Uses the same cookie-minting trick as `served-bundle.mjs` (the secret is read
 * from `~/.dsh/.credentials.yaml` and never printed). `DSH_WEB_URL` overrides
 * the server, `WORKSPACE` the directory under test.
 */
import { createHash, createHmac } from 'node:crypto'
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const BASE = process.env.DSH_WEB_URL ?? 'http://127.0.0.1:3080'
const WORKSPACE = process.env.WORKSPACE ?? '/home/agentuser/DeepSeek 1'
const SCRATCH = join(WORKSPACE, '.dsh-watch', `wfo-live-${process.pid}.txt`)
const CONTENT = `workspace-file-ops live check ${new Date().toISOString()}\n`

const base64url = (value) => Buffer.from(value).toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
const authority = new URL(BASE).host

const readSecret = () => {
	const text = readFileSync(join(homedir(), '.dsh', '.credentials.yaml'), 'utf8')
	const at = text.indexOf('client-connection/browser-session:')
	return at === -1 ? undefined : /^\s+secret:\s*(\S+)\s*$/mu.exec(text.slice(at))?.[1]
}

const secret = readSecret()
if (secret === undefined) {
	console.log('  FAIL no browser-session secret; cannot reach the live server')
	process.exit(1)
}
const issuedAt = Date.now()
const body = base64url(Buffer.from(JSON.stringify({ version: 1, authority, issuedAt, expiresAt: issuedAt + 3600_000 }), 'utf8'))
const cookie = `${'dsh-auth-' + base64url(createHash('sha256').update(authority).digest())}=v1.${body}.${base64url(createHmac('sha256', Buffer.from(secret, 'base64url')).update(body).digest())}`

/** Session ids whose recorded workspace is the directory under test. */
const sessionIds = () => {
	// Session scope directories encode the workspace: `/` becomes `-` and every
	// other unsafe byte its `~XXXX` escape, wrapped in `--`.
	const key = WORKSPACE.replaceAll('/', '-').replace(/[^\w.~-]/gu, (char) => `~${char.codePointAt(0).toString(16).padStart(4, '0')}`)
	const root = join(homedir(), '.dsh', 'sessions')
	try {
		return readdirSync(root)
			.filter((scope) => scope.includes(key))
			.flatMap((scope) => readdirSync(join(root, scope)))
			.filter((entry) => entry.startsWith('session-'))
	} catch {
		return []
	}
}

let failures = 0
const check = (label, condition, detail = '') => {
	if (condition) console.log(`  ok   ${label}`)
	else {
		failures += 1
		console.log(`  FAIL ${label} ${detail}`)
	}
}

const headers = { cookie }
writeFileSync(SCRATCH, CONTENT, 'utf8')
const encoded = encodeURIComponent(SCRATCH)

const candidates = sessionIds()
check('sessions found for the workspace', candidates.length > 0, candidates.join(','))

/** The first session the route accepts: it resolves roots itself. */
let session
let downloaded
for (const candidate of candidates) {
	const response = await fetch(`${BASE}/workspace-file-ops/download?session=${encodeURIComponent(candidate)}&path=${encoded}`, { headers })
	if (response.status !== 200) continue
	session = candidate
	downloaded = await response.text()
	break
}
check('download route serves the scratch file', session !== undefined, `no session among ${candidates.join(',')}`)
check('download returns the exact bytes', downloaded === CONTENT, JSON.stringify(downloaded))
console.log(`       session=${session ?? '-'}`)

if (session !== undefined) {
	const deleted = await fetch(`${BASE}/workspace-file-ops/delete`, {
		method: 'POST',
		headers: { ...headers, 'content-type': 'application/json' },
		body: JSON.stringify({ session, path: SCRATCH }),
	})
	const payload = await deleted.json().catch(() => undefined)
	check('delete route answers ok', deleted.status === 200 && payload?.ok === true, `HTTP ${deleted.status} ${JSON.stringify(payload)}`)
	check('scratch file is really gone', !readdirSync(join(WORKSPACE, '.dsh-watch')).includes(SCRATCH.split('/').pop()))
}

rmSync(SCRATCH, { force: true })
console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
