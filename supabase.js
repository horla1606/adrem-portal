// supabase.js
const { createClient } = supabase;
const _supabase = createClient('https://ktiunkthfdjllfivnamz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0aXVua3RoZmRqbGxmaXZuYW16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NjMzMDUsImV4cCI6MjA4NzMzOTMwNX0.vmxUuqWKMFpIQgU9s_bEYMFIQN5_QQckpIE1iusrY-8');

const DB = {

    // ── AUTH ────────────────────────────────────────────────────
    requireAuth: (role) => {
        const user = JSON.parse(sessionStorage.getItem('adrem_user') || 'null');
        const roles = Array.isArray(role) ? role : (role ? [role] : []);
        if (!user || (roles.length && !roles.includes(user.role))) {
            window.location.href = (roles.length === 1 && roles[0] === 'student') ? 'student-login.html' : 'staff-login.html';
            return null;
        }
        return user;
    },
    getUser: () => {
        try { return JSON.parse(sessionStorage.getItem('adrem_user')); }
        catch(e) { return null; }
    },
    today: () => new Date().toISOString().split('T')[0],
    initials: (name) => {
        if (!name) return '??';
        return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
    },
    listenForLogout: () => {
        window.addEventListener('storage', (e) => {
            if (e.key === 'adrem_logout') {
                const user = DB.getUser();
                window.location.href = (user && user.role === 'student') ? 'student-login.html' : 'staff-login.html';
            }
        });
    },
    logout: () => {
        const user = DB.getUser();
        localStorage.setItem('adrem_logout', Date.now());
        sessionStorage.removeItem('adrem_user');
        window.location.href = (user && user.role === 'student') ? 'student-login.html' : 'staff-login.html';
    },

    // ── SETTINGS ────────────────────────────────────────────────
    getSettings: async () => {
        const { data } = await _supabase.from('settings').select('*').eq('id', 1).single();
        return data || {};
    },
    saveSettings: async (updates) => await _supabase.from('settings').update(updates).eq('id', 1),
    setResultsPublished: async (val) => await _supabase.from('settings').update({ results_published: val }).eq('id', 1),

    // ── STAFF ───────────────────────────────────────────────────
    getAllStaff: async () => { const { data } = await _supabase.from('staff').select('*').order('name'); return data || []; },
    getStaffById: async (id) => { const { data } = await _supabase.from('staff').select('*').eq('id', id).single(); return data; },
    addStaff: async (obj) => await _supabase.from('staff').insert([obj]),
    removeStaff: async (id) => await _supabase.from('staff').delete().eq('id', id),
    activateStaff: async (id) => await _supabase.from('staff').update({ is_active: true }).eq('id', id),
    deactivateStaff: async (id) => await _supabase.from('staff').update({ is_active: false }).eq('id', id),
    updateStaff: async (id, updates) => await _supabase.from('staff').update(updates).eq('id', id),

    // ── STUDENTS ────────────────────────────────────────────────
    getAllStudents: async () => { const { data } = await _supabase.from('students').select('*').order('name'); return data || []; },
    getClassStudents: async (cls) => { const { data } = await _supabase.from('students').select('*').eq('class', cls).order('name'); return data || []; },
    getStudentById: async (id) => { const { data } = await _supabase.from('students').select('*').eq('id', id).single(); return data; },
    addStudent: async (obj) => await _supabase.from('students').insert([obj]),
    removeStudent: async (id) => await _supabase.from('students').delete().eq('id', id),
    activateStudent: async (id) => await _supabase.from('students').update({ is_active: true }).eq('id', id),
    deactivateStudent: async (id) => await _supabase.from('students').update({ is_active: false }).eq('id', id),
    updateStudent: async (id, updates) => await _supabase.from('students').update(updates).eq('id', id),

    // ── CLASSES ─────────────────────────────────────────────────
    getAllClasses: async () => { const { data } = await _supabase.from('classes').select('*').order('name'); return data || []; },
    addClass: async (obj) => await _supabase.from('classes').insert([obj]),
    setClassTeacher: async (id, isCt, cls) => await _supabase.from('staff').update({ is_class_teacher: isCt, assigned_class: cls }).eq('id', id),

    // ── SCORES ──────────────────────────────────────────────────
    getClassScores: async (cls, sub, term, sess) => {
        const { data } = await _supabase.from('scores').select('*').eq('class_name', cls).eq('subject', sub).eq('term', term).eq('session', sess);
        return data || [];
    },
    getAllClassScores: async (cls, term, sess) => {
        const { data } = await _supabase.from('scores').select('*').eq('class_name', cls).eq('term', term).eq('session', sess);
        return data || [];
    },
    getStudentScores: async (studentId, term, sess) => {
        const { data } = await _supabase.from('scores').select('*').eq('student_id', studentId).eq('term', term).eq('session', sess).order('subject');
        return data || [];
    },
    saveScore: async (sid, sub, cls, ca, ex, term, sess) => {
        return await _supabase.from('scores').upsert(
            { student_id: sid, subject: sub, class_name: cls, ca_score: ca, exam_score: ex, term, session: sess },
            { onConflict: 'student_id,subject,term,session' }
        );
    },
    saveScoresBulk: async (rows) => await _supabase.from('scores').upsert(rows, { onConflict: 'student_id,subject,term,session' }),

    // ── ATTENDANCE ──────────────────────────────────────────────
    getStudentAttendance: async (studentId, term, sess) => {
        const { data } = await _supabase.from('attendance').select('*').eq('student_id', studentId).eq('term', term).eq('session', sess).order('date');
        return data || [];
    },
    getClassAttendanceByDate: async (cls, date) => {
        const { data } = await _supabase.from('attendance').select('*').eq('class_name', cls).eq('date', date);
        return data || [];
    },
    saveAttendanceBulk: async (rows) => await _supabase.from('attendance').upsert(rows, { onConflict: 'student_id,date' }),

    // ── PSYCHOMOTOR ─────────────────────────────────────────────
    getClassPsychomotor: async (cls, term, sess) => {
        const { data } = await _supabase.from('psychomotor').select('*').eq('class_name', cls).eq('term', term).eq('session', sess);
        return data || [];
    },
    getStudentPsychomotor: async (studentId, term, sess) => {
        const { data } = await _supabase.from('psychomotor').select('*').eq('student_id', studentId).eq('term', term).eq('session', sess).maybeSingle();
        return data || null;
    },
    getPsychomotorForTerm: async (term, sess) => {
        const { data } = await _supabase.from('psychomotor').select('*').eq('term', term).eq('session', sess);
        return data || [];
    },
    savePsychomotorDraft: async (rows) => await _supabase.from('psychomotor').upsert(rows, { onConflict: 'student_id,term,session' }),
    savePsychomotorBulk: async (rows, status) => {
        const withStatus = rows.map(r => ({ ...r, status: status || 'draft' }));
        return await _supabase.from('psychomotor').upsert(withStatus, { onConflict: 'student_id,term,session' });
    },
    submitPsychomotor: async (cls, term, sess) => await _supabase.from('psychomotor').update({ status: 'submitted' }).eq('class_name', cls).eq('term', term).eq('session', sess),
    approvePsychomotor: async (cls, term, sess) => await _supabase.from('psychomotor').update({ status: 'approved' }).eq('class_name', cls).eq('term', term).eq('session', sess),

    // ── NOTICES & LOGS ──────────────────────────────────────────
    getNotices: async (limit) => {
        const { data } = await _supabase.from('notices').select('*').order('created_at', { ascending: false }).limit(limit);
        return data || [];
    },
    sendNotice: async (title, message, audience, priority) => await _supabase.from('notices').insert([{ title, message, audience, priority }]),
    deleteNotice: async (id) => await _supabase.from('notices').delete().eq('id', id),
    logActivity: async (action, detail, aid) => await _supabase.from('activity_log').insert([{ action, detail, admin_id: aid }]),
    getActivityLog: async (limit) => {
        const { data } = await _supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(limit);
        return data || [];
    },

    // ── PASSWORDS ───────────────────────────────────────────────
    resetPassword: async (table, id, pw) => await _supabase.from(table).update({ password: pw }).eq('id', id),

    // ── GRADING ─────────────────────────────────────────────────
    // Returns { grade, remark } for a given total score and class name
    getGrade: (total, className) => {
        const t = Number(total) || 0;
        if (className && className.toString().toUpperCase().startsWith('SS')) {
            // WAEC senior school grading
            if (t >= 75) return { grade: 'A1', remark: 'Excellent' };
            if (t >= 70) return { grade: 'B2', remark: 'Very Good' };
            if (t >= 65) return { grade: 'B3', remark: 'Good' };
            if (t >= 60) return { grade: 'C4', remark: 'Credit' };
            if (t >= 55) return { grade: 'C5', remark: 'Credit' };
            if (t >= 50) return { grade: 'C6', remark: 'Credit' };
            if (t >= 45) return { grade: 'D7', remark: 'Pass' };
            if (t >= 40) return { grade: 'E8', remark: 'Pass' };
            return { grade: 'F9', remark: 'Fail' };
        }
        // JSS junior school grading
        if (t >= 70) return { grade: 'A', remark: 'Excellent' };
        if (t >= 40) return { grade: 'P', remark: 'Pass' };
        return { grade: 'F', remark: 'Fail' };
    },
    gradeFor: (cls, t) => DB.getGrade(t, cls).grade,
    gradeClassFor: (cls, t) => {
        const g = DB.getGrade(t, cls).grade;
        return 'g-' + g;
    },

    // ── FILE UPLOAD ──────────────────────────────────────────────
    uploadFile: async (file, bucket, path) => {
        if (!file) return null;
        if (!file.type.startsWith('image/')) throw new Error('Only image files are allowed');
        const { data, error } = await _supabase.storage.from(bucket).upload(path, file, { upsert: true });
        if (error) throw new Error('Upload failed: ' + error.message);
        const { data: { publicUrl } } = _supabase.storage.from(bucket).getPublicUrl(path);
        return publicUrl;
    }
};
