// ============================================================
//  supabase.js  —  Adrem Model Academy Portal
//  Shared database helper. Include in every HTML page via:
//  <script src="supabase.js"></script>
// ============================================================

const SUPABASE_URL = 'https://ktiunkthfdjllfivnamz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0aXVua3RoZmRqbGxmaXZuYW16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NjMzMDUsImV4cCI6MjA4NzMzOTMwNX0.vmxUuqWKMFpIQgU9s_bEYMFIQN5_QQckpIE1iusrY-8';

const DB = {

  // ── GET current logged-in user from session ──
  getUser() {
    const s = sessionStorage.getItem('adrem_user');
    return s ? JSON.parse(s) : null;
  },

  // ── Redirect to login if not authenticated ──
  requireAuth(role = null) {
    const user = this.getUser();
    if (!user) { window.location.href = 'staff-login.html'; return null; }
    if (role && user.role !== role) { window.location.href = 'staff-login.html'; return null; }
    return user;
  },

  // ── Base headers ──
  get headers() {
    return {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  },

  // ── SELECT rows ──
  // DB.select('students', { class: 'JSS 2A' }, 'id,first_name,surname,reg_number')
  async select(table, filters = {}, columns = '*', order = null) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(columns)}`;
    for (const [col, val] of Object.entries(filters)) {
      url += `&${col}=eq.${encodeURIComponent(val)}`;
    }
    if (order) url += `&order=${order}`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Select failed'); }
    return res.json();
  },

  // ── SELECT with raw filter string (for complex queries) ──
  // DB.selectRaw('scores', 'student_id=eq.UUID&term=eq.First+Term')
  async selectRaw(table, filterStr, columns = '*') {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(columns)}&${filterStr}`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Query failed'); }
    return res.json();
  },

  // ── INSERT ──
  async insert(table, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(data)
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Insert failed'); }
    return res.json();
  },

  // ── UPDATE ──
  // DB.update('students', { class: 'JSS 3A' }, { id: 'UUID' })
  async update(table, data, filters = {}) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?`;
    url += Object.entries(filters).map(([k,v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&');
    const res = await fetch(url, {
      method: 'PATCH',
      headers: this.headers,
      body: JSON.stringify(data)
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Update failed'); }
    return res.json();
  },

  // ── UPSERT (insert or update if exists) ──
  async upsert(table, data, onConflict = null) {
    let url = `${SUPABASE_URL}/rest/v1/${table}`;
    if (onConflict) url += `?on_conflict=${onConflict}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...this.headers, 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(data)
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Upsert failed'); }
    return res.json();
  },

  // ── DELETE ──
  async delete(table, filters = {}) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?`;
    url += Object.entries(filters).map(([k,v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&');
    const res = await fetch(url, { method: 'DELETE', headers: this.headers });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Delete failed'); }
    return true;
  },

  // ── SETTINGS shortcut ──
  async getSettings() {
    const rows = await this.select('settings', { id: 1 });
    return rows[0] || {};
  },

  // ── LOGOUT ──
  logout() {
    sessionStorage.removeItem('adrem_user');
    window.location.href = 'staff-login.html';
  }
};
