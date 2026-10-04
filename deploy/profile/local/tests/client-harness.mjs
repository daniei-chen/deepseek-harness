/**
 * Render-level harness for the patched sidebar-files client bundle: loads the
 * real bundle through the real module-loader shim, wires the real slot
 * registration, then renders the file tree with a minimal React surface and
 * asserts the new download/delete row buttons exist and are wired.
 */
import { readdirSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * Resolve the bundle under test from the *current* release, so a DSH upgrade
 * only needs the patch re-applied, not this script edited. `DSH_RELEASE` may
 * point at another install; `SIDEBAR_FILES_BUNDLE` wins outright.
 */
const resolveBundle = () => {
	if (process.env.SIDEBAR_FILES_BUNDLE !== undefined) return process.env.SIDEBAR_FILES_BUNDLE
	const release = realpathSync(process.env.DSH_RELEASE ?? '/opt/lightvela/dsh/current')
	const store = join(release, 'node_modules/.pnpm')
	const pkg = readdirSync(store).find((entry) => entry.startsWith('@deepseek-ai+dsh-client-ui-sidebar-files@'))
	if (pkg === undefined) throw new Error(`no sidebar-files package under ${store}`)
	return join(store, pkg, 'node_modules/@deepseek-ai/dsh-client-ui-sidebar-files/lib/client.js')
}

const BUNDLE = resolveBundle()
console.log(`bundle: ${BUNDLE}`)

let registration
globalThis.window = { __ModuleLoader__: { load: (value) => { registration = value } } }

// --- minimal jsx runtime -----------------------------------------------------
const Fragment = Symbol('Fragment')
const jsx = (type, props) => ({ type, props: props ?? {} })
const jsxs = jsx

// --- minimal React hooks -----------------------------------------------------
const hookState = []
let hookIndex = 0
const react = {
	useState: (initial) => {
		const index = hookIndex++
		if (hookState[index] === undefined) hookState[index] = typeof initial === 'function' ? initial() : initial
		return [hookState[index], (next) => { hookState[index] = next }]
	},
	useRef: (initial) => {
		const index = hookIndex++
		hookState[index] ??= { current: initial }
		return hookState[index]
	},
	useEffect: () => {},
	useLayoutEffect: () => {},
}

// --- fake primitives ---------------------------------------------------------
const icon = (name) => (props) => jsx(name, props ?? {})
const primitives = {
	FileTypeIcon: icon('FileTypeIcon'),
	PathLabel: icon('PathLabel'),
	Tooltip: ({ children }) => children,
	classifyFileType: () => 'text',
	IconFolderOpenRegular: icon('IconFolderOpenRegular'),
	IconFolderCloseRegular: icon('IconFolderCloseRegular'),
	IconDownloadOutlineRegular: icon('IconDownloadOutlineRegular'),
	IconTrashOutlineRegular: icon('IconTrashOutlineRegular'),
}

const modules = {
	'@deepseek-ai/dsh-client-ui-primitives': primitives,
	'@deepseek-ai/cordis': {},
	'react/jsx-runtime': { jsx, jsxs, Fragment },
	react: react,
	'@deepseek-ai/dsh-client-store': { defineStore: (definition) => definition },
}

globalThis.document = {
	createElement: () => ({ click() {}, remove() {}, set href(value) { this._href = value }, set download(value) { this._download = value } }),
	body: { append() {} },
	head: { appendChild() {} },
	querySelector: () => ({}),
}

await import(pathToFileURL(BUNDLE).href)

let failures = 0
const check = (label, condition, detail = '') => {
	if (condition) console.log(`  ok   ${label}`)
	else {
		failures += 1
		console.log(`  FAIL ${label} ${detail}`)
	}
}

check('bundle registered with the module loader', registration?.id === '@deepseek-ai/dsh-client-ui-sidebar-files', JSON.stringify(registration?.id))
const exports = registration.factory((specifier) => {
	if (specifier in modules) return modules[specifier]
	throw new Error(`unexpected require("${specifier}")`)
})

// --- fake cordis client context ---------------------------------------------
const registered = {}
const dictionaries = {}
const ctx = {
	locale: {
		bind: (ns) => (key, params) => (params === undefined ? `${ns}.${key}` : `${ns}.${key}${JSON.stringify(params)}`),
		register: (ns, value) => { dictionaries[ns] = value },
	},
	effect: (callback) => callback(),
	inject: () => {},
	slots: {
		inject: (_name, callback) => callback(),
		register: (definition, component) => { registered[definition.name + '|' + (definition.key ?? '')] = component },
	},
	sidebarRightTabs: { register: () => {} },
	remote: { $stream: () => ({ [Symbol.asyncIterator]: async function* () {}, dispose: async () => {} }), workspaceFiles: { list: async () => ({ ok: true, value: { entries: [], truncated: false } }) } },
	shortcuts: { register: () => {} },
}
exports.apply(ctx)

check('zh dictionary carries the new keys', dictionaries.sidebarFiles?.zh?.['entry.download'] === '下载' && dictionaries.sidebarFiles.zh['entry.delete'] === '删除')
check('en dictionary carries the new keys', dictionaries.sidebarFiles?.en?.['entry.download'] === 'Download' && dictionaries.sidebarFiles.en['entry.delete'] === 'Delete')
const zhKeys = Object.keys(dictionaries.sidebarFiles.zh).sort().join(',')
const enKeys = Object.keys(dictionaries.sidebarFiles.en).sort().join(',')
check('dictionaries stay key-aligned', zhKeys === enKeys, `${zhKeys} != ${enKeys}`)

const body = registered['sidebar.right.pane.tab|@deepseek-ai/dsh-client-ui-sidebar-files']
check('files tab body registered', typeof body === 'function')

// --- render ------------------------------------------------------------------
const calls = []
globalThis.fetch = async (url, init) => {
	calls.push({ url, init })
	return { ok: true, status: 200, json: async () => ({ ok: true }) }
}
const created = []
globalThis.document.createElement = (tag) => {
	const anchor = {
		tag, clicked: false, removed: false,
		click() { this.clicked = true },
		remove() { this.removed = true },
	}
	created.push(anchor)
	return anchor
}

const sessionId = 'session-1'
const source = '/home/agentuser/DeepSeek 1'
const tabId = 'tab-1'
const tab = {
	id: tabId,
	title: 'Files',
	signal: new AbortController().signal,
	actions: { bindCommands() {}, openResource: (address) => calls.push({ url: 'open:' + address }) },
}
const store = {
	byTab: {
		[tabId]: {
			root: source,
			expanded: [source],
			autoRefresh: true,
			scrollTop: 0,
			levels: {
				[source]: { kind: 'ready', level: { entries: [{ name: 'sub', type: 'directory' }, { name: 'notes 笔记.txt', type: 'file' }], truncated: false } },
				[`${source}/sub`]: { kind: 'ready', level: { entries: [{ name: 'deep.md', type: 'file' }], truncated: false } },
			},
		},
	},
}

hookIndex = 0
hookState.length = 0
const element = body({
	useTabInfo: () => ({ tab }),
	sessionId,
	useSessions: (selector) => selector({ byId: { [sessionId]: { cwd: source } } }),
	useStore: (selector) => selector(store),
	actions: {},
	start: () => {},
	refresh: () => {},
	setAutoRefresh: () => {},
	toggle: () => {},
	t: (key, params) => (params === undefined ? key : `${key}${JSON.stringify(params)}`),
	renderSlot: () => null,
})

/** Expand function components into a host-element tree. */
const expand = (node) => {
	if (node === null || node === undefined || node === false) return null
	if (Array.isArray(node)) return node.map(expand).filter((child) => child !== null)
	if (typeof node !== 'object') return node
	if (typeof node.type === 'function') {
		hookIndex = 0
		return expand(node.type(node.props))
	}
	return { type: node.type, props: { ...node.props, children: expand(node.props.children) } }
}

const walk = (node, visit) => {
	if (node === null || node === undefined || typeof node !== 'object') return
	if (Array.isArray(node)) {
		for (const child of node) walk(child, visit)
		return
	}
	visit(node)
	const children = node.props?.children
	for (const child of Array.isArray(children) ? children : [children]) walk(child, visit)
}

const tree = expand(element)
const found = []
walk(tree, (node) => {
	if (node.props?.['data-files-action'] !== undefined) found.push(node)
})
check('download action labelled', found.some((node) => node.props['data-files-action'] === 'download' && node.props.title === 'entry.download'))
check('delete action labelled', found.some((node) => node.props['data-files-action'] === 'delete' && node.props.title === 'entry.delete'))

const rows = []
walk(tree, (node) => {
	if (node.props?.['data-files-entry'] !== undefined) rows.push(node)
})
const actionsOf = (row) => {
	const actions = []
	walk(row, (node) => {
		if (node.props?.['data-files-action'] !== undefined) actions.push(node)
	})
	return actions
}
check('directory row keeps its markup contract', rows.some((node) => node.props['data-files-entry'] === 'directory' && node.props['data-files-path'] === `${source}/sub`))
check('file row keeps its markup contract', rows.some((node) => node.props['data-files-entry'] === 'file' && node.props['data-files-path'] === `${source}/notes 笔记.txt`))
check('every visible row carries exactly its two actions', rows.length === 2 && rows.every((row) => actionsOf(row).length === 2), JSON.stringify(rows.map((row) => actionsOf(row).map((a) => a.props['data-files-action']))))
check('no action leaks onto the non-openable row', found.length === 4, `found ${found.length}`)
const wrappers = []
walk(tree, (node) => { if (node.props?.className === 'k-1LKG_itemRow') wrappers.push(node) })
check('rows are wrapped beside their actions', wrappers.length === 2, `wrappers=${wrappers.length}`)

// --- handler behaviour -------------------------------------------------------
const fileRow = rows.find((node) => node.props['data-files-entry'] === 'file')
const fileActions = actionsOf(fileRow)
const downloadAnchor = (() => {
	const before = created.length
	fileActions.find((node) => node.props['data-files-action'] === 'download').props.onClick({ stopPropagation() {} })
	return created.slice(before)
})()
check('download clicks one anchor', downloadAnchor.length === 1 && downloadAnchor[0].clicked === true)
check('download url is encoded and session-scoped', /^\/workspace-file-ops\/download\?session=session-1&path=.*notes%20%E7%AC%94%E8%AE%B0\.txt$/.test(String(downloadAnchor[0]?.href)), String(downloadAnchor[0]?.href))
check('download removes the anchor again', downloadAnchor[0]?.removed === true)
check('download never navigates the page', !calls.some((call) => String(call.url).startsWith('open:')))

let stopped = false
actionsOf(fileRow).find((node) => node.props['data-files-action'] === 'delete').props.onClick({ stopPropagation() { stopped = true } })
await new Promise((resolve) => setTimeout(resolve, 20))
const deleteCall = calls.find((call) => String(call.url).includes('/workspace-file-ops/delete'))
check('delete posts to the host route', deleteCall !== undefined && deleteCall.init.method === 'POST')
check('delete body carries the session and the file path', JSON.parse(deleteCall?.init?.body ?? '{}').path === `${source}/notes 笔记.txt`, deleteCall?.init?.body ?? '')
check('delete stops the click from reaching the row', stopped)

const dirDelete = actionsOf(rows.find((node) => node.props['data-files-entry'] === 'directory')).find((node) => node.props['data-files-action'] === 'delete')
dirDelete.props.onClick({ stopPropagation() {} })
await new Promise((resolve) => setTimeout(resolve, 20))
check('folders are deletable too', calls.some((call) => String(call.url).includes('/workspace-file-ops/delete') && JSON.parse(call.init.body).path === `${source}/sub`))

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
