'use strict';

/**
 * main.js — shared utilities loaded on every page
 */

// ── Navbar scroll effect ─────────────────────────────────────────
const navbar = document.getElementById('navbar');
if (navbar) {
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 20);
  });
}

// ── Topbar clock (admin page) ─────────────────────────────────────
function startClock() {
  const el = document.getElementById('topbar-time');
  if (!el) return;
  const update = () => {
    el.textContent = new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  };
  update();
  setInterval(update, 1000);
}
startClock();

// ── Badge helper ──────────────────────────────────────────────────
const STATUS_CLASS = {
  'Booked':           'badge-booked',
  'Picked Up':        'badge-picked',
  'In Transit':       'badge-transit',
  'Out for Delivery': 'badge-outdelivery',
  'Delivered':        'badge-delivered',
  'Cancelled':        'badge-cancelled'
};
const STATUS_ICON = {
  'Booked':           '📝',
  'Picked Up':        '🚚',
  'In Transit':       '✈️',
  'Out for Delivery': '🛵',
  'Delivered':        '✅',
  'Cancelled':        '❌'
};
const TIMELINE_DOT_CLASS = {
  'Booked':           'timeline-dot-booked',
  'Picked Up':        'timeline-dot-picked',
  'In Transit':       'timeline-dot-transit',
  'Out for Delivery': 'timeline-dot-outdelivery',
  'Delivered':        'timeline-dot-delivered',
  'Cancelled':        'timeline-dot-cancelled'
};

function makeBadge(status) {
  const cls  = STATUS_CLASS[status]  || 'badge-booked';
  const icon = STATUS_ICON[status]   || '📦';
  return `<span class="badge ${cls}">${icon} ${status}</span>`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// ── Expose helpers globally ───────────────────────────────────────
window.CTS = {
  makeBadge,
  formatDate,
  formatDateTime,
  STATUS_ICON,
  STATUS_CLASS,
  TIMELINE_DOT_CLASS
};
