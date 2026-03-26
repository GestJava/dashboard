/* ============================================
   DASHBOARD COMMAND CENTER — Core Application
   ============================================ */

(function () {
  'use strict';

  // ─── Configuration ────────────────────────────
  const STORAGE_KEY = 'commandCenterConfig';
  const CAROUSEL_INTERVAL = 60000; // 60 seconds

  const ALL_SLOTS = [
    'WallA-Slot1', 'WallA-Slot2', 'WallA-Slot3', 'WallA-Slot4', 'WallA-Slot5',
    'WallA-Slot6', 'WallA-Slot7', 'WallA-Slot8', 'WallA-Slot9',
    'WallB-Slot1', 'WallB-Slot2', 'WallB-Slot3',
    'WallC-Slot1', 'WallC-Slot2'
  ];
  const WALL_B_SLOTS = ['WallB-Slot1', 'WallB-Slot2', 'WallB-Slot3'];

  // ─── State ────────────────────────────────────
  let state = {
    slots: {},
    carousels: {},
    emergency: { active: false, url: '' }
  };
  let carouselTimers = {};

  // Initialize default state for each slot
  ALL_SLOTS.forEach(id => {
    state.slots[id] = { url: '', zoom: 100 };
  });
  WALL_B_SLOTS.forEach(id => {
    state.carousels[id] = { enabled: false, urls: [], currentIndex: 0 };
  });

  // ─── DOM References ───────────────────────────
  const adminPanel = document.getElementById('adminPanel');
  const adminOverlay = document.getElementById('adminOverlay');
  const openAdminBtn = document.getElementById('openAdminBtn');
  const closeAdminBtn = document.getElementById('closeAdminBtn');
  const fullscreenBtn = document.getElementById('fullscreenBtn');

  const globalRefreshBtn = document.getElementById('globalRefreshBtn');
  const wallBGrid = document.getElementById('wallBGrid');
  const toastContainer = document.getElementById('toastContainer');

  // ─── Clock ────────────────────────────────────
  function updateClock() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    document.getElementById('liveClock').textContent = `${h}:${m}:${s}`;
  }
  setInterval(updateClock, 1000);
  updateClock();

  // ─── Toast Notifications ─────────────────────
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3000);
  }

  // ─── Admin Panel Toggle ───────────────────────
  function openAdmin() {
    adminPanel.classList.add('open');
    adminOverlay.classList.add('open');
  }

  function closeAdmin() {
    adminPanel.classList.remove('open');
    adminOverlay.classList.remove('open');
  }

  openAdminBtn.addEventListener('click', openAdmin);
  closeAdminBtn.addEventListener('click', closeAdmin);
  adminOverlay.addEventListener('click', closeAdmin);

  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
          showToast(`Error attempting to enable fullscreen: ${err.message}`, 'error');
        });
      } else {
        document.exitFullscreen();
      }
    });

    document.addEventListener('fullscreenchange', () => {
      if (document.fullscreenElement) {
        fullscreenBtn.innerHTML = '<span class="btn-icon">🗗</span> Exit Fullscreen';
        fullscreenBtn.classList.add('active');
      } else {
        fullscreenBtn.innerHTML = '<span class="btn-icon">⛶</span> Fullscreen';
        fullscreenBtn.classList.remove('active');
      }
    });
  }

  // ─── Tab Navigation ───────────────────────────
  window.switchTab = function (tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    // Update tab panels
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.dataset.tab === tabName);
    });
  };

  // ─── Iframe Management ────────────────────────
  function createIframe(url, slotId) {
    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.loading = 'lazy';
    iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation');
    iframe.setAttribute('allow', 'fullscreen; autoplay; encrypted-media');
    iframe.setAttribute('referrerpolicy', 'no-referrer');
    iframe.id = `iframe-${slotId}`;
    iframe.title = slotId;
    iframe.style.transformOrigin = 'top left';
    iframe.style.position = 'absolute';
    iframe.style.top = '0';
    iframe.style.left = '0';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    return iframe;
  }

  // ─── Responsive Desktop Zoom ────────────────────
  function updateIframeScale(slotId) {
    const slotEl = document.getElementById(slotId);
    const iframe = document.getElementById(`iframe-${slotId}`);
    if (!slotEl || !iframe) return;

    const contentEl = slotEl.querySelector('.slot-content');
    if (!contentEl) return;

    const containerW = contentEl.clientWidth;
    const containerH = contentEl.clientHeight;
    if (!containerW || !containerH) return;

    // Base desktop viewport width 
    const BASE_DESKTOP_WIDTH = 1280;

    // Zoom factor (100% = 1.0, 150% = 1.5)
    // As you zoom in, the effective viewport SHRINKS, causing text to enlarge.
    const zoomFactor = (state.slots[slotId]?.zoom || 100) / 100;
    const effectiveWidth = BASE_DESKTOP_WIDTH / zoomFactor;

    // Scale needed to fit the effective width into the physical container width
    const scale = containerW / effectiveWidth;

    // The height the iframe needs so that when scaled it exactly fits container height
    const effectiveHeight = containerH / scale;

    iframe.style.width = Math.round(effectiveWidth) + 'px';
    iframe.style.height = Math.round(effectiveHeight) + 'px';
    iframe.style.transform = `scale(${scale})`;
  }

  // Recalculate all visible iframe scales on window resize
  function updateAllScales() {
    ALL_SLOTS.forEach(id => {
      if (state.slots[id]?.url) updateIframeScale(id);
    });
  }

  const resizeObserver = new ResizeObserver(() => updateAllScales());
  document.querySelectorAll('.slot-content').forEach(el => resizeObserver.observe(el));

  function setSlotContent(slotId, url) {
    const slotEl = document.getElementById(slotId);
    if (!slotEl) return;

    const contentEl = slotEl.querySelector('.slot-content');
    if (!contentEl) return;

    // Clear existing content
    contentEl.innerHTML = '';

    if (url && url.trim()) {
      // Show loading spinner
      const loader = document.createElement('div');
      loader.className = 'slot-loading';
      loader.innerHTML = '<div class="slot-loading-spinner"></div><div class="slot-loading-text">Loading...</div>';
      contentEl.appendChild(loader);

      // Create iframe
      const iframe = createIframe(url.trim(), slotId);
      iframe.style.opacity = '0';
      iframe.style.transition = 'opacity 0.4s ease';
      contentEl.appendChild(iframe);
      // Apply zoom if zoomed
      const zoom = state.slots[slotId]?.zoom || 100;
      if (zoom !== 100) updateIframeScale(slotId);

      iframe.addEventListener('load', () => {
        if (loader.parentNode) loader.parentNode.removeChild(loader);
        iframe.style.opacity = '1';
        updateIframeScale(slotId);
      });

      iframe.addEventListener('error', () => {
        if (loader.parentNode) loader.parentNode.removeChild(loader);
        iframe.style.opacity = '1';
        updateIframeScale(slotId);
      });

      // Fallback: remove loader after 10s
      setTimeout(() => {
        if (loader.parentNode) loader.parentNode.removeChild(loader);
        iframe.style.opacity = '1';
        updateIframeScale(slotId);
      }, 10000);

      slotEl.classList.add('slot-active');
      updateSlotStatus(slotId, true);
    } else {
      // Show placeholder
      const placeholder = document.createElement('div');
      placeholder.className = 'slot-placeholder';
      placeholder.innerHTML = `
        <div class="slot-placeholder-icon">${slotId.startsWith('WallA-Slot') && parseInt(slotId.replace('WallA-Slot', '')) > 5 ? '📊' : slotId === 'WallA-Slot3' ? '🗺️' : '📺'}</div>
        <div class="slot-placeholder-text">${slotId}</div>
      `;
      contentEl.appendChild(placeholder);
      slotEl.classList.remove('slot-active');
      updateSlotStatus(slotId, false);
    }

    updateActiveCount();
  }

  function updateSlotStatus(slotId, active) {
    const statusEl = document.getElementById(`status-${slotId}`);
    if (statusEl) {
      statusEl.textContent = active ? 'Active' : 'Inactive';
      statusEl.className = `slot-config-status ${active ? 'active' : 'inactive'}`;
    }
  }

  function updateActiveCount() {
    let count = 0;
    ALL_SLOTS.forEach(id => {
      if (state.slots[id]?.url) count++;
    });
    document.getElementById('activeCount').textContent = `${count} Active`;
  }

  // ─── Public: Apply URL ────────────────────────
  window.applyUrl = function (slotId) {
    const input = document.getElementById(`url-${slotId}`);
    if (!input) return;
    const url = input.value.trim();
    state.slots[slotId].url = url;
    setSlotContent(slotId, url);
    saveConfig();
    if (url) {
      showToast(`${slotId} loaded`, 'success');
    }
  };

  // ─── Public: Clear Slot ───────────────────────
  window.clearSlot = function (slotId) {
    const input = document.getElementById(`url-${slotId}`);
    if (input) input.value = '';
    state.slots[slotId].url = '';
    setSlotContent(slotId, '');
    saveConfig();
    showToast(`${slotId} cleared`, 'info');
  };

  // ─── Public: Refresh Single Slot ──────────────
  window.refreshSlot = function (slotId) {
    if (slotId === 'emergency') {
      const iframe = document.querySelector('#emergencySlot iframe');
      if (iframe) {
        iframe.src = iframe.src;
        showToast('Emergency slot refreshed', 'info');
      }
      return;
    }
    const iframe = document.getElementById(`iframe-${slotId}`);
    if (iframe) {
      iframe.src = iframe.src;
      showToast(`${slotId} refreshed`, 'info');
    }
  };

  // ─── Public: Set Zoom ─────────────────────────
  const ZOOM_MIN = 100;
  const ZOOM_MAX = 300;
  const ZOOM_STEP = 20;

  window.setZoom = function (slotId, value) {
    const val = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, parseInt(value, 10)));
    state.slots[slotId].zoom = val;

    // Update admin panel controls
    const adminZoomVal = document.getElementById(`zoomVal-${slotId}`);
    const adminSlider = document.getElementById(`zoom-${slotId}`);
    if (adminZoomVal) adminZoomVal.textContent = `${val}%`;
    if (adminSlider) adminSlider.value = val;

    // Update on-frame zoom badge
    const badge = document.getElementById(`zoom-badge-${slotId}`);
    if (badge) {
      badge.textContent = `${val}%`;
      badge.classList.toggle('zoomed', val > ZOOM_MIN);
    }

    updateIframeScale(slotId);
    saveConfig();
  };

  window.zoomIn = function (slotId) {
    const current = state.slots[slotId]?.zoom || 100;
    window.setZoom(slotId, current + ZOOM_STEP);
  };

  window.zoomOut = function (slotId) {
    const current = state.slots[slotId]?.zoom || 100;
    window.setZoom(slotId, current - ZOOM_STEP);
  };

  window.zoomReset = function (slotId) {
    window.setZoom(slotId, 100);
  };

  // ─── Inject Zoom Controls into Slot Headers ───
  function injectZoomControls() {
    ALL_SLOTS.forEach(slotId => {
      const slotEl = document.getElementById(slotId);
      if (!slotEl) return;
      const actions = slotEl.querySelector('.slot-actions');
      if (!actions) return;

      // Add zoom controls before existing buttons
      const zoomGroup = document.createElement('div');
      zoomGroup.className = 'slot-zoom-group';
      zoomGroup.innerHTML = `
        <button class="slot-action-btn zoom-btn" onclick="zoomOut('${slotId}')" title="Zoom Out (−)">−</button>
        <span class="slot-zoom-badge" id="zoom-badge-${slotId}" ondblclick="zoomReset('${slotId}')" title="Double-click untuk reset">100%</span>
        <button class="slot-action-btn zoom-btn" onclick="zoomIn('${slotId}')" title="Zoom In (+)">+</button>
      `;
      actions.insertBefore(zoomGroup, actions.firstChild);
    });
  }

  // ─── Ctrl+Scroll Wheel Zoom ───────────────────
  function setupScrollZoom() {
    ALL_SLOTS.forEach(slotId => {
      const slotEl = document.getElementById(slotId);
      if (!slotEl) return;

      slotEl.addEventListener('wheel', (e) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        const current = state.slots[slotId]?.zoom || 100;
        const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
        window.setZoom(slotId, current + delta);
      }, { passive: false });
    });
  }

  // ─── Global Refresh ───────────────────────────
  globalRefreshBtn.addEventListener('click', () => {
    ALL_SLOTS.forEach(id => {
      const iframe = document.getElementById(`iframe-${id}`);
      if (iframe) iframe.src = iframe.src;
    });
    showToast('All slots refreshed', 'success');
  });



  // ─── Carousel / Auto-Rotation ─────────────────
  window.toggleCarousel = function (slotId, enabled) {
    state.carousels[slotId].enabled = enabled;
    const urlList = document.getElementById(`carousel-urls-${slotId}`);
    const addBtn = document.getElementById(`carousel-add-${slotId}`);

    if (enabled) {
      urlList.style.display = 'flex';
      addBtn.style.display = 'block';
      if (state.carousels[slotId].urls.length === 0) {
        addCarouselUrl(slotId);
        addCarouselUrl(slotId);
      }
      startCarousel(slotId);
    } else {
      urlList.style.display = 'none';
      addBtn.style.display = 'none';
      stopCarousel(slotId);
    }
    saveConfig();
  };

  window.addCarouselUrl = function (slotId) {
    const urls = state.carousels[slotId].urls;
    const index = urls.length;
    urls.push('');

    const urlList = document.getElementById(`carousel-urls-${slotId}`);
    const item = document.createElement('div');
    item.className = 'carousel-url-item';
    item.innerHTML = `
      <input type="url" class="input-url" placeholder="URL rotasi #${index + 1}" 
        onchange="updateCarouselUrl('${slotId}', ${index}, this.value)">
      <button class="carousel-remove-btn" onclick="removeCarouselUrl('${slotId}', ${index}, this.parentNode)">✕</button>
    `;
    urlList.appendChild(item);
    saveConfig();
  };

  window.updateCarouselUrl = function (slotId, index, value) {
    if (state.carousels[slotId].urls[index] !== undefined) {
      state.carousels[slotId].urls[index] = value.trim();
      saveConfig();

      // Restart carousel if running
      if (state.carousels[slotId].enabled) {
        stopCarousel(slotId);
        startCarousel(slotId);
      }
    }
  };

  window.removeCarouselUrl = function (slotId, index, element) {
    state.carousels[slotId].urls.splice(index, 1);
    if (element && element.parentNode) element.parentNode.removeChild(element);
    rebuildCarouselUrlList(slotId);
    saveConfig();
  };

  function rebuildCarouselUrlList(slotId) {
    const urlList = document.getElementById(`carousel-urls-${slotId}`);
    urlList.innerHTML = '';
    state.carousels[slotId].urls.forEach((url, i) => {
      const item = document.createElement('div');
      item.className = 'carousel-url-item';
      item.innerHTML = `
        <input type="url" class="input-url" placeholder="URL rotasi #${i + 1}" value="${url}"
          onchange="updateCarouselUrl('${slotId}', ${i}, this.value)">
        <button class="carousel-remove-btn" onclick="removeCarouselUrl('${slotId}', ${i}, this.parentNode)">✕</button>
      `;
      urlList.appendChild(item);
    });
  }

  function startCarousel(slotId) {
    stopCarousel(slotId); // Clear any existing timer
    const carousel = state.carousels[slotId];
    const validUrls = carousel.urls.filter(u => u && u.trim());
    if (validUrls.length < 2) return;

    // Update carousel indicator dots
    updateCarouselDots(slotId, validUrls.length, carousel.currentIndex);

    // Show indicator
    const indicator = document.getElementById(`carousel-${slotId}`);
    if (indicator) indicator.classList.add('active');

    carouselTimers[slotId] = setInterval(() => {

      carousel.currentIndex = (carousel.currentIndex + 1) % validUrls.length;
      const nextUrl = validUrls[carousel.currentIndex];

      // Fade transition
      const slotEl = document.getElementById(slotId);
      const contentEl = slotEl?.querySelector('.slot-content');
      if (contentEl) {
        contentEl.style.opacity = '0';
        setTimeout(() => {
          setSlotContent(slotId, nextUrl);
          state.slots[slotId].url = nextUrl;
          contentEl.style.opacity = '1';
          contentEl.style.transition = 'opacity 0.5s ease';
        }, 300);
      }

      updateCarouselDots(slotId, validUrls.length, carousel.currentIndex);
    }, CAROUSEL_INTERVAL);
  }

  function stopCarousel(slotId) {
    if (carouselTimers[slotId]) {
      clearInterval(carouselTimers[slotId]);
      delete carouselTimers[slotId];
    }
    const indicator = document.getElementById(`carousel-${slotId}`);
    if (indicator) indicator.classList.remove('active');
  }

  function updateCarouselDots(slotId, total, activeIndex) {
    const indicator = document.getElementById(`carousel-${slotId}`);
    if (!indicator) return;
    indicator.innerHTML = '';
    for (let i = 0; i < total; i++) {
      const dot = document.createElement('span');
      dot.className = `carousel-dot${i === activeIndex ? ' active' : ''}`;
      indicator.appendChild(dot);
    }
  }

  // ─── LocalStorage Persistence ─────────────────
  function saveConfig() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to save config:', e);
    }
  }

  function loadConfig() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge saved state into current state
        if (parsed.slots) {
          ALL_SLOTS.forEach(id => {
            if (parsed.slots[id]) {
              state.slots[id] = { ...state.slots[id], ...parsed.slots[id] };
            }
          });
        }
        if (parsed.carousels) {
          WALL_B_SLOTS.forEach(id => {
            if (parsed.carousels[id]) {
              state.carousels[id] = { ...state.carousels[id], ...parsed.carousels[id] };
            }
          });
        }
        if (parsed.emergency) {
          state.emergency = { ...state.emergency, ...parsed.emergency };
        }
      }
    } catch (e) {
      console.warn('Failed to load config:', e);
    }
  }

  function applyLoadedConfig() {
    // Apply URLs and zoom to all slots
    ALL_SLOTS.forEach(id => {
      const s = state.slots[id];
      const urlInput = document.getElementById(`url-${id}`);
      const zoomSlider = document.getElementById(`zoom-${id}`);
      const zoomVal = document.getElementById(`zoomVal-${id}`);

      if (urlInput && s.url) {
        urlInput.value = s.url;
        setSlotContent(id, s.url);
      }
      if (zoomSlider && s.zoom) {
        zoomSlider.value = s.zoom;
        if (zoomVal) zoomVal.textContent = `${s.zoom}%`;
      }
    });



    // Apply carousel config
    WALL_B_SLOTS.forEach(id => {
      const carousel = state.carousels[id];
      const toggle = document.getElementById(`carousel-toggle-${id}`);
      const urlList = document.getElementById(`carousel-urls-${id}`);
      const addBtn = document.getElementById(`carousel-add-${id}`);

      if (toggle && carousel.enabled) {
        toggle.checked = true;
        if (urlList) urlList.style.display = 'flex';
        if (addBtn) addBtn.style.display = 'block';

        // Rebuild URL inputs
        rebuildCarouselUrlList(id);
        startCarousel(id);
      }
    });

    updateActiveCount();
  }

  // ─── Admin Panel Footer Actions ───────────────
  window.saveAllConfig = function () {
    // Collect all current input values
    ALL_SLOTS.forEach(id => {
      const urlInput = document.getElementById(`url-${id}`);
      const zoomSlider = document.getElementById(`zoom-${id}`);
      if (urlInput) state.slots[id].url = urlInput.value.trim();
      if (zoomSlider) state.slots[id].zoom = parseInt(zoomSlider.value, 10);
    });
    saveConfig();
    showToast('Configuration saved to LocalStorage', 'success');
  };

  window.loadAllConfig = function () {
    loadConfig();
    applyLoadedConfig();
    showToast('Configuration loaded from LocalStorage', 'success');
  };

  window.resetAllConfig = function () {
    if (!confirm('Reset semua konfigurasi? Semua URL dan pengaturan akan dihapus.')) return;

    // Stop all carousels
    WALL_B_SLOTS.forEach(id => stopCarousel(id));

    // Reset state
    ALL_SLOTS.forEach(id => {
      state.slots[id] = { url: '', zoom: 100 };
    });
    WALL_B_SLOTS.forEach(id => {
      state.carousels[id] = { enabled: false, urls: [], currentIndex: 0 };
    });
    state.emergency = { active: false, url: '' };

    // Reset UI
    ALL_SLOTS.forEach(id => {
      const urlInput = document.getElementById(`url-${id}`);
      const zoomSlider = document.getElementById(`zoom-${id}`);
      const zoomVal = document.getElementById(`zoomVal-${id}`);
      if (urlInput) urlInput.value = '';
      if (zoomSlider) zoomSlider.value = 100;
      if (zoomVal) zoomVal.textContent = '100%';
      setSlotContent(id, '');
    });

    WALL_B_SLOTS.forEach(id => {
      const toggle = document.getElementById(`carousel-toggle-${id}`);
      const urlList = document.getElementById(`carousel-urls-${id}`);
      const addBtn = document.getElementById(`carousel-add-${id}`);
      if (toggle) toggle.checked = false;
      if (urlList) { urlList.style.display = 'none'; urlList.innerHTML = ''; }
      if (addBtn) addBtn.style.display = 'none';
    });



    localStorage.removeItem(STORAGE_KEY);
    showToast('All configurations reset', 'warning');
    updateActiveCount();
  };

  // ─── Keyboard Shortcuts ───────────────────────
  document.addEventListener('keydown', (e) => {
    // Escape to close admin panel
    if (e.key === 'Escape' && adminPanel.classList.contains('open')) {
      closeAdmin();
    }
    // Ctrl+Shift+A to open admin
    if (e.ctrlKey && e.shiftKey && e.key === 'A') {
      e.preventDefault();
      openAdmin();
    }

    // Ctrl+Shift+R for global refresh
    if (e.ctrlKey && e.shiftKey && e.key === 'R') {
      e.preventDefault();
      globalRefreshBtn.click();
    }
  });

  // ─── Lazy Loading with IntersectionObserver ───
  function setupLazyLoading() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const slot = entry.target;
        const iframe = slot.querySelector('iframe');
        if (!iframe) return;

        if (entry.isIntersecting) {
          // Iframe is visible, ensure it has src
          const slotId = slot.dataset.slot;
          if (slotId && state.slots[slotId]?.url && !iframe.src) {
            iframe.src = state.slots[slotId].url;
          }
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.monitor-slot').forEach(slot => {
      observer.observe(slot);
    });
  }

  // ─── Security: Secret Token ──────────────────────────
  // Hides sensitive admin controls unless a specific URL token is provided
  function checkSecretToken() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const SECRET_TOKEN = 'Rahas1A'; // Hardcoded secret token

    // These elements should be display:none by CSS
    if (token === SECRET_TOKEN) {
      if (openAdminBtn) openAdminBtn.style.display = 'inline-flex';

    } else {
      console.log('Admin controls hidden. Use ?token=SECRET to unlock.');
      closeAdmin(); // Ensure panel closes if token is absent
    }
  }

  // ─── Initialization ───────────────────────────
  function init() {
    checkSecretToken();
    injectZoomControls();
    setupScrollZoom();
    loadConfig();
    applyLoadedConfig();
    setupLazyLoading();

    // Add smooth opacity transition to slot-content
    document.querySelectorAll('.slot-content').forEach(el => {
      el.style.transition = 'opacity 0.5s ease';
    });

    // Auto-detect proxy URL hint
    const proxyHint = document.getElementById('proxyUrlHint');
    if (proxyHint) {
      const host = window.location.hostname;
      proxyHint.textContent = `http://${host}:3001/proxy?url=TARGET_URL`;
    }

    console.log('%c🖥️ Command Center initialized', 'color: #38bdf8; font-weight: bold; font-size: 14px');
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
