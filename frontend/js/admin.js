'use strict';

/**
 * admin.js — Admin dashboard logic
 * Handles: auth guard, stats, shipment table, pagination, status update modal
 */

let currentPage      = 1;
let currentShipmentId = null;
let currentTN         = null;
let searchTimer       = null;

// ── Auth Guard ────────────────────────────────────────────────────
async function checkAuth() {
  try {
    const res  = await fetch('/api/auth/me', { credentials: 'same-origin' });
    const data = await res.json();
    if (!res.ok || !data.success) {
      window.location.href = '/login';
      return;
    }
    // Show admin name
    const nameEl   = document.getElementById('admin-name');
    const avatarEl = document.getElementById('admin-avatar');
    if (nameEl && data.admin_name)   nameEl.textContent   = data.admin_name;
    if (avatarEl && data.admin_name) avatarEl.textContent = data.admin_name.charAt(0).toUpperCase();

    // Hide auth guard, show app
    document.getElementById('auth-guard').style.display = 'none';
    document.getElementById('admin-app').style.display  = 'flex';

    // Initial data load
    loadDashboardStats();
    loadShipments(1);
  } catch (err) {
    window.location.href = '/login';
  }
}

// ── Tab navigation ────────────────────────────────────────────────
function showTab(tabName) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar__link').forEach(l => l.classList.remove('active'));

  const panel = document.getElementById(`panel-${tabName}`);
  const tab   = document.getElementById(`tab-${tabName}`);
  if (panel) panel.classList.add('active');
  if (tab)   tab.classList.add('active');

  const titles = { dashboard: 'Dashboard', shipments: 'All Shipments' };
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = titles[tabName] || 'Dashboard';
}

// ── Dashboard Stats ───────────────────────────────────────────────
async function loadDashboardStats() {
  const loadEl    = document.getElementById('stats-loading');
  const contentEl = document.getElementById('stats-content');

  try {
    const res  = await fetch('/api/dashboard/stats', { credentials: 'same-origin' });
    const data = await res.json();

    if (!res.ok || !data.success) {
      if (loadEl) loadEl.innerHTML = '<div class="alert alert-error">Failed to load statistics.</div>';
      return;
    }

    const { stats, recent_shipments } = data;

    // Stat cards
    const cardsEl = document.getElementById('stat-cards');
    if (cardsEl) {
      cardsEl.innerHTML = `
        <div class="stat-card primary">
          <div class="stat-card__icon">📦</div>
          <div class="stat-card__value">${stats.total_shipments}</div>
          <div class="stat-card__label">Total Shipments</div>
        </div>
        <div class="stat-card success">
          <div class="stat-card__icon">✅</div>
          <div class="stat-card__value">${stats.delivered}</div>
          <div class="stat-card__label">Delivered</div>
        </div>
        <div class="stat-card transit">
          <div class="stat-card__icon">✈️</div>
          <div class="stat-card__value">${stats.in_transit}</div>
          <div class="stat-card__label">In Transit</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-card__icon">🛵</div>
          <div class="stat-card__value">${stats.out_for_delivery}</div>
          <div class="stat-card__label">Out for Delivery</div>
        </div>
        <div class="stat-card primary">
          <div class="stat-card__icon">📝</div>
          <div class="stat-card__value">${stats.booked}</div>
          <div class="stat-card__label">Booked</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-card__icon">❌</div>
          <div class="stat-card__value">${stats.cancelled}</div>
          <div class="stat-card__label">Cancelled</div>
        </div>`;
    }

    // Recent shipments table
    const recentEl = document.getElementById('recent-table-body');
    if (recentEl) {
      if (!recent_shipments || recent_shipments.length === 0) {
        recentEl.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--clr-muted);padding:var(--space-8);">No shipments yet.</td></tr>';
      } else {
        recentEl.innerHTML = recent_shipments.map(s => `
          <tr>
            <td><code style="font-size:var(--fs-xs);background:var(--clr-bg);padding:2px 6px;border-radius:4px;">${s.tracking_number}</code></td>
            <td>${escHtml(s.receiver_name)}</td>
            <td>${escHtml(s.courier_type)}</td>
            <td>${CTS.makeBadge(s.current_status)}</td>
            <td style="color:var(--clr-muted);font-size:var(--fs-xs);">${CTS.formatDate(s.booking_date)}</td>
          </tr>`).join('');
      }
    }

    if (loadEl)    loadEl.style.display    = 'none';
    if (contentEl) contentEl.style.display = 'block';

  } catch (err) {
    if (loadEl) loadEl.innerHTML = '<div class="alert alert-error"><span class="alert__icon">⚠️</span> Could not load dashboard data.</div>';
  }
}

// ── Shipments table ───────────────────────────────────────────────
async function loadShipments(page = 1) {
  currentPage = page;
  const tbody   = document.getElementById('shipments-table-body');
  const loadEl  = document.getElementById('shipments-loading');
  const errEl   = document.getElementById('shipments-error');
  const pagEl   = document.getElementById('pagination-controls');

  if (loadEl)  loadEl.style.display = 'flex';
  if (errEl)   errEl.classList.add('hidden');
  if (tbody)   tbody.innerHTML = '';
  if (pagEl)   pagEl.innerHTML = '';

  const search = document.getElementById('search-input')?.value.trim() || '';
  const status = document.getElementById('status-filter')?.value       || '';

  const params = new URLSearchParams({ page, limit: 15 });
  if (search) params.set('search', search);
  if (status) params.set('status', status);

  try {
    const res  = await fetch(`/api/shipments?${params}`, { credentials: 'same-origin' });
    const data = await res.json();

    if (!res.ok || !data.success) {
      if (errEl) { errEl.textContent = data.error || 'Failed to load shipments.'; errEl.classList.remove('hidden'); }
      return;
    }

    const rows = data.data;

    if (!rows || rows.length === 0) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--clr-muted);padding:var(--space-10);">No shipments found.</td></tr>';
    } else {
      tbody.innerHTML = rows.map(s => `
        <tr>
          <td><code style="font-size:var(--fs-xs);background:var(--clr-bg);padding:2px 6px;border-radius:4px;">${escHtml(s.tracking_number)}</code></td>
          <td style="font-size:var(--fs-sm);">${escHtml(s.sender_name)}</td>
          <td style="font-size:var(--fs-sm);">${escHtml(s.receiver_name)}</td>
          <td style="font-size:var(--fs-xs);color:var(--clr-muted);">${escHtml(s.courier_type)}</td>
          <td style="font-size:var(--fs-xs);color:var(--clr-muted);">${s.weight_kg} kg</td>
          <td>${CTS.makeBadge(s.current_status)}</td>
          <td style="font-size:var(--fs-xs);color:var(--clr-muted);">${CTS.formatDate(s.booking_date)}</td>
          <td>
            <button class="btn btn-secondary btn-sm"
              onclick="openStatusModal(${s.shipment_id}, '${escHtml(s.tracking_number)}', '${escHtml(s.current_status)}')"
              ${['Delivered','Cancelled'].includes(s.current_status) ? 'disabled title="Cannot update a finalised shipment"' : ''}>
              ✏️ Update
            </button>
          </td>
        </tr>`).join('');
    }

    // Pagination
    const { pagination } = data;
    if (pagination && pagination.pages > 1) {
      let btns = '';
      btns += `<button class="page-btn" onclick="loadShipments(${page - 1})" ${page === 1 ? 'disabled' : ''}>‹</button>`;
      for (let p = 1; p <= pagination.pages; p++) {
        if (p === 1 || p === pagination.pages || Math.abs(p - page) <= 2) {
          btns += `<button class="page-btn ${p === page ? 'active' : ''}" onclick="loadShipments(${p})">${p}</button>`;
        } else if (Math.abs(p - page) === 3) {
          btns += `<span style="color:var(--clr-muted);">…</span>`;
        }
      }
      btns += `<button class="page-btn" onclick="loadShipments(${page + 1})" ${page === pagination.pages ? 'disabled' : ''}>›</button>`;
      btns += `<span style="font-size:var(--fs-xs);color:var(--clr-muted);margin-left:var(--space-2);">${pagination.total} total</span>`;
      if (pagEl) pagEl.innerHTML = btns;
    }

  } catch (err) {
    if (errEl) { errEl.textContent = 'Network error loading shipments.'; errEl.classList.remove('hidden'); }
  } finally {
    if (loadEl) loadEl.style.display = 'none';
  }
}

// ── Status update modal ───────────────────────────────────────────
function openStatusModal(shipmentId, tn, currentStatus) {
  currentShipmentId = shipmentId;
  currentTN         = tn;

  document.getElementById('modal-tn').textContent         = tn;
  document.getElementById('modal-status').value           = '';
  document.getElementById('modal-location').value         = '';
  document.getElementById('modal-remarks').value          = '';
  document.getElementById('modal-error').classList.add('hidden');

  document.getElementById('status-modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('status-modal').classList.add('hidden');
  currentShipmentId = null;
  currentTN         = null;
}

async function saveStatusUpdate() {
  const status   = document.getElementById('modal-status').value;
  const location = document.getElementById('modal-location').value.trim();
  const remarks  = document.getElementById('modal-remarks').value.trim();
  const errEl    = document.getElementById('modal-error');
  const saveBtn  = document.getElementById('modal-save-btn');

  errEl.classList.add('hidden');

  if (!status) {
    errEl.textContent = 'Please select a new status.';
    errEl.classList.remove('hidden');
    return;
  }

  saveBtn.disabled    = true;
  saveBtn.textContent = '⏳ Saving…';

  try {
    const res  = await fetch(`/api/shipments/${currentShipmentId}/status`, {
      method:      'PATCH',
      credentials: 'same-origin',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({ status, location, remarks })
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      errEl.textContent = data.error || 'Update failed.';
      errEl.classList.remove('hidden');
      return;
    }

    closeModal();
    // Refresh both stats and table
    loadDashboardStats();
    loadShipments(currentPage);

  } catch (err) {
    errEl.textContent = 'Network error. Please try again.';
    errEl.classList.remove('hidden');
  } finally {
    saveBtn.disabled    = false;
    saveBtn.textContent = 'Update Status';
  }
}

// ── Logout ────────────────────────────────────────────────────────
async function logout() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  window.location.href = '/login';
}

// ── Debounced search ──────────────────────────────────────────────
function debouncedSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadShipments(1), 400);
}

// ── Close modal on overlay click ──────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('status-modal');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }
  // ESC to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
});

// ── Utilities ─────────────────────────────────────────────────────
function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Init ──────────────────────────────────────────────────────────
checkAuth();
