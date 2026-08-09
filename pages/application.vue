<template>
  <div class="page-container">
    <!-- ============ Sticky toolbar: category pills + search ============ -->
    <nav
      class="toolbar"
      :class="{ 'menu-open': isMobileMenuOpen }"
      ref="toolbarRef"
      aria-label="Category navigation"
    >
      <button
        class="menu-toggle"
        @click="toggleMobileMenu"
        :aria-label="isMobileMenuOpen ? 'Close menu' : 'Open menu'"
        :aria-expanded="isMobileMenuOpen"
      >
        <span class="menu-toggle-bar"></span>
        <span class="menu-toggle-bar"></span>
        <span class="menu-toggle-bar"></span>
      </button>

      <div class="toolbar-row">
        <div class="nav-scroll" ref="topNavContainer">
          <button
            v-for="category in menuItems"
            :key="category.title"
            class="nav-pill"
            :class="{ active: activeCategory === category.title }"
            @click="handleCategoryLinkClick(category.title)"
            :title="isChinese ? category.title_zh : category.title"
          >
            <AntIcon :icon="category.icon" class="nav-pill-icon" />
            <span class="nav-pill-label">{{ isChinese ? category.title_zh : category.title }}</span>
          </button>
        </div>

        <div class="search" role="search">
          <SearchOutlined class="search-icon" />
          <input
            v-model="searchQuery"
            type="text"
            class="search-input"
            :placeholder="isChinese ? '搜索应用…' : 'Search apps…'"
            :aria-label="isChinese ? '搜索应用' : 'Search applications'"
          />
          <button
            v-if="searchQuery"
            class="search-clear"
            @click="searchQuery = ''"
            :aria-label="isChinese ? '清除搜索' : 'Clear search'"
          >
            <CloseCircleFilled />
          </button>
          <span v-if="isSearching" class="search-count">
            {{ totalSearchMatches }}
          </span>
        </div>
      </div>
    </nav>

    <!-- ============ Main content ============ -->
    <main class="main-content">
      <section
        v-for="sec in visibleSections"
        :key="sec.category.title"
        :id="sec.category.title"
        class="category-section"
      >
        <header class="category-header">
          <span class="category-icon-wrap">
            <AntIcon :icon="sec.category.icon" class="category-icon" />
          </span>
          <div class="category-titles">
            <h2>{{ isChinese ? sec.category.title_zh : sec.category.title }}</h2>
            <span class="category-count">
              {{ sec.items.length }} {{ isChinese ? '项' : 'items' }}
            </span>
          </div>
        </header>

        <div class="sub-nav">
          <button
            class="sub-pill"
            :class="{ active: !activeSubCategories[sec.category.title] || activeSubCategories[sec.category.title] === 'All' }"
            @click="setActiveSubCategory(sec.category.title, 'All')"
          >
            {{ isChinese ? '全部' : 'All' }}
          </button>
          <button
            v-for="subCategory in getSubCategories(sec.category.title)"
            :key="subCategory"
            class="sub-pill"
            :class="{ active: activeSubCategories[sec.category.title] === subCategory }"
            @click="setActiveSubCategory(sec.category.title, subCategory)"
          >
            {{ getSubCategoryName(sec.category.title, subCategory) }}
          </button>
        </div>

        <div class="card-grid">
          <button
            v-for="(item, index) in sec.items"
            :key="item.id || item.name"
            type="button"
            class="card-link"
            :style="{ '--i': index }"
            @click="openDetail(item)"
          >
            <article
              class="card"
              @mousemove="handleMouseMove"
              @mouseleave="resetCardStyle"
            >
              <span class="card-glow"></span>
              <span class="card-ring"></span>

              <div class="card-inner">
                <div class="card-top">
                  <div class="card-icon">
                    <img
                      v-if="!failedFavicons.has(item.url) && getFaviconUrl(item.url)"
                      :src="getFaviconUrl(item.url)"
                      :alt="`${item.name} icon`"
                      @error="handleFaviconError(item.url)"
                      class="favicon-img"
                      loading="lazy"
                    />
                    <span v-else class="card-letter">
                      {{ (isChinese ? item.name_zh : item.name).charAt(0).toUpperCase() }}
                    </span>
                  </div>
                  <div
                    class="card-rating"
                    :aria-label="isChinese ? `${item.rating} 星` : `${item.rating} of 5 stars`"
                  >
                    <template v-for="i in 5" :key="i">
                      <StarFilled v-if="i <= item.rating" class="star star-on" />
                      <StarOutlined v-else class="star star-off" />
                    </template>
                  </div>
                </div>

                <div class="card-body">
                  <span class="card-subtag">{{ getSubCategoryName(sec.category.title, item.subCategory) }}</span>
                  <h3 class="card-title">{{ isChinese ? item.name_zh : item.name }}</h3>
                  <p class="card-desc">{{ isChinese ? item.content_zh : item.content }}</p>
                </div>

                <div class="card-footer">
                  <span class="card-host">{{ getHostname(item.url) }}</span>
                  <span class="card-visit">
                    {{ isChinese ? '访问' : 'Visit' }}
                    <ArrowUpOutlined class="card-visit-arrow" />
                  </span>
                </div>
              </div>
            </article>
          </button>
        </div>
      </section>

      <!-- Empty state while searching -->
      <div v-if="isSearching && totalSearchMatches === 0" class="empty-state">
        <SearchOutlined class="empty-icon" />
        <p class="empty-title">{{ isChinese ? '没有找到匹配的应用' : 'No matching apps found' }}</p>
        <p class="empty-hint">{{ isChinese ? `没有结果包含 “${searchQuery}”` : `Nothing matches “${searchQuery}”` }}</p>
        <button class="empty-action" @click="searchQuery = ''">
          {{ isChinese ? '清除搜索' : 'Clear search' }}
        </button>
      </div>

      <!-- Empty state when a category filter yields nothing (not searching) -->
      <div
        v-if="!isSearching && visibleSections.length === 0"
        class="empty-state"
      >
        <p class="empty-title">{{ isChinese ? '暂无内容' : 'Nothing here yet' }}</p>
      </div>
    </main>

    <Comments />

    <!-- ============ 内容详情 Modal（小红书风格） ============ -->
    <ContentDetail v-model="detailOpen" :item="detailItem" />

    <!-- ============ Floating action buttons ============ -->
    <div class="fab-container">
      <button
        @click="scrollToTop"
        class="fab-button back-to-top"
        :class="{ 'is-visible': showBackToTop }"
        :tabindex="showBackToTop ? 0 : -1"
        :aria-hidden="!showBackToTop"
        :aria-label="isChinese ? '返回顶部' : 'Back to top'"
        title="Back to Top"
      >
        <ArrowUpOutlined />
      </button>
      <button
        @click="toggleLanguage"
        class="fab-button fab-language"
        :title="isChinese ? 'Switch to English' : '切换为中文'"
        :aria-label="isChinese ? 'Switch to English' : '切换为中文'"
      >
        <TranslationOutlined />
        <span class="fab-lang-text">{{ isChinese ? 'EN' : '中' }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, h, watch, nextTick } from 'vue'
import { useMenuStore } from '~/stores/menuStore'
import { useContentStore } from '~/stores/contentStore'
import { storeToRefs } from 'pinia'
import * as antIcons from '@ant-design/icons-vue'
import {
  StarFilled,
  StarOutlined,
  SearchOutlined,
  CloseCircleFilled,
  TranslationOutlined,
  ArrowUpOutlined,
} from '@ant-design/icons-vue'
import Comments from '~/components/Comments.vue'
import ContentDetail from '~/components/ContentDetail.vue'

// Dynamically render an Ant Design icon from its string name.
const AntIcon = (props) => {
  const icon = antIcons[props.icon]
  return icon ? h(icon) : null
}

// ---- stores (async data source with bundled fallback) ----
const menuStore = useMenuStore()
const { menuItems } = storeToRefs(menuStore)

const contentStore = useContentStore()
const { contentItems } = storeToRefs(contentStore)

// ---- reactive state ----
const topNavContainer = ref(null)
const toolbarRef = ref(null)
const activeSubCategories = ref({})
const activeCategory = ref('')
const isChinese = ref(false)
const showBackToTop = ref(false)
const isMobileMenuOpen = ref(false)
const searchQuery = ref('')

const trimmedSearch = computed(() => searchQuery.value.trim().toLowerCase())
const isSearching = computed(() => trimmedSearch.value.length > 0)

const matchesQuery = (item, q) => {
  if (!q) return true
  return (
    (item.name || '').toLowerCase().includes(q) ||
    (item.name_zh || '').toLowerCase().includes(q) ||
    (item.content || '').toLowerCase().includes(q) ||
    (item.content_zh || '').toLowerCase().includes(q) ||
    (item.subCategory || '').toLowerCase().includes(q) ||
    (item.subCategory_zh || '').toLowerCase().includes(q)
  )
}

const totalSearchMatches = computed(() => {
  if (!isSearching.value) return 0
  const q = trimmedSearch.value
  return contentItems.value.filter((item) => matchesQuery(item, q)).length
})

// ---- language & mobile menu ----
const toggleLanguage = () => {
  isChinese.value = !isChinese.value
}

const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
}

const closeMobileMenu = () => {
  if (isMobileMenuOpen.value && window.innerWidth <= 768) {
    isMobileMenuOpen.value = false
  }
}

// ---- 3D tilt ----
const handleMouseMove = (event) => {
  const card = event.currentTarget
  const { left, top, width, height } = card.getBoundingClientRect()
  const x = event.clientX - left
  const y = event.clientY - top
  const rotateX = ((y - height / 2) / (height / 2)) * -8
  const rotateY = ((x - width / 2) / (width / 2)) * 8
  card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-6px)`
  card.style.setProperty('--mx', `${x}px`)
  card.style.setProperty('--my', `${y}px`)
}

const resetCardStyle = (event) => {
  const card = event.currentTarget
  card.style.transform = ''
}

// ---- favicon (unavatar.io) with graceful fallback ----
const failedFavicons = ref(new Set())

const getFaviconUrl = (itemUrl) => {
  if (!itemUrl) return ''
  try {
    const url = new URL(itemUrl)
    return `https://unavatar.io/${url.hostname}?fallback=false`
  } catch (error) {
    return ''
  }
}

const handleFaviconError = (itemUrl) => {
  const next = new Set(failedFavicons.value)
  next.add(itemUrl)
  failedFavicons.value = next
}


// ---- 内容详情 Modal（小红书风格）----
const detailOpen = ref(false)
const detailItem = ref(null)
const openDetail = (item) => {
  detailItem.value = item
  detailOpen.value = true
}
const getHostname = (itemUrl) => {
  try {
    return new URL(itemUrl).hostname.replace(/^www\./, '')
  } catch (error) {
    return itemUrl || ''
  }
}

// ---- navigation / scrolling ----
const scrollOffset = ref(138)

const handleCategoryLinkClick = (categoryTitle) => {
  const element = document.getElementById(categoryTitle)
  if (element) {
    const offset = scrollOffset.value
    const bodyRect = document.body.getBoundingClientRect().top
    const elementPosition = element.getBoundingClientRect().top - bodyRect
    const offsetPosition = elementPosition - offset
    window.scrollTo({ top: offsetPosition, behavior: 'smooth' })
  }
  closeMobileMenu()
}

const setActiveSubCategory = (category, subCategory) => {
  activeSubCategories.value = { ...activeSubCategories.value, [category]: subCategory }
}

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const handleScroll = () => {
  showBackToTop.value = window.scrollY > 280
}

// ---- derived data ----
const getSubCategories = (categoryTitle) => {
  const items = contentItems.value.filter((item) => item.category === categoryTitle)
  return [...new Set(items.map((item) => item.subCategory))]
}

const getSubCategoryName = (categoryTitle, subCategory) => {
  if (!isChinese.value) return subCategory
  const item = contentItems.value.find(
    (i) => i.category === categoryTitle && i.subCategory === subCategory
  )
  return item ? item.subCategory_zh : subCategory
}

const getFilteredItems = (categoryTitle) => {
  const selectedSub = activeSubCategories.value[categoryTitle]
  const q = trimmedSearch.value
  return contentItems.value.filter((item) => {
    if (item.category !== categoryTitle) return false
    if (selectedSub && selectedSub !== 'All' && item.subCategory !== selectedSub) return false
    return matchesQuery(item, q)
  })
}

// Pre-compute visible sections so each category's list is filtered once.
const visibleSections = computed(() => {
  return menuItems.value
    .map((category) => ({ category, items: getFilteredItems(category.title) }))
    .filter((section) => section.items.length > 0)
})

// ---- lifecycle ----
let observer = null

onMounted(async () => {
  // Pull live data from the backend (stores keep bundled JSON as fallback).
  await Promise.all([menuStore.fetchMenu(), contentStore.fetchContent()])

  window.addEventListener('scroll', handleScroll, { passive: true })

  // Measure header (64px) + toolbar height to anchor sticky offsets precisely.
  await nextTick()
  const headerH = 64
  const toolbarH = toolbarRef.value ? toolbarRef.value.offsetHeight : 60
  scrollOffset.value = headerH + toolbarH + 12

  // IntersectionObserver: highlight the category currently near the top.
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) activeCategory.value = entry.target.id
      })
    },
    {
      rootMargin: `-${scrollOffset.value}px 0px -78% 0px`,
      threshold: 0,
    }
  )
  document.querySelectorAll('.category-section').forEach((section) => observer.observe(section))
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
  if (observer) observer.disconnect()
})

// Keep the observed sections in sync after async data renders.
watch(
  () => menuItems.value.length + contentItems.value.length,
  async () => {
    await nextTick()
    if (!observer) return
    document.querySelectorAll('.category-section').forEach((section) => observer.observe(section))
  }
)

// Smoothly scroll the active category pill into the center of the nav strip.
watch(activeCategory, async (newCategory) => {
  if (!newCategory || !topNavContainer.value) return
  await nextTick()
  const activeEl = topNavContainer.value.querySelector('.nav-pill.active')
  if (!activeEl) return
  const container = topNavContainer.value
  const target = activeEl.offsetLeft - container.offsetWidth / 2 + activeEl.offsetWidth / 2
  const start = container.scrollLeft
  const change = target - start
  const duration = 420
  let startTime = null
  const easeInOutQuad = (t, b, c, d) => {
    t /= d / 2
    if (t < 1) return (c / 2) * t * t + b
    t--
    return (-c / 2) * (t * (t - 2) - 1) + b
  }
  const animate = (now) => {
    if (startTime === null) startTime = now
    const elapsed = now - startTime
    container.scrollLeft = easeInOutQuad(elapsed, start, change, duration)
    if (elapsed < duration) requestAnimationFrame(animate)
  }
  requestAnimationFrame(animate)
})
</script>

<style>
/* Global styles for Ant Design dropdowns (teleported to body) — theme aware,
   accent now follows the global indigo scale. */
.ant-dropdown .ant-dropdown-menu {
  background-color: rgba(255, 255, 255, 0.82) !important;
  backdrop-filter: blur(18px) saturate(180%) !important;
  -webkit-backdrop-filter: blur(18px) saturate(180%) !important;
  border: 1px solid var(--border-color) !important;
  border-radius: var(--radius-md) !important;
  padding: 6px !important;
  box-shadow: var(--shadow-lg) !important;
}
.ant-dropdown .ant-dropdown-menu-item {
  color: var(--text-primary) !important;
  border-radius: var(--radius-sm) !important;
}
.ant-dropdown .ant-dropdown-menu-item:hover {
  background-color: var(--accent-soft) !important;
  color: var(--accent) !important;
}
html.dark .ant-dropdown .ant-dropdown-menu {
  background-color: rgba(26, 28, 38, 0.82) !important;
  border-color: var(--border-color) !important;
  box-shadow: var(--shadow-lg) !important;
}
html.dark .ant-dropdown .ant-dropdown-menu-item {
  color: var(--text-primary) !important;
}
html.dark .ant-dropdown .ant-dropdown-menu-item:hover {
  background-color: var(--accent-soft) !important;
  color: var(--accent) !important;
}
</style>

<style scoped>
/* ============================================================
   Design tokens — bridged to the GLOBAL design system.

   • Fonts: we NO LONGER redeclare --font-sans here, so the page
     inherits the global Inter + Noto Sans SC stack. Headings pick
     up --font-display automatically via main.css.
   • Accent: sourced from the global indigo scale (--accent /
     --accent-hover / --accent-soft / --accent-glow) instead of
     the old blue→violet palette, so the whole site reads as one.
   • Text: the page always sits on a dark photo overlay
     (app.vue .main-content-area::before), so text is LIGHT in
     both themes for legibility.
   ============================================================ */
.page-container {
  font-family: var(--font-sans);
  color: var(--text-1);
  background-color: transparent;

  /* Text — light in both themes (page lives on a dark overlay) */
  --text-1: #f4f5f9;
  --text-2: #b4b8c6;
  --text-3: #7d8194;

  /* Accent echo — translucent indigo border tint */
  --accent-line: rgba(99, 102, 241, 0.5);

  /* Smoked glass surfaces (light text on dark) */
  --glass: linear-gradient(160deg, rgba(48, 51, 66, 0.82), rgba(24, 26, 36, 0.88));
  --glass-2: rgba(32, 35, 46, 0.68);
  --glass-3: rgba(255, 255, 255, 0.06);
  --glass-hover: rgba(38, 41, 54, 0.66);

  /* Strokes */
  --stroke: rgba(255, 255, 255, 0.1);
  --stroke-soft: rgba(255, 255, 255, 0.06);
  --stroke-strong: rgba(255, 255, 255, 0.5);

  /* Shadows — tiered and tuned to register on the dark overlay */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.25);
  --shadow-md: 0 6px 18px rgba(0, 0, 0, 0.35);
  --shadow-lg: 0 18px 44px rgba(0, 0, 0, 0.45);

  /* Rating stars */
  --star: #fbbf24;
  --star-empty: rgba(255, 255, 255, 0.18);

  /* Indigo icon-chip wash (uses the global accent glow) */
  --tile-grad: linear-gradient(135deg, var(--accent-glow), transparent);
}

html.dark .page-container {
  --text-1: #f3f4f6;
  --text-2: #aeb6c6;
  --text-3: #828b9e;

  --accent-line: rgba(129, 140, 248, 0.5);

  --glass: linear-gradient(160deg, rgba(40, 43, 56, 0.8), rgba(18, 20, 28, 0.86));
  --glass-2: rgba(28, 30, 40, 0.72);
  --glass-3: rgba(255, 255, 255, 0.05);
  --glass-hover: rgba(32, 35, 48, 0.72);

  --stroke: rgba(255, 255, 255, 0.09);
  --stroke-soft: rgba(255, 255, 255, 0.05);
  --stroke-strong: rgba(255, 255, 255, 0.4);

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4), 0 2px 10px rgba(0, 0, 0, 0.35);
  --shadow-md: 0 8px 24px rgba(0, 0, 0, 0.45);
  --shadow-lg: 0 20px 50px rgba(0, 0, 0, 0.55);

  --star: #fbbf24;
  --star-empty: rgba(255, 255, 255, 0.18);

  --tile-grad: linear-gradient(135deg, var(--accent-glow), transparent);
}

html {
  scroll-behavior: smooth;
}

@keyframes float-soft {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

/* ============================================================
   Sticky toolbar
   ============================================================ */
.toolbar {
  position: sticky;
  top: 64px;
  z-index: 9;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 18px;
  background: var(--glass-2);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 1px solid var(--stroke);
  box-shadow: var(--shadow-sm);
}

.toolbar-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.nav-scroll {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  flex: 1 1 auto;
  min-width: 0;
  padding: 2px;
  scrollbar-width: none;
  -webkit-mask-image: linear-gradient(
    to right,
    transparent 0,
    #000 14px,
    #000 calc(100% - 14px),
    transparent 100%
  );
  mask-image: linear-gradient(
    to right,
    transparent 0,
    #000 14px,
    #000 calc(100% - 14px),
    transparent 100%
  );
}
.nav-scroll::-webkit-scrollbar { display: none; }

.nav-pill {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: var(--radius-full);
  border: 1px solid var(--stroke);
  background: var(--glass-3);
  color: var(--text-2);
  font-size: var(--text-sm);
  font-weight: 550;
  font-family: inherit;
  white-space: nowrap;
  cursor: pointer;
  transition: color var(--dur) var(--ease-out), background var(--dur) var(--ease-out),
    border-color var(--dur) var(--ease-out), box-shadow var(--dur) var(--ease-out),
    transform var(--dur-fast) var(--ease-out);
}
.nav-pill:hover {
  color: var(--text-1);
  background: var(--glass-hover);
  border-color: var(--accent-line);
  transform: translateY(-1px);
}
.nav-pill.active {
  color: #fff;
  background: linear-gradient(135deg, var(--accent), var(--accent-hover));
  border-color: transparent;
  box-shadow: var(--shadow-accent), 0 0 0 1px rgba(255, 255, 255, 0.12) inset;
}
.nav-pill-icon { font-size: var(--text-md); line-height: 1; }

.nav-pill:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* ---- search ---- */
.search {
  position: relative;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  width: 280px;
  height: 42px;
  padding: 0 12px;
  border-radius: var(--radius-full);
  background: var(--glass-2);
  border: 1px solid var(--stroke);
  box-shadow: var(--shadow-sm);
  transition: border-color var(--dur) var(--ease-out), box-shadow var(--dur) var(--ease-out),
    background var(--dur) var(--ease-out);
}
.search:focus-within {
  border-color: var(--accent-line);
  box-shadow: 0 0 0 4px var(--accent-soft), var(--shadow-sm);
}
.search-icon {
  color: var(--text-3);
  font-size: var(--text-md);
  flex-shrink: 0;
}
.search-input {
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-1);
  font-size: var(--text-base);
  font-family: inherit;
  padding: 0 10px;
}
.search-input::placeholder { color: var(--text-3); }
.search-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
  font-size: var(--text-md);
  padding: 2px;
  border-radius: var(--radius-full);
  transition: color var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out);
}
.search-clear:hover { color: var(--accent); background: var(--accent-soft); }
.search-count {
  flex-shrink: 0;
  margin-left: 8px;
  padding: 2px 9px;
  border-radius: var(--radius-full);
  background: var(--accent-soft);
  color: var(--accent);
  font-size: var(--text-xs);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.menu-toggle {
  display: none;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  width: 40px;
  height: 40px;
  padding: 0 9px;
  border: 1px solid var(--stroke);
  border-radius: var(--radius-md);
  background: var(--glass-3);
  cursor: pointer;
}
.menu-toggle-bar {
  display: block;
  height: 2px;
  width: 100%;
  background: var(--text-1);
  border-radius: 2px;
  transition: transform var(--dur-slow) var(--ease-out), opacity var(--dur) var(--ease-out);
}
.menu-open .menu-toggle-bar:nth-child(1) { transform: translateY(7px) rotate(45deg); }
.menu-open .menu-toggle-bar:nth-child(2) { opacity: 0; }
.menu-open .menu-toggle-bar:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

/* ============================================================
   Main content
   ============================================================ */
.main-content {
  padding: 28px 18px 60px;
}

.category-section {
  margin-bottom: 52px;
  scroll-margin-top: 138px;
}

.category-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 18px;
}
.category-icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  background: var(--tile-grad);
  border: 1px solid var(--accent-line);
  box-shadow: var(--shadow-sm);
  flex-shrink: 0;
}
.category-icon {
  font-size: var(--text-xl);
  color: var(--accent);
}
.category-titles {
  display: flex;
  align-items: baseline;
  gap: 12px;
  min-width: 0;
}
.category-titles h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text-1);
}
.category-count {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-3);
  padding: 2px 10px;
  border-radius: var(--radius-full);
  background: var(--glass-3);
  border: 1px solid var(--stroke-soft);
  font-variant-numeric: tabular-nums;
}

/* ---- sub-category pills ---- */
.sub-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 22px;
}
.sub-pill {
  padding: 6px 15px;
  border-radius: var(--radius-full);
  border: 1px solid var(--stroke);
  background: var(--glass-3);
  color: var(--text-2);
  font-size: var(--text-sm);
  font-weight: 550;
  font-family: inherit;
  cursor: pointer;
  transition: color var(--dur) var(--ease-out), background var(--dur) var(--ease-out),
    border-color var(--dur) var(--ease-out), transform var(--dur-fast) var(--ease-out),
    box-shadow var(--dur) var(--ease-out);
}
.sub-pill:hover {
  color: var(--text-1);
  background: var(--glass-hover);
  border-color: var(--accent-line);
  transform: translateY(-1px);
}
.sub-pill.active {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: var(--accent-line);
  font-weight: 650;
}
.sub-pill:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* ============================================================
   Card grid + cards
   ============================================================ */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
  gap: 20px;
}

.card-link {
  /* 现为 <button>：重置原生按钮样式，保留卡片视觉 */
  display: block;
  width: 100%;
  text-align: left;
  font-family: inherit;
  background: transparent;
  border: none;
  padding: 0;
  color: inherit;
  cursor: pointer;
  border-radius: var(--radius-xl);
  animation: float-soft 7s ease-in-out infinite;
  animation-delay: calc(var(--i, 0) * 0.12s);
  /* No backdrop-filter here — 128 blurred surfaces would jank. Cards use an
     opaque smoked gradient instead; heavy glow/shadow lift only on hover. */
}
.card-link:nth-child(n + 9) { animation: none; } /* only the first rows float */

.card-link:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.card {
  --mx: 50%;
  --my: 50%;
  position: relative;
  height: 100%;
  border-radius: var(--radius-xl);
  background: var(--glass);
  border: 1px solid var(--stroke);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  transform-style: preserve-3d;
  transition: transform var(--dur-slow) var(--ease-out),
    box-shadow var(--dur-slow) var(--ease-out), border-color var(--dur) var(--ease-out);
}

.card-link:hover .card {
  box-shadow: var(--shadow-lg), var(--shadow-accent);
  border-color: var(--accent-line);
}

/* mouse-follow radial glow */
.card-glow {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(
    260px circle at var(--mx) var(--my),
    var(--accent-glow),
    transparent 60%
  );
  opacity: 0;
  transition: opacity var(--dur) var(--ease-out);
  pointer-events: none;
  z-index: 0;
}
.card-link:hover .card-glow { opacity: 0.7; }

/* subtle top sheen line */
.card-ring {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    var(--stroke-strong),
    transparent
  );
  opacity: 0.7;
  z-index: 1;
}

.card-inner {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  height: 100%;
}

.card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.card-icon {
  width: 50px;
  height: 50px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--tile-grad);
  border: 1px solid var(--accent-line);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  flex-shrink: 0;
}
.favicon-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: var(--glass-2);
}
.card-letter {
  font-size: var(--text-lg);
  font-weight: 800;
  background: linear-gradient(135deg, var(--accent), var(--accent-hover));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.card-rating {
  display: flex;
  gap: 1px;
  font-size: var(--text-sm);
  padding-top: 2px;
}
.star { line-height: 1; }
.star-on { color: var(--star); }
.star-off { color: var(--star-empty); }

.card-body {
  flex: 1 1 auto;
  min-width: 0;
}
.card-subtag {
  display: inline-block;
  max-width: 100%;
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--accent);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  background: var(--accent-soft);
  margin-bottom: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-title {
  margin: 0 0 6px;
  font-family: var(--font-display);
  font-size: var(--text-md);
  font-weight: 680;
  letter-spacing: -0.01em;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-desc {
  margin: 0;
  font-size: var(--text-sm);
  line-height: 1.55;
  color: var(--text-2);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid var(--stroke-soft);
}
.card-host {
  font-size: var(--text-xs);
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-variant-numeric: tabular-nums;
}
.card-visit {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
  font-size: var(--text-xs);
  font-weight: 650;
  color: var(--accent);
  opacity: 0.85;
  transition: gap var(--dur) var(--ease-out), opacity var(--dur) var(--ease-out);
}
.card-visit-arrow {
  font-size: var(--text-xs);
  transform: rotate(45deg);
  transition: transform var(--dur) var(--ease-out);
}
.card-link:hover .card-visit { gap: 8px; opacity: 1; }
.card-link:hover .card-visit-arrow { transform: rotate(45deg) translate(2px, -2px); }

/* ============================================================
   Empty state
   ============================================================ */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 8px;
  padding: 70px 24px;
  border-radius: var(--radius-xl);
  background: var(--glass);
  border: 1px dashed var(--stroke);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
.empty-icon {
  font-size: var(--text-3xl);
  color: var(--text-3);
  margin-bottom: 6px;
}
.empty-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 680;
  color: var(--text-1);
}
.empty-hint {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text-3);
}
.empty-action {
  margin-top: 10px;
  padding: 8px 18px;
  border-radius: var(--radius-full);
  border: 1px solid var(--accent-line);
  background: var(--accent-soft);
  color: var(--accent);
  font-family: inherit;
  font-weight: 650;
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease-out),
    transform var(--dur-fast) var(--ease-out);
}
.empty-action:hover { background: var(--accent); color: #fff; transform: translateY(-1px); }

/* ============================================================
   Floating action buttons
   ============================================================ */
.fab-container {
  position: fixed;
  bottom: 32px;
  right: 32px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  z-index: 1000;
}
.fab-button {
  width: 52px;
  height: 52px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  color: var(--text-1);
  cursor: pointer;
  background: var(--glass-2);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid var(--stroke);
  box-shadow: var(--shadow-md);
  transition: transform var(--dur-slow) var(--ease-out),
    box-shadow var(--dur-slow) var(--ease-out), border-color var(--dur-slow) var(--ease-out),
    background var(--dur-slow) var(--ease-out), opacity var(--dur-slow) var(--ease-out);
}
.fab-button:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg), var(--shadow-accent);
  border-color: var(--accent-line);
  background: var(--glass-hover);
}
.fab-button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
.fab-language { gap: 1px; }
.fab-lang-text {
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.back-to-top {
  opacity: 0;
  transform: scale(0.6) translateY(12px);
  pointer-events: none;
}
.back-to-top.is-visible {
  opacity: 1;
  transform: none;
  pointer-events: auto;
}

/* ============================================================
   Responsive
   ============================================================ */
@media (max-width: 768px) {
  .toolbar {
    top: 50px;
    padding: 10px 14px;
  }
  .menu-toggle { display: flex; }
  .toolbar-row { flex-wrap: wrap; }
  .nav-scroll {
    display: none;
    width: 100%;
    flex-wrap: wrap;
    overflow: visible;
    -webkit-mask-image: none;
    mask-image: none;
  }
  .toolbar.menu-open .nav-scroll { display: flex; }
  .nav-pill { width: auto; }
  .search { width: 1px; flex: 1 1 auto; }

  .main-content { padding: 20px 14px 50px; }
  .category-section { scroll-margin-top: 150px; margin-bottom: 40px; }
  .category-titles h2 { font-size: var(--text-lg); }
  .card-grid { grid-template-columns: 1fr; gap: 14px; }

  .fab-container { bottom: 18px; right: 18px; }
  .fab-button { width: 48px; height: 48px; font-size: 1.1rem; }
}

@media (prefers-reduced-motion: reduce) {
  .card-link { animation: none; }
  html { scroll-behavior: auto; }
  .card, .nav-pill, .sub-pill, .fab-button { transition: none; }
}
</style>
