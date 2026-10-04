/**
 * End-to-end check against the *running* `dsh web`: fetch the very bundle the
 * browser is handed and assert it carries the row-action patch.
 *
 * The release directory on disk proves nothing on its own — the client-modules
 * service snapshots each bundle at activation and serves that snapshot until
 * the HMR watcher republishes it — so this asks the live server.
 *
 * Authentication: the server answers 401 to anything without its
 * authority-bound session cookie. This script mints that cookie from the
 * persisted signing secret (`~/.dsh/.credentials.yaml`) exactly as
 * `client-connection` does; the secret is never printed. Override the server
 * with `DSH_WEB_URL` (default `http://127.0.0.1:3080`).
 */
import { createHash, createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const BASE = process.env.DSH_WEB_URL ?? 'http://127.0.0.1:3080'
const CREDENTIALS = join(homedir(), '.dsh', '.credentials.yaml')
const PLUGIN_ID = '@deepseek-ai/dsh-client-ui-sidebar-files'

/** The persisted browser-session signing secret, or a reason we cannot proceed. */
const readSecret = () => {
	const text = readFileSync(CREDENTIALS, 'utf8')
	const at = text.indexOf('client-connection/browser-session:')
	if (at === -1) return undefined
	const record = text.slice(at)
	const match = /^\s+secret:\s*(\S+)\s*$/mu.exec(record)
	return match?.[1]
}

const base64url = (value) => Buffer.from(value).toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
const authority = new URL(BASE).host

/** The same cookie `client-connection`'s token exchange would have set. */
const mintCookie = (secret) => {
	const issuedAt = Date.now()
	const expiresAt = issuedAt + 60 * 60 * 1000
	const body = base64url(Buffer.from(JSON.stringify({ version: 1, authority, issuedAt, expiresAt }), 'utf8'))
	const signature = base64url(createHmac('sha256', Buffer.from(secret, 'base64url')).update(body).digest())
	const name = 'dsh-auth-' + base64url(createHash('sha256').update(authority).digest())
	return `${name}=v1.${body}.${signature}`
}

let failures = 0
const check = (label, condition, detail = '') => {
	if (condition) console.log(`  ok   ${label}`)
	else {
		failures += 1
		console.log(`  FAIL ${label} ${detail}`)
	}
}

const secret = readSecret()
if (secret === undefined) {
	console.log(`  FAIL no browser-session secret in ${CREDENTIALS}`)
	process.exit(1)
}
const cookie = mintCookie(secret)

const indexResponse = await fetch(`${BASE}/`, { headers: { cookie } })
const html = indexResponse.status === 200 ? await indexResponse.text() : ''
check('index served for the minted session', indexResponse.status === 200, `HTTP ${indexResponse.status}`)

// The index preloads every active bundle at its current revision — as one
// composed `??` combo URL (HTML-escaped, and relative). That exact URL is the
// only one the server will answer, and it is literally what the browser loads.
const raw = [...html.matchAll(new RegExp(`href="([^"]*${PLUGIN_ID.replaceAll('/', '\\/')}[^"]*)"`, 'gu'))].map((match) => match[1])
const urls = raw.map((href) => {
	const decoded = href.replaceAll('&amp;', '&')
	return decoded.startsWith('/') ? decoded : `/${decoded}`
})
check('index references the sidebar-files bundle', urls.length > 0, `${urls.length} url(s)`)

for (const url of urls) {
	const short = url.length > 120 ? `${url.slice(0, 60)}…${url.slice(-40)}` : url
	const response = await fetch(new URL(url, BASE), { headers: { cookie } })
	check(`served bundle answers 200 as a script`, response.status === 200 && (response.headers.get('content-type') ?? '').includes('javascript'), `${short} HTTP ${response.status}`)
	const source = await response.text()
	check('served bundle carries the download action', source.includes('action: "download"') && source.includes('tree.t("entry.download")'))
	check('served bundle carries the delete action', source.includes('action: "delete"') && source.includes('tree.t("entry.delete")'))
	check('served bundle carries the row-action strip', source.includes('k-1LKG_rowActions') && source.includes('k-1LKG_action'))
	check('served bundle carries the host route prefix', source.includes('const OPS_ROUTE = "/workspace-file-ops"') && source.includes('${OPS_ROUTE}/download?session='))
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
