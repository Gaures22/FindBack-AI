/**
 * FindBack AI - Complete Frontend Application Logic
 * ----------------------------------------------------
 * Handles SPA tab routing, JWT authentication, item reporting,
 * filtering/search, AI matching interaction, claim verifications,
 * and admin dashboard controls.
 */

const API_BASE = (window.location.protocol.startsWith('http') && window.location.port === '3000')
  ? '/api'
  : 'http://localhost:3000/api';

// Global State
let currentUser = null;
let authToken = localStorage.getItem('findback_token') || null;
let allItems = [];
let filteredItems = [];
let currentAdminSubtab = 'reports';

// Initialize App on DOM Load
document.addEventListener('DOMContentLoaded', () => {
  checkStoredAuth();
  loadStats();
  loadItems();
  
  // Set default datetime inputs to current time
  const nowStr = new Date().toISOString().slice(0, 16);
  const lostDate = document.getElementById('lost-date');
  const foundDate = document.getElementById('found-date');
  if (lostDate) lostDate.value = nowStr;
  if (foundDate) foundDate.value = nowStr;
});

// ----------------------------------------------------
// SPA TAB NAVIGATION
// ----------------------------------------------------

function switchTab(tabName) {
  // Update nav buttons
  const navButtons = document.querySelectorAll('.nav-link');
  navButtons.forEach(btn => {
    if (btn.getAttribute('data-tab') === tabName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update tab views
  const views = document.querySelectorAll('.tab-view');
  views.forEach(view => {
    if (view.id === `tab-${tabName}`) {
      view.classList.add('active');
    } else {
      view.classList.remove('active');
    }
  });

  // Tab specific data loads
  if (tabName === 'browse') {
    loadItems();
  } else if (tabName === 'matches') {
    populateUserItemSelector();
  } else if (tabName === 'claims') {
    loadClaims();
  } else if (tabName === 'admin') {
    loadAdminData();
  } else if (tabName === 'home') {
    loadStats();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ----------------------------------------------------
// TOAST NOTIFICATIONS & MODALS
// ----------------------------------------------------

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconClass = type === 'success' ? 'fa-circle-check' :
                    type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info';

  toast.innerHTML = `
    <i class="fa-solid ${iconClass}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

// Close modal when clicking dark backdrop
window.onclick = function(event) {
  if (event.target.classList.contains('modal')) {
    event.target.classList.remove('active');
  }
};

// ----------------------------------------------------
// AUTHENTICATION SYSTEM
// ----------------------------------------------------

function checkStoredAuth() {
  const storedUser = localStorage.getItem('findback_user');
  if (authToken && storedUser) {
    try {
      currentUser = JSON.parse(storedUser);
      updateAuthUI();
    } catch (e) {
      handleLogout();
    }
  }
}

function updateAuthUI() {
  const navAuth = document.getElementById('nav-auth');
  const btnLoginModal = document.getElementById('btn-login-modal');
  const userBadge = document.getElementById('user-profile-badge');
  const userNameDisplay = document.getElementById('user-name-display');
  const userAvatar = document.getElementById('user-avatar');

  const authElements = document.querySelectorAll('.auth-required');
  const adminElements = document.querySelectorAll('.admin-only');

  if (currentUser) {
    btnLoginModal.style.display = 'none';
    userBadge.style.display = 'flex';
    userNameDisplay.textContent = currentUser.name;
    userAvatar.textContent = currentUser.name.charAt(0).toUpperCase();

    authElements.forEach(el => el.style.display = 'inline-flex');

    if (currentUser.role === 'admin') {
      adminElements.forEach(el => el.style.display = 'inline-flex');
    } else {
      adminElements.forEach(el => el.style.display = 'none');
    }
  } else {
    btnLoginModal.style.display = 'inline-flex';
    userBadge.style.display = 'none';
    authElements.forEach(el => el.style.display = 'none');
    adminElements.forEach(el => el.style.display = 'none');
  }
}

function toggleAuthMode(mode) {
  const btnLogin = document.getElementById('btn-show-login');
  const btnReg = document.getElementById('btn-show-register');
  const formLogin = document.getElementById('form-login');
  const formReg = document.getElementById('form-register');

  if (mode === 'login') {
    btnLogin.classList.add('active');
    btnReg.classList.remove('active');
    formLogin.style.display = 'block';
    formReg.style.display = 'none';
  } else {
    btnReg.classList.add('active');
    btnLogin.classList.remove('active');
    formReg.style.display = 'block';
    formLogin.style.display = 'none';
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');

    authToken = data.token;
    currentUser = data.user;

    localStorage.setItem('findback_token', authToken);
    localStorage.setItem('findback_user', JSON.stringify(currentUser));

    updateAuthUI();
    closeModal('auth-modal');
    showToast(`Welcome back, ${currentUser.name}!`, 'success');
  } catch (err) {
    if (err.name === 'TypeError' || err.message.includes('fetch')) {
      showToast('Cannot connect to server. Please run "node server.js" in terminal.', 'error');
    } else {
      showToast(err.message, 'error');
    }
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const role = document.getElementById('reg-role').value;

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');

    authToken = data.token;
    currentUser = data.user;

    localStorage.setItem('findback_token', authToken);
    localStorage.setItem('findback_user', JSON.stringify(currentUser));

    updateAuthUI();
    closeModal('auth-modal');
    showToast('Account created successfully!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function quickLogin(email, password) {
  document.getElementById('login-email').value = email;
  document.getElementById('login-password').value = password;
  document.getElementById('form-login').dispatchEvent(new Event('submit'));
}

function handleLogout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('findback_token');
  localStorage.removeItem('findback_user');
  updateAuthUI();
  switchTab('home');
  showToast('Logged out successfully.', 'info');
}

// ----------------------------------------------------
// STATS & ITEMS BROWSER
// ----------------------------------------------------

async function loadStats() {
  try {
    const res = await fetch(`${API_BASE}/items`);
    const data = await res.json();
    if (res.ok && data.items) {
      const items = data.items;
      document.getElementById('stat-total').textContent = items.length;
      document.getElementById('stat-lost').textContent = items.filter(i => i.type === 'lost' && i.status === 'active').length;
      document.getElementById('stat-found').textContent = items.filter(i => i.type === 'found' && i.status === 'active').length;
      document.getElementById('stat-resolved').textContent = items.filter(i => i.status === 'resolved').length;
    }
  } catch (err) {
    console.log('Stats error:', err);
  }
}

async function loadItems() {
  const grid = document.getElementById('items-grid');
  grid.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Fetching campus reports...</p>
    </div>
  `;

  try {
    const res = await fetch(`${API_BASE}/items`);
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Failed to fetch items');

    allItems = data.items || [];
    filteredItems = [...allItems];
    renderItemCards(filteredItems);
  } catch (err) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i class="fa-solid fa-triangle-exclamation text-danger"></i></div>
        <h3>Failed to load items</h3>
        <p>${err.message}</p>
        <button class="btn btn-primary" onclick="loadItems()" style="margin-top: 1rem;">Retry</button>
      </div>
    `;
  }
}

function applyFilters() {
  const search = document.getElementById('filter-search').value.toLowerCase().trim();
  const type = document.getElementById('filter-type').value;
  const category = document.getElementById('filter-category').value;
  const status = document.getElementById('filter-status').value;
  const colour = document.getElementById('filter-colour').value.toLowerCase().trim();
  const location = document.getElementById('filter-location').value.toLowerCase().trim();

  filteredItems = allItems.filter(item => {
    if (type && item.type !== type) return false;
    if (category && item.category !== category) return false;
    if (status && item.status !== status) return false;
    if (colour && (!item.colour || !item.colour.toLowerCase().includes(colour))) return false;
    if (location && (!item.location || !item.location.toLowerCase().includes(location))) return false;
    
    if (search) {
      const titleMatch = item.title && item.title.toLowerCase().includes(search);
      const descMatch = item.description && item.description.toLowerCase().includes(search);
      const locMatch = item.location && item.location.toLowerCase().includes(search);
      if (!titleMatch && !descMatch && !locMatch) return false;
    }

    return true;
  });

  renderItemCards(filteredItems);
}

function resetFilters() {
  document.getElementById('filter-search').value = '';
  document.getElementById('filter-type').value = '';
  document.getElementById('filter-category').value = '';
  document.getElementById('filter-status').value = '';
  document.getElementById('filter-colour').value = '';
  document.getElementById('filter-location').value = '';
  filteredItems = [...allItems];
  renderItemCards(filteredItems);
}

function renderItemCards(items) {
  const grid = document.getElementById('items-grid');

  if (items.length === 0) {
    grid.innerHTML = `
      <div class="empty-state span-2" style="grid-column: 1 / -1;">
        <div class="empty-icon"><i class="fa-solid fa-box-open"></i></div>
        <h3>No Items Found</h3>
        <p>No reports match your current search or filter criteria.</p>
        <button class="btn btn-light" onclick="resetFilters()" style="margin-top: 1rem;">Clear All Filters</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = items.map(item => {
    const formattedDate = new Date(item.date_time).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const statusClass = item.status === 'active' ? 'active' :
                        item.status === 'claimed' ? 'claimed' : 'resolved';
    const statusText = item.status === 'active' ? 'Active' :
                       item.status === 'claimed' ? 'Under Verification' : 'Recovered';

    return `
      <div class="item-card">
        <div class="item-card-image">
          <span class="badge-type ${item.type}">${item.type.toUpperCase()}</span>
          <span class="badge-status ${statusClass}">${statusText}</span>
          ${item.image_url ? 
            `<img src="${item.image_url}" alt="${item.title}" onerror="this.onerror=null; this.parentNode.innerHTML='<div class=no-image-placeholder><i class=\\'fa-solid fa-image\\'></i><span>No Image Uploaded</span></div>';">` : 
            `<div class="no-image-placeholder"><i class="fa-solid fa-image"></i><span>No Image Uploaded</span></div>`
          }
        </div>
        <div class="item-card-body">
          <h3 class="item-card-title">${escapeHTML(item.title)}</h3>
          <div class="item-tags">
            <span class="tag"><i class="fa-solid fa-folder"></i> ${escapeHTML(item.category)}</span>
            ${item.colour ? `<span class="tag"><i class="fa-solid fa-palette"></i> ${escapeHTML(item.colour)}</span>` : ''}
          </div>
          <p class="item-card-desc">${escapeHTML(item.description)}</p>
          <div class="item-card-meta">
            <span><i class="fa-solid fa-location-dot"></i> ${escapeHTML(item.location)}</span>
            <span><i class="fa-solid fa-clock"></i> ${formattedDate}</span>
          </div>
          <div class="item-card-actions">
            <button class="btn btn-light btn-sm btn-block" onclick="openItemDetails(${item.id})">
              <i class="fa-solid fa-eye"></i> Details
            </button>
            ${item.status === 'active' ? `
              <button class="btn btn-purple btn-sm btn-block" onclick="triggerAIMatchForItem(${item.id})">
                <i class="fa-solid fa-bolt"></i> AI Match
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function openItemDetails(id) {
  const item = allItems.find(i => i.id === id);
  if (!item) return;

  const formattedDate = new Date(item.date_time).toLocaleString('en-US', {
    dateStyle: 'full', timeStyle: 'short'
  });

  const body = document.getElementById('item-details-body');
  body.innerHTML = `
    <div style="text-align: center; margin-bottom: 1.5rem;">
      <span class="badge-type ${item.type}" style="position: static; display: inline-block; margin-bottom: 0.5rem;">${item.type.toUpperCase()} ITEM</span>
      <h2>${escapeHTML(item.title)}</h2>
      <p class="text-muted"><i class="fa-solid fa-folder"></i> ${escapeHTML(item.category)} ${item.colour ? `• <i class="fa-solid fa-palette"></i> ${escapeHTML(item.colour)}` : ''}</p>
    </div>

    ${item.image_url ? `
      <div style="max-height: 300px; overflow: hidden; border-radius: var(--radius-md); margin-bottom: 1.5rem; text-align: center; background: #000;">
        <img src="${item.image_url}" alt="${item.title}" style="max-height: 300px; width: auto; max-width: 100%;">
      </div>
    ` : ''}

    <div style="background: var(--bg-main); padding: 1.25rem; border-radius: var(--radius-md); margin-bottom: 1.5rem;">
      <h4 style="margin-bottom: 0.5rem;">Description</h4>
      <p style="color: var(--text-main); font-size: 0.95rem;">${escapeHTML(item.description)}</p>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; font-size: 0.9rem;">
      <div>
        <strong><i class="fa-solid fa-location-dot text-primary"></i> Location:</strong>
        <p>${escapeHTML(item.location)}</p>
      </div>
      <div>
        <strong><i class="fa-solid fa-calendar-day text-primary"></i> Date & Time:</strong>
        <p>${formattedDate}</p>
      </div>
      <div>
        <strong><i class="fa-solid fa-user text-primary"></i> Reported By:</strong>
        <p>${escapeHTML(item.user_name || 'Campus Student')}</p>
      </div>
      <div>
        <strong><i class="fa-solid fa-phone text-primary"></i> Contact Info:</strong>
        <p>${escapeHTML(item.contact_info || 'Available upon claim approval')}</p>
      </div>
    </div>

    <div class="modal-footer" style="padding-top: 1rem; border-top: 1px solid var(--border);">
      <button class="btn btn-purple" onclick="closeModal('item-details-modal'); triggerAIMatchForItem(${item.id});">
        <i class="fa-solid fa-bolt"></i> Run AI Match
      </button>
      <button class="btn btn-primary" onclick="closeModal('item-details-modal'); initiateClaim(${item.id});">
        <i class="fa-solid fa-shield-cat"></i> Claim / Verify Ownership
      </button>
    </div>
  `;

  openModal('item-details-modal');
}

// ----------------------------------------------------
// REPORT LOST / FOUND SUBMISSION
// ----------------------------------------------------

function previewImage(input, previewId) {
  const box = document.getElementById(previewId);
  box.innerHTML = '';

  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      box.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
    };
    reader.readAsDataURL(input.files[0]);
  }
}

async function handleReportSubmit(e, type) {
  e.preventDefault();
  if (!authToken) {
    openModal('auth-modal');
    showToast('Please log in to submit a report.', 'info');
    return;
  }

  const isLost = type === 'lost';
  const prefix = isLost ? 'lost' : 'found';

  const formData = new FormData();
  formData.append('title', document.getElementById(`${prefix}-title`).value.trim());
  formData.append('category', document.getElementById(`${prefix}-category`).value);
  formData.append('colour', document.getElementById(`${prefix}-colour`).value.trim());
  formData.append('location', document.getElementById(`${prefix}-location`).value.trim());
  formData.append('date_time', document.getElementById(`${prefix}-date`).value);
  formData.append('description', document.getElementById(`${prefix}-description`).value.trim());
  formData.append('contact_info', document.getElementById(`${prefix}-contact`).value.trim());

  const fileInput = document.getElementById(`${prefix}-image`);
  if (fileInput.files[0]) {
    formData.append('image', fileInput.files[0]);
  }

  try {
    const endpoint = isLost ? `${API_BASE}/items/lost` : `${API_BASE}/items/found`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` },
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to submit report');

    showToast(`Report submitted successfully!`, 'success');
    document.getElementById(`form-report-${prefix}`).reset();
    document.getElementById(`${prefix}-preview`).innerHTML = '';

    // Switch to browse & reload
    await loadItems();
    switchTab('browse');

    // Prompt user for AI match
    if (data.item_id) {
      setTimeout(() => {
        if (confirm('Would you like to run AI matching right now for this item?')) {
          triggerAIMatchForItem(data.item_id);
        }
      }, 500);
    }

  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ----------------------------------------------------
// AI MATCH ENGINE FRONTEND
// ----------------------------------------------------

function populateUserItemSelector() {
  const select = document.getElementById('select-match-item');
  select.innerHTML = '<option value="">-- Choose one of your reported items --</option>';

  if (!currentUser) {
    select.innerHTML = '<option value="">(Please login to select your items)</option>';
    return;
  }

  const userItems = allItems.filter(i => i.user_id === currentUser.id);
  if (userItems.length === 0) {
    select.innerHTML = '<option value="">(You have no reported items yet)</option>';
    return;
  }

  userItems.forEach(i => {
    select.innerHTML += `<option value="${i.id}">[${i.type.toUpperCase()}] ${escapeHTML(i.title)} (${i.category})</option>`;
  });
}

function triggerAIMatchForItem(itemId) {
  switchTab('matches');
  setTimeout(() => {
    const select = document.getElementById('select-match-item');
    select.value = itemId;
    runAIMatching();
  }, 300);
}

async function runAIMatching() {
  const select = document.getElementById('select-match-item');
  const itemId = select.value;
  const resultsBox = document.getElementById('ai-matches-results');

  if (!itemId) {
    showToast('Please select an item from the list.', 'info');
    return;
  }

  resultsBox.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Python AI service analyzing text similarity, image histograms, and metadata signals...</p>
    </div>
  `;

  try {
    const res = await fetch(`${API_BASE}/matches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'AI Matching failed');

    const matches = data.matches || [];
    renderAIMatchesResults(data.target_item, matches);
  } catch (err) {
    resultsBox.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i class="fa-solid fa-triangle-exclamation text-danger"></i></div>
        <h3>AI Match Failed</h3>
        <p>${err.message}</p>
      </div>
    `;
  }
}

function renderAIMatchesResults(targetItem, matches) {
  const resultsBox = document.getElementById('ai-matches-results');

  if (matches.length === 0) {
    resultsBox.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i class="fa-solid fa-face-frown"></i></div>
        <h3>No Potential Matches Found</h3>
        <p>No opposite candidate reports met the AI match threshold for "${escapeHTML(targetItem.title)}".</p>
      </div>
    `;
    return;
  }

  resultsBox.innerHTML = `
    <div class="alert alert-info" style="margin-bottom: 1.5rem; background: #f3e8ff; border: 1px solid #d8b4fe; padding: 1rem; border-radius: var(--radius-md); display: flex; gap: 0.75rem; align-items: center;">
      <i class="fa-solid fa-circle-info text-purple" style="font-size: 1.5rem;"></i>
      <div>
        <strong>Target Item:</strong> ${escapeHTML(targetItem.title)} (${targetItem.type.toUpperCase()})<br>
        <small class="text-muted">Ranked potential candidate matches analyzed by FindBack AI Engine.</small>
      </div>
    </div>
  ` + matches.map(m => {
    const candidate = allItems.find(i => i.id === m.candidate_id) || {};
    const matchPct = Math.round(m.final_score * 100);
    const scoreColor = matchPct >= 70 ? 'var(--success)' : matchPct >= 50 ? 'var(--purple)' : 'var(--warning)';

    return `
      <div class="ai-match-card">
        <div class="match-score-radial">
          <div class="match-percentage" style="color: ${scoreColor};">${matchPct}%</div>
          <span class="match-label" style="color: ${scoreColor};">${m.is_potential_match ? 'Potential Match' : 'Low Similarity'}</span>
        </div>

        <div>
          <span class="badge-type ${candidate.type}" style="position: static; display: inline-block; margin-bottom: 0.4rem;">${(candidate.type || 'item').toUpperCase()}</span>
          <h3 style="font-size: 1.15rem; font-weight: 700;">${escapeHTML(candidate.title || 'Reported Item')}</h3>
          <p class="text-muted" style="font-size: 0.85rem;"><i class="fa-solid fa-location-dot"></i> ${escapeHTML(candidate.location || '')}</p>

          <ul class="ai-reasons-list">
            ${m.reasons.map(r => `<li><i class="fa-solid fa-circle-check"></i> ${escapeHTML(r)}</li>`).join('')}
          </ul>

          <div class="score-breakdown">
            <span>Text Sim: <strong>${Math.round(m.text_score * 100)}%</strong></span>
            <span>Image Sim: <strong>${Math.round(m.image_score * 100)}%</strong></span>
            <span>Metadata: <strong>${Math.round(m.metadata_score * 100)}%</strong></span>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          <button class="btn btn-primary btn-sm" onclick="openItemDetails(${candidate.id})">
            <i class="fa-solid fa-eye"></i> View Item
          </button>
          <button class="btn btn-purple btn-sm" onclick="initiateClaim(${candidate.id}, ${targetItem.id})">
            <i class="fa-solid fa-shield-cat"></i> Verify & Claim
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ----------------------------------------------------
// CLAIMS & VERIFICATION WORKFLOW
// ----------------------------------------------------

function initiateClaim(itemId, matchId = null) {
  if (!authToken) {
    openModal('auth-modal');
    showToast('Please log in to submit an ownership claim.', 'info');
    return;
  }

  document.getElementById('claim-item-id').value = itemId;
  document.getElementById('claim-match-id').value = matchId || '';
  document.getElementById('claim-details').value = '';
  openModal('claim-modal');
}

async function handleClaimSubmit(e) {
  e.preventDefault();
  const itemId = document.getElementById('claim-item-id').value;
  const matchId = document.getElementById('claim-match-id').value;
  const details = document.getElementById('claim-details').value.trim();

  try {
    const res = await fetch(`${API_BASE}/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        item_id: itemId,
        match_id: matchId || null,
        verification_details: details
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Claim submission failed');

    closeModal('claim-modal');
    showToast('Verification claim submitted successfully!', 'success');
    switchTab('claims');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadClaims() {
  const container = document.getElementById('claims-list-container');
  if (!authToken) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i class="fa-solid fa-lock text-muted"></i></div>
        <h3>Login Required</h3>
        <p>Please log in to view your submitted or received ownership claims.</p>
        <button class="btn btn-primary" onclick="openModal('auth-modal')" style="margin-top: 1rem;">Log In</button>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading active claims...</p>
    </div>
  `;

  try {
    const res = await fetch(`${API_BASE}/claims`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch claims');

    const claims = data.claims || [];
    if (claims.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fa-solid fa-shield-halved"></i></div>
          <h3>No Active Claims Found</h3>
          <p>You have not submitted or received any item claims yet.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="table-responsive">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Claim ID</th>
              <th>Item Title</th>
              <th>Claimant</th>
              <th>Verification Proof Details</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${claims.map(c => `
              <tr>
                <td>#CLM-${c.id}</td>
                <td><strong>${escapeHTML(c.item_title)}</strong></td>
                <td>${escapeHTML(c.claimant_name)}<br><small class="text-muted">${escapeHTML(c.claimant_email)}</small></td>
                <td style="max-width: 250px;">${escapeHTML(c.verification_details)}</td>
                <td>
                  <span class="badge-status ${c.status === 'pending' ? 'claimed' : c.status === 'approved' ? 'active' : 'resolved'}" style="position: static;">
                    ${c.status.toUpperCase()}
                  </span>
                </td>
                <td>
                  ${c.status === 'pending' ? `
                    <button class="btn btn-success btn-sm" onclick="updateClaimStatus(${c.id}, 'approved')">Approve</button>
                    <button class="btn btn-danger btn-sm" onclick="updateClaimStatus(${c.id}, 'rejected')">Reject</button>
                  ` : `<span class="text-muted">Finalized</span>`}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`;
  }
}

async function updateClaimStatus(claimId, status) {
  try {
    const res = await fetch(`${API_BASE}/claims/${claimId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ status })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update claim');

    showToast(`Claim updated to ${status}.`, 'success');
    loadClaims();
    loadItems();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ----------------------------------------------------
// ADMIN DASHBOARD
// ----------------------------------------------------

async function loadAdminData() {
  if (!currentUser || currentUser.role !== 'admin') {
    showToast('Admin privilege required.', 'error');
    switchTab('home');
    return;
  }

  try {
    const statsRes = await fetch(`${API_BASE}/admin/stats`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const stats = await statsRes.json();
    if (statsRes.ok) {
      document.getElementById('adm-users').textContent = stats.users;
      document.getElementById('adm-items').textContent = stats.total_items;
      document.getElementById('adm-pending-claims').textContent = stats.pending_claims;
      document.getElementById('adm-resolved').textContent = stats.resolved_items;
    }

    switchAdminSubtab(currentAdminSubtab);
  } catch (err) {
    console.error('Admin load error:', err);
  }
}

function switchAdminSubtab(subtab) {
  currentAdminSubtab = subtab;
  const btns = document.querySelectorAll('.admin-subtabs .btn');
  btns.forEach(b => b.classList.remove('active'));
  event && event.target && event.target.classList.add('active');

  const container = document.getElementById('admin-subcontent');

  if (subtab === 'reports') {
    container.innerHTML = `
      <div class="table-responsive">
        <table class="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Type</th>
              <th>Title</th>
              <th>Category</th>
              <th>Location</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${allItems.map(item => `
              <tr>
                <td>#${item.id}</td>
                <td><span class="badge-type ${item.type}" style="position: static;">${item.type.toUpperCase()}</span></td>
                <td><strong>${escapeHTML(item.title)}</strong></td>
                <td>${escapeHTML(item.category)}</td>
                <td>${escapeHTML(item.location)}</td>
                <td><span class="badge-status ${item.status}" style="position: static;">${item.status}</span></td>
                <td>
                  <button class="btn btn-light btn-sm" onclick="changeItemStatusAdmin(${item.id}, 'resolved')">Resolve</button>
                  <button class="btn btn-danger btn-sm" onclick="changeItemStatusAdmin(${item.id}, 'closed')">Close</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else if (subtab === 'claims') {
    loadClaims();
  } else if (subtab === 'users') {
    loadAdminUsers();
  }
}

async function loadAdminUsers() {
  const container = document.getElementById('admin-subcontent');
  try {
    const res = await fetch(`${API_BASE}/admin/users`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    container.innerHTML = `
      <div class="table-responsive">
        <table class="admin-table">
          <thead>
            <tr>
              <th>User ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Joined Date</th>
            </tr>
          </thead>
          <tbody>
            ${data.users.map(u => `
              <tr>
                <td>#USR-${u.id}</td>
                <td><strong>${escapeHTML(u.name)}</strong></td>
                <td>${escapeHTML(u.email)}</td>
                <td><span class="tag">${u.role.toUpperCase()}</span></td>
                <td>${new Date(u.created_at).toLocaleDateString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`;
  }
}

async function changeItemStatusAdmin(itemId, status) {
  try {
    const res = await fetch(`${API_BASE}/items/${itemId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      showToast(`Item #${itemId} status updated to ${status}.`, 'success');
      await loadItems();
      switchAdminSubtab('reports');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Utility: Escape HTML strings to prevent XSS
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
