<template>
  <div class="page-container">
    <nav class="top-nav" :class="{ 'mobile-menu-open': isMobileMenuOpen }" ref="topNavContainer">
      <button @click="toggleMobileMenu" class="mobile-menu-toggle" aria-label="Toggle Menu">
        <svg v-if="!isMobileMenuOpen" viewBox="0 0 100 80" width="24" height="24" fill="#e8eaed">
          <rect width="100" height="15" rx="8"></rect>
          <rect y="30" width="100" height="15" rx="8"></rect>
          <rect y="60" width="100" height="15" rx="8"></rect>
        </svg>
        <svg v-else viewBox="0 0 100 100" width="24" height="24" fill="#e8eaed">
          <rect width="120" height="15" rx="8" transform="translate(0 42) rotate(-45)"></rect>
          <rect width="120" height="15" rx="8" transform="translate(42 100) rotate(-135)"></rect>
        </svg>
      </button>
      <div v-for="category in menuItems" :key="category.title" class="nav-item" :class="{ 'nav-item-active': activeCategory === category.title }">
        <a-dropdown>
          <a class="nav-link" @click.prevent="handleCategoryLinkClick(category.title)" :href="`#${category.title}`">
            <AntIcon :icon="category.icon" />
            <span style="margin-left: 8px;">{{ isChinese ? category.title_zh : category.title }}</span>
          </a>
          <template #overlay>
            <a-menu @click="({ key }) => handleSubCategoryClick(category.title, key)">
              <a-menu-item key="All">All</a-menu-item>
              <a-menu-item v-for="subCategory in getSubCategories(category.title)" :key="subCategory">
                {{ getSubCategoryName(category.title, subCategory) }}
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>
    </nav>
    <main class="main-content">
      <section v-for="category in menuItems" :key="category.title" :id="category.title" class="category-section">
        <h2>
          <AntIcon :icon="category.icon" class="category-title-icon" />
          <span>{{ isChinese ? category.title_zh : category.title }}</span>
        </h2>
        <div class="sub-nav">
          <button 
            @click="setActiveSubCategory(category.title, 'All')"
            :class="{ active: activeSubCategories[category.title] === 'All' || !activeSubCategories[category.title] }"
          >
            All
          </button>
          <button 
            v-for="subCategory in getSubCategories(category.title)" 
            :key="subCategory"
            @click="setActiveSubCategory(category.title, subCategory)"
            :class="{ active: activeSubCategories[category.title] === subCategory }"
          >
            {{ getSubCategoryName(category.title, subCategory) }}
          </button>
        </div>
        <div class="card-grid">
          <a v-for="(item, index) in getFilteredItems(category.title)" :key="item.name" :href="item.url" target="_blank" rel="noopener noreferrer" class="card-link" :style="{ '--animation-delay': `${index * 0.05}s` }">
            <div class="card" @mousemove="handleMouseMove" @mouseleave="resetCardStyle">
              <div class="card-content">
                <div class="card-rating">
                  <template v-for="i in 5" :key="i">
                    <StarFilled v-if="i <= item.rating" class="star-filled" />
                    <StarOutlined v-else class="star-outlined" />
                  </template>
                </div>
                <div class="card-icon">
                  <img
                    v-if="!failedFavicons.has(item.url) && getFaviconUrl(item.url)"
                  :src="getFaviconUrl(item.url)"
                  :alt="`${item.name} favicon`"
                  @error="handleFaviconError(item.url)"
                  class="favicon-img"
                />
                <span v-else>{{ (isChinese ? item.name_zh : item.name).charAt(0).toUpperCase() }}</span>
              </div>
              <div class="card-body">
                  <h3>{{ isChinese ? item.name_zh : item.name }}</h3>
                  <p>{{ isChinese ? item.content_zh : item.content }}</p>
                </div>
              </div>
            </div>
          </a>
        </div>
      </section>
    </main>

    <Comments />

    <!-- Floating Action Buttons -->
    <div class="fab-container">
      <button v-show="showBackToTop" @click="scrollToTop" class="fab-button back-to-top" title="Back to Top">
        ↑
      </button>
      <button @click="toggleLanguage" class="fab-button translate-button-fab" :title="isChinese ? 'Switch to English' : '切换为中文'">
        {{ isChinese ? 'En' : '中' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, h, watch, nextTick } from 'vue'
import { useMenuStore } from '~/stores/menuStore'
import { useContentStore } from '~/stores/contentStore'
import { storeToRefs } from 'pinia'
import * as antIcons from '@ant-design/icons-vue'
import { StarFilled, StarOutlined } from '@ant-design/icons-vue'
import Comments from '~/components/Comments.vue'

// A helper to dynamically render Ant Design icons from string names
const AntIcon = (props) => {
  const icon = antIcons[props.icon]
  return icon ? h(icon) : null
}

const handleMouseMove = (event) => {
  const card = event.currentTarget
  const { left, top, width, height } = card.getBoundingClientRect()
  const x = event.clientX - left
  const y = event.clientY - top

  const rotateX = (y - height / 2) / (height / 2) * -10 // Max rotation 10deg
  const rotateY = (x - width / 2) / (width / 2) * 10    // Max rotation 10deg

  card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`
  card.style.setProperty('--mouse-x', `${x}px`)
  card.style.setProperty('--mouse-y', `${y}px`)
}

const resetCardStyle = (event) => {
  const card = event.currentTarget
  card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)'
}

const failedFavicons = ref(new Set())

const getFaviconUrl = (itemUrl) => {
  if (!itemUrl) return ''
  try {
    const url = new URL(itemUrl)
    // Use a reliable public favicon service to fetch icons
    return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=64`
  } catch (error) {
    // If the URL is invalid, we can't get a favicon.
    return ''
  }
}

const handleFaviconError = (itemUrl) => {
  // Re-create the set to ensure Vue's reactivity is triggered
  const newFailedFavicons = new Set(failedFavicons.value);
  newFailedFavicons.add(itemUrl);
  failedFavicons.value = newFailedFavicons;
}

const menuStore = useMenuStore()
const { menuItems } = storeToRefs(menuStore)

const contentStore = useContentStore()
const { contentItems } = storeToRefs(contentStore)

const topNavContainer = ref(null)
const activeSubCategories = ref({})
const activeCategory = ref('') // To track the currently visible category
const isChinese = ref(false)
const showBackToTop = ref(false)
const isMobileMenuOpen = ref(false)

const toggleLanguage = () => {
  isChinese.value = !isChinese.value
}

const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
}

const closeMobileMenu = () => {
  // Only close if the mobile menu is actually open and screen is mobile-sized
  if (isMobileMenuOpen.value && window.innerWidth <= 768) {
    isMobileMenuOpen.value = false
  }
}

const handleCategoryLinkClick = (categoryTitle) => {
  const element = document.getElementById(categoryTitle);
  if (element) {
    const offset = 130; // Height of the sticky headers
    const bodyRect = document.body.getBoundingClientRect().top;
    const elementRect = element.getBoundingClientRect().top;
    const elementPosition = elementRect - bodyRect;
    const offsetPosition = elementPosition - offset;

    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    });
  }
  closeMobileMenu()
}

const setActiveSubCategory = (category, subCategory) => {
  activeSubCategories.value[category] = subCategory
}

const handleSubCategoryClick = (category, subCategory) => {
  setActiveSubCategory(category, subCategory)
  handleCategoryLinkClick(category); // Reuse the smooth scroll logic
  closeMobileMenu()
}

const getSubCategories = (categoryTitle) => {
  const items = contentItems.value.filter(item => item.category === categoryTitle)
  return [...new Set(items.map(item => item.subCategory))]
}

const getSubCategoryName = (categoryTitle, subCategory) => {
  if (!isChinese.value) return subCategory
  const item = contentItems.value.find(i => i.category === categoryTitle && i.subCategory === subCategory)
  return item ? item.subCategory_zh : subCategory
}

const getFilteredItems = (categoryTitle) => {
  const selectedSub = activeSubCategories.value[categoryTitle]
  const items = contentItems.value.filter(item => item.category === categoryTitle)
  
  if (!selectedSub || selectedSub === 'All') {
    return items
  }
  
  return items.filter(item => item.subCategory === selectedSub)
}

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const handleScroll = () => {
  showBackToTop.value = window.scrollY > 200
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll)

  // Intersection Observer for category highlighting
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          activeCategory.value = entry.target.id
        }
      })
    },
    {
      // The top margin (-130px) accounts for the fixed headers.
      // The bottom margin (-80%) makes the intersection area a small band at the top of the viewport.
      // This ensures a section is marked "active" only when its title is near the top.
      rootMargin: '-130px 0px -80% 0px',
      threshold: 0,
    }
  )

  document.querySelectorAll('.category-section').forEach((section) => {
    observer.observe(section)
  })
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})

watch(activeCategory, async (newCategory) => {
  if (!newCategory || !topNavContainer.value) return;

  await nextTick();

  const activeElement = topNavContainer.value.querySelector('.nav-item-active');
  if (activeElement) {
    const container = topNavContainer.value;
    const targetScrollLeft = activeElement.offsetLeft - (container.offsetWidth / 2) + (activeElement.offsetWidth / 2);
    
    // Custom smooth scroll implementation
    const start = container.scrollLeft;
    const change = targetScrollLeft - start;
    const duration = 400; // ms
    let startTime = null;

    const easeInOutQuad = (t, b, c, d) => {
      t /= d / 2;
      if (t < 1) return c / 2 * t * t + b;
      t--;
      return -c / 2 * (t * (t - 2) - 1) + b;
    };

    const animateScroll = (currentTime) => {
      if (startTime === null) startTime = currentTime;
      const timeElapsed = currentTime - startTime;
      const run = easeInOutQuad(timeElapsed, start, change, duration);
      container.scrollLeft = run;
      if (timeElapsed < duration) {
        requestAnimationFrame(animateScroll);
      }
    };

    requestAnimationFrame(animateScroll);
  }
});
</script>

<style>
/* Global styles for Ant Design dropdowns */
.ant-dropdown .ant-dropdown-menu {
  background-color: rgba(41, 42, 45, 0.7) !important; /* Semi-transparent background */
  backdrop-filter: blur(10px) !important;
  -webkit-backdrop-filter: blur(10px) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  border-radius: 8px !important;
  padding: 4px !important;
}

.ant-dropdown .ant-dropdown-menu-item {
  color: #e8eaed !important;
}

.ant-dropdown .ant-dropdown-menu-item:hover {
  background-color: rgba(60, 64, 67, 0.8) !important;
  border-radius: 4px !important;
}
</style>

<style scoped>
@keyframes float {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-8px);
  }
}

html {
  scroll-behavior: smooth;
}

.page-container {
  background-color: transparent;
  color: #e8eaed;
  font-family: sans-serif;
}

.top-nav {
  display: flex;
  align-items: center;
  padding: 10px;
  gap: 8px;
  background: rgba(30, 30, 35, 0.2);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  overflow-x: auto;
  white-space: nowrap;
  position: sticky;
  top: 64px;
  z-index: 10;
}

/* Custom Scrollbar for the top navigation */
.top-nav::-webkit-scrollbar {
  height: 8px;
}

.top-nav::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

.top-nav::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  border: 2px solid transparent;
  background-clip: content-box;
}

.top-nav::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.5);
}

.nav-item {
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  transition: all 0.3s ease;
  background-color: transparent;
}

.nav-item:hover {
  background-color: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.3);
}

.nav-item.nav-item-active {
  background-color: rgba(138, 180, 248, 0.2);
  border-color: rgba(138, 180, 248, 0.8);
}

.nav-item.nav-item-active .nav-link {
  color: #e8eaed;
  font-weight: 600;
}

.nav-item .nav-link {
  color: #bdc1c6;
  text-decoration: none;
  padding: 8px 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  transition: color 0.3s ease;
}


.main-content {
  padding: 20px;
}

.category-section {
  margin-bottom: 40px;
  scroll-margin-top: 130px; /* Adjusted for 64px header + new sticky nav */
}

.category-section h2 {
  font-size: 1.5rem;
  margin-bottom: 20px;
  padding-left: 10px;
  border-left: 3px solid #8ab4f8;
  display: flex;
  align-items: center;
}

.category-title-icon {
  margin-right: 12px;
  font-size: 1.4rem;
  color: #8ab4f8;
}

.sub-nav {
  margin-bottom: 20px;
  display: flex;
  gap: 10px;
}

.sub-nav button {
  background-color: rgba(255, 255, 255, 0.05); /* Less opaque */
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #e8eaed;
  padding: 8px 16px;
  border-radius: 20px;
  cursor: pointer;
  backdrop-filter: blur(8px); /* More blur */
  -webkit-backdrop-filter: blur(8px);
  transition: all 0.3s ease;
}

.sub-nav button:hover {
  background-color: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.2);
  transform: scale(1.05); /* Add a little pop */
}

.sub-nav button.active {
  background-color: #8ab4f8;
  color: #202124;
  font-weight: bold;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 24px;
}

.card-link {
  text-decoration: none;
  color: inherit;
  border-radius: 18px;
  animation: float 6s ease-in-out infinite;
  animation-delay: var(--animation-delay);
}

.card-link:hover {
  animation-play-state: paused;
}

.card {
  --mouse-x: 50%;
  --mouse-y: 50%;
  --card-border-color: rgba(255, 255, 255, 0.2);

  background: rgba(35, 35, 40, 0.5);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  
  border-radius: 16px;
  padding: 1px;
  height: 100%;
  position: relative;
  overflow: hidden;
  
  transform-style: preserve-3d;
  transition: transform 0.4s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.4s ease;
}

.card:hover {
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
}

.card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(
    circle at var(--mouse-x) var(--mouse-y),
    rgba(138, 180, 248, 0.15),
    transparent 40%
  );
  border-radius: inherit;
  opacity: 0;
  transition: opacity 0.4s ease;
}

.card:hover::before {
  opacity: 1;
}

.card::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image: radial-gradient(
    circle at var(--mouse-x) var(--mouse-y),
    var(--card-border-color),
    transparent 60%
  );
  border-radius: inherit;
  z-index: 1;
}

.card-content {
  background: transparent; /* Let the glassmorphism show through */
  border-radius: 15px;
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column; /* Change to column for better control */
  align-items: flex-start; /* Align items to the start */
  justify-content: flex-start; /* Align content to the top */
  z-index: 2;
  position: relative;
  min-height: 130px; /* Give a fixed height to all cards */
}

.card-rating {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 2px;
  font-size: 14px;
}

.card-rating .star-filled {
  color: #ffc107; /* A bright, pure yellow */
}

.card-rating .star-outlined {
  color: rgba(255, 255, 255, 0.3); /* A subtle grey for unfilled stars */
}

.favicon-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  background-color: rgba(255, 255, 255, 0.9); /* Add a light background for favicons with transparency */
}

.card-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background-color: rgba(138, 180, 248, 0.1);
  color: #e8eaed;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: 16px; /* Add margin below icon */
  flex-shrink: 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.card-body {
  width: 100%;
}

.card-body h3 {
  margin: 0 0 8px 0;
  font-size: 1rem;
  color: #e8eaed;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-body p {
  margin: 0;
  font-size: 0.875rem;
  color: #bdc1c6;
  display: -webkit-box;
  -webkit-line-clamp: 2; /* Limit to 2 lines */
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.5;
}

/* Floating Action Button Styles */
.fab-container {
  position: fixed;
  bottom: 40px;
  right: 40px;
  display: flex;
  flex-direction: column;
  gap: 15px;
  z-index: 1000;
}

.fab-button {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: bold;
  cursor: pointer;
  color: #e8eaed;
  /* Aligning with card styles for consistency */
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0));
  transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
  border: 1px solid rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
}

.fab-button:hover {
  /* Aligning with card hover styles */
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.05));
  transform: scale(1.1) translateY(-5px); /* Adjusted transform for a nice lift */
  box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.45);
  border-color: rgba(255, 255, 255, 0.3);
}

.back-to-top {
  font-size: 1.8rem;
  padding-bottom: 4px; /* Adjust arrow position */
}

.translate-button-fab {
  font-size: 1.2rem; /* Adjust font size for text */
}

.mobile-menu-toggle {
  display: none;
}

/* Responsive Design for Mobile Devices */
@media (max-width: 768px) {
  .top-nav {
    padding: 8px 15px;
    top: 50px; /* Adjust for potentially smaller headers on mobile */
    flex-direction: column;
    align-items: flex-start;
    /* Remove horizontal scroll when menu is vertical */
    overflow-x: hidden;
    white-space: normal;
  }

  .mobile-menu-toggle {
    display: block;
    background: none;
    border: none;
    padding: 5px;
    cursor: pointer;
    margin-bottom: 5px;
  }

  .nav-item {
    display: none; /* Hide items by default on mobile */
    width: 100%;
  }

  .top-nav.mobile-menu-open .nav-item {
    display: block; /* Show items when menu is open */
  }

  .top-nav.mobile-menu-open {
    padding-bottom: 15px;
  }

  .nav-item .nav-link {
    padding: 10px 15px;
    border-radius: 6px;
  }

  .main-content {
    padding: 15px;
  }

  .category-section {
    scroll-margin-top: 110px; /* Adjust scroll margin for new nav height */
  }

  .category-section h2 {
    font-size: 1.3rem;
  }

  .sub-nav {
    flex-wrap: wrap; /* Allow buttons to wrap on small screens */
  }

  .card-grid {
    grid-template-columns: 1fr; /* Single column layout on mobile */
    gap: 15px;
  }

  .card {
    flex-direction: row; /* Revert to row for better layout on smaller tablets */
    align-items: center;
    text-align: left;
  }

  .card-icon {
    margin-right: 0;
    margin-bottom: 15px;
  }

  .fab-container {
    bottom: 20px;
    right: 20px;
  }

  .fab-button {
    width: 50px;
    height: 50px;
    font-size: 1.3rem;
  }

  .back-to-top {
    font-size: 1.6rem;
  }
}

@media (max-width: 480px) {
  .card {
    flex-direction: column; /* Stack on very small screens */
    align-items: flex-start;
  }
}
</style>
