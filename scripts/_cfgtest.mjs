// Standalone test harness for the config engine (appConfig.ts).
// Transpiles the real module with esbuild, then exercises every public path:
// validate coercion, load, save round-trip, reload, diff/emit, watcher,
// publicConfig secret stripping, corrupt/missing file robustness.
import { build } from 'esbuild'
import { writeFileSync, readFileSync, rmSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const tmp = mkdtempSync(join(tmpdir(), 'cfgtest-'))
const outFile = join(process.cwd(), 'scripts', '.appConfig.mjs')
const srcFile = join(process.cwd(), 'server/utils/appConfig.ts')

await build({
  entryPoints: [srcFile],
  outfile: outFile,
  format: 'esm',
  bundle: true,
  platform: 'node',
  external: ['node:*', 'yaml'],
  logLevel: 'silent',
})

const mod = await import(pathToFileURL(outFile).href)
const { validate, loadConfig, getConfig, saveConfig, reload, onConfigChange,
  startConfigWatcher, stopConfigWatcher, publicConfig, DEFAULT_CONFIG } = mod

// Point the engine at an isolated temp config file.
const cfgFile = join(tmp, 'config.yml')
process.env.NUXT_CONFIG_FILE = cfgFile

let pass = 0, fail = 0
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name} ${extra}`) }
}
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  ok(name, g === w, `\n     got  ${g}\n     want ${w}`)
}

console.log('\n[1] validate() — robustness against bad input')
// garbage non-object → full defaults
eq('non-object input → defaults', validate('garbage'), DEFAULT_CONFIG)
eq('null input → defaults', validate(null), DEFAULT_CONFIG)
// partial → merged with defaults
eq('partial top-level merges defaults',
  validate({ branding: { siteTitle: 'X' } }).branding,
  { siteTitle: 'X', brandName: 'Nuxt Admin', brandLogo: '/logo.ico' })
// out-of-range ints clamped
eq('port below range clamps to 1', validate({ server: { devPort: 0 } }).server.devPort, 1)
eq('port above range clamps to 65535', validate({ server: { prodPort: 99999 } }).server.prodPort, 65535)
eq('pageSize clamps to min 1', validate({ limits: { posts: { pageSize: -5 } } }).limits.posts.pageSize, 1)
eq('pageSize clamps to max 200', validate({ limits: { posts: { pageSize: 9999 } } }).limits.posts.pageSize, 200)
// wrong types coerced
eq('string number coerced', validate({ server: { prodPort: '8080' } }).server.prodPort, 8080)
eq('NaN → default', validate({ server: { devPort: NaN } }).server.devPort, DEFAULT_CONFIG.server.devPort)
eq('proper bool false respected', validate({ features: { enableSignup: false } }).features.enableSignup, false)
eq('non-bool string → default', validate({ features: { enableSignup: 'yes' } }).features.enableSignup, DEFAULT_CONFIG.features.enableSignup)
eq('cookieMaxAgeDays clamps min 1', validate({ data: { cookieMaxAgeDays: 0 } }).data.cookieMaxAgeDays, 1)

console.log('\n[2] loadConfig() + getConfig() — file → memory')
writeFileSync(cfgFile, '')
loadConfig()
eq('empty file → defaults in memory', getConfig(), DEFAULT_CONFIG)
writeFileSync(cfgFile, 'branding:\n  siteTitle: "Hot Demo"\n  brandName: "HD"\n')
loadConfig()
eq('parsed file populates memory', getConfig().branding.siteTitle, 'Hot Demo')
eq('parsed file keeps defaults for unset', getConfig().features.enableSignup, true)

console.log('\n[3] saveConfig() — validate + immediate effect + atomic write')
const saved = saveConfig({ branding: { siteTitle: 'Saved Title' }, limits: { posts: { pageSize: 7 } } })
eq('save returns validated config', saved.limits.posts.pageSize, 7)
eq('save updates memory immediately', getConfig().limits.posts.pageSize, 7)
// file on disk should now contain the saved value
const onDisk = readFileSync(cfgFile, 'utf8')
ok('save persisted siteTitle to disk', onDisk.includes('Saved Title'))
ok('save persisted pageSize to disk', onDisk.includes('7'))
// full structure written (all sections present)
for (const sec of ['server:', 'data:', 'limits:', 'realtime:', 'features:', 'branding:']) {
  ok(`save wrote section ${sec}`, onDisk.includes(sec))
}

console.log('\n[4] publicConfig() — strips secrets/internal keys')
const pub = publicConfig()
ok('publicConfig has no authSecret', !JSON.stringify(pub).includes('authSecret'))
ok('publicConfig has no dataDir', !JSON.stringify(pub).includes('dataDir'))
ok('publicConfig has no host/devPort/prodPort', !JSON.stringify(pub).includes('prodPort') && !JSON.stringify(pub).includes('devPort') && !JSON.stringify(pub).includes('host'))
ok('publicConfig keeps cookieMaxAgeDays', JSON.stringify(pub).includes('cookieMaxAgeDays'))
ok('publicConfig keeps branding', !!pub.branding && !!pub.branding.siteTitle)
ok('publicConfig keeps limits', !!pub.limits && !!pub.limits.posts)

console.log('\n[5] onConfigChange() — diff + startup-key detection')
loadConfig() // reset to file state
const events = []
const unsub = onConfigChange((e) => events.push(e))
// hot-key change only
saveConfig({ branding: { siteTitle: 'Change A' } })
ok('hot change emitted exactly once', events.length === 1, `got ${events.length}`)
ok('hot change has changedKeys', events[0].changedKeys.includes('branding.siteTitle'))
eq('hot change: no startup keys', events[0].startupKeysChanged, [])
// startup-key change
events.length = 0
saveConfig({ server: { prodPort: 4000 }, branding: { siteTitle: 'Change B' } })
const e1 = events[0]
ok('startup change detected prodPort', e1.startupKeysChanged.includes('server.prodPort'))
ok('startup change also has hot keys', e1.changedKeys.includes('branding.siteTitle'))
// no-op save emits nothing
events.length = 0
saveConfig(getConfig())
ok('identical save emits no event', events.length === 0)
unsub()

console.log('\n[6] reload() — re-reads file, emits')
writeFileSync(cfgFile, 'branding:\n  siteTitle: "Reloaded"\nlimits:\n  posts:\n    pageSize: 33\n')
const before = getConfig()
const evs = []
const u2 = onConfigChange((e) => evs.push(e))
reload()
eq('reload picks up new pageSize', getConfig().limits.posts.pageSize, 33)
ok('reload emitted change', evs.length >= 1 && evs[0].changedKeys.includes('limits.posts.pageSize'))
u2()

console.log('\n[7] Robustness — corrupt YAML + missing file')
writeFileSync(cfgFile, 'this is: : not valid: yaml: [unclosed')
const beforeCorrupt = getConfig()
reload()
ok('corrupt YAML does not throw (keeps previous)', getConfig() === beforeCorrupt || getConfig().branding)
rmSync(cfgFile)
reload()
ok('missing file does not throw → defaults', getConfig().branding.siteTitle === DEFAULT_CONFIG.branding.siteTitle)

console.log('\n[8] File watcher — hot reload on external edit')
// recreate file fresh
saveConfig({ branding: { siteTitle: 'Watcher Start' } })
let watchSeen = false
const u3 = onConfigChange(() => { watchSeen = true })
startConfigWatcher()
// external edit (not via saveConfig): simulate an editor save
await new Promise((r) => setTimeout(r, 100))
writeFileSync(cfgFile, 'branding:\n  siteTitle: "Watcher Fired"\n')
await new Promise((r) => setTimeout(r, 800)) // debounce 300ms + slack
ok('watcher detected external file change', watchSeen)
ok('watcher applied external change', getConfig().branding.siteTitle === 'Watcher Fired')
stopConfigWatcher()

console.log('\n[9] saveConfig self-write dedup — watcher must not double-fire')
let fired = 0
const u4 = onConfigChange(() => { fired++ })
startConfigWatcher()
saveConfig({ branding: { siteTitle: 'Dedup Test' } })
await new Promise((r) => setTimeout(r, 700))
ok('saveConfig emits exactly once (watcher dedup)', fired === 1, `fired=${fired}`)
stopConfigWatcher()
u4()

console.log('\n[10] Regression — external edit right after saveConfig NOT swallowed')
// The old time-window dedup (1500ms) ate any external edit near a saveConfig.
// Now diff-based dedup lets it through. Verify the bug is gone.
let regFired = 0
const u5 = onConfigChange(() => { regFired++ })
startConfigWatcher()
saveConfig({ branding: { siteTitle: 'Before External' } })   // sets memory + writes file
await new Promise((r) => setTimeout(r, 50))                   // within old 1500ms window
writeFileSync(cfgFile, 'branding:\n  siteTitle: "External Right After"\n')  // external edit
await new Promise((r) => setTimeout(r, 800))                  // debounce + slack
ok('external edit after saveConfig detected', regFired >= 2, `fired=${regFired} (expect ≥2: save + external)`)
ok('external edit after saveConfig applied', getConfig().branding.siteTitle === 'External Right After')
stopConfigWatcher()
u5()

console.log('\n[11] saveConfig PATCH semantics — partial update preserves other fields')
// Start from a known full state.
writeFileSync(cfgFile, 'limits:\n  posts:\n    titleMax: 80\n    pageSize: 25\nbranding:\n  siteTitle: "Base"\n  brandName: "BN"\n')
loadConfig()
eq('baseline titleMax=80', getConfig().limits.posts.titleMax, 80)
eq('baseline pageSize=25', getConfig().limits.posts.pageSize, 25)
eq('baseline brandName=BN', getConfig().branding.brandName, 'BN')
// Partial PUT: only change pageSize. Other fields MUST survive.
saveConfig({ limits: { posts: { pageSize: 9 } } })
eq('partial PUT changed pageSize', getConfig().limits.posts.pageSize, 9)
eq('partial PUT preserved titleMax (not reset to default 100)', getConfig().limits.posts.titleMax, 80)
eq('partial PUT preserved brandName', getConfig().branding.brandName, 'BN')
// And the persisted file keeps the untouched fields.
const persisted = readFileSync(cfgFile, 'utf8')
ok('disk still has titleMax: 80', /titleMax:\s*80/.test(persisted))

rmSync(tmp, { recursive: true, force: true })
console.log(`\n──────── RESULT: ${pass} passed, ${fail} failed ────────`)
process.exit(fail ? 1 : 0)
