'use strict';

/**
 * login.js — Admin login page logic
 */

function togglePassword() {
  const input  = document.getElementById('password');
  const toggle = document.getElementById('pass-toggle');
  if (input.type === 'password') {
    input.type       = 'text';
    toggle.textContent = '🙈';
  } else {
    input.type       = 'password';
    toggle.textContent = '👁️';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // If already logged in, go to admin
  fetch('/api/auth/me', { credentials: 'same-origin' })
    .then(r => r.json())
    .then(d => { if (d.success) window.location.href = '/admin'; })
    .catch(() => {});

  const form = document.getElementById('login-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const errBox = document.getElementById('login-error');
    const errMsg = document.getElementById('login-error-msg');
    const btn    = document.getElementById('login-btn');
    const usernameEl = document.getElementById('username');
    const passwordEl = document.getElementById('password');

    // Clear errors
    errBox.classList.add('hidden');
    document.getElementById('err-username').textContent = '';
    document.getElementById('err-password').textContent = '';
    usernameEl.classList.remove('error');
    passwordEl.classList.remove('error');

    const username = usernameEl.value.trim();
    const password = passwordEl.value;

    if (!username) {
      document.getElementById('err-username').textContent = 'Username is required.';
      usernameEl.classList.add('error');
      usernameEl.focus();
      return;
    }
    if (!password) {
      document.getElementById('err-password').textContent = 'Password is required.';
      passwordEl.classList.add('error');
      passwordEl.focus();
      return;
    }

    btn.disabled    = true;
    btn.textContent = '⏳ Logging in…';

    try {
      const res  = await fetch('/api/auth/login', {
        method:      'POST',
        credentials: 'same-origin',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        errMsg.textContent = data.error || 'Invalid username or password.';
        errBox.classList.remove('hidden');
        passwordEl.value = '';
        passwordEl.focus();
        return;
      }

      // Redirect to admin dashboard
      window.location.href = '/admin';

    } catch (err) {
      errMsg.textContent = 'Network error. Please try again.';
      errBox.classList.remove('hidden');
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Login to Dashboard';
    }
  });
});
