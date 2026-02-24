// ============================================================
//  supabase.js  —  Adrem Model Academy Portal
//  Include in every HTML page via:
//  <script src="supabase.js"></script>
//
//  Covers: Authentication · Students · Staff · Scores ·
//          Attendance · Psychomotor · Notices · Settings
// ============================================================

const SUPABASE_URL = 'https://ktiunkthfdjllfivnamz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0aXVua3RoZmRqbGxmaXZuYW16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NjMzMDUsImV4cCI6MjA4NzMzOTMwNX0.vmxUuqWKMFpIQgU9s_bEYMFIQN5_QQckpIE1iusrY-8';

const DB = {

  // ═══════════════════════════════════════════════════════════
  //  SESSION MANAGEMENT
  // ═══════════════════════════════════════════════════════════

  // Get current logged-in user from sessionStorage
  getUser() {
    try {
      const s = sessionStorage.getItem('adrem_user');
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  },

  // Save user to sessionStorage after successful login
  saveSession(user) {
    sessionStorage.setItem('adrem_user', JSON.stringify(user));
  },

  // Redirect to login if not authenticated or wrong role
  // Usage inside any dashboard: const USER = DB.requireAuth('staff');
  requireAuth(role = null) {
    const user = this.getUser();
    if (!user) { window.location.href = 'staff-login.html'; return null; }
    if (role && user.role !== role) { window.location.href = 'staff-login.html'; return null; }
    return user;
  },

  // Clear session and go to login
  logout() {
    sessionStorage.removeItem('adrem_user');
    window.location.href = 'staff-login.html';
  },

  // ═══════════════════════════════════════════════════════════
  //  BASE HTTP LAYER
  // ═══════════════════════════════════════════════════════════

  get headers() {
    return {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  },

  // ═══════════════════════════════════════════════════════════
  //  GENERIC CRUD
  // ═══════════════════════════════════════════════════════════

  // SELECT rows
  // DB.select('students', { class: 'JSS 2A' }, '*', 'name.asc')
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

  // SELECT with raw PostgREST filter string (for complex queries)
  // DB.selectRaw('psychomotor', 'student_id=eq.5&status=eq.approved')
  async selectRaw(table, filterStr, columns = '*') {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(columns)}&${filterStr}`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message || 'Query failed'); }
    return res.json();
  },

  // INSERT a single row or array of rows
  async insert(table, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(data)
    });
    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message || 'Insert failed'); }
    return res.json();
  },

  // UPDATE rows matching filters
  // DB.update('students', { class: 'JSS 3A' }, { id: 5 })
  async update(table, data, filters = {}) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?`;
    url += Object.entries(filters).map(([k,v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&');
    const res = await fetch(url, {
      method: 'PATCH',
      headers: this.headers,
      body: JSON.stringify(data)
    });
    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message || 'Update failed'); }
    const text = await res.text();
    return text ? JSON.parse(text) : [];
  },

  // UPSERT — insert, or update if row already exists
  async upsert(table, data, onConflict = null) {
    let url = `${SUPABASE_URL}/rest/v1/${table}`;
    if (onConflict) url += `?on_conflict=${onConflict}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...this.headers, 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(data)
    });
    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message || 'Upsert failed'); }
    const text = await res.text();
    return text ? JSON.parse(text) : [];
  },

  // DELETE rows matching filters
  async delete(table, filters = {}) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?`;
    url += Object.entries(filters).map(([k,v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&');
    const res = await fetch(url, { method: 'DELETE', headers: this.headers });
    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message || 'Delete failed'); }
    return true;
  },

  // ═══════════════════════════════════════════════════════════
  //  SETTINGS
  // ═══════════════════════════════════════════════════════════

  // Get school settings — term, session, results_published, etc.
  async getSettings() {
    try {
      const rows = await this.select('settings', { id: 1 });
      return rows[0] || { term: 'First Term', session: '2024/2025', results_published: false };
    } catch {
      return { term: 'First Term', session: '2024/2025', results_published: false };
    }
  },

  // Save/update school settings (admin only). Always writes to row id=1.
  async saveSettings(data) {
    return this.upsert('settings', { id: 1, ...data }, 'id');
  },

  // Publish or unpublish student results
  async setResultsPublished(published) {
    return this.update('settings', { results_published: !!published }, { id: 1 });
  },

  // ═══════════════════════════════════════════════════════════
  //  AUTHENTICATION — LOGIN PAGE
  // ═══════════════════════════════════════════════════════════

  // Login a STUDENT by reg number + password
  async loginStudent(reg, password) {
    const rows = await this.select('students', { reg, password });
    if (!rows.length) throw new Error('Invalid registration number or password.');
    const s = rows[0];
    const user = {
      role: 'student',
      id: s.id,
      name: s.name,
      reg: s.reg,
      class: s.class,
      phone: s.phone || '',
    };
    this.saveSession(user);
    return user;
  },

  // Login a STAFF or ADMIN member by phone + password.
  // The staff table's `role` column should be either 'staff' or 'admin'.
  async loginStaff(phone, password) {
    const rows = await this.select('staff', { phone, password });
    if (!rows.length) throw new Error('Invalid phone number or password.');
    const s = rows[0];
    const user = {
      role: s.role === 'admin' ? 'admin' : 'staff',
      id: s.id,
      name: s.name,
      phone: s.phone,
      email: s.email || '',
      subjects: s.subjects || '',
      qualification: s.qualification || '',
      isClassTeacher: !!s.is_class_teacher,
      assignedClass: s.assigned_class || '',
      joinDate: s.join_date || '',
    };
    this.saveSession(user);
    return user;
  },

  // ═══════════════════════════════════════════════════════════
  //  CLASSES
  // ═══════════════════════════════════════════════════════════

  // Get all distinct classes (from the classes table if it exists)
  async getAllClasses() {
    try {
      return await this.select('classes', {}, '*', 'name.asc');
    } catch {
      // Fallback: derive classes from students table
      const students = await this.getAllStudents();
      const names = [...new Set(students.map(s => s.class).filter(Boolean))].sort();
      return names.map(n => ({ name: n }));
    }
  },

  // Add a new class / arm to the classes table
  async addClass(data) {
    return this.insert('classes', {
      name: data.name,
      level: data.level || null,
      created_at: new Date().toISOString()
    });
  },

  // ═══════════════════════════════════════════════════════════
  //  STUDENTS
  // ═══════════════════════════════════════════════════════════

  // Get all students in a given class, sorted by name
  async getClassStudents(className) {
    return this.select('students', { class: className }, '*', 'name.asc');
  },

  // Get every student in the school (admin)
  async getAllStudents() {
    return this.select('students', {}, '*', 'name.asc');
  },

  // Add a new student. Default password = surname (last part of name, lowercase)
  async addStudent(data) {
    if (!data.password) {
      data.password = (data.name || 'student').split(' ').pop().toLowerCase();
    }
    // Mirror reg → reg_number so the NOT NULL constraint on the old column is satisfied
    if (data.reg && !data.reg_number) data.reg_number = data.reg;
    // Mirror name into first_name/surname if those columns exist
    if (data.name) {
      const parts = data.name.trim().split(/\s+/);
      if (!data.surname)     data.surname    = parts[parts.length - 1];
      if (!data.first_name)  data.first_name = parts.slice(0, parts.length - 1).join(' ') || data.surname;
    }
    return this.insert('students', data);
  },

  // Edit a student's details
  async updateStudent(id, data) {
    return this.update('students', data, { id });
  },

  // Remove a student
  async removeStudent(id) {
    return this.delete('students', { id });
  },

  // ═══════════════════════════════════════════════════════════
  //  STAFF
  // ═══════════════════════════════════════════════════════════

  // Get all staff members (admin)
  async getAllStaff() {
    return this.select('staff', {}, '*', 'name.asc');
  },

  // Add a new staff member. Default password = surname
  async addStaff(data) {
    if (!data.password) {
      data.password = (data.name || 'staff').split(' ').pop().toLowerCase();
    }
    return this.insert('staff', data);
  },

  // Edit a staff member's details
  async updateStaff(id, data) {
    return this.update('staff', data, { id });
  },

  // Remove a staff member
  async removeStaff(id) {
    return this.delete('staff', { id });
  },

  // Assign or remove class teacher status for a staff member
  async setClassTeacher(staffId, isClassTeacher, assignedClass) {
    return this.update('staff', {
      is_class_teacher: !!isClassTeacher,
      assigned_class: isClassTeacher ? (assignedClass || null) : null
    }, { id: staffId });
  },

  // Reset a user's password (works for both students and staff tables)
  async resetPassword(table, id, newPassword) {
    return this.update(table, { password: newPassword }, { id });
  },

  // ═══════════════════════════════════════════════════════════
  //  SCORES
  // ═══════════════════════════════════════════════════════════

  // Get all scores for one student (used by student dashboard)
  async getStudentScores(studentId, term, session) {
    const filters = { student_id: studentId };
    if (term) filters.term = term;
    if (session) filters.session = session;
    return this.select('scores', filters, '*', 'subject.asc');
  },

  // Get scores for a class + subject (staff score entry page)
  async getClassScores(className, subject, term, session) {
    let qs = `class_name=eq.${encodeURIComponent(className)}`;
    if (subject) qs += `&subject=eq.${encodeURIComponent(subject)}`;
    if (term)    qs += `&term=eq.${encodeURIComponent(term)}`;
    if (session) qs += `&session=eq.${encodeURIComponent(session)}`;
    return this.selectRaw('scores', qs);
  },

  // Get ALL scores for a class across all subjects (admin broadsheet)
  async getAllClassScores(className, term, session) {
    let qs = `class_name=eq.${encodeURIComponent(className)}`;
    if (term)    qs += `&term=eq.${encodeURIComponent(term)}`;
    if (session) qs += `&session=eq.${encodeURIComponent(session)}`;
    return this.selectRaw('scores', qs);
  },

  // Save a batch of scores for a class at once (staff: Save All Scores button)
  // scoreRows: array of objects, each with:
  //   { student_id, subject, class_name, ca_score, exam_score, term, session }
  // Requires a UNIQUE constraint on (student_id, subject, term, session) in Supabase.
  async saveScoresBulk(scoreRows) {
    // Make sure numbers are numbers, not strings
    const clean = scoreRows.map(r => ({
      ...r,
      ca_score: Number(r.ca_score) || 0,
      exam_score: Number(r.exam_score) || 0,
    }));
    return this.upsert('scores', clean, 'student_id,subject,term,session');
  },

  // Save a single score (for one student, one subject)
  // Requires a UNIQUE constraint on (student_id, subject, term, session) in Supabase.
  async saveScore(studentId, subject, className, caScore, examScore, term, session) {
    return this.upsert('scores', {
      student_id: studentId,
      subject,
      class_name: className,
      ca_score: Number(caScore) || 0,
      exam_score: Number(examScore) || 0,
      term,
      session
    }, 'student_id,subject,term,session');
  },

  // ═══════════════════════════════════════════════════════════
  //  ATTENDANCE
  // ═══════════════════════════════════════════════════════════

  // Get attendance history for a student (student dashboard)
  async getStudentAttendance(studentId, term, session) {
    const filters = { student_id: studentId };
    if (term) filters.term = term;
    if (session) filters.session = session;
    return this.select('attendance', filters, '*', 'date.asc');
  },

  // Get attendance for a class on a specific date (staff pre-filling today's sheet)
  async getClassAttendanceByDate(className, date) {
    return this.selectRaw('attendance',
      `class_name=eq.${encodeURIComponent(className)}&date=eq.${date}`
    );
  },

  // Save attendance for a whole class for one day (staff: Save Attendance button)
  // records: array of { student_id, class_name, date, status, term, session }
  // status values: 'present' | 'absent'
  // Requires a UNIQUE constraint on (student_id, date) in Supabase.
  async saveAttendanceBulk(records) {
    return this.upsert('attendance', records, 'student_id,date');
  },

  // Get today's date as YYYY-MM-DD (for attendance date field)
  today() {
    return new Date().toISOString().split('T')[0];
  },

  // ═══════════════════════════════════════════════════════════
  //  PSYCHOMOTOR
  // ═══════════════════════════════════════════════════════════

  // Get approved psychomotor record for one student (student dashboard / result print)
  async getStudentPsychomotor(studentId, term, session) {
    let qs = `student_id=eq.${studentId}&status=eq.approved`;
    if (term)    qs += `&term=eq.${encodeURIComponent(term)}`;
    if (session) qs += `&session=eq.${encodeURIComponent(session)}`;
    const rows = await this.selectRaw('psychomotor', qs);
    return rows[0] || null;
  },

  // Get all psychomotor grades for a class (staff grading page + admin approval)
  async getClassPsychomotor(className, term, session) {
    let qs = `class_name=eq.${encodeURIComponent(className)}`;
    if (term)    qs += `&term=eq.${encodeURIComponent(term)}`;
    if (session) qs += `&session=eq.${encodeURIComponent(session)}`;
    return this.selectRaw('psychomotor', qs);
  },

  // Save / update psychomotor grades for a whole class
  // rows: array of objects with all trait scores + meta fields
  // status: 'draft' | 'submitted' | 'approved'
  // Requires a UNIQUE constraint on (student_id, term, session) in Supabase.
  async savePsychomotorBulk(rows, status) {
    const tagged = rows.map(r => ({ ...r, status: status || 'draft' }));
    return this.upsert('psychomotor', tagged, 'student_id,term,session');
  },

  // Admin: approve all psychomotor records for a class
  async approvePsychomotor(className, term, session) {
    let url = `${SUPABASE_URL}/rest/v1/psychomotor?`
      + `class_name=eq.${encodeURIComponent(className)}`
      + `&term=eq.${encodeURIComponent(term)}`
      + `&session=eq.${encodeURIComponent(session)}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: this.headers,
      body: JSON.stringify({ status: 'approved' })
    });
    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message || 'Approve failed'); }
    return true;
  },

  // Admin: get all submitted (pending) psychomotor entries
  async getPendingPsychomotor() {
    const url = `${SUPABASE_URL}/rest/v1/psychomotor?select=*&status=eq.submitted&order=class_name.asc`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message || 'Query failed'); }
    return res.json();
  },

  // ═══════════════════════════════════════════════════════════
  //  NOTICES
  // ═══════════════════════════════════════════════════════════

  // Get recent notices for student/staff dashboards
  async getNotices(limit) {
    const n = limit || 5;
    const url = `${SUPABASE_URL}/rest/v1/notices?select=*&order=created_at.desc&limit=${n}`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message || 'Query failed'); }
    return res.json();
  },

  // Post a notice (admin notice board)
  async sendNotice(title, message, audience, priority) {
    return this.insert('notices', {
      title,
      message,
      audience: audience || 'all',
      priority: priority || 'normal',
      created_at: new Date().toISOString()
    });
  },

  // Delete a notice
  async deleteNotice(id) {
    return this.delete('notices', { id });
  },

  // ═══════════════════════════════════════════════════════════
  //  ACTIVITY LOG
  // ═══════════════════════════════════════════════════════════

  // Log a portal action (non-critical, silent if table missing)
  async logActivity(action, detail, staffId) {
    try {
      await this.insert('activity_log', {
        action,
        detail: detail || '',
        staff_id: staffId || null,
        created_at: new Date().toISOString()
      });
    } catch { /* fail silently */ }
  },

  // Get recent activity entries for admin activity log page
  async getActivityLog(limit) {
    const n = limit || 20;
    const url = `${SUPABASE_URL}/rest/v1/activity_log?select=*&order=created_at.desc&limit=${n}`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message || 'Query failed'); }
    return res.json();
  },

  // ═══════════════════════════════════════════════════════════
  //  UTILITY HELPERS
  // ═══════════════════════════════════════════════════════════

  // Format a date string to "12 Jan, 2025"
  formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
  },

  // Get initials from a full name ("Samson Adeleke" → "SA")
  initials(name) {
    if (!name) return '??';
    return name.split(' ').filter(Boolean).map(w => w[0]).join('').substring(0, 2).toUpperCase();
  },

  // Show a toast notification (requires a #toast element in the page)
  showToast(msg, type) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = (type === 'error' ? '❌ ' : '✅ ') + msg;
    t.style.opacity = '1';
    t.style.transform = 'translateY(0)';
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transform = 'translateY(10px)';
    }, 3500);
  }

};

window.DB = DB;
