'use strict';

/**
 * track.js — Shipment tracking page logic
 */

let currentTrackingNumber = null;

// ── On page load: check if ?tn= query param present ───────────────
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const tn     = params.get('tn');
  if (tn) {
    document.getElementById('tracking-input').value = tn;
    trackShipment();
  }
});

// ── State management ──────────────────────────────────────────────
function setState(name) {
  ['initial','loading','notfound','error','result'].forEach(s => {
    const el = document.getElementById(`state-${s}`);
    if (el) el.classList.toggle('hidden', s !== name);
  });
}

// ── Main track function ───────────────────────────────────────────
async function trackShipment() {
  const input = document.getElementById('tracking-input');
  const errEl = document.getElementById('search-error');
  const val   = input.value.trim().toUpperCase();

  errEl.style.display = 'none';
  errEl.textContent   = '';

  if (!val) {
    errEl.textContent   = 'Please enter a tracking number.';
    errEl.style.display = 'block';
    input.focus();
    return;
  }

  currentTrackingNumber = val;

  // Update URL without reload
  const url = new URL(window.location);
  url.searchParams.set('tn', val);
  window.history.replaceState({}, '', url);

  setState('loading');

  try {
    const res  = await fetch(`/api/track/${encodeURIComponent(val)}`);
    const data = await res.json();

    if (!res.ok || !data.success) {
      if (res.status === 404) {
        document.getElementById('notfound-msg').textContent =
          data.error || `No shipment found with tracking number "${val}".`;
        setState('notfound');
      } else {
        setState('error');
      }
      return;
    }

    renderResult(data);
    setState('result');

  } catch (err) {
    console.error('Track error:', err);
    setState('error');
  }
}

// ── Render result ──────────────────────────────────────────────────
function renderResult({ shipment, history }) {
  // Header
  document.getElementById('res-tn').textContent    = `Tracking Number: ${shipment.tracking_number}`;
  document.getElementById('res-status').textContent = shipment.current_status;
  document.getElementById('res-badge').innerHTML    = CTS.makeBadge(shipment.current_status);

  // Details
  document.getElementById('res-type').textContent     = shipment.courier_type || '—';
  document.getElementById('res-weight').textContent   = shipment.weight_kg ? `${shipment.weight_kg} kg` : '—';
  document.getElementById('res-booked').textContent   = CTS.formatDateTime(shipment.booking_date);
  document.getElementById('res-expected').textContent = CTS.formatDate(shipment.expected_delivery);

  // Sender / Receiver
  document.getElementById('res-sender-name').textContent   = shipment.sender?.name    || '—';
  document.getElementById('res-sender-addr').textContent   = shipment.sender?.address || '—';
  document.getElementById('res-receiver-name').textContent = shipment.receiver?.name    || '—';
  document.getElementById('res-receiver-addr').textContent = shipment.receiver?.address || '—';

  // Timeline
  const tlEl = document.getElementById('res-timeline');
  if (!history || history.length === 0) {
    tlEl.innerHTML = '<p style="color:var(--clr-muted);font-size:var(--fs-sm);">No tracking history available.</p>';
    return;
  }

  // Render newest first visually but keep oldest at top of DOM
  tlEl.innerHTML = history.map((h, i) => {
    const dotClass = CTS.TIMELINE_DOT_CLASS[h.status] || 'timeline-dot-booked';
    const icon     = CTS.STATUS_ICON[h.status] || '📦';
    const isLatest = i === history.length - 1;
    return `
      <div class="timeline-item">
        <div class="timeline-dot ${dotClass}" title="${h.status}">
          ${icon}
        </div>
        <div class="timeline-content">
          <div class="timeline-status">${h.status}${isLatest ? ' <span style="font-size:.7em;color:var(--clr-primary-dk);font-weight:700;">● CURRENT</span>' : ''}</div>
          ${h.location ? `<div class="timeline-location">📍 ${h.location}</div>` : ''}
          ${h.remarks  ? `<div class="timeline-remarks">${h.remarks}</div>` : ''}
          <div class="timeline-meta">${CTS.formatDateTime(h.updated_at)}</div>
        </div>
      </div>`;
  }).join('');
}

// ── Keyboard support ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('tracking-input');
  if (input) {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') trackShipment();
    });
  }
});
