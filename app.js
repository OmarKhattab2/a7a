/**
 * STUDEX // Academic Planner (Bilingual)
 * Vanilla JS, IndexedDB, PWA Ready
 */

// --- AUDIO SYSTEM ---
let audioCtx = null;
let sfxEnabled = true;

function playSfx(type) {
    if (!sfxEnabled) return;
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'click') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
        } else if (type === 'success') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.setValueAtTime(900, now + 0.1);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        }
    } catch (e) {
        console.warn("Audio playback failed:", e);
    }
}

window.toggleAudio = function () {
    sfxEnabled = !sfxEnabled;
    localStorage.setItem('studex_sfx', sfxEnabled ? '1' : '0');
    updateAudioUI();
    if (sfxEnabled) playSfx('click');
};

function updateAudioUI() {
    const statusEl = document.getElementById('sfx-status');
    const toggleEl = document.getElementById('sfx-toggle');
    if (statusEl && toggleEl) {
        statusEl.textContent = sfxEnabled ? 'SND: ON' : 'SND: OFF';
        toggleEl.style.color = sfxEnabled ? 'var(--c-text-main)' : 'var(--c-danger)';
    }
}

// --- INDEXED DB SETUP ---
const DB_NAME = "StudexDB";
const DB_VERSION = 1;
let db = null;

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onupgradeneeded = (e) => {
            const database = e.target.result;
            if (!database.objectStoreNames.contains('schedule')) {
                const store = database.createObjectStore('schedule', { keyPath: 'id' });
                store.createIndex('subjectId', 'subjectId', { unique: false });
                store.createIndex('date', 'date', { unique: false });
                store.createIndex('status', 'status', { unique: false });
            }
            if (!database.objectStoreNames.contains('subjects')) {
                database.createObjectStore('subjects', { keyPath: 'id' });
            }
            if (!database.objectStoreNames.contains('metadata')) {
                database.createObjectStore('metadata', { keyPath: 'key' });
            }
        };

        request.onsuccess = (e) => {
            db = e.target.result;
            resolve();
        };

        request.onerror = (e) => reject(e.target.error);
    });
}

function dbPut(storeName, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(data);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

function dbGetAll(storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function dbGet(storeName, key) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function dbClear(storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// --- STATE MANAGEMENT ---
let appState = {
    metadata: { weekId: 'NONE', weekStart: null, weekEnd: null },
    subjects: [],
    sessions: [],
    scheduleFilter: 'all',
    currentDateStr: new Date().toISOString().split('T')[0]
};

async function loadData() {
    try {
        const metaList = await dbGetAll('metadata');
        metaList.forEach(m => {
            appState.metadata[m.key] = m.value;
        });
        
        appState.subjects = await dbGetAll('subjects');
        appState.sessions = await dbGetAll('schedule');
        
        // Settings load
        const storedSfx = localStorage.getItem('studex_sfx');
        if (storedSfx !== null) sfxEnabled = storedSfx === '1';
        updateAudioUI();
        
        const remTime = localStorage.getItem('studex_reminder_time') || '08:00';
        document.getElementById('setting-reminder-time').value = remTime;
        
        updateNotifUI();
        
        renderAll();
    } catch (e) {
        console.error("Failed to load data from DB", e);
        showToast("خطأ في تحميل قاعدة البيانات", "danger");
    }
}

// --- NAVIGATION ---
window.navigateMain = function(target) {
    document.querySelectorAll('.mech-nav-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.mech-nav-btn[data-target="${target}"]`);
    if (btn) btn.classList.add('active');

    document.querySelectorAll('.sys-view').forEach(v => {
        v.classList.remove('active');
        v.classList.add('hidden');
    });
    const view = document.getElementById(target);
    if (view) {
        view.classList.remove('hidden');
        view.classList.add('active');
    }
    
    if (target === 'analytics') renderAnalytics();
    
    window.scrollTo(0, 0);
};

document.querySelectorAll('.mech-nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        playSfx('click');
        navigateMain(e.currentTarget.getAttribute('data-target'));
    });
});

// --- RENDER ENGINE ---
function renderAll() {
    renderDashboard();
    renderSchedule();
    renderSubjects();
    if(document.getElementById('analytics').classList.contains('active')) {
        renderAnalytics();
    }
}

function getTodayStr() {
    return new Date().toISOString().split('T')[0];
}

function renderDashboard() {
    const today = getTodayStr();
    document.getElementById('dash-date-display').textContent = today;
    document.getElementById('dash-week-id').textContent = `WEEK_ID: ${appState.metadata.weekId || 'NONE'}`;
    
    let total = appState.sessions.length;
    let completed = appState.sessions.filter(s => s.status === 'completed').length;
    let remaining = total - completed;
    let pct = total === 0 ? 0 : Math.round((completed / total) * 100);
    
    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-completed').textContent = completed;
    document.getElementById('stat-remaining').textContent = remaining;
    document.getElementById('dash-progress-text').textContent = `${pct}%`;
    document.getElementById('dash-progress-fill').style.width = `${pct}%`;
    
    // Today's Feed
    const todaySessions = appState.sessions.filter(s => s.date === today);
    const dashTodayFeed = document.getElementById('dash-today-feed');
    if (todaySessions.length === 0) {
        dashTodayFeed.innerHTML = `<li class="text-muted">لا توجد مهام اليوم.</li>`;
    } else {
        dashTodayFeed.innerHTML = todaySessions.map(s => {
            const sub = appState.subjects.find(x => x.id === s.subjectId);
            const subName = sub ? sub.name : 'Unknown';
            const isComp = s.status === 'completed';
            return `
                <li>
                    <div style="text-decoration: ${isComp ? 'line-through' : 'none'}; opacity: ${isComp ? '0.5' : '1'};">
                        <span class="eng-text text-accent" dir="ltr">[${subName}]</span> ${s.title}
                    </div>
                    <span class="eng-text ${isComp ? 'text-success' : 'text-warning'}">${s.durationMinutes}m</span>
                </li>
            `;
        }).join('');
    }
    
    // Upcoming Feed
    let d = new Date();
    d.setDate(d.getDate() + 1);
    const tomorrow = d.toISOString().split('T')[0];
    d.setDate(d.getDate() + 1);
    const dayAfter = d.toISOString().split('T')[0];
    
    const upcoming = appState.sessions.filter(s => s.date === tomorrow || s.date === dayAfter);
    const upcomingFeed = document.getElementById('dash-upcoming-feed');
    if (upcoming.length === 0) {
        upcomingFeed.innerHTML = `<li class="text-muted">لا توجد جلسات قادمة.</li>`;
    } else {
        upcomingFeed.innerHTML = upcoming.map(s => {
            const sub = appState.subjects.find(x => x.id === s.subjectId);
            return `
                <li>
                    <div><span class="eng-text text-muted" dir="ltr">[${s.date}]</span> ${sub?sub.name:''} - ${s.title}</div>
                    <span class="eng-text text-muted">${s.durationMinutes}m</span>
                </li>
            `;
        }).join('');
    }
}

function renderSchedule() {
    const container = document.getElementById('schedule-container');
    const filterContainer = document.getElementById('schedule-filters');
    
    // Unique dates
    const dates = [...new Set(appState.sessions.map(s => s.date))].sort();
    
    // Build filters
    let filterHtml = `<button class="filter-btn ${appState.scheduleFilter==='all'?'active':''}" onclick="setSchedFilter('all')">SYS.ALL</button>`;
    dates.forEach(d => {
        filterHtml += `<button class="filter-btn ${appState.scheduleFilter===d?'active':''}" onclick="setSchedFilter('${d}')">${d}</button>`;
    });
    filterContainer.innerHTML = filterHtml;
    
    let filtered = appState.sessions;
    if (appState.scheduleFilter !== 'all') {
        filtered = filtered.filter(s => s.date === appState.scheduleFilter);
    }
    
    // Sort by date then status
    filtered.sort((a,b) => {
        if(a.date !== b.date) return a.date.localeCompare(b.date);
        return a.status.localeCompare(b.status);
    });
    filtered.sort((a,b) => (a.status === 'completed' ? 1 : 0) - (b.status === 'completed' ? 1 : 0));
    
    if (filtered.length === 0) {
        container.innerHTML = `<div class="empty-state eng-text text-muted">NO SESSIONS SCHEDULED.</div>`;
        return;
    }
    
    container.innerHTML = filtered.map(s => {
        const sub = appState.subjects.find(x => x.id === s.subjectId);
        const subName = sub ? sub.name : 'Unknown';
        const isComp = s.status === 'completed';
        
        return `
            <div class="data-card ${isComp ? 'completed' : ''}">
                <div class="card-media">
                    <span class="eng-text text-muted" style="font-size: 1.5rem;" dir="ltr">[ ${subName.substring(0,3).toUpperCase()} ]</span>
                    <span class="card-tag eng-text">${isComp ? 'COMPLETED' : 'PENDING'}</span>
                </div>
                <div class="card-body">
                    <div>
                        <div class="eng-text text-accent" style="font-size:0.75rem;">${subName}</div>
                        <h3 class="card-title" style="text-decoration: ${isComp?'line-through':'none'};">${s.title}</h3>
                    </div>
                    <div class="card-meta eng-text">
                        <span class="meta-item">DATE: ${s.date}</span>
                        <span class="meta-item">DUR: ${s.durationMinutes} MIN</span>
                    </div>
                    <div class="action-group mt-2">
                        <button class="solid-btn ${isComp ? 'outline-btn' : 'success-btn'} w-full" onclick="toggleSession('${s.id}')">
                            <span class="btn-text eng-text">${isComp ? 'MARK PENDING' : 'MARK COMPLETED'}</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

window.setSchedFilter = function(val) {
    appState.scheduleFilter = val;
    playSfx('click');
    renderSchedule();
}

window.toggleSession = async function(id) {
    const s = appState.sessions.find(x => x.id === id);
    if (!s) return;
    
    s.status = s.status === 'completed' ? 'pending' : 'completed';
    playSfx(s.status === 'completed' ? 'success' : 'click');
    
    try {
        await dbPut('schedule', s);
        renderAll();
    } catch(e) {
        console.error(e);
        showToast("فشل الحفظ", "danger");
    }
}

function renderSubjects() {
    const container = document.getElementById('subjects-container');
    if (appState.subjects.length === 0) {
        container.innerHTML = `<div class="empty-state eng-text text-muted">NO SUBJECTS LOGGED.</div>`;
        return;
    }
    
    container.innerHTML = appState.subjects.map(sub => {
        const subSessions = appState.sessions.filter(s => s.subjectId === sub.id);
        const total = subSessions.length;
        const comp = subSessions.filter(s => s.status === 'completed').length;
        const pct = total === 0 ? 0 : Math.round((comp/total)*100);
        
        return `
            <div class="data-card subject-card" onclick="openSubjectDetail('${sub.id}')">
                <div class="card-body" style="justify-content:center;">
                    <h3 class="card-title eng-text text-accent mb-2" style="font-size:1.5rem;">${sub.name}</h3>
                    <div class="eng-text text-muted" style="font-size:0.8rem; display:flex; justify-content:space-between;">
                        <span>TASKS: ${total}</span>
                        <span>DONE: ${comp}</span>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar-fill" style="width:${pct}%;"></div>
                        <span class="progress-bar-text" dir="ltr">${pct}%</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

window.openSubjectDetail = function(subId) {
    const sub = appState.subjects.find(x => x.id === subId);
    if (!sub) return;
    
    document.getElementById('subject-detail-title').textContent = sub.name;
    document.getElementById('subject-detail-id').textContent = `SUB_ID: ${sub.id}`;
    
    const subSessions = appState.sessions.filter(s => s.subjectId === sub.id);
    const total = subSessions.length;
    const comp = subSessions.filter(s => s.status === 'completed').length;
    const pct = total === 0 ? 0 : Math.round((comp/total)*100);
    
    document.getElementById('subject-detail-pct').textContent = `${pct}%`;
    document.getElementById('subject-detail-count').textContent = `${comp} / ${total}`;
    document.getElementById('subject-detail-fill').style.width = `${pct}%`;
    
    const container = document.getElementById('subject-sessions-container');
    
    if (subSessions.length === 0) {
        container.innerHTML = `<div class="empty-state eng-text text-muted">NO SESSIONS LOGGED.</div>`;
    } else {
        subSessions.sort((a,b) => a.date.localeCompare(b.date));
        container.innerHTML = subSessions.map(s => {
            const isComp = s.status === 'completed';
            return `
                <div class="data-card ${isComp ? 'completed' : ''}">
                    <div class="card-body">
                        <div>
                            <span class="card-tag eng-text" style="position:relative; float:left; top:0; left:0;">${isComp ? 'COMPLETED' : 'PENDING'}</span>
                            <h3 class="card-title" style="text-decoration: ${isComp?'line-through':'none'}; margin-top:10px;">${s.title}</h3>
                        </div>
                        <div class="card-meta eng-text">
                            <span class="meta-item">DATE: ${s.date}</span>
                            <span class="meta-item">DUR: ${s.durationMinutes} MIN</span>
                        </div>
                        <div class="action-group mt-2">
                            <button class="solid-btn ${isComp ? 'outline-btn' : 'success-btn'} w-full" onclick="toggleSessionSubDetail('${s.id}', '${sub.id}')">
                                <span class="btn-text eng-text">${isComp ? 'MARK PENDING' : 'MARK COMPLETED'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    navigateMain('subject-detail');
}

window.toggleSessionSubDetail = async function(sessionId, subId) {
    await toggleSession(sessionId);
    openSubjectDetail(subId);
}

function renderAnalytics() {
    let total = appState.sessions.length;
    let comp = appState.sessions.filter(s => s.status === 'completed').length;
    let pct = total === 0 ? 0 : Math.round((comp/total)*100);
    
    document.getElementById('analytics-pct').textContent = `${pct}%`;
    document.getElementById('analytics-ratio').textContent = `${comp} / ${total}`;
    
    const barsContainer = document.getElementById('analytics-subject-bars');
    
    if (appState.subjects.length === 0) {
        barsContainer.innerHTML = `<div class="text-muted eng-text">NO DATA</div>`;
        return;
    }
    
    barsContainer.innerHTML = appState.subjects.map(sub => {
        const s = appState.sessions.filter(x => x.subjectId === sub.id);
        const t = s.length;
        const c = s.filter(x => x.status === 'completed').length;
        const p = t === 0 ? 0 : Math.round((c/t)*100);
        
        return `
            <div>
                <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:5px;">
                    <strong class="text-accent">${sub.name}</strong>
                    <span class="eng-text text-muted" dir="ltr">${c}/${t} (${p}%)</span>
                </div>
                <div class="progress-bar-container" style="margin-top:0;">
                    <div class="progress-bar-fill" style="width:${p}%;"></div>
                </div>
            </div>
        `;
    }).join('');
}


// --- JSON IMPORT LOGIC (MERGE MODE) ---
window.document.getElementById('import-file').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (ev) => {
        try {
            const data = JSON.parse(ev.target.result);
            if (!data.weekId || !data.subjects || !Array.isArray(data.subjects)) {
                throw new Error("Invalid format");
            }
            
            // Meta
            await dbPut('metadata', {key: 'weekId', value: data.weekId});
            if (data.weekStart) await dbPut('metadata', {key: 'weekStart', value: data.weekStart});
            if (data.weekEnd) await dbPut('metadata', {key: 'weekEnd', value: data.weekEnd});
            
            // Subjects & Sessions Merge
            for (const sub of data.subjects) {
                if (!sub.id || !sub.name || !Array.isArray(sub.sessions)) continue;
                
                await dbPut('subjects', { id: sub.id, name: sub.name });
                
                for (const s of sub.sessions) {
                    if (!s.id || !s.title || !s.date) continue;
                    
                    const existing = await dbGet('schedule', s.id);
                    let statusToSave = 'pending';
                    
                    if (existing) {
                        statusToSave = existing.status;
                    } else if (s.status) {
                        statusToSave = s.status;
                    }
                    
                    await dbPut('schedule', {
                        id: s.id,
                        subjectId: sub.id,
                        title: s.title,
                        date: s.date,
                        durationMinutes: s.durationMinutes || 60,
                        status: statusToSave
                    });
                }
            }
            
            playSfx('success');
            showToast("تم استيراد الجدول ودمجه بنجاح", "success");
            await loadData();
            
        } catch(err) {
            console.error(err);
            showToast("خطأ في الاستيراد: ملف JSON غير صالح", "danger");
        }
        e.target.value = '';
    };
    reader.readAsText(file);
});

// --- BACKUP & RESTORE ---
window.exportBackup = async function() {
    try {
        const meta = await dbGetAll('metadata');
        const subjects = await dbGetAll('subjects');
        const sessions = await dbGetAll('schedule');
        
        const backup = {
            _isBackup: true,
            timestamp: new Date().toISOString(),
            metadata: meta,
            subjects: subjects,
            schedule: sessions
        };
        
        const a = document.createElement('a');
        a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup));
        a.download = `STUDEX_BACKUP_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        playSfx('success');
    } catch(e) {
        showToast("فشل التصدير", "danger");
    }
}

window.restoreBackup = function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!confirm('تحذير: استعادة النسخة الاحتياطية ستمسح جميع البيانات الحالية. هل ترغب بالاستمرار؟')) {
        e.target.value = '';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = async (ev) => {
        try {
            const d = JSON.parse(ev.target.result);
            if (!d._isBackup) throw new Error("Not a valid backup file.");
            
            await dbClear('metadata');
            await dbClear('subjects');
            await dbClear('schedule');
            
            for (let m of d.metadata) await dbPut('metadata', m);
            for (let s of d.subjects) await dbPut('subjects', s);
            for (let s of d.schedule) await dbPut('schedule', s);
            
            playSfx('success');
            showToast("تم استعادة البيانات", "success");
            await loadData();
        } catch (err) {
            showToast("ملف النسخة الاحتياطية تالف", "danger");
        }
        e.target.value = '';
    };
    reader.readAsText(file);
}

window.wipeData = async function() {
    if(confirm('مسح النظام: سيتم حذف جميع البيانات نهائياً. هل أنت متأكد؟')) {
        await dbClear('metadata');
        await dbClear('subjects');
        await dbClear('schedule');
        location.reload();
    }
}

// --- MODALS & TOAST ---
window.showModal = function(id) {
    const m = document.getElementById(id);
    if (m) {
        m.classList.add('active');
        playSfx('click');
    }
}

window.hideModal = function(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('active');
}

window.showToast = function(msg, type = 'primary') {
    const r = document.getElementById('toast-rack');
    if (!r) return;

    const t = document.createElement('div');
    t.className = `sys-toast ${type === 'danger' ? 'sys-toast-danger' : type === 'success' ? 'sys-toast-success' : (type === 'warning' ? 'sys-toast-warning' : '')}`;
    t.textContent = msg;
    r.appendChild(t);

    setTimeout(() => {
        t.style.opacity = '0';
        setTimeout(() => t.remove(), 200);
    }, 3000);
}

// --- NOTIFICATIONS & REMINDERS ---
function updateNotifUI() {
    const btn = document.getElementById('btn-toggle-notif');
    const txt = document.getElementById('notif-status-text');
    if(!btn || !txt) return;
    
    const p = Notification.permission;
    if (p === 'granted') {
        txt.textContent = 'ENABLED';
        btn.style.borderColor = 'var(--c-success)';
        btn.style.color = 'var(--c-success)';
    } else if (p === 'denied') {
        txt.textContent = 'BLOCKED';
        btn.style.borderColor = 'var(--c-danger)';
        btn.style.color = 'var(--c-danger)';
    } else {
        txt.textContent = 'OFF (CLICK TO ENABLE)';
        btn.style.borderColor = 'var(--c-border-bright)';
        btn.style.color = 'var(--c-text-main)';
    }
}

window.toggleNotifications = async function() {
    playSfx('click');
    if (!('Notification' in window)) {
        showToast("المتصفح غير مدعوم", "danger");
        return;
    }
    
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        const p = await Notification.requestPermission();
        if (p === 'granted') {
            showToast("تم تفعيل الإشعارات", "success");
            scheduleDailyNotification();
        }
    } else if (Notification.permission === 'granted') {
        showToast("مفعلة بالفعل", "success");
    } else {
        showToast("قم بتغيير الإذن من إعدادات المتصفح", "warning");
    }
    updateNotifUI();
}

window.saveReminderTime = function() {
    const val = document.getElementById('setting-reminder-time').value;
    localStorage.setItem('studex_reminder_time', val);
    showToast("تم تحديث وقت التذكير", "success");
    scheduleDailyNotification();
}

function scheduleDailyNotification() {
    if (Notification.permission !== 'granted') return;
    if (!('serviceWorker' in navigator)) return;
    
    navigator.serviceWorker.ready.then(reg => {
        console.log("Notification scheduling registered in local context. Note: background execution may be suspended by mobile OS.");
    });
}

function showInAppDailySummary() {
    const today = getTodayStr();
    const lastSummary = localStorage.getItem('studex_last_summary_date');
    if (lastSummary === today) return;
    
    const todaySessions = appState.sessions.filter(s => s.date === today);
    if (todaySessions.length === 0) return;
    
    const total = todaySessions.length;
    const comp = todaySessions.filter(s => s.status === 'completed').length;
    
    const pastPending = appState.sessions.filter(s => s.date < today && s.status === 'pending');
    
    let html = `
        <h3 class="eng-text text-accent mb-2">DATE: <span dir="ltr">${today}</span></h3>
        <p class="mb-3">Today's Sessions — جلسات اليوم:</p>
        <div class="tactical-stats-grid mb-3">
            <div class="stat-block" style="padding:10px;">
                <div class="stat-label eng-text">Planned</div>
                <div class="stat-val eng-text" dir="ltr">${total}</div>
            </div>
            <div class="stat-block" style="padding:10px;">
                <div class="stat-label eng-text">Completed</div>
                <div class="stat-val eng-text text-success" dir="ltr">${comp}</div>
            </div>
            <div class="stat-block" style="padding:10px;">
                <div class="stat-label eng-text">Overdue</div>
                <div class="stat-val eng-text text-danger" dir="ltr">${pastPending.length}</div>
            </div>
        </div>
        <button class="solid-btn outline-btn w-full" onclick="localStorage.setItem('studex_last_summary_date', '${today}'); hideModal('daily-summary-modal')">
            <span class="btn-text">تأكيد واستلام</span>
        </button>
    `;
    
    document.getElementById('daily-summary-body').innerHTML = html;
    setTimeout(() => {
        showModal('daily-summary-modal');
    }, 1000);
}

// --- PWA CLIENT HOOKS ---
let deferredPrompt = null;
const installBtn = document.getElementById('install-btn');
const iosHint = document.getElementById('ios-install-hint');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) installBtn.classList.remove('hidden');
});

if (installBtn) {
    installBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response to prompt: ${outcome}`);
            deferredPrompt = null;
            installBtn.classList.add('hidden');
        }
    });
}
const modalInstallBtn = document.getElementById('modal-install-btn');
if(modalInstallBtn) {
    modalInstallBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            deferredPrompt = null;
            hideModal('pwa-install-modal');
            if (installBtn) installBtn.classList.add('hidden');
        }
    });
}

const isIos = () => /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
const isInStandaloneMode = () => ('standalone' in window.navigator) && (window.navigator.standalone);

if (isIos() && !isInStandaloneMode() && iosHint) {
    iosHint.classList.remove('hidden');
}

// --- BOOT SEQUENCE ---
window.addEventListener('load', async () => {
    try {
        await initDB();
        await loadData();
        showInAppDailySummary();
    } catch(e) {
        console.error("Boot failure", e);
    }

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(err => {
            console.warn('Service Worker registration failed:', err);
        });
    }
});
