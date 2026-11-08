// script.js
/**
 * LIFEXP // OS PROD v1.0
 * Clean Production Build with robust logic and local storage limiters.
 */

const STORAGE_KEY = 'lifexp_os_prod_v1';
const LEVELS = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200];

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
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
        } else if (type === 'success') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.setValueAtTime(1200, now + 0.1);
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
    state.uiSettings.sfxOn = sfxEnabled;
    saveState();
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

// --- STATE MANAGEMENT ---
let state = {
    profile: { name: 'OPERATIVE', level: 1, xp: 0, coins: 0 },
    quests: [],
    store: [],
    inventory: [],
    transactions: [],
    achievements: [],
    stats: { completedQuests: 0, totalEarned: 0, totalSpent: 0 },
    uiSettings: { lastView: 'dashboard', sfxOn: true, questFilter: 'all' }
};

const sysAchievements = [
    { id: 'A_01', title: 'العملية الأولى', desc: 'تم إنجاز وتوثيق أول عملية ميدانية بنجاح.', condition: (s) => s.stats.completedQuests >= 1 },
    { id: 'A_02', title: 'استمرارية تكتيكية', desc: 'تم إنجاز 10 مهام معتمدة.', condition: (s) => s.stats.completedQuests >= 10 },
    { id: 'A_03', title: 'رصيد مؤمّن', desc: 'تم جمع 500 وحدة مالية إجمالاً.', condition: (s) => s.stats.totalEarned >= 500 }
];

function generateId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const parsedState = JSON.parse(saved);
            if (parsedState && typeof parsedState === 'object') {
                state = parsedState;
                if (!Array.isArray(state.quests)) state.quests = [];
                if (!Array.isArray(state.store)) state.store = [];
                if (!Array.isArray(state.inventory)) state.inventory = [];
                if (!Array.isArray(state.transactions)) state.transactions = [];
                if (!Array.isArray(state.achievements)) state.achievements = [];
                if (!state.profile) state.profile = { name: 'OPERATIVE', level: 1, xp: 0, coins: 0 };
                if (!state.stats) state.stats = { completedQuests: 0, totalEarned: 0, totalSpent: 0 };
                if (!state.uiSettings) state.uiSettings = { lastView: 'dashboard', sfxOn: true, questFilter: 'all' };
            } else {
                throw new Error("Invalid root structure");
            }
        } catch (e) {
            console.error("State reconstruction failed:", e);
            saveState();
        }
    } else {
        saveState();
    }
}

function saveState() {
    try {
        if (state.transactions.length > 100) {
            state.transactions = state.transactions.slice(0, 100);
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        return true;
    } catch (e) {
        console.error("CRITICAL I/O ERROR: LocalStorage write blocked.", e);
        return false;
    }
}

// --- NAVIGATION ---
let currentFilter = 'all';

document.querySelectorAll('.mech-nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        playSfx('click');
        navigateMain(e.currentTarget.getAttribute('data-target'), true);
    });
});

document.querySelectorAll('.profile-module-card, .profile-system-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
        playSfx('click');
        navigateSub(e.currentTarget.getAttribute('data-sub'), true);
    });
});

document.querySelectorAll('[data-back]').forEach(btn => {
    btn.addEventListener('click', (e) => {
        playSfx('click');
        navigateMain(e.currentTarget.getAttribute('data-back'), true);
    });
});

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        playSfx('click');
        const filter = e.currentTarget.getAttribute('data-filter');
        currentFilter = filter;

        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');

        state.uiSettings.questFilter = filter;
        saveState();
        renderQuests();
    });
});

function navigateMain(target, recordHistory = false) {
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

    if (recordHistory) {
        state.uiSettings.lastView = target;
        saveState();
    }
    window.scrollTo(0, 0);
}

function navigateSub(target, recordHistory = true) {
    document.querySelectorAll('.sys-view').forEach(v => {
        v.classList.remove('active');
        v.classList.add('hidden');
    });
    const view = document.getElementById(target);
    if (view) {
        view.classList.remove('hidden');
        view.classList.add('active');
    }
    if (target === 'stats') renderStats();

    if (recordHistory) {
        state.uiSettings.lastView = target;
        saveState();
    }
    window.scrollTo(0, 0);
}

// --- RENDER ENGINE ---
function updateUI() {
    renderDashboard();
    renderQuests();
    renderApprovals();
    renderStore();
    renderInventory();
    renderWallet();
    renderAchievements();
    checkLvlUp();
    checkAchieve();

    const pCount = state.quests.filter(q => q.status === 'pending').length;
    const badge1 = document.getElementById('pending-badge');
    const badge2 = document.getElementById('menu-pending-badge');
    if (pCount > 0) {
        if (badge1) badge1.classList.remove('hidden');
        if (badge2) badge2.classList.remove('hidden');
    } else {
        if (badge1) badge1.classList.add('hidden');
        if (badge2) badge2.classList.add('hidden');
    }
}

function renderDashboard() {
    const p = state.profile;
    document.querySelectorAll('#player-name-display').forEach(el => el.textContent = p.name);

    const settingName = document.getElementById('setting-name');
    if (settingName) settingName.value = p.name;

    const dashLevel = document.getElementById('dash-level');
    if (dashLevel) dashLevel.textContent = p.level < 10 ? `0${p.level}` : p.level;

    const dashXp = document.getElementById('dash-xp');
    if (dashXp) dashXp.textContent = p.xp;

    const dashCoins = document.getElementById('dash-coins');
    if (dashCoins) dashCoins.textContent = p.coins;

    const dashCompleted = document.getElementById('dash-completed');
    if (dashCompleted) dashCompleted.textContent = state.stats.completedQuests;

    const profileCoins = document.getElementById('profile-coins');
    if (profileCoins) profileCoins.textContent = p.coins;

    const profilePending = document.getElementById('profile-pending');
    if (profilePending) profilePending.textContent = state.quests.filter(q => q.status === 'pending').length;

    const actQ = state.quests.find(q => q.status === 'available');
    const briefingTitle = document.getElementById('briefing-title-dynamic');
    if (briefingTitle) briefingTitle.textContent = actQ ? actQ.title : 'لا توجد مهام بانتظار الإنجاز';

    const nextXp = LEVELS[p.level] || (LEVELS[LEVELS.length - 1] + (p.level - 9) * 1000);
    const prevXp = LEVELS[p.level - 1] || 0;

    const nextXpEl = document.getElementById('dash-next-xp');
    if (nextXpEl) nextXpEl.textContent = nextXp;

    let prog = nextXp > prevXp ? ((p.xp - prevXp) / (nextXp - prevXp)) * 100 : 100;
    const xpFill = document.getElementById('dash-xp-fill');
    if (xpFill) xpFill.style.width = `${Math.min(Math.max(prog, 0), 100)}%`;

    const feed = document.getElementById('dash-overview');
    if (feed) {
        const rx = [...state.transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 4);
        if (rx.length === 0) {
            feed.innerHTML = `<li class="text-muted">NO LOGS DETECTED.</li>`;
        } else {
            feed.innerHTML = rx.map(tx => `
                <li>
                    <span>${tx.desc}</span>
                    <span class="eng-text ${tx.amount > 0 ? 'text-green' : 'text-red'}">${tx.amount > 0 ? '+' : ''}${tx.amount} CR</span>
                </li>
            `).join('');
        }
    }
}

// -- QUESTS --
function renderQuests() {
    const container = document.getElementById('quests-container');
    if (!container) return;

    let qList = state.quests.filter(q => q.status === 'available');
    if (currentFilter !== 'all') qList = qList.filter(q => q.category === currentFilter);

    if (qList.length === 0) {
        container.innerHTML = `<div class="empty-state eng-text text-muted">NO ACTIVE DIRECTIVES.</div>`;
        return;
    }

    container.innerHTML = qList.map(q => `
        <div class="data-card">
            <div class="card-media">
                <div class="eng-text text-muted" style="font-size: 2rem;">{ OP }</div>
                <span class="card-tag eng-text" style="color:var(--c-${q.diff === 'Easy' ? 'green' : q.diff === 'Medium' ? 'gold' : q.diff === 'Hard' ? 'accent' : 'danger'}); border-color:currentColor;">THREAT_${q.diff.toUpperCase()}</span>
            </div>
            <div class="card-body">
                <h3 class="card-title">${q.title}</h3>
                <div class="card-bounty eng-text">
                    <span class="bounty-item text-gold">REWARD: ${q.coins} CR</span>
                    <span class="bounty-item text-accent">EXP: ${q.xp}</span>
                </div>
                <div class="action-group">
                    <button class="solid-btn primary-btn w-full" onclick="submitQuest('${q.id}')"><span class="btn-text">إنجاز</span></button>
                    <button class="solid-btn danger-btn" onclick="deleteQuest('${q.id}')" aria-label="Delete">X</button>
                </div>
            </div>
        </div>
    `).join('');
}

window.openQuestModal = function () {
    document.getElementById('q-title').value = '';
    document.getElementById('q-coins').value = '50';
    document.getElementById('q-xp').value = '30';
    showModal('quest-modal');
};

window.saveQuest = async function () {
    const btn = document.querySelector('#quest-modal .primary-btn');
    const originalText = btn ? btn.innerHTML : '<span class="btn-text">تسجيل وتأكيد</span>';

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="btn-text">جاري المعالجة...</span>';
        }
        await new Promise(resolve => setTimeout(resolve, 150));

        const titleEl = document.getElementById('q-title');
        const catEl = document.getElementById('q-category');
        const diffEl = document.getElementById('q-diff');
        const coinsEl = document.getElementById('q-coins');
        const xpEl = document.getElementById('q-xp');

        const t = titleEl.value.trim();
        if (!t) {
            showToast('DATA ERROR: TITLE REQUIRED', 'danger');
            return;
        }

        const newQuest = {
            id: generateId(),
            title: t,
            category: catEl.value,
            diff: diffEl.value,
            coins: Math.max(0, parseInt(coinsEl.value, 10) || 0),
            xp: Math.max(0, parseInt(xpEl.value, 10) || 0),
            status: 'available',
            date: new Date().toISOString()
        };

        state.quests.unshift(newQuest);
        if (!saveState()) {
            state.quests.shift();
            throw new Error("Storage validation failed");
        }

        playSfx('success');
        hideModal('quest-modal');
        showToast('DIRECTIVE ADDED', 'success');
        updateUI();
    } catch (error) {
        showToast('SYSTEM ERROR: FAILED TO SAVE', 'danger');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
};

window.submitQuest = function (id) {
    const q = state.quests.find(x => x.id === id);
    if (q && q.status === 'available') {
        q.status = 'pending';
        playSfx('click');
        saveState();
        showToast('AWAITING AUTH', 'success');
        updateUI();
    }
};

window.deleteQuest = function (id) {
    if (confirm('تحذير النظام: هل أنت متأكد من مسح هذه العملية نهائياً؟')) {
        state.quests = state.quests.filter(q => q.id !== id);
        saveState();
        playSfx('click');
        showToast('DIRECTIVE DELETED', 'success');
        updateUI();
    }
};

// -- APPROVALS --
function renderApprovals() {
    const container = document.getElementById('approvals-container');
    if (!container) return;

    const p = state.quests.filter(q => q.status === 'pending');
    if (p.length === 0) {
        container.innerHTML = `<div class="empty-state eng-text text-muted">ALL CLEAR. NO PENDING TASKS.</div>`;
        return;
    }

    container.innerHTML = p.map(q => `
        <div class="data-card" style="border-color:var(--c-gold);">
            <div class="card-body">
                <div class="eng-text text-gold" style="font-size:0.75rem; margin-bottom:5px;">PENDING_AUTH // TSK_${q.id}</div>
                <h3 class="card-title">${q.title}</h3>
                <div class="card-bounty eng-text">
                    <span class="bounty-item text-gold">CR: +${q.coins}</span>
                    <span class="bounty-item text-accent">EXP: +${q.xp}</span>
                </div>
                <div style="display:flex; gap:10px;">
                    <button class="solid-btn outline-btn w-full" style="color:var(--c-green); border-color:var(--c-green);" onclick="appQ('${q.id}')">APPROVE</button>
                    <button class="solid-btn danger-btn w-full" onclick="rejQ('${q.id}')">REJECT</button>
                </div>
            </div>
        </div>
    `).join('');
}

window.appQ = function (id) {
    const q = state.quests.find(x => x.id === id);
    if (q && q.status === 'pending') {
        q.status = 'completed';
        state.profile.coins += q.coins;
        state.profile.xp += q.xp;
        state.stats.completedQuests++;
        state.stats.totalEarned += q.coins;
        state.transactions.push({ id: generateId(), desc: `AUTH: ${q.title}`, amount: q.coins, date: new Date().toISOString() });

        playSfx('success');
        checkLvlUp();
        saveState();
        showToast(`FUNDS DEPOSITED: +${q.coins} CR`, 'success');
        updateUI();
    }
};

window.rejQ = function (id) {
    const q = state.quests.find(x => x.id === id);
    if (q && q.status === 'pending') {
        q.status = 'available';
        playSfx('click');
        saveState();
        showToast('AUTH REJECTED', 'danger');
        updateUI();
    }
};

// -- STORE & INV --
function renderStore() {
    const container = document.getElementById('store-container');
    if (!container) return;

    if (state.store.length === 0) {
        container.innerHTML = `<div class="empty-state eng-text text-muted">MARKET OFFLINE. ADD ITEMS.</div>`;
        return;
    }

    container.innerHTML = state.store.map(r => `
        <div class="data-card">
            <div class="card-media">
                 <div class="eng-text text-muted" style="font-size: 2rem;">[+]</div>
                <span class="card-tag eng-text" style="color:var(--c-gold); border-color:var(--c-gold);">${r.price} CR</span>
            </div>
            <div class="card-body">
                <h3 class="card-title">${r.title}</h3>
                <div class="action-group">
                    <button class="solid-btn outline-btn w-full" onclick="buyR('${r.id}')"><span class="btn-text">PURCHASE</span></button>
                    <button class="solid-btn danger-btn" onclick="deleteReward('${r.id}')" aria-label="Delete">X</button>
                </div>
            </div>
        </div>
    `).join('');
}

window.openRewardModal = function () {
    document.getElementById('r-title').value = '';
    document.getElementById('r-price').value = '150';
    showModal('reward-modal');
};

window.saveReward = async function () {
    const btn = document.querySelector('#reward-modal .primary-btn');
    const originalText = btn ? btn.innerHTML : '<span class="btn-text">إدراج بالسوق</span>';

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="btn-text">جاري المعالجة...</span>';
        }
        await new Promise(resolve => setTimeout(resolve, 150));

        const titleEl = document.getElementById('r-title');
        const priceEl = document.getElementById('r-price');

        const t = titleEl.value.trim();
        const p = parseInt(priceEl.value, 10) || 0;

        if (!t || p <= 0) {
            showToast('INVALID PARAMS', 'danger');
            return;
        }

        const newReward = { id: generateId(), title: t, price: p };
        state.store.push(newReward);

        if (!saveState()) {
            state.store.pop();
            throw new Error("Storage validation failed");
        }

        playSfx('success');
        hideModal('reward-modal');
        showToast('ASSET LISTED', 'success');
        updateUI();
    } catch (error) {
        showToast('SYSTEM ERROR: FAILED TO SAVE', 'danger');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
};

window.buyR = function (id) {
    const r = state.store.find(x => x.id === id);
    if (!r) return;

    if (state.profile.coins >= r.price) {
        state.profile.coins -= r.price;
        state.stats.totalSpent += r.price;
        state.inventory.unshift({ id: generateId(), title: r.title, price: r.price, status: 'unused', date: new Date().toISOString() });
        state.transactions.push({ id: generateId(), desc: `BUY: ${r.title}`, amount: -r.price, date: new Date().toISOString() });

        playSfx('success');
        saveState();
        showToast('ASSET ACQUIRED', 'success');
        updateUI();
    } else {
        showToast('INSUFFICIENT FUNDS', 'danger');
    }
};

window.deleteReward = function (id) {
    if (confirm('تحذير النظام: هل أنت متأكد من مسح هذه المكافأة من السوق؟')) {
        state.store = state.store.filter(r => r.id !== id);
        saveState();
        playSfx('click');
        showToast('ASSET REMOVED', 'success');
        updateUI();
    }
};

function renderInventory() {
    const container = document.getElementById('inventory-container');
    if (!container) return;

    if (state.inventory.length === 0) {
        container.innerHTML = `<div class="empty-state eng-text text-muted">STORAGE EMPTY.</div>`;
        return;
    }

    container.innerHTML = state.inventory.map(i => `
        <div class="data-card" style="${i.status === 'redeemed' ? 'opacity:0.4; filter:grayscale(1);' : ''}">
            <div class="card-body">
                <div class="eng-text text-muted" style="font-size:0.75rem; margin-bottom:10px;">ID: ${i.id} // ${i.status.toUpperCase()}</div>
                <h3 class="card-title">${i.title}</h3>
                ${i.status === 'unused' ? `<button class="solid-btn primary-btn w-full mt-2" onclick="useI('${i.id}')"><span class="btn-text">CONSUME</span></button>` : ''}
            </div>
        </div>
    `).join('');
}

window.useI = function (id) {
    const i = state.inventory.find(x => x.id === id);
    if (i && i.status === 'unused') {
        i.status = 'redeemed';
        playSfx('click');
        saveState();
        showToast('ASSET CONSUMED', 'success');
        updateUI();
    }
};

function renderWallet() {
    const balEl = document.getElementById('wallet-balance');
    if (balEl) balEl.textContent = state.profile.coins;

    const c = document.getElementById('transactions-container');
    if (!c) return;

    const sorted = [...state.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    if (sorted.length === 0) {
        c.innerHTML = `<div class="empty-state eng-text text-muted">NO RECORDS.</div>`;
        return;
    }

    c.innerHTML = `<ul class="data-feed">` + sorted.map(tx => `
        <li>
            <div>
                <div style="font-weight:bold;">${tx.desc}</div>
                <div style="font-size:0.7rem; color:var(--c-text-muted);">${new Date(tx.date).toLocaleDateString()}</div>
            </div>
            <span class="eng-text ${tx.amount > 0 ? 'text-green' : 'text-red'}" style="font-weight:bold;">${tx.amount > 0 ? '+' : ''}${tx.amount} CR</span>
        </li>
    `).join('') + `</ul>`;
}

// -- STATS & ACHV --
function renderStats() {
    const taskEl = document.getElementById('stats-tasks');
    const ecoEl = document.getElementById('stats-economy');

    if (taskEl) {
        taskEl.innerHTML = `
            <div class="panel-top-bar eng-text">OP_METRICS</div>
            <div class="eng-text text-accent" style="font-size:2rem; font-weight:900;">${state.stats.completedQuests}</div>
            <p class="text-muted" style="font-size:0.8rem;">CLEARED DIRECTIVES</p>
        `;
    }

    if (ecoEl) {
        ecoEl.innerHTML = `
            <div class="panel-top-bar eng-text">FINANCIAL_FLOW</div>
            <div class="eng-text text-green" style="font-size:1rem; font-weight:bold;">IN: +${state.stats.totalEarned}</div>
            <div class="eng-text text-red mt-1" style="font-size:1rem; font-weight:bold;">OUT: -${state.stats.totalSpent}</div>
        `;
    }
}

function checkLvlUp() {
    const p = state.profile;
    let leveledUp = false;

    // الحلقة التكرارية لضمان رفع المستويات إذا كسب نقاط كافية لعدة مستويات دفعة واحدة
    while (true) {
        const nXp = LEVELS[p.level] || (LEVELS[LEVELS.length - 1] + (p.level - 9) * 1000);
        if (p.xp >= nXp) {
            p.level++;
            leveledUp = true;
        } else {
            break;
        }
    }

    if (leveledUp) {
        playSfx('success');
        saveState();
        showToast(`LEVEL UP: ${p.level}`, 'success');
    }
}

function checkAchieve() {
    sysAchievements.forEach(a => {
        if (!state.achievements.includes(a.id) && a.condition(state)) {
            state.achievements.push(a.id);
            playSfx('success');
            showToast(`NEW BADGE ACQUIRED: ${a.title}`, 'success');
            saveState();
        }
    });
}

function renderAchievements() {
    const c = document.getElementById('achievements-container');
    if (!c) return;

    c.innerHTML = sysAchievements.map(a => {
        const u = state.achievements.includes(a.id);
        return `
            <div class="ach-card ${u ? 'unlocked' : 'locked'}">
                <div class="ach-icon" style="display:flex;align-items:center;justify-content:center;color: ${u ? 'var(--c-gold)' : 'inherit'};">✦</div>
                <div>
                    <h4 style="color:${u ? 'var(--c-gold)' : 'var(--c-text-muted)'}; font-weight:900;">${a.title}</h4>
                    <p class="text-muted" style="font-size:0.85rem;">${a.desc}</p>
                </div>
            </div>
        `;
    }).join('');
}

// -- SETTINGS & DATA MANAGEMENT --
window.updateName = function () {
    const nameEl = document.getElementById('setting-name');
    if (!nameEl) return;

    const n = nameEl.value.trim();
    if (n) {
        if (n === state.profile.name) {
            showToast('NAME IS IDENTICAL', 'primary');
            return;
        }
        state.profile.name = n;
        playSfx('click');
        saveState();
        showToast('ID UPDATED', 'success');
        updateUI();
    }
};

window.resetData = function () {
    if (confirm('SYSTEM WIPE: ALL DATA WILL BE DELETED. PROCEED?')) {
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
    }
};

window.exportData = function () {
    const a = document.createElement('a');
    a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
    a.download = `LIFEXP_OS_BACKUP_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
};

window.importData = function (e) {
    const f = e.target.files[0];
    if (!f) return;

    if (!confirm('WARNING: THIS WILL OVERWRITE CURRENT DATA. PROCEED?')) {
        e.target.value = '';
        return;
    }

    const r = new FileReader();
    r.onload = (ev) => {
        try {
            const d = JSON.parse(ev.target.result);
            if (d && d.profile && typeof d.profile.coins === 'number' && Array.isArray(d.quests)) {
                state = d;
                saveState();
                showToast('DATA RESTORED', 'success');
                updateUI();
            } else {
                throw new Error("Invalid format");
            }
        } catch (err) {
            showToast('CORRUPTED FILE REJECTED', 'danger');
        }
        e.target.value = '';
    };
    r.readAsText(f);
};

// -- MODALS & TOAST --
window.showModal = function (id) {
    const m = document.getElementById(id);
    if (m) {
        m.classList.add('active');
        playSfx('click');
    }
};

window.hideModal = function (id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('active');
};

window.showToast = function (msg, type = 'primary') {
    const r = document.getElementById('toast-rack');
    if (!r) return;

    const t = document.createElement('div');
    t.className = `sys-toast ${type === 'danger' ? 'sys-toast-danger' : type === 'success' ? 'sys-toast-success' : ''}`;
    t.textContent = msg;
    r.appendChild(t);

    setTimeout(() => {
        t.style.opacity = '0';
        setTimeout(() => t.remove(), 200);
    }, 3000);
};

// -- PWA CLIENT HOOKS --
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

const isIos = () => /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
const isInStandaloneMode = () => ('standalone' in window.navigator) && (window.navigator.standalone);

if (isIos() && !isInStandaloneMode() && iosHint) {
    iosHint.classList.remove('hidden');
}

// -- BOOT SEQUENCE --
window.addEventListener('load', () => {
    loadState();

    if (state.uiSettings && state.uiSettings.sfxOn !== undefined) {
        sfxEnabled = state.uiSettings.sfxOn;
    }
    updateAudioUI();

    if (state.uiSettings && state.uiSettings.questFilter) {
        currentFilter = state.uiSettings.questFilter;
        document.querySelectorAll('.filter-btn').forEach(b => {
            b.classList.remove('active');
            if (b.getAttribute('data-filter') === currentFilter) b.classList.add('active');
        });
    }

    if (state.uiSettings && state.uiSettings.lastView) {
        const viewToLoad = state.uiSettings.lastView;
        const targetElement = document.getElementById(viewToLoad);

        if (targetElement) {
            if (targetElement.classList.contains('sub-view')) {
                navigateSub(viewToLoad, false);
            } else {
                navigateMain(viewToLoad, false);
            }
        } else {
            navigateMain('dashboard', false);
        }
    } else {
        navigateMain('dashboard', false);
    }

    updateUI();

    // Register Service Worker from sw.js
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(err => {
            console.warn('Service Worker registration failed:', err);
        });
    }
});