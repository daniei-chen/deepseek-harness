/**
 * Standalone harness for the local workspace-file-ops host plugin: mounts the
 * real routes on a throwaway node:http server with a minimal `fs`/`sessions`
 * stub, then drives them over real HTTP.
 */
import { createServer } from 'node:http'
import { mkdtemp, mkdir, readFile, realpath, rm, stat, lstat, writeFile, readdir, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, sep } from 'node:path'
import { apply, inject, name } from '/home/agentuser/.dsh/profiles/web/local/workspace-file-ops/index.js'

const root = await mkdtemp(join(tmpdir(), 'wfo-'))
const workspace = join(root, 'DeepSeek 1')
const outside = join(root, 'outside')
await mkdir(join(workspace, 'sub'), { recursive: true })
await mkdir(outside, { recursive: true })
await writeFile(join(workspace, 'a.txt'), 'hello world\n')
await writeFile(join(workspace, 'big.txt'), 'compressible line of text\n'.repeat(500))
await writeFile(join(workspace, '中文 名称.txt'), '中文内容\n')
await writeFile(join(workspace, 'sub', 'b.txt'), 'deep\n')
await mkdir(join(workspace, 'empty'))
await writeFile(join(outside, 'secret.txt'), 'secret\n')
await symlink(join(outside, 'secret.txt'), join(workspace, 'link-out.txt'))

const realRoot = await realpath(root)
/** Path resolution the way the local fs backend does it (absolute wins over cwd). */
const abs = (path, cwd) => (path.startsWith('/') || /^[A-Za-z]:/.test(path) ? path : join(cwd ?? realWorkspace, path))
const realWorkspace = await realpath(workspace)

/** Minimal stand-in for the real `fs` service (local backend semantics). */
const fsService = {
	async resolve(path, opts = {}) {
		const absolute = abs(path, opts.cwd)
		try {
			return { key: await realpath(absolute) }
		} catch {
			return { key: absolute }
		}
	},
	async lstat(path, opts = {}) {
		const absolute = abs(path, opts.cwd)
		try {
			const info = await lstat(absolute)
			const type = info.isDirectory() ? 'directory' : info.isFile() ? 'file' : info.isSymbolicLink() ? 'symlink' : 'other'
			return { type, size: info.size }
		} catch {
			return undefined
		}
	},
	async stat(target) {
		try {
			const info = await stat(target.key)
			const type = info.isDirectory() ? 'directory' : info.isFile() ? 'file' : 'other'
			return { type, size: info.size, version: `${info.mtimeMs}` }
		} catch {
			return undefined
		}
	},
	contains(parent, child) {
		return child.key === parent.key || child.key.startsWith(parent.key + sep)
	},
	processPath(target) {
		return target.key
	},
}

const routes = new Map()
const effects = []
const ctx = {
	fs: fsService,
	sessions: { get: (id) => (id === 'session-ok' ? { header: { cwd: realWorkspace } } : undefined) },
	webServer: { register: (route) => { routes.set(route.path, route.handler); return () => routes.delete(route.path) } },
	connection: { requestRejection: (req) => (req.headers['x-untrusted'] === '1' ? 403 : undefined) },
	effect: (callback, label) => { effects.push(label); return callback() },
}

apply(ctx)

const server = createServer((req, res) => {
	const path = new URL(req.url, 'http://x').pathname
	const handler = routes.get(path)
	if (handler === undefined) {
		res.statusCode = 404
		res.end()
		return
	}
	handler(req, res)
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`

let failures = 0
const check = (label, condition, detail = '') => {
	if (condition) console.log(`  ok   ${label}`)
	else {
		failures += 1
		console.log(`  FAIL ${label} ${detail}`)
	}
}

console.log(`plugin name=${name} inject=${inject.join(',')}`)
console.log(`effects: ${effects.join(' | ')}`)

// 1. routes exist
check('download route registered', routes.has('/workspace-file-ops/download'))
check('delete route registered', routes.has('/workspace-file-ops/delete'))

// 2. file download
{
	const response = await fetch(`${base}/workspace-file-ops/download?session=session-ok&path=${encodeURIComponent(join(realWorkspace, '中文 名称.txt'))}`)
	const body = Buffer.from(await response.arrayBuffer())
	check('file download 200', response.status === 200, String(response.status))
	check('file download bytes', body.toString('utf8') === '中文内容\n', JSON.stringify(body.toString('utf8')))
	check('file download attachment header', /filename\*=UTF-8''/.test(response.headers.get('content-disposition') ?? ''), response.headers.get('content-disposition') ?? '')
	check('file download disposition name', (response.headers.get('content-disposition') ?? '').includes('%E4%B8%AD%E6%96%87'), response.headers.get('content-disposition') ?? '')
}

// 3. directory zip
{
	const response = await fetch(`${base}/workspace-file-ops/download?session=session-ok&path=${encodeURIComponent(realWorkspace)}`)
	const archive = Buffer.from(await response.arrayBuffer())
	check('zip download 200', response.status === 200, String(response.status))
	check('zip content-type', response.headers.get('content-type') === 'application/zip')
	await writeFile('/tmp/wfo-out.zip', archive)
	console.log(`       zip bytes=${archive.byteLength}`)
}

// 4. confinement
{
	const response = await fetch(`${base}/workspace-file-ops/download?session=session-ok&path=${encodeURIComponent(join(realRoot, 'outside', 'secret.txt'))}`)
	check('outside workspace refused', response.status === 403, String(response.status))
}

// 5. symlink escape refused
{
	const response = await fetch(`${base}/workspace-file-ops/download?session=session-ok&path=${encodeURIComponent(join(realWorkspace, 'link-out.txt'))}`)
	check('symlink escape refused', response.status === 403, String(response.status))
}

// 6. unknown session / missing file
{
	const a = await fetch(`${base}/workspace-file-ops/download?session=nope&path=${encodeURIComponent(join(realWorkspace, 'a.txt'))}`)
	const b = await fetch(`${base}/workspace-file-ops/download?session=session-ok&path=${encodeURIComponent(join(realWorkspace, 'gone.txt'))}`)
	check('unknown session 404', a.status === 404, String(a.status))
	check('missing file 404', b.status === 404, String(b.status))
}

// 7. method and trust fence
{
	const a = await fetch(`${base}/workspace-file-ops/download`, { method: 'POST' })
	const b = await fetch(`${base}/workspace-file-ops/download?session=session-ok&path=${encodeURIComponent(join(realWorkspace, 'a.txt'))}`, { headers: { 'x-untrusted': '1' } })
	check('GET route rejects POST', a.status === 405, String(a.status))
	check('trust fence answers 403', b.status === 403, String(b.status))
}

// 8. delete refuses outside and root, then deletes inside
{
	const post = (body) => fetch(`${base}/workspace-file-ops/delete`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
	const outsideDelete = await post({ session: 'session-ok', path: join(realRoot, 'outside', 'secret.txt') })
	check('delete outside refused', outsideDelete.status === 403, String(outsideDelete.status))
	const rootDelete = await post({ session: 'session-ok', path: realWorkspace })
	check('delete workspace root refused', rootDelete.status === 400, String(rootDelete.status))
	const fileDelete = await post({ session: 'session-ok', path: join(realWorkspace, 'a.txt') })
	check('delete file 200', fileDelete.status === 200 && (await fileDelete.json()).ok === true)
	const gone = await lstat(join(realWorkspace, 'a.txt')).then(() => false, () => true)
	check('file really gone', gone)
	const dirDelete = await post({ session: 'session-ok', path: join(realWorkspace, 'sub') })
	check('delete directory 200', dirDelete.status === 200, String(dirDelete.status))
	const dirGone = await lstat(join(realWorkspace, 'sub')).then(() => false, () => true)
	check('directory really gone', dirGone)
	const outsideKept = await readFile(join(realRoot, 'outside', 'secret.txt'), 'utf8')
	check('outside file untouched', outsideKept === 'secret\n')
}

// 9. malformed bodies
{
	const bad = await fetch(`${base}/workspace-file-ops/delete`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' })
	check('malformed JSON 400', bad.status === 400, String(bad.status))
	const tooBig = await fetch(`${base}/workspace-file-ops/delete`, { method: 'POST', body: 'x'.repeat(70 * 1024) })
	check('oversized body refused', tooBig.status === 413, String(tooBig.status))
}

server.close()
await rm(root, { recursive: true, force: true })
console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
