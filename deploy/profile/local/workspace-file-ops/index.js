/**
 * Local DSH host plugin: the right Sidebar's workspace file tree gets two row
 * actions that need the Host — downloading (a file streams as itself, a
 * directory as a ZIP) and deleting (recursive, no confirmation).
 *
 * Two exact routes on the composition's `webServer`, both behind the
 * Connection trust fence, so only the authenticated application origin can
 * call them:
 *
 *   GET  /workspace-file-ops/download?session=<id>&path=<absolute>
 *   POST /workspace-file-ops/delete   {"session": <id>, "path": <absolute>}
 *
 * Every path is confined to the session's own workspace root through the `fs`
 * service (`resolve` + `contains`), so neither route can touch anything the
 * file tree would not have shown. Nothing here is model-facing: it is the
 * Host half of a browser affordance, and the browser half lives in the
 * patched `@deepseek-ai/dsh-client-ui-sidebar-files` client bundle.
 *
 * Deliberately dependency-free (node builtins only): this module is mounted
 * from the profile directory, where the release's virtual store is not
 * reachable, and a failed boot must never be caused by it.
 */
import { createReadStream } from 'node:fs'
import { readdir, readFile, rm, stat } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { deflateRawSync } from 'node:zlib'

/** Stable Cordis plugin name. */
export const name = 'workspace-file-ops'

/** Services required before the routes can be registered. */
export const inject = ['webServer', 'connection', 'fs', 'sessions']

/** Route paths shared with the client bundle's fetch calls. */
const ROUTE_PREFIX = '/workspace-file-ops'
const DOWNLOAD_PATH = `${ROUTE_PREFIX}/download`
const DELETE_PATH = `${ROUTE_PREFIX}/delete`

/** Request bodies are two short strings; anything larger is hostile. */
const MAX_BODY_BYTES = 64 * 1024
/** One ZIP is materialized in memory, so the whole tree is capped. */
const MAX_ARCHIVE_BYTES = 256 * 1024 * 1024

/** One route failure carrying the HTTP status and the client-visible code. */
class OpsError extends Error {
	/**
	 * @param {number} status - HTTP status to answer with.
	 * @param {string} code - stable machine code for the client.
	 * @param {string} message - human-readable reason.
	 */
	constructor(status, code, message) {
		super(message)
		this.status = status
		this.code = code
	}
}

/** Send one JSON body (never cached: these outcomes are live facts). */
function sendJson(res, status, payload) {
	const body = Buffer.from(JSON.stringify(payload), 'utf8')
	res.statusCode = status
	res.setHeader('content-type', 'application/json; charset=utf-8')
	res.setHeader('content-length', String(body.byteLength))
	res.setHeader('cache-control', 'no-store')
	res.end(body)
}

/** 405 with the route's one supported method. */
function sendMethodNotAllowed(res, allow) {
	res.statusCode = 405
	res.setHeader('allow', allow)
	res.end()
}

/** Collect a bounded request body as UTF-8 text; null past the ceiling. */
async function readBoundedBody(req) {
	const chunks = []
	let size = 0
	for await (const chunk of req) {
		size += chunk.byteLength
		if (size > MAX_BODY_BYTES) {
			req.resume()
			return null
		}
		chunks.push(chunk)
	}
	return Buffer.concat(chunks, size).toString('utf8')
}

/**
 * `content-disposition` for one download: an ASCII fallback plus the RFC 5987
 * UTF-8 form, so Chinese names survive every browser.
 * @param {string} filename - the suggested file name.
 * @returns {string} the header value.
 */
function attachmentHeader(filename) {
	const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
	const encoded = encodeURIComponent(filename).replace(
		/['()!*]/g,
		(character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
	)
	return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`
}

//#region ZIP writer
/** CRC-32 table (the ZIP entry checksum; node:zlib has no exposed one). */
const CRC_TABLE = (() => {
	const table = new Int32Array(256)
	for (let index = 0; index < 256; index += 1) {
		let value = index
		for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
		table[index] = value
	}
	return table
})()

/**
 * CRC-32 of one buffer, as the ZIP format stores it.
 * @param {Buffer} buffer - the uncompressed entry bytes.
 * @returns {number} the unsigned checksum.
 */
function crc32(buffer) {
	let crc = -1
	for (let index = 0; index < buffer.length; index += 1) crc = CRC_TABLE[(crc ^ buffer[index]) & 0xff] ^ (crc >>> 8)
	return (crc ^ -1) >>> 0
}

/**
 * MS-DOS date and time fields for one mtime.
 * @param {Date} date - the entry's modification time.
 * @returns {{time: number, date: number}} the two 16-bit fields.
 */
function dosTimestamp(date) {
	const year = Math.max(1980, date.getFullYear())
	return {
		time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() / 2),
		date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
	}
}

/**
 * Build one ZIP archive (deflate entries, UTF-8 name flag) from collected
 * entries. Written by hand so this module needs no third-party dependency.
 * @param {Array<{name: string, data: Buffer, mtime: Date, directory: boolean}>} entries - archive members, in order.
 * @returns {Buffer} the complete archive.
 */
function buildZip(entries) {
	const locals = []
	const central = []
	let offset = 0
	for (const entry of entries) {
		const nameBytes = Buffer.from(entry.name, 'utf8')
		const { time, date } = dosTimestamp(entry.mtime)
		const raw = entry.directory ? Buffer.alloc(0) : entry.data
		const deflated = raw.length === 0 ? Buffer.alloc(0) : deflateRawSync(raw, { level: 6 })
		const useDeflate = deflated.length < raw.length
		const body = useDeflate ? deflated : raw
		const method = useDeflate ? 8 : 0
		const checksum = entry.directory ? 0 : crc32(raw)
		const local = Buffer.alloc(30)
		local.writeUInt32LE(0x04034b50, 0)
		local.writeUInt16LE(20, 4)
		local.writeUInt16LE(0x0800, 6)
		local.writeUInt16LE(method, 8)
		local.writeUInt16LE(time, 10)
		local.writeUInt16LE(date, 12)
		local.writeUInt32LE(checksum, 14)
		local.writeUInt32LE(body.length, 18)
		local.writeUInt32LE(raw.length, 22)
		local.writeUInt16LE(nameBytes.length, 26)
		locals.push(local, nameBytes, body)

		const header = Buffer.alloc(46)
		header.writeUInt32LE(0x02014b50, 0)
		header.writeUInt16LE(20, 4)
		header.writeUInt16LE(20, 6)
		header.writeUInt16LE(0x0800, 8)
		header.writeUInt16LE(method, 10)
		header.writeUInt16LE(time, 12)
		header.writeUInt16LE(date, 14)
		header.writeUInt32LE(checksum, 16)
		header.writeUInt32LE(body.length, 20)
		header.writeUInt32LE(raw.length, 24)
		header.writeUInt16LE(nameBytes.length, 28)
		header.writeUInt32LE(entry.directory ? 0x41ed0010 : 0x81a40000, 38)
		header.writeUInt32LE(offset, 42)
		central.push(header, nameBytes)
		offset += local.length + nameBytes.length + body.length
	}
	const directory = Buffer.concat(central)
	const end = Buffer.alloc(22)
	end.writeUInt32LE(0x06054b50, 0)
	end.writeUInt16LE(entries.length, 8)
	end.writeUInt16LE(entries.length, 10)
	end.writeUInt32LE(directory.length, 12)
	end.writeUInt32LE(offset, 16)
	return Buffer.concat([...locals, directory, end])
}

/**
 * Collect one directory tree as ZIP entries, keyed under the directory's own
 * name so extracting recreates it. Symbolic links are skipped rather than
 * followed, so an archive never reaches outside the tree that was asked for.
 * @param {string} hostPath - absolute host path of the directory.
 * @param {string} label - the archive-internal name of that directory.
 * @param {Array} entries - accumulator for the built entries.
 * @param {{bytes: number}} budget - running uncompressed total.
 */
async function collectDirectory(hostPath, label, entries, budget) {
	const children = await readdir(hostPath, { withFileTypes: true })
	for (const child of children) {
		const childPath = join(hostPath, child.name)
		const childLabel = `${label}/${child.name}`
		if (child.isSymbolicLink()) continue
		if (child.isDirectory()) {
			const info = await stat(childPath).catch(() => undefined)
			entries.push({
				name: `${childLabel}/`,
				data: Buffer.alloc(0),
				mtime: info?.mtime ?? new Date(),
				directory: true,
			})
			await collectDirectory(childPath, childLabel, entries, budget)
			continue
		}
		if (!child.isFile()) continue
		const info = await stat(childPath)
		budget.bytes += info.size
		if (budget.bytes > MAX_ARCHIVE_BYTES) {
			throw new OpsError(413, 'archive-too-large', '这个目录太大，无法打包下载。')
		}
		entries.push({ name: childLabel, data: await readFile(childPath), mtime: info.mtime, directory: false })
	}
}
//#endregion

/**
 * Confine one requested path to its session's workspace.
 * @param {object} ctx - plugin context carrying `fs` and `sessions`.
 * @param {string} sessionId - the session whose workspace root owns the path.
 * @param {string} path - absolute path of the requested entry.
 * @returns {Promise<{hostPath: string, rootPath: string, target: object, info: object}>} resolved facts.
 */
async function locate(ctx, sessionId, path) {
	if (typeof sessionId !== 'string' || sessionId.length === 0) {
		throw new OpsError(400, 'bad-request', 'session is required')
	}
	if (typeof path !== 'string' || path.length === 0) {
		throw new OpsError(400, 'bad-request', 'path is required')
	}
	const workspaceRoot = ctx.sessions.get(sessionId)?.header?.cwd
	if (typeof workspaceRoot !== 'string' || workspaceRoot.length === 0) {
		throw new OpsError(404, 'no-workspace', 'this session has no workspace directory')
	}
	const root = await ctx.fs.resolve(workspaceRoot)
	const entry = await ctx.fs.lstat(path, { cwd: workspaceRoot })
	if (entry === undefined) throw new OpsError(404, 'not-found', `no entry at "${path}"`)
	const target = await ctx.fs.resolve(path, { cwd: workspaceRoot })
	if (!ctx.fs.contains(root, target)) {
		throw new OpsError(403, 'outside-workspace', `"${path}" is outside the workspace`)
	}
	const info = await ctx.fs.stat(target)
	if (info === undefined) throw new OpsError(404, 'not-found', `no entry at "${path}"`)
	return {
		hostPath: ctx.fs.processPath(target),
		rootPath: ctx.fs.processPath(root),
		target,
		info,
	}
}

/**
 * Register the download and delete routes.
 * @param {object} ctx - Host context carrying the Web server, the trust fence, and the filesystem.
 */
export function apply(ctx) {
	/** The composition's Connection service (typed locally: its package is browser-side). */
	const connectionOf = () => Reflect.get(ctx, 'connection')
	/** Answer an untrusted/unauthenticated request; true when it was rejected. */
	const rejected = (req, res) => {
		const rejection = connectionOf()?.requestRejection?.(req)
		if (rejection === undefined) return false
		res.statusCode = rejection
		res.end()
		return true
	}

	ctx.effect(
		() =>
			ctx.webServer.register({
				kind: 'exact',
				path: DOWNLOAD_PATH,
				handler: async (req, res) => {
					if (rejected(req, res)) return
					if (req.method !== 'GET') {
						sendMethodNotAllowed(res, 'GET')
						return
					}
					try {
						const url = new URL(req.url ?? '/', 'http://localhost')
						const located = await locate(ctx, url.searchParams.get('session'), url.searchParams.get('path'))
						const filename = located.hostPath.slice(located.hostPath.lastIndexOf(sep) + 1)
						if (located.info.type === 'file') {
							res.statusCode = 200
							res.setHeader('content-type', 'application/octet-stream')
							res.setHeader('content-disposition', attachmentHeader(filename))
							if (located.info.size !== undefined) res.setHeader('content-length', String(located.info.size))
							res.setHeader('cache-control', 'no-store')
							createReadStream(located.hostPath).on('error', () => res.destroy()).pipe(res)
							return
						}
						if (located.info.type === 'directory') {
							const entries = []
							await collectDirectory(located.hostPath, filename, entries, { bytes: 0 })
							const archive = buildZip(entries)
							res.statusCode = 200
							res.setHeader('content-type', 'application/zip')
							res.setHeader('content-disposition', attachmentHeader(`${filename}.zip`))
							res.setHeader('content-length', String(archive.byteLength))
							res.setHeader('cache-control', 'no-store')
							res.end(archive)
							return
						}
						throw new OpsError(415, 'not-downloadable', `"${filename}" is neither a file nor a directory`)
					} catch (error) {
						if (res.headersSent) {
							res.destroy()
							return
						}
						const failure = error instanceof OpsError ? error : new OpsError(500, 'failed', String(error?.message ?? error))
						sendJson(res, failure.status, { ok: false, code: failure.code, message: failure.message })
					}
				},
			}),
		`workspace-file-ops: GET ${DOWNLOAD_PATH}`,
	)

	ctx.effect(
		() =>
			ctx.webServer.register({
				kind: 'exact',
				path: DELETE_PATH,
				handler: async (req, res) => {
					if (rejected(req, res)) return
					if (req.method !== 'POST') {
						sendMethodNotAllowed(res, 'POST')
						return
					}
					try {
						const text = await readBoundedBody(req)
						if (text === null) throw new OpsError(413, 'bad-request', 'request body is too large')
						let body
						try {
							body = JSON.parse(text)
						} catch {
							throw new OpsError(400, 'bad-request', 'request body must be JSON')
						}
						if (typeof body !== 'object' || body === null) {
							throw new OpsError(400, 'bad-request', 'request body must be an object')
						}
						const located = await locate(ctx, body.session, body.path)
						if (located.hostPath === located.rootPath) {
							throw new OpsError(400, 'workspace-root', 'the workspace root itself cannot be deleted')
						}
						await rm(located.hostPath, { recursive: true, force: false })
						sendJson(res, 200, { ok: true })
					} catch (error) {
						const failure = error instanceof OpsError ? error : new OpsError(500, 'failed', String(error?.message ?? error))
						sendJson(res, failure.status, { ok: false, code: failure.code, message: failure.message })
					}
				},
			}),
		`workspace-file-ops: POST ${DELETE_PATH}`,
	)
}
