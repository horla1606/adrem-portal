// ============================================================
//  supabase.js  —  Adrem Model Academy Portal  v2.0
//  Include in every HTML page via:
//  <script src="supabase.js"></script>
//
//  FIXES APPLIED (v2.0):
//  - Admin login uses EMAIL (staff table, role='admin', email column)
//  - Staff login uses PHONE NUMBER (staff table, role='staff')
//  - Student login uses REG NUMBER (students table)
//  - is_active flag supported on both students & staff tables
//  - delete() guard: refuses empty filters (prevents wiping tables)
//  - update() guard: refuses empty filters (prevents patching all rows)
//  - getAllClasses() double-catch for safety
//  - addStudent() clean minimal insert — no legacy column mirroring
//  - addStaff() includes email, teaching_classes, is_active fields
//  - requireAuth() accepts single role string OR array of roles
//  - logActivity() fully silent — never crashes callers
//  - getActivityLog() returns [] gracefully if table missing
//  - getNotices() returns [] gracefully if table missing
//  - saveSession() supports rememberMe (localStorage) + sessionStorage
//  - logout() broadcasts to other open tabs via BroadcastChannel
//  - listenForLogout() helper for dashboards to hook cross-tab logout
//  - Grade helpers (jssGrade, waecGrade, gradeFor) centralised here
// ============================================================

const SUPABASE_URL = 'https://ktiunkthfdjllfivnamz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0aXVua3RoZmRqbGxmaXZuYW16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NjMzMDUsImV4cCI6MjA4NzMzOTMwNX0.vmxUuqWKMFpIQgU9s_bEYMFIQN5_QQckpIE1iusrY-8';

const DB = {

  // ═══════════════════════════════════════════════════════════
  //  SESSION MANAGEMENT
  // ═══════════════════════════════════════════════════════════

  // Get current logged-in user — checks localStorage first (remember me), then sessionStorage
  getUser() {
    try {
      const s = localStorage.getItem('adrem_user') || sessionStorage.getItem('adrem_user');
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  },

  // Save user session.
  // rememberMe=true → persists across browser restarts (localStorage)
  // rememberMe=false → clears on browser close (sessionStorage only)
  saveSession(user, rememberMe) {
    const data = JSON.stringify(user);
    sessionStorage.setItem('adrem_user', data);
    if (rememberMe) {
      localStorage.setItem('adrem_user', data);
    } else {
      localStorage.removeItem('adrem_user'); // clear any stale remember-me data
    }
  },

  // Redirect to login if not authenticated or wrong role.
  // role: string 'admin' | 'staff' | 'student', or array e.g. ['staff','admin']
  requireAuth(role) {
    const user = this.getUser();
    if (!user) { window.location.href = 'staff-login.html'; return null; }
    if (role) {
      const allowed = Array.isArray(role) ? role : [role];
      if (!allowed.includes(user.role)) { window.location.href = 'staff-login.html'; return null; }
    }
    return user;
  },

  // Clear all session data and go to login.
  // Broadcasts logout event so all other open tabs also redirect.
  logout() {
    sessionStorage.removeItem('adrem_user');
    localStorage.removeItem('adrem_user');
    try {
      const bc = new BroadcastChannel('adrem_auth');
      bc.postMessage({ type: 'logout' });
      bc.close();
    } catch { /* BroadcastChannel not available in all environments */ }
    window.location.href = 'staff-login.html';
  },

  // Call once in each dashboard's init() to handle cross-tab logout
  listenForLogout() {
    try {
      const bc = new BroadcastChannel('adrem_auth');
      bc.onmessage = (e) => {
        if (e.data && e.data.type === 'logout') {
          sessionStorage.removeItem('adrem_user');
          window.location.href = 'staff-login.html';
        }
      };
    } catch { /* fail silently */ }
  },

  // ═══════════════════════════════════════════════════════════
  //  BASE HTTP LAYER
  // ═══════════════════════════════════════════════════════════

  get headers() {
    return {
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'return=representation'
    };
  },

  // ═══════════════════════════════════════════════════════════
  //  GENERIC CRUD
  // ═══════════════════════════════════════════════════════════

  async select(table, filters = {}, columns = '*', order = null) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(columns)}`;
    for (const [col, val] of Object.entries(filters)) {
      url += `&${col}=eq.${encodeURIComponent(val)}`;
    }
    if (order) url += `&order=${order}`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message || 'Select failed'); }
    return res.json();
  },

  async selectRaw(table, filterStr, columns = '*') {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(columns)}&${filterStr}`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message || 'Query failed'); }
    return res.json();
  },

  async insert(table, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method:  'POST',
      headers: this.headers,
      body:    JSON.stringify(data)
    });
    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message || 'Insert failed'); }
    return res.json();
  },

  // GUARD: refuses to run with empty filters to prevent patching ALL rows
  async update(table, data, filters = {}) {
    if (!Object.keys(filters).length) {
      throw new Error('Update refused: no filter provided. This would update every row in ' + table + '.');
    }
    let url = `${SUPABASE_URL}/rest/v1/${table}?`;
    url += Object.entries(filters).map(([k,v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&');
    const res = await fetch(url, {
      method:  'PATCH',
      headers: this.headers,
      body:    JSON.stringify(data)
    });
    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message || 'Update failed'); }
    const text = await res.text();
    return text ? JSON.parse(text) : [];
  },

  async upsert(table, data, onConflict = null) {
    let url = `${SUPABASE_URL}/rest/v1/${table}`;
    if (onConflict) url += `?on_conflict=${onConflict}`;
    const res = await fetch(url, {
      method:  'POST',
      headers: { ...this.headers, 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body:    JSON.stringify(data)
    });
    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message || 'Upsert failed'); }
    const text = await res.text();
    return text ? JSON.parse(text) : [];
  },

  // GUARD: refuses to run with empty filters to prevent wiping entire table
  async delete(table, filters = {}) {
    if (!Object.keys(filters).length) {
      throw new Error('Delete refused: no filter provided. This would delete every row in ' + table + '.');
    }
    let url = `${SUPABASE_URL}/rest/v1/${table}?`;
    url += Object.entries(filters).map(([k,v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&');
    const res = await fetch(url, { method: 'DELETE', headers: this.headers });
    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message || 'Delete failed'); }
    return true;
  },

  // ═══════════════════════════════════════════════════════════
  //  SETTINGS
  // ═══════════════════════════════════════════════════════════

  async getSettings() {
    try {
      const rows = await this.select('settings', { id: 1 });
      if (rows && rows[0]) return rows[0];
      console.warn('ADREM: settings row id=1 missing — using defaults. Run SQL setup script.');
      return { term: 'First Term', session: '2024/2025', results_published: false };
    } catch(e) {
      console.error('ADREM CRITICAL: Cannot load settings. Scores may be saved under wrong term/session.', e);
      return { term: 'First Term', session: '2024/2025', results_published: false };
    }
  },

  async saveSettings(data) {
    return this.upsert('settings', { id: 1, ...data }, 'id');
  },

  async setResultsPublished(published) {
    return this.update('settings', { results_published: !!published }, { id: 1 });
  },

  // ═══════════════════════════════════════════════════════════
  //  AUTHENTICATION
  //  Three separate login paths:
  //    1. Students  → reg number  + password
  //    2. Staff     → phone       + password  (role = 'staff')
  //    3. Admin     → email       + password  (role = 'admin')
  //
  //  Returns a user object; caller is responsible for saveSession().
  //  is_active === false blocks login even if credentials are correct.
  // ═══════════════════════════════════════════════════════════

  async loginStudent(reg, password) {
    const rows = await this.select('students', { reg, password });
    if (!rows.length) throw new Error('Invalid registration number or password. Default password is your Surname.');
    const s = rows[0];
    if (s.is_active === false) throw new Error('This student account is deactivated. Contact your class teacher or Admin.');
    return { role: 'student', id: s.id, name: s.name, reg: s.reg, class: s.class, phone: s.phone || '' };
  },

  // Staff login: phone + password (role must be 'staff', not 'admin')
  async loginStaff(phone, password) {
    const rows = await this.select('staff', { phone, password });
    if (!rows.length) throw new Error('Invalid phone number or password. Default password is your Surname.');
    const s = rows[0];
    if (s.is_active === false) throw new Error('This staff account is deactivated. Contact Admin.');
    if (s.role === 'admin') throw new Error('Admin accounts must log in via the Admin tab using email.');
    return {
      role:            'staff',
      id:              s.id,
      name:            s.name,
      phone:           s.phone,
      email:           s.email           || '',
      subjects:        s.subjects        || '',
      qualification:   s.qualification   || '',
      isClassTeacher:  !!s.is_class_teacher,
      assignedClass:   s.assigned_class  || '',
      // teachingClasses: all classes this staff member teaches (comma-separated)
      teachingClasses: s.teaching_classes || s.assigned_class || '',
      joinDate:        s.join_date        || '',
    };
  },

  // Admin login: email + password (role must be 'admin')
  async loginAdmin(email, password) {
    const rows = await this.select('staff', { email, password });
    if (!rows.length) throw new Error('Invalid email or password. Access denied.');
    const s = rows[0];
    if (s.is_active === false) throw new Error('This admin account is deactivated.');
    if (s.role !== 'admin') throw new Error('Access denied. This account does not have admin privileges.');
    return { role: 'admin', id: s.id, name: s.name, phone: s.phone || '', email: s.email };
  },

  // ═══════════════════════════════════════════════════════════
  //  CLASSES
  //  Naming convention: "JSS 1", "JSS 2", "JSS 3", "SS 1", "SS 2", "SS 3"
  //  (No arms/sections like A, B — one class per level)
  // ═══════════════════════════════════════════════════════════

  async getAllClasses() {
    try {
      return await this.select('classes', {}, '*', 'name.asc');
    } catch {
      try {
        // Fallback: derive from students table if classes table missing
        const students = await this.getAllStudents();
        const names = [...new Set(students.map(s => s.class).filter(Boolean))].sort();
        return names.map(n => ({ name: n }));
      } catch {
        return []; // both sources failed — return empty array
      }
    }
  },

  async getClassNames() {
    const classes = await this.getAllClasses();
    return classes.map(c => c.name);
  },

  async addClass(data) {
    return this.insert('classes', {
      name:       data.name,
      level:      data.level || null,
      created_at: new Date().toISOString()
    });
  },

  async deleteClass(id) {
    return this.delete('classes', { id });
  },

  // ═══════════════════════════════════════════════════════════
  //  STUDENTS
  // ═══════════════════════════════════════════════════════════

  async getClassStudents(className) {
    return this.select('students', { class: className }, '*', 'name.asc');
  },

  async getAllStudents() {
    return this.select('students', {}, '*', 'name.asc');
  },

  // Clean insert — only sends the columns that exist in the new schema.
  // Default password = surname (last word of name, lowercase).
  async addStudent(data) {
    const surname = (data.name || 'student').trim().split(/\s+/).pop().toLowerCase();
    return this.insert('students', {
      name:      data.name,
      reg:       data.reg,
      password:  data.password || surname,
      class:     data.class,
      gender:    data.gender  || null,
      dob:       data.dob     || null,
      phone:     data.phone   || null,
      is_active: true,
    });
  },

  async updateStudent(id, data) {
    return this.update('students', data, { id });
  },

  async deactivateStudent(id) {
    return this.update('students', { is_active: false }, { id });
  },

  async activateStudent(id) {
    return this.update('students', { is_active: true }, { id });
  },

  async removeStudent(id) {
    return this.delete('students', { id });
  },

  // ═══════════════════════════════════════════════════════════
  //  STAFF
  // ═══════════════════════════════════════════════════════════

  async getAllStaff() {
    return this.select('staff', {}, '*', 'name.asc');
  },

  // Insert a new staff member with full field set.
  // teaching_classes: comma-separated list of all classes this staff teaches
  // email is required for admin accounts (used for login)
  async addStaff(data) {
    const surname = (data.name || 'staff').trim().split(/\s+/).pop().toLowerCase();
    return this.insert('staff', {
      name:              data.name,
      phone:             data.phone,
      email:             data.email            || null,
      qualification:     data.qualification    || null,
      subjects:          data.subjects         || null,
      role:              data.role             || 'staff',
      join_date:         data.join_date        || null,
      is_class_teacher:  false,
      assigned_class:    null,
      teaching_classes:  data.teaching_classes || null,
      password:          data.password         || surname,
      is_active:         true,
    });
  },

  async updateStaff(id, data) {
    return this.update('staff', data, { id });
  },

  async deactivateStaff(id) {
    return this.update('staff', { is_active: false }, { id });
  },

  async activateStaff(id) {
    return this.update('staff', { is_active: true }, { id });
  },

  async removeStaff(id) {
    return this.delete('staff', { id });
  },

  async setClassTeacher(staffId, isClassTeacher, assignedClass) {
    return this.update('staff', {
      is_class_teacher: !!isClassTeacher,
      assigned_class:   isClassTeacher ? (assignedClass || null) : null
    }, { id: staffId });
  },

  async setTeachingClasses(staffId, teachingClasses) {
    return this.update('staff', { teaching_classes: teachingClasses || null }, { id: staffId });
  },

  // Reset password — min 4 characters enforced
  async resetPassword(table, id, newPassword) {
    if (!newPassword || newPassword.trim().length < 4) {
      throw new Error('Password must be at least 4 characters long.');
    }
    return this.update(table, { password: newPassword.trim() }, { id });
  },

  // ═══════════════════════════════════════════════════════════
  //  SCORES
  //  Previous term scores remain visible and editable by admin.
  //  Identified uniquely by: student_id + subject + term + session
  // ═══════════════════════════════════════════════════════════

  async getStudentScores(studentId, term, session) {
    const filters = { student_id: studentId };
    if (term)    filters.term    = term;
    if (session) filters.session = session;
    return this.select('scores', filters, '*', 'subject.asc');
  },

  async getClassScores(className, subject, term, session) {
    let qs = `class_name=eq.${encodeURIComponent(className)}`;
    if (subject) qs += `&subject=eq.${encodeURIComponent(subject)}`;
    if (term)    qs += `&term=eq.${encodeURIComponent(term)}`;
    if (session) qs += `&session=eq.${encodeURIComponent(session)}`;
    return this.selectRaw('scores', qs);
  },

  async getAllClassScores(className, term, session) {
    let qs = `class_name=eq.${encodeURIComponent(className)}`;
    if (term)    qs += `&term=eq.${encodeURIComponent(term)}`;
    if (session) qs += `&session=eq.${encodeURIComponent(session)}`;
    return this.selectRaw('scores', qs);
  },

  async saveScoresBulk(scoreRows) {
    const clean = scoreRows.map(r => ({
      ...r,
      ca_score:   Number(r.ca_score)   || 0,
      exam_score: Number(r.exam_score) || 0,
    }));
    return this.upsert('scores', clean, 'student_id,subject,term,session');
  },

  async saveScore(studentId, subject, className, caScore, examScore, term, session) {
    return this.upsert('scores', {
      student_id: studentId,
      subject,
      class_name: className,
      ca_score:   Number(caScore)   || 0,
      exam_score: Number(examScore) || 0,
      term,
      session
    }, 'student_id,subject,term,session');
  },

  // ═══════════════════════════════════════════════════════════
  //  ATTENDANCE
  // ═══════════════════════════════════════════════════════════

  async getStudentAttendance(studentId, term, session) {
    const filters = { student_id: studentId };
    if (term)    filters.term    = term;
    if (session) filters.session = session;
    return this.select('attendance', filters, '*', 'date.asc');
  },

  async getClassAttendanceByDate(className, date) {
    return this.selectRaw('attendance',
      `class_name=eq.${encodeURIComponent(className)}&date=eq.${date}`
    );
  },

  async saveAttendanceBulk(records) {
    return this.upsert('attendance', records, 'student_id,date');
  },

  // Returns today's date as YYYY-MM-DD using local device time
  today() {
    const d = new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0')
    ].join('-');
  },

  // ═══════════════════════════════════════════════════════════
  //  PSYCHOMOTOR
  // ═══════════════════════════════════════════════════════════

  async getStudentPsychomotor(studentId, term, session) {
    let qs = `student_id=eq.${studentId}&status=eq.approved`;
    if (term)    qs += `&term=eq.${encodeURIComponent(term)}`;
    if (session) qs += `&session=eq.${encodeURIComponent(session)}`;
    const rows = await this.selectRaw('psychomotor', qs);
    return rows[0] || null;
  },

  async getClassPsychomotor(className, term, session) {
    let qs = `class_name=eq.${encodeURIComponent(className)}`;
    if (term)    qs += `&term=eq.${encodeURIComponent(term)}`;
    if (session) qs += `&session=eq.${encodeURIComponent(session)}`;
    return this.selectRaw('psychomotor', qs);
  },

  async savePsychomotorBulk(rows, status) {
    const tagged = rows.map(r => ({ ...r, status: status || 'draft' }));
    return this.upsert('psychomotor', tagged, 'student_id,term,session');
  },

  async approvePsychomotor(className, term, session) {
    const url = `${SUPABASE_URL}/rest/v1/psychomotor?`
      + `class_name=eq.${encodeURIComponent(className)}`
      + `&term=eq.${encodeURIComponent(term)}`
      + `&session=eq.${encodeURIComponent(session)}`;
    const res = await fetch(url, {
      method:  'PATCH',
      headers: this.headers,
      body:    JSON.stringify({ status: 'approved' })
    });
    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message || 'Approve failed'); }
    return true;
  },

  async getPendingPsychomotor() {
    const url = `${SUPABASE_URL}/rest/v1/psychomotor?select=*&status=eq.submitted&order=class_name.asc`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message || 'Query failed'); }
    return res.json();
  },

  // ═══════════════════════════════════════════════════════════
  //  NOTICES — Returns [] gracefully if table does not exist yet
  // ═══════════════════════════════════════════════════════════

  async getNotices(limit) {
    try {
      const n = limit || 5;
      const url = `${SUPABASE_URL}/rest/v1/notices?select=*&order=created_at.desc&limit=${n}`;
      const res = await fetch(url, { headers: this.headers });
      if (!res.ok) return [];
      return res.json();
    } catch { return []; }
  },

  async sendNotice(title, message, audience, priority) {
    return this.insert('notices', {
      title,
      message,
      audience:   audience || 'all',
      priority:   priority || 'normal',
      created_at: new Date().toISOString()
    });
  },

  async deleteNotice(id) {
    return this.delete('notices', { id });
  },

  // ═══════════════════════════════════════════════════════════
  //  ACTIVITY LOG — Fully silent; returns [] if table missing
  // ═══════════════════════════════════════════════════════════

  async logActivity(action, detail, staffId) {
    try {
      await this.insert('activity_log', {
        action,
        detail:     detail  || '',
        staff_id:   staffId || null,
        created_at: new Date().toISOString()
      });
    } catch { /* intentionally silent — table may not exist yet */ }
  },

  async getActivityLog(limit) {
    try {
      const n = limit || 20;
      const url = `${SUPABASE_URL}/rest/v1/activity_log?select=*&order=created_at.desc&limit=${n}`;
      const res = await fetch(url, { headers: this.headers });
      if (!res.ok) return [];
      return res.json();
    } catch { return []; }
  },

  // ═══════════════════════════════════════════════════════════
  //  UTILITY & GRADING HELPERS
  // ═══════════════════════════════════════════════════════════

  formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return dateStr; }
  },

  initials(name) {
    if (!name) return '??';
    return name.split(' ').filter(Boolean).map(w => w[0]).join('').substring(0, 2).toUpperCase();
  },

  showToast(msg, type) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = (type === 'error' ? '❌ ' : '✅ ') + msg;
    t.style.opacity   = '1';
    t.style.transform = 'translateY(0)';
    setTimeout(() => {
      t.style.opacity   = '0';
      t.style.transform = 'translateY(10px)';
    }, 3500);
  },

  // Returns true if this class uses SS/WAEC grading
  isSSClass(className) {
    return (className || '').toUpperCase().trim().startsWith('SS');
  },

  // JSS grading: A (70-100), P (40-69), F (0-39)
  jssGrade(total)      { return total >= 70 ? 'A' : total >= 40 ? 'P' : 'F'; },
  jssGradeClass(total) { return total >= 70 ? 'g-A' : total >= 40 ? 'g-P' : 'g-F'; },

  // WAEC grading: A1 (75-100) down to F9 (0-39)
  waecGrade(total) {
    return total >= 75 ? 'A1' : total >= 70 ? 'B2' : total >= 65 ? 'B3'
         : total >= 60 ? 'C4' : total >= 55 ? 'C5' : total >= 50 ? 'C6'
         : total >= 45 ? 'D7' : total >= 40 ? 'E8' : 'F9';
  },
  waecGradeClass(total) {
    return total >= 75 ? 'g-A1' : total >= 70 ? 'g-B2' : total >= 65 ? 'g-B3'
         : total >= 60 ? 'g-C4' : total >= 55 ? 'g-C5' : total >= 50 ? 'g-C6'
         : total >= 45 ? 'g-D7' : total >= 40 ? 'g-E8' : 'g-F9';
  },

  // Auto-select the correct grade + CSS class based on class name
  gradeFor(className, total) {
    return this.isSSClass(className) ? this.waecGrade(total) : this.jssGrade(total);
  },
  gradeClassFor(className, total) {
    return this.isSSClass(className) ? this.waecGradeClass(total) : this.jssGradeClass(total);
  }

};

window.DB = DB;
