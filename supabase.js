// ============================================================
//  supabase.js  —  Adrem Model Academy Portal
//  Include on every page: <script src="supabase.js"></script>
//
//  Schema (confirmed from live Supabase):
//  admins      : id(uuid), full_name, email, password, created_at
//  staff       : id(uuid), name, full_name, surname, phone, email,
//                qualification, subjects, teaching_classes,
//                is_class_teacher, assigned_class, role,
//                password, is_active, join_date, created_at
//  students    : id(uuid), reg_number, first_name, surname,
//                full_name, class, gender, dob, phone,
//                parent_phone, password, is_active, created_at
//  classes     : id, name, level, created_at
//  scores      : id(uuid), student_id, subject, class_name,
//                ca_score, exam_score, term, session,
//                entered_by, created_at
//  attendance  : id(uuid), student_id, class_name, date,
//                status, term, session, marked_by, created_at
//  psychomotor : id(uuid), student_id, class_name,
//                class_teacher_id, punctuality, attentiveness,
//                neatness, politeness, honesty, sports, clubs,
//                creativity, leadership, conduct,
//                teacher_remark, status, term, session, created_at
//  notices     : id(uuid), title, message, audience, sent_to,
//                priority, created_by, created_at
//  settings    : id(int), session, term, term_start, term_end,
//                next_term_start, school_name, school_address,
//                school_phone, school_email, results_published
//  activity_log: id(bigint), action, detail, staff_id, created_at
// ============================================================

const SUPABASE_URL = 'https://ktiunkthfdjllfivnamz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0aXVua3RoZmRqbGxmaXZuYW16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NjMzMDUsImV4cCI6MjA4NzMzOTMwNX0.vmxUuqWKMFpIQgU9s_bEYMFIQN5_QQckpIE1iusrY-8';

const DB = {

  // ═══════════════════════════════════════════════════════════
  //  BASE HTTP
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
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || `Select from ${table} failed`); }
    return res.json();
  },

  async selectRaw(table, filterStr, columns = '*') {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(columns)}&${filterStr}`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || `Query on ${table} failed`); }
    return res.json();
  },

  async insert(table, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method:  'POST',
      headers: this.headers,
      body:    JSON.stringify(data)
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || `Insert into ${table} failed`); }
    const text = await res.text();
    return text ? JSON.parse(text) : [];
  },

  async update(table, data, filters = {}) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?`;
    url += Object.entries(filters).map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&');
    const res = await fetch(url, {
      method:  'PATCH',
      headers: this.headers,
      body:    JSON.stringify(data)
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || `Update on ${table} failed`); }
    const text = await res.text();
    return text ? JSON.parse(text) : [];
  },

  async upsert(table, data, onConflict) {
    let url = `${SUPABASE_URL}/rest/v1/${table}`;
    if (onConflict) url += `?on_conflict=${onConflict}`;
    const res = await fetch(url, {
      method:  'POST',
      headers: { ...this.headers, 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body:    JSON.stringify(data)
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || `Upsert on ${table} failed`); }
    const text = await res.text();
    return text ? JSON.parse(text) : [];
  },

  async delete(table, filters = {}) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?`;
    url += Object.entries(filters).map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&');
    const res = await fetch(url, { method: 'DELETE', headers: this.headers });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || `Delete from ${table} failed`); }
    return true;
  },

  // ═══════════════════════════════════════════════════════════
  //  SESSION MANAGEMENT
  // ═══════════════════════════════════════════════════════════

  getUser() {
    try {
      const s = sessionStorage.getItem('adrem_user');
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  },

  saveSession(user) {
    sessionStorage.setItem('adrem_user', JSON.stringify(user));
  },

  // Call at top of every dashboard page
  // Usage: const USER = DB.requireAuth('staff');
  requireAuth(role = null) {
    const user = this.getUser();
    if (!user) { window.location.href = 'staff-login.html'; return null; }
    if (role && user.role !== role) { window.location.href = 'staff-login.html'; return null; }
    return user;
  },

  logout() {
    sessionStorage.removeItem('adrem_user');
    window.location.href = 'staff-login.html';
  },

  // ═══════════════════════════════════════════════════════════
  //  LOGIN — three separate flows for three tables
  // ═══════════════════════════════════════════════════════════

  // STUDENT: reg_number + password → students table
  async loginStudent(regNumber, password) {
    const rows = await this.select('students', {
      reg_number: regNumber,
      password:   password,
      is_active:  true
    });
    if (!rows.length) throw new Error('Invalid registration number or password.');
    const s = rows[0];
    const user = {
      role:      'student',
      id:        s.id,
      name:      s.full_name || `${s.first_name || ''} ${s.surname || ''}`.trim(),
      firstName: s.first_name || '',
      surname:   s.surname    || '',
      reg:       s.reg_number,
      class:     s.class,
      phone:     s.phone || s.parent_phone || '',
    };
    this.saveSession(user);
    return user;
  },

  // STAFF: phone + password → staff table (role must NOT be 'admin')
  async loginStaff(phone, password) {
    const rows = await this.select('staff', {
      phone:     phone,
      password:  password,
      is_active: true
    });
    if (!rows.length) throw new Error('Invalid phone number or password.');
    const s = rows[0];
    if (s.role === 'admin') throw new Error('Admin accounts must use the Admin login tab.');
    const user = {
      role:           'staff',
      id:             s.id,
      name:           s.full_name || s.name || '',
      phone:          s.phone,
      email:          s.email          || '',
      subjects:       s.subjects       || '',
      teachingClasses: s.teaching_classes || '',
      qualification:  s.qualification  || '',
      isClassTeacher: !!s.is_class_teacher,
      assignedClass:  s.assigned_class || '',
      joinDate:       s.join_date      || '',
    };
    this.saveSession(user);
    return user;
  },

  // ADMIN: email + password → admins table
  async loginAdmin(email, password) {
    const rows = await this.select('admins', {
      email:    email,
      password: password
    });
    if (!rows.length) throw new Error('Invalid admin credentials.');
    const a = rows[0];
    const user = {
      role:  'admin',
      id:    a.id,
      name:  a.full_name,
      email: a.email,
    };
    this.saveSession(user);
    return user;
  },

  // ═══════════════════════════════════════════════════════════
  //  SETTINGS
  // ═══════════════════════════════════════════════════════════

  async getSettings() {
    try {
      const rows = await this.select('settings', { id: 1 });
      return rows[0] || {
        term: 'First Term', session: '2024/2025', results_published: false
      };
    } catch {
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
  //  STUDENTS
  // ═══════════════════════════════════════════════════════════

  async getClassStudents(className) {
    return this.select('students', { class: className }, '*', 'first_name.asc');
  },

  async getAllStudents() {
    return this.select('students', {}, '*', 'class.asc,first_name.asc');
  },

  // data: { first_name, surname, reg_number, gender, dob, class, parent_phone, password }
  async addStudent(data) {
    const fullName = `${data.first_name || ''} ${data.surname || ''}`.trim();
    if (!data.password) data.password = (data.surname || 'student').toLowerCase();
    return this.insert('students', {
      ...data,
      full_name: fullName,
      is_active: true
    });
  },

  async updateStudent(id, data) {
    if (data.first_name || data.surname) {
      data.full_name = `${data.first_name || ''} ${data.surname || ''}`.trim();
    }
    return this.update('students', data, { id });
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

  // data: { name, surname, phone, email, qualification, subjects,
  //         teaching_classes, role, join_date, password }
  async addStaff(data) {
    const fullName = data.full_name || `${data.name || ''} ${data.surname || ''}`.trim() || data.name;
    if (!data.password) data.password = (data.surname || data.name || 'staff').toLowerCase();
    return this.insert('staff', {
      ...data,
      full_name:  fullName,
      role:       data.role || 'staff',
      is_active:  true
    });
  },

  async updateStaff(id, data) {
    return this.update('staff', data, { id });
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

  async resetPassword(table, id, newPassword) {
    return this.update(table, { password: newPassword }, { id });
  },

  // ═══════════════════════════════════════════════════════════
  //  CLASSES
  // ═══════════════════════════════════════════════════════════

  async getAllClasses() {
    return this.select('classes', {}, '*', 'name.asc');
  },

  // ═══════════════════════════════════════════════════════════
  //  SCORES
  // ═══════════════════════════════════════════════════════════

  // Student dashboard: all scores for one student this term/session
  async getStudentScores(studentId, term, session) {
    let qs = `student_id=eq.${studentId}`;
    if (term)    qs += `&term=eq.${encodeURIComponent(term)}`;
    if (session) qs += `&session=eq.${encodeURIComponent(session)}`;
    qs += '&order=subject.asc';
    return this.selectRaw('scores', qs);
  },

  // Staff score entry: scores for a class + subject
  async getClassScores(className, subject, term, session) {
    let qs = `class_name=eq.${encodeURIComponent(className)}`;
    if (subject) qs += `&subject=eq.${encodeURIComponent(subject)}`;
    if (term)    qs += `&term=eq.${encodeURIComponent(term)}`;
    if (session) qs += `&session=eq.${encodeURIComponent(session)}`;
    return this.selectRaw('scores', qs);
  },

  // Admin broadsheet: all scores for a class
  async getAllClassScores(className, term, session) {
    let qs = `class_name=eq.${encodeURIComponent(className)}`;
    if (term)    qs += `&term=eq.${encodeURIComponent(term)}`;
    if (session) qs += `&session=eq.${encodeURIComponent(session)}`;
    return this.selectRaw('scores', qs);
  },

  // Save one score
  async saveScore(studentId, subject, className, caScore, examScore, term, session, enteredBy) {
    return this.upsert('scores', {
      student_id:  studentId,
      subject,
      class_name:  className,
      ca_score:    Number(caScore)   || 0,
      exam_score:  Number(examScore) || 0,
      term,
      session,
      entered_by:  enteredBy || null
    }, 'student_id,subject,term,session');
  },

  // Bulk save scores (staff: Save All button)
  async saveScoresBulk(scoreRows) {
    const clean = scoreRows.map(r => ({
      student_id:  r.student_id,
      subject:     r.subject,
      class_name:  r.class_name,
      ca_score:    Number(r.ca_score)   || 0,
      exam_score:  Number(r.exam_score) || 0,
      term:        r.term,
      session:     r.session,
      entered_by:  r.entered_by || null
    }));
    return this.upsert('scores', clean, 'student_id,subject,term,session');
  },

  // ═══════════════════════════════════════════════════════════
  //  ATTENDANCE
  // ═══════════════════════════════════════════════════════════

  // Student dashboard: attendance history
  async getStudentAttendance(studentId, term, session) {
    let qs = `student_id=eq.${studentId}`;
    if (term)    qs += `&term=eq.${encodeURIComponent(term)}`;
    if (session) qs += `&session=eq.${encodeURIComponent(session)}`;
    qs += '&order=date.asc';
    return this.selectRaw('attendance', qs);
  },

  // Staff: today's attendance for a class
  async getClassAttendanceByDate(className, date) {
    return this.selectRaw('attendance',
      `class_name=eq.${encodeURIComponent(className)}&date=eq.${date}`
    );
  },

  // Staff: bulk save attendance for a day
  // records: [{ student_id, class_name, date, status, term, session, marked_by }]
  async saveAttendanceBulk(records) {
    return this.upsert('attendance', records, 'student_id,date');
  },

  today() {
    return new Date().toISOString().split('T')[0];
  },

  // ═══════════════════════════════════════════════════════════
  //  PSYCHOMOTOR
  // ═══════════════════════════════════════════════════════════

  // Student dashboard: approved record for one student
  async getStudentPsychomotor(studentId, term, session) {
    let qs = `student_id=eq.${studentId}&status=eq.approved`;
    if (term)    qs += `&term=eq.${encodeURIComponent(term)}`;
    if (session) qs += `&session=eq.${encodeURIComponent(session)}`;
    const rows = await this.selectRaw('psychomotor', qs);
    return rows[0] || null;
  },

  // Staff: all psychomotor rows for a class
  async getClassPsychomotor(className, term, session) {
    let qs = `class_name=eq.${encodeURIComponent(className)}`;
    if (term)    qs += `&term=eq.${encodeURIComponent(term)}`;
    if (session) qs += `&session=eq.${encodeURIComponent(session)}`;
    return this.selectRaw('psychomotor', qs);
  },

  // Staff: save/update psychomotor for whole class
  async savePsychomotorBulk(rows, status) {
    const tagged = rows.map(r => ({ ...r, status: status || 'draft' }));
    return this.upsert('psychomotor', tagged, 'student_id,term,session');
  },

  // Admin: approve all psychomotor for a class
  async approvePsychomotor(className, term, session) {
    let url = `${SUPABASE_URL}/rest/v1/psychomotor?`
      + `class_name=eq.${encodeURIComponent(className)}`
      + `&term=eq.${encodeURIComponent(term)}`
      + `&session=eq.${encodeURIComponent(session)}`;
    const res = await fetch(url, {
      method:  'PATCH',
      headers: this.headers,
      body:    JSON.stringify({ status: 'approved' })
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Approve failed'); }
    return true;
  },

  // Admin: get all submitted (pending approval) psychomotor
  async getPendingPsychomotor() {
    return this.selectRaw('psychomotor',
      'status=eq.submitted&order=class_name.asc'
    );
  },

  // ═══════════════════════════════════════════════════════════
  //  NOTICES
  // ═══════════════════════════════════════════════════════════

  async getNotices(limit) {
    return this.selectRaw('notices',
      `order=created_at.desc&limit=${limit || 5}`
    );
  },

  // audience: 'all' | 'students' | 'staff'
  async sendNotice(title, message, audience, priority, createdBy) {
    return this.insert('notices', {
      title,
      message,
      audience:   audience   || 'all',
      sent_to:    audience   || 'all',   // keep both columns in sync
      priority:   priority   || 'normal',
      created_by: createdBy  || null,
      created_at: new Date().toISOString()
    });
  },

  async deleteNotice(id) {
    return this.delete('notices', { id });
  },

  // ═══════════════════════════════════════════════════════════
  //  ACTIVITY LOG
  // ═══════════════════════════════════════════════════════════

  async logActivity(action, detail, staffId) {
    try {
      await this.insert('activity_log', {
        action,
        detail:     detail  || '',
        staff_id:   staffId || null,
        created_at: new Date().toISOString()
      });
    } catch { /* fail silently — never break UI */ }
  },

  async getActivityLog(limit) {
    return this.selectRaw('activity_log',
      `order=created_at.desc&limit=${limit || 20}`
    );
  },

  // ═══════════════════════════════════════════════════════════
  //  UTILITY HELPERS
  // ═══════════════════════════════════════════════════════════

  formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
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

  // Grade helper used by broadsheet + student result
  // Works for both JSS (A/B/C/P/F) and SS (A1–F9) based on class name
  getGrade(total, className) {
    const isJSS = (className || '').toUpperCase().startsWith('JSS')
               || (className || '').toUpperCase().startsWith('PRI')
               || (className || '').toUpperCase().startsWith('NUR');
    if (isJSS) {
      if (total >= 70) return { grade: 'A', remark: 'Excellent' };
      if (total >= 60) return { grade: 'B', remark: 'Very Good' };
      if (total >= 50) return { grade: 'C', remark: 'Good' };
      if (total >= 40) return { grade: 'P', remark: 'Pass' };
      return { grade: 'F', remark: 'Fail' };
    } else {
      if (total >= 75) return { grade: 'A1', remark: 'Excellent' };
      if (total >= 70) return { grade: 'B2', remark: 'Very Good' };
      if (total >= 65) return { grade: 'B3', remark: 'Good' };
      if (total >= 60) return { grade: 'C4', remark: 'Credit' };
      if (total >= 55) return { grade: 'C5', remark: 'Credit' };
      if (total >= 50) return { grade: 'C6', remark: 'Credit' };
      if (total >= 45) return { grade: 'D7', remark: 'Pass' };
      if (total >= 40) return { grade: 'E8', remark: 'Pass' };
      return { grade: 'F9', remark: 'Fail' };
    }
  }
};

window.DB = DB;
