/* ============================================================
   LOGO REVIEW APP
   Windows 95/XP style — Vanilla JS, no framework
   ============================================================ */

'use strict';

// ============================================================
// STATE
// ============================================================

const STATE = {
  logos: [],          // from logos.json
  project: '',
  boardLogos: [],     // { id, x, y, scale, starred, instanceId, color }
  shortlist: [],      // array of logo ids
  pendingColor: null, // currently highlighted swatch color
  boardBg: '#ffffff',
  instanceCounter: 0,
  activeTool: 'select', // 'select' | 'text' | 'spray'
  toolSize: 1,          // 0=small 1=medium 2=large
  textBoxes: [],        // { instanceId, x, y, text, color, fontSize }
};

const BOARD_BG_CYCLE = [
  { color: '#ffffff', label: 'White' },
  { color: '#808080', label: 'Gray' },
  { color: '#000000', label: 'Black' },
];
let boardBgIndex = 0;

const BASE_SIZE = 120; // px — base logo width for scale=1.0

// ============================================================
// DOM REFS
// ============================================================

const $ = id => document.getElementById(id);
const whiteboard   = $('whiteboard');
const tray         = $('tray');
const shortlistEl  = $('shortlist-items');
const shortlistCnt = $('shortlist-count');
const projectName  = $('project-name');
const searchInput  = $('search-input');
const statusText   = $('status-text');
const statusCount  = $('status-count');
const statusBgInd  = $('status-bg-indicator');
const btnClear     = $('btn-clear-board');
const btnBgToggle  = $('btn-bg-toggle');
const btnCopyLink  = $('btn-copy-link');
const btnSearch    = $('btn-search');
const toast        = $('toast');

// ============================================================
// UTILITY
// ============================================================

function uid() {
  return 'i' + (++STATE.instanceCounter) + '_' + Math.random().toString(36).slice(2, 7);
}

function hexToHsl(hex) {
  hex = hex.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function getLogoById(id) {
  return STATE.logos.find(l => l.id === id);
}

function getInstanceById(instanceId) {
  return STATE.boardLogos.find(b => b.instanceId === instanceId);
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 2000);
}

function updateStatus(msg) {
  statusText.textContent = msg;
}

function updateStatusCount() {
  const count = STATE.boardLogos.length;
  statusCount.textContent = count === 0 ? '' : `${count} on board`;
}

// ============================================================
// TINT HELPER
// ============================================================

// screen blend: black marks take on the color, white areas stay white.
function applyTintToElement(img, overlay, color) {
  if (!color) {
    img.style.filter = 'none';
    if (overlay) { overlay.style.backgroundColor = ''; overlay.style.opacity = '0'; }
  } else if (color === '#000000') {
    img.style.filter = 'none';
    if (overlay) overlay.style.opacity = '0';
  } else if (color === '#ffffff') {
    img.style.filter = 'invert(1)';
    if (overlay) overlay.style.opacity = '0';
  } else {
    img.style.filter = 'none';
    if (overlay) { overlay.style.backgroundColor = color; overlay.style.opacity = '1'; }
  }
}

// Approximation filter for shortlist thumbnails (no overlay available).
function tintFilterForShortlist(color) {
  if (!color || color === '#000000') return 'none';
  if (color === '#ffffff') return 'invert(1)';
  const { h } = hexToHsl(color);
  return `sepia(1) saturate(5) hue-rotate(${h - 35}deg)`;
}

// Returns the color of a logo's most relevant board instance.
function getLogoColor(id) {
  const inst = STATE.boardLogos.find(b => b.id === id && b.starred)
             || STATE.boardLogos.find(b => b.id === id);
  return inst ? (inst.color || null) : null;
}

// ============================================================
// TRAY RENDERING
// ============================================================

function renderTray() {
  tray.innerHTML = '';
  STATE.logos.forEach(logo => {
    const onBoard = STATE.boardLogos.some(b => b.id === logo.id);
    const card = document.createElement('div');
    card.className = 'tray-card' + (onBoard ? ' on-board' : '');
    card.dataset.id = logo.id;
    card.draggable = true;

    const imgWrap = document.createElement('div');
    imgWrap.className = 'tray-card-img-wrap';

    const img = document.createElement('img');
    img.src = logo.file;
    img.alt = logo.label;
    img.draggable = false;

    imgWrap.appendChild(img);

    const label = document.createElement('div');
    label.className = 'tray-card-label';
    label.textContent = '#' + logo.id;

    card.appendChild(imgWrap);
    card.appendChild(label);
    tray.appendChild(card);

    // Drag start
    card.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', logo.id);
      e.dataTransfer.effectAllowed = 'copy';
      card.classList.add('drag-source');
      // Custom drag image
      const ghost = document.createElement('div');
      ghost.style.cssText = 'position:fixed;top:-200px;left:-200px;width:64px;height:44px;background:#fff;border:1px dashed #000080;display:flex;align-items:center;justify-content:center;';
      const ghostImg = document.createElement('img');
      ghostImg.src = logo.file;
      ghostImg.style.cssText = 'max-width:60px;max-height:40px;object-fit:contain;';
      ghost.appendChild(ghostImg);
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 32, 22);
      setTimeout(() => document.body.removeChild(ghost), 0);
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('drag-source');
    });
  });

}

function updateTrayDimState() {
  document.querySelectorAll('.tray-card').forEach(card => {
    const id = card.dataset.id;
    const onBoard = STATE.boardLogos.some(b => b.id === id);
    card.classList.toggle('on-board', onBoard);
  });
}

// ============================================================
// WHITEBOARD DRAG/DROP (from tray)
// ============================================================

whiteboard.addEventListener('dragover', e => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  whiteboard.classList.add('drag-over');
});

whiteboard.addEventListener('dragleave', e => {
  if (!whiteboard.contains(e.relatedTarget)) {
    whiteboard.classList.remove('drag-over');
  }
});

whiteboard.addEventListener('drop', e => {
  e.preventDefault();
  whiteboard.classList.remove('drag-over');
  const id = e.dataTransfer.getData('text/plain');
  if (!id) return;

  const logo = getLogoById(id);
  if (!logo) return;

  const rect = whiteboard.getBoundingClientRect();
  const x = e.clientX - rect.left - BASE_SIZE / 2;
  const y = e.clientY - rect.top - 40;

  addBoardLogo(id, Math.max(0, x), Math.max(0, y), 1.0);
});

// ============================================================
// BOARD LOGO MANAGEMENT
// ============================================================

function addBoardLogo(id, x, y, scale) {
  const instanceId = uid();
  const entry = { id, x, y, scale, starred: false, instanceId, color: null };
  STATE.boardLogos.push(entry);
  renderBoardLogo(entry);
  updateTrayDimState();
  updateStatusCount();
  renderShortlist();
  updateStatus(`Added logo #${id} to board`);
  return instanceId;
}

function removeBoardLogo(instanceId) {
  const idx = STATE.boardLogos.findIndex(b => b.instanceId === instanceId);
  if (idx === -1) return;
  const entry = STATE.boardLogos[idx];
  STATE.boardLogos.splice(idx, 1);
  const el = whiteboard.querySelector(`[data-instance-id="${instanceId}"]`);
  if (el) el.remove();
  updateTrayDimState();
  updateStatusCount();
  renderShortlist();
  updateStatus(`Removed logo #${entry.id} from board`);
}

function renderBoardLogo(entry) {
  const logo = getLogoById(entry.id);
  if (!logo) return;

  const el = document.createElement('div');
  el.className = 'board-logo';
  el.dataset.instanceId = entry.instanceId;
  el.dataset.id = entry.id;

  const w = BASE_SIZE * entry.scale;

  el.style.left = entry.x + 'px';
  el.style.top = entry.y + 'px';
  el.style.width = w + 'px';

  // Controls row (star + delete)
  const controls = document.createElement('div');
  controls.className = 'board-logo-controls';

  const starBtn = document.createElement('button');
  starBtn.className = 'board-ctrl-btn star-btn' + (entry.starred ? ' starred' : '');
  starBtn.title = 'Toggle shortlist';
  starBtn.textContent = '★';
  starBtn.addEventListener('mousedown', e => { e.stopPropagation(); });
  starBtn.addEventListener('click', e => {
    e.stopPropagation();
    toggleStar(entry.instanceId);
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'board-ctrl-btn delete-btn';
  deleteBtn.title = 'Remove from board';
  deleteBtn.textContent = '✕';
  deleteBtn.addEventListener('mousedown', e => { e.stopPropagation(); });
  deleteBtn.addEventListener('click', e => {
    e.stopPropagation();
    removeBoardLogo(entry.instanceId);
  });

  controls.appendChild(starBtn);
  controls.appendChild(deleteBtn);

  // Inner content
  const inner = document.createElement('div');
  inner.className = 'board-logo-inner bg-' + (logo.bg === 'transparent' ? 'transparent' : logo.bg);

  const img = document.createElement('img');
  img.src = logo.file;
  img.alt = logo.label;
  img.className = 'board-logo-img';
  img.draggable = false;
  img.style.width = '100%';
  img.style.display = 'block';

  const tintOverlay = document.createElement('div');
  tintOverlay.className = 'tint-overlay';

  // Dark bg warning
  const warning = document.createElement('div');
  warning.className = 'dark-bg-warning';
  warning.textContent = '⚠';
  warning.title = 'Dark background logo — color tint may not show well';
  warning.style.display = 'none';

  inner.appendChild(img);
  inner.appendChild(tintOverlay);

  // Resize handle
  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'resize-handle';
  resizeHandle.title = 'Drag to resize';
  inner.appendChild(resizeHandle);

  // Scale pill
  const scalePill = document.createElement('div');
  scalePill.className = 'scale-pill';
  scalePill.textContent = entry.scale.toFixed(1) + 'x';

  el.appendChild(controls);
  el.appendChild(warning);
  el.appendChild(inner);
  el.appendChild(scalePill);

  whiteboard.appendChild(el);

  // Apply this logo's stored color
  applyTintToElement(img, tintOverlay, entry.color);

  // Set up drag (move) on the logo element
  setupBoardLogoDrag(el, entry);
  setupResizeDrag(resizeHandle, el, entry);

  // Click to select
  el.addEventListener('mousedown', e => {
    if (e.target === resizeHandle) return;
    selectBoardLogo(entry.instanceId);
  });
}

function refreshBoardLogo(instanceId) {
  const entry = getInstanceById(instanceId);
  if (!entry) return;
  const el = whiteboard.querySelector(`[data-instance-id="${instanceId}"]`);
  if (!el) return;
  el.remove();
  renderBoardLogo(entry);
  if (STATE.selectedInstanceId === instanceId) {
    const newEl = whiteboard.querySelector(`[data-instance-id="${instanceId}"]`);
    if (newEl) newEl.classList.add('selected');
  }
}

// ============================================================
// SELECTION
// ============================================================

STATE.selectedInstanceId = null;

function selectBoardLogo(instanceId) {
  document.querySelectorAll('.board-logo.selected').forEach(el => el.classList.remove('selected'));
  STATE.selectedInstanceId = instanceId;
  const el = whiteboard.querySelector(`[data-instance-id="${instanceId}"]`);
  if (el) {
    el.classList.add('selected');
    el.style.zIndex = getMaxZ() + 1;
  }
  // Sync swatch/picker highlight to this logo's color
  const instance = getInstanceById(instanceId);
  document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
  const cp = document.getElementById('color-picker');
  if (cp) cp.classList.remove('active');
  if (instance && instance.color) {
    const sw = document.querySelector(`.swatch[data-color="${instance.color}"]`);
    if (sw) {
      sw.classList.add('active');
    } else if (cp) {
      // Color came from picker — sync picker value and mark it active
      cp.value = instance.color;
      cp.classList.add('active');
    }
    STATE.pendingColor = instance.color;
  } else {
    STATE.pendingColor = null;
  }
}

function deselectAll() {
  document.querySelectorAll('.board-logo.selected').forEach(el => el.classList.remove('selected'));
  STATE.selectedInstanceId = null;
  document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
  const cp = document.getElementById('color-picker');
  if (cp) cp.classList.remove('active');
  STATE.pendingColor = null;
}

whiteboard.addEventListener('mousedown', e => {
  if (e.target === whiteboard) deselectAll();
});

function getMaxZ() {
  let max = 1;
  document.querySelectorAll('.board-logo').forEach(el => {
    const z = parseInt(el.style.zIndex || '1', 10);
    if (z > max) max = z;
  });
  return max;
}

// ============================================================
// BOARD LOGO DRAGGING (move)
// ============================================================

function setupBoardLogoDrag(el, entry) {
  let dragging = false;
  let startX, startY, startLeft, startTop;

  el.addEventListener('mousedown', e => {
    // Don't drag when clicking buttons or resize handle
    if (e.target.classList.contains('board-ctrl-btn')) return;
    if (e.target.classList.contains('resize-handle')) return;

    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startLeft = entry.x;
    startTop = entry.y;

    document.body.classList.add('dragging');
    el.style.zIndex = getMaxZ() + 1;

    e.preventDefault();
  });

  function onMouseMove(e) {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const wbRect = whiteboard.getBoundingClientRect();
    const elW = el.offsetWidth;
    const elH = el.offsetHeight;

    let newX = startLeft + dx;
    let newY = startTop + dy;

    // Clamp to whiteboard bounds
    newX = Math.max(0, Math.min(wbRect.width - elW, newX));
    newY = Math.max(0, Math.min(wbRect.height - elH, newY));

    entry.x = newX;
    entry.y = newY;
    el.style.left = newX + 'px';
    el.style.top = newY + 'px';
  }

  function onMouseUp() {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove('dragging');
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

// ============================================================
// RESIZE HANDLE
// ============================================================

function setupResizeDrag(handle, el, entry) {
  let resizing = false;
  let startX, startScale, startW;

  handle.addEventListener('mousedown', e => {
    e.stopPropagation();
    e.preventDefault();
    resizing = true;
    startX = e.clientX;
    startScale = entry.scale;
    startW = BASE_SIZE * entry.scale;
    document.body.classList.add('dragging');
  });

  function onMouseMove(e) {
    if (!resizing) return;
    const dx = e.clientX - startX;
    const newW = Math.max(40, startW + dx);
    const newScale = newW / BASE_SIZE;
    entry.scale = parseFloat(newScale.toFixed(2));
    el.style.width = newW + 'px';
    // Update scale pill
    const pill = el.querySelector('.scale-pill');
    if (pill) pill.textContent = entry.scale.toFixed(1) + 'x';
  }

  function onMouseUp() {
    if (!resizing) return;
    resizing = false;
    document.body.classList.remove('dragging');
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

// ============================================================
// STAR / SHORTLIST
// ============================================================

function toggleStar(instanceId) {
  const entry = getInstanceById(instanceId);
  if (!entry) return;
  entry.starred = !entry.starred;

  if (entry.starred) {
    if (!STATE.shortlist.includes(entry.id)) {
      STATE.shortlist.push(entry.id);
    }
  } else {
    // Only unstar from shortlist if no other board instance is starred
    const otherStarred = STATE.boardLogos.some(b => b.id === entry.id && b.starred && b.instanceId !== instanceId);
    if (!otherStarred) {
      STATE.shortlist = STATE.shortlist.filter(id => id !== entry.id);
    }
  }

  // Update star button visual
  const el = whiteboard.querySelector(`[data-instance-id="${instanceId}"]`);
  if (el) {
    const btn = el.querySelector('.star-btn');
    if (btn) btn.classList.toggle('starred', entry.starred);
  }

  renderShortlist();
  updateStatus(entry.starred ? `Starred logo #${entry.id}` : `Unstarred logo #${entry.id}`);
}

// ============================================================
// SHORTLIST SIDEBAR
// ============================================================

function renderShortlist() {
  shortlistEl.innerHTML = '';
  shortlistCnt.textContent = '★ ' + STATE.shortlist.length;

  STATE.shortlist.forEach(id => {
    const logo = getLogoById(id);
    if (!logo) return;

    const item = document.createElement('div');
    item.className = 'shortlist-item';
    item.title = logo.label;

    const img = document.createElement('img');
    img.src = logo.file;
    img.alt = logo.label;
    img.style.filter = tintFilterForShortlist(getLogoColor(id));

    const label = document.createElement('div');
    label.className = 'shortlist-item-id';
    label.textContent = '#' + id;

    item.appendChild(img);
    item.appendChild(label);

    item.addEventListener('click', () => {
      // Find this logo on the board
      const boardInstance = STATE.boardLogos.find(b => b.id === id && b.starred);
      if (boardInstance) {
        // Flash selection on board
        selectBoardLogo(boardInstance.instanceId);
        // Scroll whiteboard to show it
        const el = whiteboard.querySelector(`[data-instance-id="${boardInstance.instanceId}"]`);
        if (el) {
          el.scrollIntoView && el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          flashElement(el);
        }
      } else {
        // Flash in tray
        const trayCard = tray.querySelector(`.tray-card[data-id="${id}"]`);
        if (trayCard) {
          trayCard.scrollIntoView({ behavior: 'smooth', inline: 'center' });
          flashTrayCard(trayCard);
        }
      }
    });

    shortlistEl.appendChild(item);
  });
}

function flashElement(el) {
  el.style.outline = '3px solid #000080';
  el.style.outlineOffset = '3px';
  setTimeout(() => {
    el.style.outline = '';
    el.style.outlineOffset = '';
  }, 800);
}

function flashTrayCard(card) {
  card.classList.add('flash-highlight');
  setTimeout(() => card.classList.remove('flash-highlight'), 800);
}

// ============================================================
// TOOLBAR: SWATCHES
// ============================================================

document.querySelectorAll('.swatch').forEach(swatch => {
  swatch.addEventListener('click', () => {
    const color = swatch.dataset.color;
    const isActive = swatch.classList.contains('active');

    document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));

    if (isActive) {
      STATE.pendingColor = null;
      if (STATE.selectedInstanceId) {
        const inst = getInstanceById(STATE.selectedInstanceId);
        if (inst) {
          inst.color = null;
          const el = whiteboard.querySelector(`[data-instance-id="${STATE.selectedInstanceId}"]`);
          if (el) applyTintToElement(el.querySelector('.board-logo-img'), el.querySelector('.tint-overlay'), null);
          renderShortlist();
          updateStatus(`Color cleared from logo #${inst.id}`);
        }
      } else {
        updateStatus('No logo selected');
      }
    } else {
      swatch.classList.add('active');
      STATE.pendingColor = color;
      if (STATE.selectedInstanceId) {
        const inst = getInstanceById(STATE.selectedInstanceId);
        if (inst) {
          inst.color = color;
          const el = whiteboard.querySelector(`[data-instance-id="${STATE.selectedInstanceId}"]`);
          if (el) applyTintToElement(el.querySelector('.board-logo-img'), el.querySelector('.tint-overlay'), color);
          renderShortlist();
          updateStatus(`Logo #${inst.id} color → ${color}`);
        }
      } else {
        updateStatus('Select a logo on the canvas to apply color');
      }
    }
  });
});

// ============================================================
// TOOLBAR: COLOR PICKER
// ============================================================

const colorPicker = document.getElementById('color-picker');

function applyCustomColor(color) {
  document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
  colorPicker.classList.add('active');
  STATE.pendingColor = color;
  if (STATE.selectedInstanceId) {
    const inst = getInstanceById(STATE.selectedInstanceId);
    if (inst) {
      inst.color = color;
      const el = whiteboard.querySelector(`[data-instance-id="${STATE.selectedInstanceId}"]`);
      if (el) applyTintToElement(el.querySelector('.board-logo-img'), el.querySelector('.tint-overlay'), color);
      renderShortlist();
      updateStatus(`Logo #${inst.id} color → ${color}`);
    }
  } else {
    updateStatus('Select a logo on the canvas to apply color');
  }
}

colorPicker.addEventListener('input', () => applyCustomColor(colorPicker.value));

// When a swatch is clicked, deactivate the color picker highlight
document.querySelectorAll('.swatch').forEach(s => {
  s.addEventListener('click', () => colorPicker.classList.remove('active'));
});

// ============================================================
// TOOLBAR: SEARCH
// ============================================================

function doSearch() {
  const val = searchInput.value.trim();
  if (!val) return;

  // Normalize: pad with leading zero if single digit
  let searchId = val;
  if (!isNaN(val) && val.length === 1) searchId = '0' + val;

  const logo = STATE.logos.find(l => l.id === searchId || l.id === val);
  if (!logo) {
    updateStatus(`Logo #${val} not found`);
    return;
  }

  const card = tray.querySelector(`.tray-card[data-id="${logo.id}"]`);
  if (card) {
    card.scrollIntoView({ behavior: 'smooth', inline: 'center' });
    // Highlight
    document.querySelectorAll('.tray-card').forEach(c => c.classList.remove('search-highlight'));
    card.classList.add('search-highlight');
    setTimeout(() => card.classList.remove('search-highlight'), 2000);
    updateStatus(`Found logo #${logo.id}: ${logo.label}`);
  }
}

btnSearch.addEventListener('click', doSearch);
searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') doSearch();
});

// ============================================================
// TOOLBAR: CLEAR BOARD
// ============================================================

btnClear.addEventListener('click', () => {
  STATE.boardLogos = [];
  STATE.shortlist = [];
  STATE.textBoxes = [];
  // Remove logos and text boxes but keep the spray canvas
  whiteboard.querySelectorAll('.board-logo, .board-textbox').forEach(el => el.remove());
  clearSprayCanvas();
  deselectAll();
  updateTrayDimState();
  updateStatusCount();
  renderShortlist();
  updateStatus('Board cleared');
});

// ============================================================
// TOOLBAR: BOARD BACKGROUND TOGGLE
// ============================================================

function updateBoardBg() {
  const bg = BOARD_BG_CYCLE[boardBgIndex];
  STATE.boardBg = bg.color;
  whiteboard.style.backgroundColor = bg.color;
  btnBgToggle.textContent = 'BG: ' + bg.label;
  statusBgInd.textContent = 'BG: ' + bg.label;
  updateStatus(`Board background: ${bg.label}`);
}

btnBgToggle.addEventListener('click', () => {
  boardBgIndex = (boardBgIndex + 1) % BOARD_BG_CYCLE.length;
  updateBoardBg();
});

// ============================================================
// SHARE LINK
// ============================================================

function serializeState() {
  const obj = {
    shortlist: STATE.shortlist,
    board: STATE.boardLogos.map(b => ({
      id: b.id,
      x: Math.round(b.x),
      y: Math.round(b.y),
      scale: b.scale,
      starred: b.starred,
      color: b.color || null,
    })),
    textBoxes: STATE.textBoxes.map(t => ({
      instanceId: t.instanceId,
      x: Math.round(t.x),
      y: Math.round(t.y),
      text: t.text,
      color: t.color,
      fontSize: t.fontSize,
    })),
    boardBg: STATE.boardBg,
  };
  return btoa(JSON.stringify(obj));
}

function deserializeState(encoded) {
  try {
    const obj = JSON.parse(atob(encoded));
    return obj;
  } catch (e) {
    console.error('Failed to parse state:', e);
    return null;
  }
}

function restoreState(obj) {
  if (!obj) return;

  // Board background
  if (obj.boardBg) {
    const idx = BOARD_BG_CYCLE.findIndex(bg => bg.color === obj.boardBg);
    boardBgIndex = idx >= 0 ? idx : 0;
    updateBoardBg();
  }

  // Shortlist
  STATE.shortlist = obj.shortlist || [];

  // Board logos (each with its own stored color)
  if (obj.board) {
    obj.board.forEach(item => {
      const instanceId = uid();
      const entry = {
        id: item.id,
        x: item.x,
        y: item.y,
        scale: item.scale || 1.0,
        starred: item.starred || false,
        instanceId,
        color: item.color || null,
      };
      STATE.boardLogos.push(entry);
      renderBoardLogo(entry);
    });
  }

  // Text boxes
  if (obj.textBoxes) {
    obj.textBoxes.forEach(t => {
      const entry = {
        instanceId: t.instanceId || uid(),
        x: t.x, y: t.y,
        text: t.text || '',
        color: t.color || '#000000',
        fontSize: t.fontSize || 28,
      };
      STATE.textBoxes.push(entry);
      renderTextBox(entry);
    });
  }

  updateTrayDimState();
  updateStatusCount();
  renderShortlist();
}

btnCopyLink.addEventListener('click', () => {
  const encoded = serializeState();
  const url = window.location.origin + window.location.pathname + '?s=' + encoded;
  navigator.clipboard.writeText(url).then(() => {
    showToast('Link copied!');
    updateStatus('Share link copied to clipboard');
  }).catch(() => {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = url;
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Link copied!');
    updateStatus('Share link copied to clipboard');
  });
});

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.target.isContentEditable) return; // Don't fire while editing text boxes

  if (e.key === 'Escape') {
    deselectAll();
    setActiveTool('select');
    updateStatus('Ready');
  }

  if ((e.key === 'Delete' || e.key === 'Backspace') && STATE.selectedInstanceId) {
    removeBoardLogo(STATE.selectedInstanceId);
    STATE.selectedInstanceId = null;
  }

  // Tool shortcuts
  if (e.key === 's' || e.key === 'S') setActiveTool('select');
  if (e.key === 't' || e.key === 'T') setActiveTool('text');
  if (e.key === 'b' || e.key === 'B') setActiveTool('brush');
  if (e.key === 'p' || e.key === 'P') setActiveTool('spray');
});

// ============================================================
// TITLEBAR BUTTONS (cosmetic)
// ============================================================

$('btn-minimize').addEventListener('click', () => updateStatus('Minimize clicked'));
$('btn-maximize').addEventListener('click', () => updateStatus('Maximize clicked'));
$('btn-close').addEventListener('click', () => updateStatus('Close clicked'));

// ============================================================
// TOOL SYSTEM
// ============================================================

function setActiveTool(tool) {
  STATE.activeTool = tool;
  document.querySelectorAll('.tpal-btn[data-tool]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tool === tool);
  });
  const sprayCanvas = $('spray-canvas');
  if (sprayCanvas) {
    const canvasTool = tool === 'spray' || tool === 'brush';
    sprayCanvas.style.pointerEvents = canvasTool ? 'auto' : 'none';
    sprayCanvas.style.zIndex = canvasTool ? '500' : '2';
  }
  // Cursor on whiteboard
  whiteboard.classList.remove('tool-text', 'tool-brush', 'tool-spray');
  if (tool !== 'select') whiteboard.classList.add('tool-' + tool);
  const labels = { select: 'Select / Move', text: 'Text  [double-click to edit]', brush: 'Paintbrush', spray: 'Spray Paint' };
  updateStatus('Tool: ' + (labels[tool] || tool));
}

document.querySelectorAll('.tpal-btn[data-tool]').forEach(btn => {
  btn.addEventListener('click', () => setActiveTool(btn.dataset.tool));
});

document.querySelectorAll('.size-opt').forEach(opt => {
  opt.addEventListener('click', () => {
    STATE.toolSize = parseInt(opt.dataset.idx);
    document.querySelectorAll('.size-opt').forEach(o => o.classList.remove('active'));
    opt.classList.add('active');
  });
});

// Text tool: click empty board area to add text box
whiteboard.addEventListener('click', e => {
  if (STATE.activeTool !== 'text') return;
  if (e.target.closest('.board-logo') || e.target.closest('.board-textbox')) return;
  const rect = whiteboard.getBoundingClientRect();
  addTextBox(e.clientX - rect.left, e.clientY - rect.top);
});

// ============================================================
// TEXT BOX SYSTEM
// ============================================================

function addTextBox(x, y) {
  const fontSizes = [14, 24, 42];
  const instanceId = uid();
  const entry = {
    instanceId, x, y,
    text: '',
    color: STATE.pendingColor || '#000000',
    fontSize: fontSizes[STATE.toolSize],
  };
  STATE.textBoxes.push(entry);
  const el = renderTextBox(entry);
  startEditTextBox(el);
}

function renderTextBox(entry) {
  const el = document.createElement('div');
  el.className = 'board-textbox';
  el.dataset.instanceId = entry.instanceId;
  el.style.left = entry.x + 'px';
  el.style.top  = entry.y + 'px';

  const controls = document.createElement('div');
  controls.className = 'textbox-controls';

  const delBtn = document.createElement('button');
  delBtn.className = 'board-ctrl-btn delete-btn';
  delBtn.title = 'Delete text';
  delBtn.textContent = '✕';
  delBtn.addEventListener('mousedown', e => e.stopPropagation());
  delBtn.addEventListener('click', e => { e.stopPropagation(); removeTextBox(entry.instanceId); });
  controls.appendChild(delBtn);

  const content = document.createElement('div');
  content.className = 'textbox-content';
  content.textContent = entry.text;
  content.style.fontSize = entry.fontSize + 'px';
  content.style.color = entry.color;
  content.contentEditable = 'false';

  content.addEventListener('blur', () => {
    entry.text = content.innerText;
    content.contentEditable = 'false';
    el.classList.remove('editing');
    if (!entry.text.trim()) removeTextBox(entry.instanceId);
  });
  content.addEventListener('keydown', e => {
    e.stopPropagation(); // prevent logo delete shortcut while typing
    if (e.key === 'Escape') content.blur();
  });

  el.appendChild(controls);
  el.appendChild(content);
  whiteboard.appendChild(el);
  setupTextBoxDrag(el, content, entry);
  return el;
}

function startEditTextBox(el) {
  const content = el.querySelector('.textbox-content');
  content.contentEditable = 'true';
  el.classList.add('editing');
  content.focus();
  const range = document.createRange();
  range.selectNodeContents(content);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

function removeTextBox(instanceId) {
  const idx = STATE.textBoxes.findIndex(t => t.instanceId === instanceId);
  if (idx !== -1) STATE.textBoxes.splice(idx, 1);
  const el = whiteboard.querySelector(`.board-textbox[data-instance-id="${instanceId}"]`);
  if (el) el.remove();
}

function setupTextBoxDrag(el, contentEl, entry) {
  let dragging = false, startX, startY, startLeft, startTop;

  el.addEventListener('mousedown', e => {
    if (el.classList.contains('editing')) return;
    if (e.target.classList.contains('board-ctrl-btn')) return;
    dragging = true;
    startX = e.clientX; startY = e.clientY;
    startLeft = entry.x; startTop = entry.y;
    document.body.classList.add('dragging');
    el.style.zIndex = getMaxZ() + 1;
    e.preventDefault();
  });

  el.addEventListener('dblclick', e => {
    if (e.target.classList.contains('board-ctrl-btn')) return;
    startEditTextBox(el);
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    entry.x = Math.max(0, startLeft + (e.clientX - startX));
    entry.y = Math.max(0, startTop  + (e.clientY - startY));
    el.style.left = entry.x + 'px';
    el.style.top  = entry.y + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove('dragging');
  });
}

// ============================================================
// SPRAY PAINT SYSTEM
// ============================================================

let sprayBuffer = null, sprayBufferCtx = null;
let isSpraying = false, sprayPos = { x: 0, y: 0 }, sprayTimer = null;

function initSpray() {
  sprayBuffer = document.createElement('canvas');
  sprayBufferCtx = sprayBuffer.getContext('2d');
  syncSprayCanvasSize();

  const sprayCanvas = $('spray-canvas');

  let lastBrushPos = null;

  sprayCanvas.addEventListener('mousedown', e => {
    isSpraying = true;
    const rect = sprayCanvas.getBoundingClientRect();
    sprayPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    lastBrushPos = { ...sprayPos };
    if (STATE.activeTool === 'brush') {
      doBrushAt(sprayPos.x, sprayPos.y);
    } else {
      doSprayAt(sprayPos.x, sprayPos.y);
      sprayTimer = setInterval(() => doSprayAt(sprayPos.x, sprayPos.y), 30);
    }
  });

  sprayCanvas.addEventListener('mousemove', e => {
    if (!isSpraying) return;
    const rect = sprayCanvas.getBoundingClientRect();
    const newPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    if (STATE.activeTool === 'brush') {
      interpolateBrush(lastBrushPos.x, lastBrushPos.y, newPos.x, newPos.y);
      lastBrushPos = newPos;
    } else {
      sprayPos = newPos;
    }
  });

  document.addEventListener('mouseup', () => {
    if (!isSpraying) return;
    isSpraying = false;
    lastBrushPos = null;
    clearInterval(sprayTimer);
    sprayTimer = null;
  });

  new ResizeObserver(() => syncSprayCanvasSize()).observe(whiteboard);
}

function syncSprayCanvasSize() {
  const canvas = $('spray-canvas');
  const w = whiteboard.offsetWidth, h = whiteboard.offsetHeight;
  if (!w || !h) return;

  // Preserve buffer content across resize
  const tmp = document.createElement('canvas');
  tmp.width = sprayBuffer.width; tmp.height = sprayBuffer.height;
  tmp.getContext('2d').drawImage(sprayBuffer, 0, 0);

  canvas.width = w; canvas.height = h;
  sprayBuffer.width = w; sprayBuffer.height = h;

  if (tmp.width && tmp.height) sprayBufferCtx.drawImage(tmp, 0, 0);
  $('spray-canvas').getContext('2d').drawImage(sprayBuffer, 0, 0);
}

function doSprayAt(x, y) {
  const radii = [10, 22, 40];
  const radius = radii[STATE.toolSize];
  const color = STATE.pendingColor || '#000000';
  sprayBufferCtx.fillStyle = color;
  for (let i = 0; i < 28; i++) {
    const angle = Math.random() * 2 * Math.PI;
    const r = Math.sqrt(Math.random()) * radius;
    sprayBufferCtx.fillRect(Math.round(x + r * Math.cos(angle)), Math.round(y + r * Math.sin(angle)), 1, 1);
  }
  const ctx = $('spray-canvas').getContext('2d');
  ctx.clearRect(0, 0, sprayBuffer.width, sprayBuffer.height);
  ctx.drawImage(sprayBuffer, 0, 0);
}

function doBrushAt(x, y) {
  const radii = [3, 7, 14];
  const radius = radii[STATE.toolSize];
  const color = STATE.pendingColor || '#000000';
  sprayBufferCtx.fillStyle = color;
  sprayBufferCtx.beginPath();
  sprayBufferCtx.arc(x, y, radius, 0, 2 * Math.PI);
  sprayBufferCtx.fill();
  const ctx = $('spray-canvas').getContext('2d');
  ctx.clearRect(0, 0, sprayBuffer.width, sprayBuffer.height);
  ctx.drawImage(sprayBuffer, 0, 0);
}

function interpolateBrush(x1, y1, x2, y2) {
  const radius = [3, 7, 14][STATE.toolSize];
  const step = Math.max(1, radius * 0.5);
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.ceil(dist / step);
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    doBrushAt(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t);
  }
}

function clearSprayCanvas() {
  if (!sprayBuffer) return;
  sprayBufferCtx.clearRect(0, 0, sprayBuffer.width, sprayBuffer.height);
  const canvas = $('spray-canvas');
  if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

$('btn-clear-spray').addEventListener('click', () => {
  clearSprayCanvas();
  updateStatus('Spray cleared');
});

// ============================================================
// INIT: LOAD LOGOS.JSON
// ============================================================

async function init() {
  updateStatus('Loading logos...');

  try {
    const res = await fetch('logos.json');
    if (!res.ok) throw new Error('Failed to fetch logos.json');
    const data = await res.json();

    STATE.logos = data.logos || [];
    STATE.project = data.project || 'Logo Review';

    // Update title bar and toolbar
    projectName.textContent = STATE.project;
    document.title = `Good Problem Studios - An Abundance of Logos - Playground Tool`;
    $('titlebar-text').textContent = `Good Problem Studios - An Abundance of Logos - Playground Tool`;

    // Render tray
    renderTray();

    // Init spray canvas
    initSpray();

    // Check URL param for restored state
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('s');
    if (encoded) {
      const obj = deserializeState(encoded);
      if (obj) {
        restoreState(obj);
        updateStatus('State restored from share link');
      } else {
        updateStatus('Ready — ' + STATE.logos.length + ' logos loaded');
      }
    } else {
      updateStatus('Ready — ' + STATE.logos.length + ' logos loaded');
    }

    updateStatusCount();

  } catch (err) {
    console.error(err);
    updateStatus('Error loading logos.json — ' + err.message);
  }
}

// ============================================================
// MENU ITEMS (cosmetic)
// ============================================================

document.querySelectorAll('.menu-item').forEach(item => {
  item.addEventListener('click', e => {
    updateStatus(item.textContent + ' menu (not implemented)');
  });
});

// ============================================================
// START
// ============================================================

init();
