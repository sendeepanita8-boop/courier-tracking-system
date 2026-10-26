'use strict';

/**
 * book.js — Courier booking page logic
 */

let lastTrackingNumber = null;

// ── Validation helpers ────────────────────────────────────────────
function clearErrors() {
  document.querySelectorAll('.form-error').forEach(el => el.textContent = '');
  document.querySelectorAll('.form-control').forEach(el => el.classList.remove('error'));
}

function showFieldError(fieldId, msg) {
  const errEl = document.getElementById(`err-${fieldId}`);
  const input = document.getElementById(fieldId);
  if (errEl) errEl.textContent = msg;
  if (input) input.classList.add('error');
}

function validateForm(data) {
  let valid = true;
  clearErrors();

  if (!data.sender_name.trim()) {
    showFieldError('sender_name', 'Sender name is required.'); valid = false;
  }
  if (!data.sender_phone.trim()) {
    showFieldError('sender_phone', 'Sender phone is required.'); valid = false;
  } else if (!/^\d{10}$/.test(data.sender_phone.trim())) {
    showFieldError('sender_phone', 'Enter a valid 10-digit phone number.'); valid = false;
  }
  if (!data.receiver_name.trim()) {
    showFieldError('receiver_name', 'Receiver name is required.'); valid = false;
  }
  if (!data.receiver_phone.trim()) {
    showFieldError('receiver_phone', 'Receiver phone is required.'); valid = false;
  } else if (!/^\d{10}$/.test(data.receiver_phone.trim())) {
    showFieldError('receiver_phone', 'Enter a valid 10-digit phone number.'); valid = false;
  }
  if (data.sender_phone.trim() === data.receiver_phone.trim()) {
    showFieldError('receiver_phone', 'Receiver phone must differ from sender phone.'); valid = false;
  }
  const w = Number(data.weight_kg);
  if (!data.weight_kg || isNaN(w) || w <= 0) {
    showFieldError('weight_kg', 'Enter a valid positive weight.'); valid = false;
  }
  if (w > 500) {
    showFieldError('weight_kg', 'Weight cannot exceed 500 kg.'); valid = false;
  }
  return valid;
}

// ── Form submit ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('booking-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const data = {
      sender_name:       formData.get('sender_name')       || '',
      sender_phone:      formData.get('sender_phone')      || '',
      sender_email:      formData.get('sender_email')      || '',
      sender_address:    formData.get('sender_address')    || '',
      receiver_name:     formData.get('receiver_name')     || '',
      receiver_phone:    formData.get('receiver_phone')    || '',
      receiver_address:  formData.get('receiver_address')  || '',
      weight_kg:         formData.get('weight_kg')         || '',
      courier_type:      formData.get('courier_type')      || 'Standard',
      expected_delivery: formData.get('expected_delivery') || ''
    };

    if (!validateForm(data)) return;

    const submitBtn = document.getElementById('submit-btn');
    const errBox    = document.getElementById('form-error');
    const errMsg    = document.getElementById('form-error-msg');

    submitBtn.disabled    = true;
    submitBtn.textContent = '⏳ Booking…';
    errBox.classList.add('hidden');

    try {
      const res  = await fetch('/api/shipments', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data)
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        const msg = json.errors ? json.errors.join(' ') : (json.error || 'Booking failed. Please try again.');
        errMsg.textContent = msg;
        errBox.classList.remove('hidden');
        errBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      // Success
      lastTrackingNumber = json.tracking_number;
      document.getElementById('success-tn').textContent = json.tracking_number;
      document.getElementById('booking-form-container').classList.add('hidden');
      document.getElementById('booking-success').classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (err) {
      errMsg.textContent = 'Network error. Please check your connection and try again.';
      errBox.classList.remove('hidden');
    } finally {
      submitBtn.disabled    = false;
      submitBtn.textContent = '📦 Book Shipment';
    }
  });

  // Set minimum date to today for expected delivery
  const deliveryInput = document.getElementById('expected_delivery');
  if (deliveryInput) {
    deliveryInput.min = new Date().toISOString().split('T')[0];
  }
});

// ── Success actions ───────────────────────────────────────────────
function trackSuccess() {
  if (lastTrackingNumber) {
    window.location.href = `/track?tn=${encodeURIComponent(lastTrackingNumber)}`;
  }
}

function bookAnother() {
  lastTrackingNumber = null;
  document.getElementById('booking-success').classList.add('hidden');
  document.getElementById('booking-form-container').classList.remove('hidden');
  document.getElementById('booking-form').reset();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
