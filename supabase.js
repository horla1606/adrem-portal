// supabase.js
const { createClient } = supabase;
const _supabase = createClient('https://ktiunkthfdjllfivnamz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0aXVua3RoZmRqbGxmaXZuYW16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NjMzMDUsImV4cCI6MjA4NzMzOTMwNX0.vmxUuqWKMFpIQgU9s_bEYMFIQN5_QQckpIE1iusrY-8');

const DB = {
    // AUTH
    requireAuth: (role) => {
        const user = JSON.parse(sessionStorage.getItem('adrem_user'));
        if (!user || (role && user.role !== role)) {
            window.location.href = 'staff-login.html';
            return null;
        }
        return user;
    },
    listenForLogout: () => {
        window.addEventListener('storage', (e) => { if (e.key === 'adrem_logout') window.location.href = 'staff-login.html'; });
    },

    // SETTINGS
    getSettings: async () => {
        const { data } = await _supabase.from('settings').select('*').eq('id', 1).single();
        return data;
    },
    saveSettings: async (updates) => await _supabase.from('settings').update(updates).eq('id', 1),
    setResultsPublished: async (val) => await _supabase.from('settings').update({ results_published: val }).eq('id', 1),

    // STAFF & STUDENTS
    getAllStaff: async () => { const { data } = await _supabase.from('staff').select('*').order('name'); return data || []; },
    getAllStudents: async () => { const { data } = await _supabase.from('students').select('*').order('name'); return data || []; },
    getClassStudents: async (cls) => { const { data } = await _supabase.from('students').select('*').eq('class', cls).order('name'); return data || []; },
    addStudent: async (obj) => await _supabase.from('students').insert([obj]),
    addStaff: async (obj) => await _supabase.from('staff').insert([obj]),
    removeStudent: async (id) => await _supabase.from('students').delete().eq('id', id),
    removeStaff: async (id) => await _supabase.from('staff').delete().eq('id', id),
    activateStudent: async (id) => await _supabase.from('students').update({ is_active: true }).eq('id', id),
    deactivateStudent: async (id) => await _supabase.from('students').update({ is_active: false }).eq('id', id),
    activateStaff: async (id) => await _supabase.from('staff').update({ is_active: true }).eq('id', id),
    deactivateStaff: async (id) => await _supabase.from('staff').update({ is_active: false }).eq('id', id),

    // CLASSES
    getAllClasses: async () => { const { data } = await _supabase.from('classes').select('*').order('name'); return data || []; },
    addClass: async (obj) => await _supabase.from('classes').insert([obj]),
    setClassTeacher: async (id, isCt, cls) => await _supabase.from('staff').update({ is_class_teacher: isCt, assigned_class: cls }).eq('id', id),

    // SCORES
    getClassScores: async (cls, sub, term, sess) => {
        const { data } = await _supabase.from('scores').select('*').eq('class_name', cls).eq('subject', sub).eq('term', term).eq('session', sess);
        return data || [];
    },
    getAllClassScores: async (cls, term, sess) => {
        const { data } = await _supabase.from('scores').select('*').eq('class_name', cls).eq('term', term).eq('session', sess);
        return data || [];
    },
    saveScore: async (sid, sub, cls, ca, ex, term, sess) => {
        return await _supabase.from('scores').upsert({ student_id: sid, subject: sub, class_name: cls, ca_score: ca, exam_score: ex, term, session: sess }, { onConflict: 'student_id,subject,term,session' });
    },
    saveScoresBulk: async (rows) => await _supabase.from('scores').upsert(rows, { onConflict: 'student_id,subject,term,session' }),

    // PSYCHOMOTOR
    getClassPsychomotor: async (cls, term, sess) => {
        const { data } = await _supabase.from('psychomotor').select('*').eq('class_name', cls).eq('term', term).eq('session', sess);
        return data || [];
    },
    approvePsychomotor: async (cls, term, sess) => await _supabase.from('psychomotor').update({ status: 'approved' }).eq('class_name', cls).eq('term', term).eq('session', sess),

    // NOTICES & LOGS
    getNotices: async (limit) => { const { data } = await _supabase.from('notices').select('*').order('created_at', { ascending: false }).limit(limit); return data || []; },
    sendNotice: async (title, message, audience, priority) => await _supabase.from('notices').insert([{ title, message, audience, priority }]),
    deleteNotice: async (id) => await _supabase.from('notices').delete().eq('id', id),
    logActivity: async (action, detail, aid) => await _supabase.from('activity_log').insert([{ action, detail, admin_id: aid }]),
    getActivityLog: async (limit) => { const { data } = await _supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(limit); return data || []; },

    // PASSWORDS
    resetPassword: async (table, id, pw) => await _supabase.from(table).update({ password: pw }).eq('id', id),
    
    // UTILS
    selectRaw: async (table, query) => {
        const { data } = await _supabase.from(table).select('*').url.searchParams.append('query', query);
        return data || [];
    },
    gradeFor: (cls, t) => (cls.startsWith('SS') ? waecGrade(t) : jssGrade(t)),
    gradeClassFor: (cls, t) => (cls.startsWith('SS') ? waecGradeClass(t) : jssGradeClass(t))
};