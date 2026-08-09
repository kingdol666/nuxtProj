<template>
  <!--
    Dendritic Genesis — a generative-art landing page.
    Built on the algorithmic-art skill viewer template (Anthropic branding FIXED),
    with a diffusion-limited-aggregation core algorithm (VARIABLE).
  -->
  <div class="art-container">
    <!-- Control Sidebar -->
    <aside class="sidebar">
      <h1>Dendritic Genesis</h1>
      <div class="subtitle">Diffusion-limited aggregation grown live, seed by seed.</div>

      <!-- Seed Section (ALWAYS KEEP) -->
      <div class="control-section">
        <h3>Seed</h3>
        <input type="number" id="seed-input" class="seed-input" v-model.number="seedInput" @change="onSeedInput" />
        <div class="seed-controls">
          <button class="button secondary" @click="previousSeed">&larr; Prev</button>
          <button class="button secondary" @click="nextSeed">Next &rarr;</button>
        </div>
        <button class="button tertiary" @click="randomSeedAndUpdate">&#8635; Random</button>
      </div>

      <!-- Parameters Section -->
      <div class="control-section">
        <h3>Parameters</h3>

        <div class="control-group">
          <label>Symmetry (rotational fold)</label>
          <div class="slider-container">
            <input type="range" min="1" max="8" step="1" v-model.number="ui.symmetry" @input="onParamChange('symmetry')" />
            <span class="value-display">{{ ui.symmetry }}-fold</span>
          </div>
        </div>

        <div class="control-group">
          <label>Growth Density</label>
          <div class="slider-container">
            <input type="range" min="2000" max="14000" step="500" v-model.number="ui.target" @input="onParamChange('target')" />
            <span class="value-display">{{ ui.target }}</span>
          </div>
        </div>

        <div class="control-group">
          <label>Stickiness</label>
          <div class="slider-container">
            <input type="range" min="0.1" max="1" step="0.05" v-model.number="ui.stickiness" @input="onParamChange('stickiness')" />
            <span class="value-display">{{ ui.stickiness.toFixed(2) }}</span>
          </div>
        </div>

        <div class="control-group">
          <label>Branch Reach</label>
          <div class="slider-container">
            <input type="range" min="6" max="30" step="1" v-model.number="ui.reach" @input="onParamChange('reach')" />
            <span class="value-display">{{ ui.reach }}px</span>
          </div>
        </div>
      </div>

      <!-- Colors Section -->
      <div class="control-section">
        <h3>Colors</h3>
        <div class="color-group" v-for="(c, i) in colorLabels" :key="i">
          <label>{{ c }}</label>
          <div class="color-picker-container">
            <input type="color" v-model="ui.palette[i]" @input="onPaletteChange" />
            <span class="color-value">{{ ui.palette[i] }}</span>
          </div>
        </div>
      </div>

      <!-- Actions Section (ALWAYS KEEP) -->
      <div class="control-section">
        <h3>Actions</h3>
        <button class="button" @click="regenerate">Regenerate</button>
        <div class="button-row" style="margin-top:8px">
          <button class="button secondary" @click="resetParameters">Reset</button>
          <button class="button tertiary" @click="downloadPNG">Download PNG</button>
        </div>
        <div class="stat-line" v-if="saturated">grown: <b>{{ grown }}</b> · canvas full ✓</div>
        <div class="stat-line" v-else-if="grown >= ui.target">grown: <b>{{ grown }}</b> / {{ ui.target }} ✓</div>
        <div class="stat-line" v-else>grown: <b>{{ grown }}</b> / {{ ui.target }}</div>
      </div>
    </aside>

    <!-- Main Canvas Area -->
    <main class="canvas-area">
      <div id="canvas-container" ref="canvasContainer">
        <div class="loading" v-if="!ready">Initializing generative art…</div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue'

const P5_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.7.0/p5.min.js'

const colorLabels = ['Core (trunk)', 'Mid-growth', 'Living tips']
const DEFAULTS = {
  seed: 12345,
  symmetry: 6,
  target: 5000,
  stickiness: 0.7,
  reach: 14,
  palette: ['#1a1a24', '#d97757', '#f5d76e']
}

const seedInput = ref(DEFAULTS.seed)
const grown = ref(0)
const saturated = ref(false)
const ready = ref(false)
const canvasContainer = ref(null)

// UI-facing reactive state (live-bound to sliders)
const ui = reactive({ ...DEFAULTS, palette: [...DEFAULTS.palette] })

let p5Instance = null

// ─── p5 loader (client-only, CDN) ──────────────────────────────────────
function loadP5() {
  return new Promise((resolve, reject) => {
    if (window.p5) return resolve(window.p5)
    const s = document.createElement('script')
    s.src = P5_CDN
    s.onload = () => (window.p5 ? resolve(window.p5) : reject(new Error('p5 failed to define')))
    s.onerror = () => reject(new Error('p5 CDN failed'))
    document.head.appendChild(s)
  })
}

// ─── parameter change handlers ─────────────────────────────────────────
function onSeedInput() {
  if (seedInput.value && seedInput.value > 0) {
    ui.seed = seedInput.value
    regenerate()
  } else {
    seedInput.value = ui.seed
  }
}
function previousSeed() { ui.seed = Math.max(1, ui.seed - 1); seedInput.value = ui.seed; regenerate() }
function nextSeed() { ui.seed = ui.seed + 1; seedInput.value = ui.seed; regenerate() }
function randomSeedAndUpdate() {
  ui.seed = Math.floor(Math.random() * 999999) + 1
  seedInput.value = ui.seed
  regenerate()
}
// symmetry changes the structure fundamentally → regenerate
function onParamChange(name) {
  if (name === 'symmetry') return regenerate()
  // stickiness / target / reach apply live to ongoing growth
  if (p5Instance) p5Instance.syncParams()
}
function onPaletteChange() { if (p5Instance) p5Instance.recolor() }
function regenerate() { if (p5Instance) p5Instance.regenerate() }
function resetParameters() {
  Object.assign(ui, { ...DEFAULTS, palette: [...DEFAULTS.palette] })
  seedInput.value = DEFAULTS.seed
  regenerate()
}
function downloadPNG() { if (p5Instance) p5Instance.savePNG() }

onMounted(async () => {
  try {
    await loadP5()
    const sketch = (p) => buildDLASketch(p, ui, grown, saturated)
    p5Instance = new window.p5(sketch, canvasContainer.value)
    ready.value = true
  } catch (e) {
    console.error(e)
    const el = canvasContainer.value.querySelector('.loading')
    if (el) el.textContent = 'Failed to load p5.js: ' + e.message
  }
})
onBeforeUnmount(() => { if (p5Instance) p5Instance.remove() })

// ════════════════════════════════════════════════════════════════════════
// DENDRITIC GENESIS — diffusion-limited aggregation with rotational symmetry
// ════════════════════════════════════════════════════════════════════════
function buildDLASketch(p, ui, grown, saturated) {
  const SIZE = 1100
  const CELL = 3                 // px per aggregation cell
  const GRID = Math.floor(SIZE / CELL)
  const CX = GRID / 2, CY = GRID / 2

  let occupied = new Set()       // "cx,cy" keys
  let depth = new Map()          // key -> deposition order (0..1 normalised)
  let clusterR = 0               // max cell-radius of cluster from centre
  let order = 0                  // deposition counter
  let gfx = null                 // offscreen accumulator
  let growing = false

  // seeded PRNG (mulberry32) so results are reproducible per seed
  function makeRng(seed) {
    let t = seed >>> 0
    return () => {
      t = (t + 0x6D2B79F5) >>> 0
      let r = Math.imul(t ^ (t >>> 15), 1 | t)
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296
    }
  }
  let rng = makeRng(ui.seed)

  // palette helpers
  function hexToRgb(h) {
    const n = parseInt(h.slice(1), 16)
    return [p.red(p.color(n)), p.green(p.color(n)), p.blue(p.color(n))] // unused safe path
  }
  function lerpHex(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16)
    const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255
    const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255
    return [Math.round(ar + (br - ar) * t), Math.round(ag + (bg - ag) * t), Math.round(ab + (bb - ab) * t)]
  }
  function colorAt(t) {
    // 3-stop gradient trunk → mid → tips
    const pal = ui.palette
    return t < 0.5 ? lerpHex(pal[0], pal[1], t / 0.5) : lerpHex(pal[1], pal[2], (t - 0.5) / 0.5)
  }

  function paintCell(cx, cy, col) {
    gfx.noStroke()
    gfx.fill(col[0], col[1], col[2], 235)
    gfx.rect(cx * CELL, cy * CELL, CELL, CELL)
  }

  // apply rotational symmetry: stamp the point and its n-1 rotated siblings
  function stamp(cx, cy, t) {
    const pal = [colorAt(t)]
    const n = ui.symmetry
    const dx = cx - CX, dy = cy - CY
    for (let k = 0; k < n; k++) {
      const a = (p.TWO_PI * k) / n
      const rx = dx * Math.cos(a) - dy * Math.sin(a)
      const ry = dx * Math.sin(a) + dy * Math.cos(a)
      const x = Math.round(CX + rx), y = Math.round(CY + ry)
      if (x < 0 || y < 0 || x >= GRID || y >= GRID) continue
      const key = x + ',' + y
      if (!occupied.has(key)) {
        occupied.add(key)
        depth.set(key, t)
        paintCell(x, y, pal[0])
        const d = Math.hypot(x - CX, y - CY)
        if (d > clusterR) clusterR = d
      }
    }
  }

  // seed cluster centre
  function seedCluster() {
    occupied.clear(); depth.clear()
    clusterR = 0; order = 0
    occupied.add(CX + ',' + CY)
    depth.set(CX + ',' + CY, 0)
    gfx.noStroke(); gfx.fill(...colorAt(0), 235)
    gfx.rect(CX * CELL, CY * CELL, CELL, CELL)
  }

  function reset() {
    rng = makeRng(ui.seed)
    gfx.background(250, 249, 245) // Anthropic light
    seedCluster()
    order = 0
    grown.value = 0
    saturated.value = false
    growing = true
  }

  // deposit one particle that sticks. Pools a step budget across multiple
  // launches so particles that escape the kill-radius are recycled quickly
  // instead of wasting the whole budget — keeps growth brisk as the cluster
  // grows large (DLA otherwise decelerates to a crawl near the target).
  function depositOne() {
    const reach = ui.reach
    let budget = 1200 // total walk steps pooled across relaunches
    while (budget > 0) {
      const birthR = clusterR + reach
      const killR = clusterR + reach * 2 + 4
      let ang = rng() * p.TWO_PI
      let cx = Math.round(CX + Math.cos(ang) * birthR)
      let cy = Math.round(CY + Math.sin(ang) * birthR)
      let stuck = false
      while (budget-- > 0) {
        cx += Math.round((rng() * 3 - 1))
        cy += Math.round((rng() * 3 - 1))
        if (cx < 0 || cy < 0 || cx >= GRID || cy >= GRID) break
        const dist = Math.hypot(cx - CX, cy - CY)
        if (dist > killR) break            // escaped → recycle, relaunch
        if (hasNeighbour(cx, cy) && rng() < ui.stickiness) {
          order++
          stamp(cx, cy, Math.min(1, order / ui.target))
          grown.value = order
          stuck = true
          break
        }
      }
      if (stuck) return true
    }
    return false
  }

  function hasNeighbour(cx, cy) {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue
        if (occupied.has((cx + dx) + ',' + (cy + dy))) return true
      }
    return false
  }

  // recolour whole cluster from current palette (cheap re-stamp offscreen)
  function recolor() {
    gfx.background(250, 249, 245)
    gfx.noStroke()
    for (const [key, t] of depth) {
      const [x, y] = key.split(',').map(Number)
      const c = colorAt(t)
      gfx.fill(c[0], c[1], c[2], 235)
      gfx.rect(x * CELL, y * CELL, CELL, CELL)
    }
  }

  p.setup = function () {
    const c = p.createCanvas(SIZE, SIZE)
    c.parent('canvas-container')
    gfx = p.createGraphics(SIZE, SIZE)
    gfx.noSmooth()
    p.noSmooth()
    reset()
  }

  p.draw = function () {
    if (!growing) return
    // natural saturation: once the dendrite reaches the canvas edge there is
    // no room for new branches, so stop gracefully (canvas-full ≈ complete).
    const maxR = GRID / 2 - ui.reach - 2
    if (clusterR >= maxR) { growing = false; saturated.value = true; grown.value = order; p.image(gfx, 0, 0); return }
    // grow a batch per frame for live animation
    const BATCH = 90
    for (let i = 0; i < BATCH; i++) {
      if (order >= ui.target) { growing = false; break }
      depositOne()
    }
    p.image(gfx, 0, 0)
  }

  // public API for the Vue handlers
  p.regenerate = function () { reset() }
  p.syncParams = function () { /* live params read directly from ui each frame */ }
  p.recolor = recolor
  p.savePNG = function () { p.saveCanvas('dendritic-genesis-' + ui.seed, 'png') }
}
</script>

<style scoped>
/* Anthropic Brand Colors */
:root {}
.art-container {
  --anthropic-dark: #141413;
  --anthropic-light: #faf9f5;
  --anthropic-mid-gray: #b0aea5;
  --anthropic-light-gray: #e8e6dc;
  --anthropic-orange: #d97757;
  --anthropic-blue: #6a9bcc;
  --anthropic-green: #788c5d;
  display: flex;
  min-height: 100vh;
  padding: 20px;
  gap: 20px;
  font-family: 'Poppins', 'Segoe UI', sans-serif;
  background: linear-gradient(135deg, #faf9f5 0%, #f5f3ee 100%);
  color: var(--anthropic-dark);
}
.sidebar {
  width: 320px; flex-shrink: 0;
  background: rgba(255,255,255,0.95);
  backdrop-filter: blur(10px);
  padding: 24px; border-radius: 12px;
  box-shadow: 0 10px 30px rgba(20,20,19,0.1);
  overflow-y: auto; overflow-x: hidden;
}
.sidebar h1 { font-size: 24px; font-weight: 500; margin-bottom: 8px; }
.sidebar .subtitle { color: var(--anthropic-mid-gray); font-size: 14px; margin-bottom: 32px; line-height: 1.4; }
.control-section { margin-bottom: 32px; }
.control-section h3 { font-size: 16px; font-weight: 600; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
.control-section h3::before { content: '•'; color: var(--anthropic-orange); font-weight: bold; }
.seed-input {
  width: 100%; background: var(--anthropic-light); padding: 12px; border-radius: 8px;
  font-family: 'Courier New', monospace; font-size: 14px; margin-bottom: 12px;
  border: 1px solid var(--anthropic-light-gray); text-align: center;
}
.seed-input:focus { outline: none; border-color: var(--anthropic-orange); box-shadow: 0 0 0 2px rgba(217,119,87,0.1); background: #fff; }
.seed-controls { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }
.control-group { margin-bottom: 20px; }
.control-group label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 8px; }
.slider-container { display: flex; align-items: center; gap: 12px; }
.slider-container input[type="range"] { flex: 1; height: 4px; background: var(--anthropic-light-gray); border-radius: 2px; outline: none; -webkit-appearance: none; }
.slider-container input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; background: var(--anthropic-orange); border-radius: 50%; cursor: pointer; transition: all 0.2s ease; }
.slider-container input[type="range"]::-webkit-slider-thumb:hover { transform: scale(1.1); background: #c86641; }
.slider-container input[type="range"]::-moz-range-thumb { width: 16px; height: 16px; background: var(--anthropic-orange); border-radius: 50%; border: none; cursor: pointer; }
.value-display { font-family: 'Courier New', monospace; font-size: 12px; color: var(--anthropic-mid-gray); min-width: 64px; text-align: right; }
.color-group { margin-bottom: 16px; }
.color-group label { display: block; font-size: 12px; color: var(--anthropic-mid-gray); margin-bottom: 4px; }
.color-picker-container { display: flex; align-items: center; gap: 8px; }
.color-picker-container input[type="color"] { width: 32px; height: 32px; border: none; border-radius: 6px; cursor: pointer; background: none; padding: 0; }
.color-value { font-family: 'Courier New', monospace; font-size: 12px; color: var(--anthropic-mid-gray); }
.button { background: var(--anthropic-orange); color: #fff; border: none; padding: 10px 16px; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s ease; width: 100%; }
.button:hover { background: #c86641; transform: translateY(-1px); }
.button:active { transform: translateY(0); }
.button.secondary { background: var(--anthropic-blue); }
.button.secondary:hover { background: #5a8bb8; }
.button.tertiary { background: var(--anthropic-green); }
.button.tertiary:hover { background: #6b7b52; }
.button-row { display: flex; gap: 8px; }
.button-row .button { flex: 1; }
.stat-line { margin-top: 12px; font-family: 'Courier New', monospace; font-size: 12px; color: var(--anthropic-mid-gray); text-align: center; }
.stat-line b { color: var(--anthropic-orange); }
.canvas-area { flex: 1; display: flex; align-items: center; justify-content: center; min-width: 0; }
#canvas-container { width: 100%; max-width: 1000px; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 40px rgba(20,20,19,0.12); background: #fff; }
#canvas-container :deep(canvas) { display: block; width: 100% !important; height: auto !important; }
.loading { display: flex; align-items: center; justify-content: center; font-size: 18px; color: var(--anthropic-mid-gray); height: 400px; }
@media (max-width: 820px) {
  .art-container { flex-direction: column; }
  .sidebar { width: 100%; }
}
</style>
