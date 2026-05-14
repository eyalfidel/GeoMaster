let easyData = [];
let hardData = [];
const MAX_PENALTY = 600;

const safeFormat = (val, formatter) => {
    if (val === undefined || val === null || val === '') return 'חסר נתון';
    try { return formatter(val); } catch(e) { return val; }
};

const categoryDataMap = {
    'דירוג צפוניות': { field: 'צפוניות', format: v => safeFormat(v, val => parseInt(String(val).replace(/,/g, '')).toLocaleString() + ' נ.צ') },
    'דירוג מערביות': { field: 'מערביות', format: v => safeFormat(v, val => parseInt(String(val).replace(/,/g, '')).toLocaleString() + ' נ.צ') },
    'דירוג גובה ממוצע': { field: 'גובה ממוצע', format: v => safeFormat(v, val => val + " מ'") },
    'דירוג מרחק מהים התיכון': { field: 'מרחק מהים התיכון', format: v => safeFormat(v, val => (parseFloat(String(val).replace(/,/g, '')) / 1000).toFixed(1) + ' ק"מ') },
    'דירוג מרחק מתחנת רכבת השלום': { field: 'מרחק מתחנת רכבת השלום', format: v => safeFormat(v, val => (parseFloat(String(val).replace(/,/g, '')) / 1000).toFixed(1) + ' ק"מ') },
    'דירוג אוכלוסייה': { field: 'סך הכל אוכלוסייה 2024', format: v => safeFormat(v, val => parseInt(String(val).replace(/,/g, '')).toLocaleString() + ' תושבים') },
    'דירוג שנת יסוד': { field: 'שנת ייסוד', format: v => safeFormat(v, val => val == 1 ? 'קדום' : (val == 1800 ? 'ותיק' : val)) },
    'דירוג אורך שם היישוב': { field: 'אורך שם היישוב', format: v => safeFormat(v, val => val + ' אותיות') }
};

const categories = [
    { id: 'דירוג צפוניות', label: 'הכי צפוני', icon: '⬆️' },
    { id: 'דירוג מערביות', label: 'הכי מערבי', icon: '⬅️' },
    { id: 'דירוג גובה ממוצע', label: 'הכי גבוה', icon: '🏔️' },
    { id: 'דירוג מרחק מהים התיכון', label: 'הכי רחוק מהים התיכון', icon: '🌊' },
    { id: 'דירוג מרחק מתחנת רכבת השלום', label: 'הכי רחוק מהמרכז', icon: '🏙️' },
    { id: 'דירוג אוכלוסייה', label: 'הכי הרבה תושבים', icon: '👥' },
    { id: 'דירוג שנת יסוד', label: 'הכי עתיק', icon: '📜' },
    { id: 'דירוג אורך שם היישוב', label: 'השם הכי ארוך', icon: '✍️' }
];

let diff = 'easy', mode = 'draw'; 
let currentDataset = [], sessionSettlements = [], totalScore = 0, gameHistory = [], bestScore = Infinity;
let endMapObj = null, endMarkers = [], currentDrawIndex = 0;
let usedDrawCats = new Set(), drawMapSettlement = null, drawMap = null, drawMarker = null, isDrawMapOpen = false;
let placeAssignments = {}, selectedPlaceItem = null;

// פונקציות תצוגה פשוטות
function showEl(id, displayType = 'block') {
    const el = document.getElementById(id);
    if(el) { el.classList.remove('hidden'); el.style.display = displayType; }
}
function hideEl(id) {
    const el = document.getElementById(id);
    if(el) { el.classList.add('hidden'); el.style.display = 'none'; }
}

// תהליך הטעינה - מיד כשהדף עולה
document.addEventListener("DOMContentLoaded", async () => {
    try {
        const [easyRes, hardRes] = await Promise.all([
            fetch('easy.json'), 
            fetch('hard.json')
        ]);
        
        easyData = await easyRes.json();
        hardData = await hardRes.json();
        
        // מחיקה פיזית של מסך הטעינה מה-HTML כדי שלא יחסום שום דבר
        const loader = document.getElementById('startup-loader');
        if (loader) loader.remove();
        
        // הצגת המשחק
        document.getElementById('app-content').style.display = 'block';
        
        checkTutorial();
        updateInlineButtonsUI();
        initGame();

    } catch (error) {
        console.error("שגיאה:", error);
        document.getElementById('loader-title').innerText = "שגיאה בטעינה";
        document.getElementById('loader-subtitle').innerText = "לא הצלחנו למשוך את הנתונים מגיטהאב.";
        const btn = document.getElementById('loader-reload-btn');
        if(btn) btn.style.display = 'inline-block';
    }
});

function checkTutorial() { if (!localStorage.getItem('israelGameTutorialSeenV3')) openTutorial(); }
function openTutorial() { showEl('tutorial-modal', 'flex'); }
function closeTutorial() { hideEl('tutorial-modal'); localStorage.setItem('israelGameTutorialSeenV3', 'true'); }
function openEndGameModal() { showEl('modal', 'flex'); }
function closeEndGameModal() { hideEl('modal'); }

function setDiff(newDiff) {
    if (diff === newDiff) return;
    if ((currentDrawIndex > 0 || Object.keys(placeAssignments).length > 0) && !confirm("החלפת רמת קושי תתחיל משחק חדש. להמשיך?")) return;
    diff = newDiff; updateInlineButtonsUI(); initGame();
}

function setMode(newMode) {
    if (mode === newMode) return;
    if ((currentDrawIndex > 0 || Object.keys(placeAssignments).length > 0) && !confirm("החלפת סגנון תתחיל משחק חדש. להמשיך?")) return;
    mode = newMode; updateInlineButtonsUI(); initGame();
}

function updateInlineButtonsUI() {
    document.getElementById('inline-diff-easy').className = diff === 'easy' ? "flex-1 rounded-lg font-bold text-[11px] z-10 transition-colors shadow-sm bg-white text-success border border-slate-200" : "flex-1 rounded-lg font-bold text-[11px] z-10 transition-colors text-slate-500";
    document.getElementById('inline-diff-hard').className = diff === 'hard' ? "flex-1 rounded-lg font-bold text-[11px] z-10 transition-colors shadow-sm bg-white text-danger border border-slate-200" : "flex-1 rounded-lg font-bold text-[11px] z-10 transition-colors text-slate-500";
    document.getElementById('inline-mode-draw').className = mode === 'draw' ? "flex-1 rounded-lg font-bold text-[11px] z-10 transition-colors shadow-sm bg-white text-primary border border-slate-200" : "flex-1 rounded-lg font-bold text-[11px] z-10 transition-colors text-slate-500";
    document.getElementById('inline-mode-place').className = mode === 'place' ? "flex-1 rounded-lg font-bold text-[11px] z-10 transition-colors shadow-sm bg-white text-accent border border-slate-200" : "flex-1 rounded-lg font-bold text-[11px] z-10 transition-colors text-slate-500";
}

function getBestScoreKey() { return `israelGameBestV3_${diff}_${mode}`; }

function loadBestScore() {
    const saved = localStorage.getItem(getBestScoreKey());
    bestScore = saved ? parseInt(saved) : Infinity;
    document.getElementById('best-score-display').innerText = saved ? bestScore.toLocaleString() : '--';
}

function initGame() {
    closeEndGameModal(); hideEl('draw-screen'); hideEl('place-screen'); hideEl('draw-end-controls'); hideEl('place-end-controls'); showEl('draw-settlement-container', 'flex');
    totalScore = 0; gameHistory = []; currentDrawIndex = 0; usedDrawCats.clear(); drawMapSettlement = null;
    if(isDrawMapOpen) toggleDrawMap();
    placeAssignments = {}; selectedPlaceItem = null;
    loadBestScore();
    currentDataset = diff === 'easy' ? easyData : hardData;
    if (!currentDataset || currentDataset.length < 8) return;
    
    let pool = [...currentDataset].sort(() => 0.5 - Math.random());
    sessionSettlements = pool.slice(0, 8);

    if (mode === 'draw') {
        showEl('draw-screen', 'flex'); document.getElementById('draw-score').innerText = '0'; initDrawMode();
    } else {
        showEl('place-screen', 'flex'); showEl('place-bank-container', 'block'); initPlaceMode();
    }
}

/* --- Draw Mode --- */
function initDrawMode() {
    document.getElementById('draw-dots').innerHTML = Array(8).fill(0).map((_,i) => `<div id="draw-dot-${i}" class="w-3 h-3 rounded-full bg-slate-200 shadow-inner transition-all"></div>`).join('');
    document.getElementById('draw-categories').innerHTML = categories.map(cat => `
        <button id="draw-cat-${cat.id}" onclick="selectDrawCategory('${cat.id}')" class="bg-white p-3 rounded-2xl flex flex-col items-center justify-center shadow-sm border-2 border-transparent disabled:opacity-50 disabled:grayscale transition-all scale-tap min-h-[80px]">
            <span class="text-2xl mb-1">${cat.icon}</span><span class="font-black text-slate-700 text-[10px] text-center uppercase">${cat.label}</span>
        </button>
    `).join('');
    nextDrawRound();
}

function nextDrawRound() {
    if (drawMapSettlement) {
        showEl('draw-prev-panel', 'flex');
        const mapBtn = document.getElementById('draw-map-btn');
        if (drawMapSettlement['lat'] || drawMapSettlement['קו רוחב']) { showEl('draw-map-btn', 'inline-block'); mapBtn.innerHTML = `איפה זה <b>${drawMapSettlement["שם יישוב"]}</b>? 🗺️`; } else hideEl('draw-map-btn');
        if(isDrawMapOpen) toggleDrawMap();
    } else hideEl('draw-prev-panel');

    if (currentDrawIndex >= 8) { hideEl('draw-settlement-container'); showEl('draw-end-controls', 'flex'); showEndGame(); return; }

    document.getElementById('round-display').innerText = `${currentDrawIndex + 1} / 8`;
    const nameEl = document.getElementById('draw-settlement-name');
    nameEl.style.opacity = 0;
    setTimeout(() => { nameEl.innerText = sessionSettlements[currentDrawIndex]["שם יישוב"]; nameEl.style.opacity = 1; }, 200);
}

function selectDrawCategory(catId) {
    if (usedDrawCats.has(catId)) return;
    const currentSettlement = sessionSettlements[currentDrawIndex];
    const catObj = categories.find(c => c.id === catId);
    usedDrawCats.add(catId); drawMapSettlement = currentSettlement;

    let bestRank = Infinity, bestCatLabel = "";
    categories.forEach(c => {
        if (!usedDrawCats.has(c.id) || c.id === catId) {
            let r = parseInt(String(currentSettlement[c.id] || "1221").replace(/,/g, '')) || 1221;
            if (r < bestRank) { bestRank = r; bestCatLabel = c.label; }
        }
    });

    let actualRank = parseInt(String(currentSettlement[catId] || "1221").replace(/,/g, '')) || 1221;
    totalScore += Math.min(actualRank, MAX_PENALTY);
    let rankText = actualRank > MAX_PENALTY ? `מקום ${actualRank} (${MAX_PENALTY} נק')` : `מקום ${actualRank}`;

    document.getElementById(`draw-dot-${currentDrawIndex}`).className = `w-3 h-3 rounded-full shadow-md scale-110 ${actualRank <= 150 ? 'bg-success' : actualRank <= 400 ? 'bg-warning' : 'bg-danger'}`;
    const btn = document.getElementById(`draw-cat-${catId}`);
    btn.disabled = true;
    btn.innerHTML = `<div class="flex items-center gap-1 mb-1"><span class="text-sm">${catObj.icon}</span><span class="text-[8px] font-bold text-slate-500 uppercase">${catObj.label}</span></div><span class="font-black text-slate-800 text-xs text-center">${currentSettlement["שם יישוב"]}</span><span class="font-bold text-slate-500 text-[9px] mt-0.5">${categoryDataMap[catId].format(currentSettlement[categoryDataMap[catId].field])}</span><span class="text-primary font-black text-[10px] mt-1 bg-primary/10 px-2 py-0.5 rounded-full" dir="rtl">${rankText}</span>`;

    document.getElementById('draw-prev-feedback').innerHTML = actualRank === bestRank ? `<span class="text-success font-bold">🎯 מעולה! בחרת אופטימלי עבור ${currentSettlement["שם יישוב"]}</span>` : `עבור ${currentSettlement["שם יישוב"]}, מוטב היה לבחור <b>${bestCatLabel}</b> (מקום ${bestRank})`;
    
    gameHistory.push({ name: currentSettlement["שם יישוב"], catLabel: catObj.label, actualRank: actualRank, rankText: rankText, icon: catObj.icon, obj: currentSettlement });
    document.getElementById('draw-score').innerText = totalScore.toLocaleString();
    currentDrawIndex++; setTimeout(nextDrawRound, 400); 
}

function toggleDrawMap() {
    const wrapper = document.getElementById('draw-map-wrapper'), btn = document.getElementById('draw-map-btn');
    isDrawMapOpen = !isDrawMapOpen;
    if(isDrawMapOpen) {
        wrapper.className = "w-full rounded-xl overflow-hidden transition-all duration-300 h-40 opacity-100 mt-2 relative";
        btn.innerHTML = '❌ סגור מפה';
        setTimeout(() => {
            if(!drawMap) {
                drawMap = L.map('draw-map', { zoomControl: false, scrollWheelZoom: false, dragging: true }).setView([31.5, 34.8], 7);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(drawMap);
            }
            drawMap.invalidateSize();
            const lat = drawMapSettlement['lat'] || drawMapSettlement['קו רוחב'], lon = drawMapSettlement['lon'] || drawMapSettlement['קו אורך'];
            if(lat && lon) {
                if(drawMarker) drawMap.removeLayer(drawMarker);
                drawMarker = L.marker([lat, lon]).addTo(drawMap);
                drawMap.flyTo([lat, lon], 11, { animate: true, duration: 1.2 });
            }
        }, 300);
    } else {
        wrapper.className = "w-full rounded-xl overflow-hidden transition-all duration-300 h-0 opacity-0 pointer-events-none relative";
        btn.innerHTML = `איפה זה <b>${drawMapSettlement["שם יישוב"]}</b>? 🗺️`;
    }
}

/* --- Place Mode --- */
function initPlaceMode() { renderPlaceBank(); renderPlaceCategories(); hideEl('place-submit-btn'); }
function renderPlaceBank() {
    const bank = document.getElementById('place-bank'); bank.innerHTML = '';
    sessionSettlements.forEach((s, idx) => {
        if (!Object.values(placeAssignments).some(placed => placed["שם יישוב"] === s["שם יישוב"])) {
            const isSelected = selectedPlaceItem && selectedPlaceItem["שם יישוב"] === s["שם יישוב"];
            bank.innerHTML += `<button onclick="selectForPlace(${idx})" class="px-3 py-1.5 rounded-full text-sm font-bold bg-slate-100 text-slate-700 transition-all ${isSelected ? 'selected-bank-item' : 'hover:bg-slate-200'}">${s["שם יישוב"]}</button>`;
        }
    });
    Object.keys(placeAssignments).length === 8 ? (bank.innerHTML = `<span class="text-success font-bold text-sm">כל היישובים שובצו! ✔️</span>`, showEl('place-submit-btn', 'block')) : hideEl('place-submit-btn');
}
function selectForPlace(idx) { selectedPlaceItem = sessionSettlements[idx]; renderPlaceBank(); }
function renderPlaceCategories() {
    document.getElementById('place-categories').innerHTML = categories.map(cat => {
        const assigned = placeAssignments[cat.id];
        if (assigned) return `<button id="place-cat-btn-${cat.id}" onclick="unplaceCategory('${cat.id}')" class="slot-filled p-3 rounded-2xl flex flex-col items-center justify-center border-2 transition-all min-h-[80px] relative scale-tap"><span class="absolute top-1 left-2 text-danger font-bold text-xs opacity-50">x</span><span class="text-xl mb-1">${cat.icon}</span><span class="font-bold text-slate-500 text-[9px] uppercase">${cat.label}</span><span class="font-black text-slate-900 text-sm mt-1">${assigned["שם יישוב"]}</span></button>`;
        return `<button id="place-cat-btn-${cat.id}" onclick="placeInCategory('${cat.id}')" class="bg-white p-3 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-slate-300 transition-all hover:bg-slate-50 min-h-[80px] scale-tap text-slate-400"><span class="text-2xl mb-1 opacity-50">${cat.icon}</span><span class="font-bold text-[10px] text-center uppercase">${cat.label}</span><span class="text-[9px] mt-1">(הצב כאן)</span></button>`;
    }).join('');
}
function placeInCategory(catId) { if (!selectedPlaceItem) return; placeAssignments[catId] = selectedPlaceItem; selectedPlaceItem = null; renderPlaceBank(); renderPlaceCategories(); }
function unplaceCategory(catId) { delete placeAssignments[catId]; renderPlaceBank(); renderPlaceCategories(); }
function submitPlacement() {
    totalScore = 0; gameHistory = [];
    categories.forEach(cat => {
        const s = placeAssignments[cat.id];
        let actualRank = parseInt(String(s[cat.id] || "1221").replace(/,/g, '')) || 1221;
        totalScore += Math.min(actualRank, MAX_PENALTY);
        let rankText = actualRank > MAX_PENALTY ? `מקום ${actualRank} (${MAX_PENALTY} נק')` : `מקום ${actualRank}`;
        gameHistory.push({ name: s["שם יישוב"], catLabel: cat.label, actualRank: actualRank, rankText: rankText, icon: cat.icon, obj: s });
        const btn = document.getElementById(`place-cat-btn-${cat.id}`);
        if(btn) { btn.onclick = null; btn.className = 'bg-white p-3 rounded-2xl flex flex-col items-center justify-center border-2 border-transparent shadow-sm min-h-[80px]'; btn.innerHTML = `<div class="flex items-center gap-1 mb-1"><span class="text-sm">${cat.icon}</span><span class="text-[8px] font-bold text-slate-500 uppercase">${cat.label}</span></div><span class="font-black text-slate-800 text-xs text-center">${s["שם יישוב"]}</span><span class="font-bold text-slate-500 text-[9px] mt-0.5">${categoryDataMap[cat.id].format(s[categoryDataMap[cat.id].field])}</span><span class="text-primary font-black text-[10px] mt-1 bg-primary/10 px-2 py-0.5 rounded-full" dir="rtl">${rankText}</span>`; }
    });
    hideEl('place-submit-btn'); hideEl('place-bank-container'); showEl('place-end-controls', 'flex'); showEndGame();
}

/* --- End Game & Optimal --- */
let globalOptimalScore = 0, globalOptimalHtml = "";
function showEndGame() {
    openEndGameModal(); document.getElementById('final-score').innerText = totalScore.toLocaleString();
    if (totalScore < bestScore) { bestScore = totalScore; localStorage.setItem(getBestScoreKey(), totalScore); document.getElementById('best-score-display').innerText = totalScore.toLocaleString(); showEl('new-record-badge', 'block'); } else hideEl('new-record-badge');
    calculateOptimalGameData();
    totalScore === globalOptimalScore ? showEl('perfect-match-ribbon', 'block') : hideEl('perfect-match-ribbon');
    document.getElementById('round-history').innerHTML = gameHistory.map((h, i) => `<div class="flex justify-between border-b border-slate-200 pb-1 italic cursor-pointer hover:bg-slate-200 transition-colors px-2 py-1 rounded-md" onclick="focusEndMapMarker(${i})"><span>${h.icon} <b>${h.name}</b> (${h.catLabel})</span><span class="font-black text-primary">${h.rankText}</span></div>`).join('');
    
    setTimeout(() => {
        const mapContainer = document.getElementById('end-map');
        if(mapContainer._leaflet_id) mapContainer.outerHTML = '<div id="end-map" class="w-full h-full"></div>';
        endMapObj = L.map('end-map', { zoomControl: true, dragging: true, scrollWheelZoom: true });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(endMapObj);
        let bounds = []; endMarkers = []; 
        gameHistory.forEach(h => {
            const lat = h.obj['lat'] || h.obj['קו רוחב'], lon = h.obj['lon'] || h.obj['קו אורך'];
            if(lat && lon) {
                const marker = L.marker([lat, lon]).addTo(endMapObj);
                let allDataHtml = `<div class="text-right text-[10px] mt-2 pt-2 border-t border-slate-200 space-y-1 h-28 overflow-y-auto pr-1">`;
                categories.forEach(c => {
                    let rankVal = parseInt(String(h.obj[c.id] || "1221").replace(/,/g, '')) || 1221;
                    allDataHtml += c.label === h.catLabel ? `<div class="text-primary font-bold bg-primary/10 rounded px-1 py-0.5">${c.icon} ${c.label}: ${categoryDataMap[c.id].format(h.obj[categoryDataMap[c.id].field])} (#${rankVal})</div>` : `<div class="text-slate-600 px-1">${c.icon} ${c.label}: ${categoryDataMap[c.id].format(h.obj[categoryDataMap[c.id].field])} (#${rankVal})</div>`;
                });
                marker.bindPopup(`<div class="text-center min-w-[160px]" dir="rtl"><b class="text-sm text-slate-800">${h.name}</b><div class="flex items-center justify-center gap-1 text-[11px] text-primary font-bold mt-1 mb-1" dir="rtl"><span>${h.icon}</span><span>בחרת: ${h.catLabel} (${h.rankText})</span></div>${allDataHtml}</div></div>`);
                bounds.push([lat, lon]); endMarkers.push(marker);
            } else endMarkers.push(null);
        });
        endMapObj.invalidateSize();
        bounds.length > 0 ? endMapObj.fitBounds(bounds, { padding: [20, 20], maxZoom: 12 }) : endMapObj.setView([31.5, 34.8], 7);
    }, 300);
    confetti({ particleCount: 200, spread: 90, origin: { y: 0.6 } });
}

function focusEndMapMarker(idx) {
    if (endMapObj && endMarkers[idx]) {
        const marker = endMarkers[idx], targetZoom = 11;
        const targetLatLng = endMapObj.unproject(endMapObj.project(marker.getLatLng(), targetZoom).subtract([0, 120]), targetZoom);
        endMapObj.flyTo(targetLatLng, targetZoom, { animate: true, duration: 1 });
        setTimeout(() => marker.openPopup(), 250);
        document.getElementById('end-map').parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function calculateOptimalGameData() {
    const n = sessionSettlements.length; let minScore = Infinity, bestAssignment = []; const costs = [];
    for (let i = 0; i < n; i++) { costs[i] = []; for (let j = 0; j < categories.length; j++) costs[i][j] = Math.min(parseInt(String(sessionSettlements[i][categories[j].id] || "1221").replace(/,/g, '')) || 1221, MAX_PENALTY); }
    function solve(sIdx, currentScore, currentAssignment, usedCategories) {
        if (currentScore >= minScore) return;
        if (sIdx === n) { minScore = currentScore; bestAssignment = [...currentAssignment]; return; }
        for (let c = 0; c < n; c++) if (!usedCategories[c]) { usedCategories[c] = true; currentAssignment.push(c); solve(sIdx + 1, currentScore + costs[sIdx][c], currentAssignment, usedCategories); currentAssignment.pop(); usedCategories[c] = false; }
    }
    solve(0, 0, [], Array(n).fill(false)); globalOptimalScore = minScore;
    globalOptimalHtml = bestAssignment.map((catIdx, sIdx) => {
        const s = sessionSettlements[sIdx], cat = categories[catIdx], actualRank = parseInt(String(s[cat.id] || "1221").replace(/,/g, '')) || 1221, rankText = actualRank > MAX_PENALTY ? `מקום ${actualRank} (${MAX_PENALTY} נק')` : `מקום ${actualRank}`;
        const userChoice = gameHistory.find(h => h.name === s["שם יישוב"]);
        let comparisonHtml = userChoice ? (userChoice.catLabel === cat.label ? `<div class="text-[10px] text-success font-bold mt-1 bg-success/10 inline-block px-2 py-0.5 rounded-full">✅ שיחקת אותה! בחרת אופטימלי</div>` : `<div class="text-[10px] text-slate-500 mt-1">במשחק שלך: ${userChoice.icon} ${userChoice.catLabel} <span class="text-danger font-bold">(${userChoice.rankText})</span></div>`) : "";
        return `<div class="border-b border-slate-200 pb-2 pt-1.5 flex flex-col items-start"><div class="flex justify-between w-full items-center"><span>${cat.icon} <b>${s["שם יישוב"]}</b> (${cat.label})</span><span class="font-black text-success">${rankText}</span></div>${comparisonHtml}</div>`;
    }).join('');
}
function showOptimalGame() { document.getElementById('optimal-score').innerText = globalOptimalScore.toLocaleString(); document.getElementById('optimal-history').innerHTML = globalOptimalHtml; showEl('optimal-modal', 'flex'); }
function shareResults() {
    let details = gameHistory.map(h => `${h.actualRank <= 150 ? '🟩' : h.actualRank <= 400 ? '🟨' : '🟥'} ${h.name} (${h.catLabel}) - מקום ${h.actualRank}`).join('\n');
    const text = `משחק היישובים V3 📍\nמצב: ${diff === 'easy' ? 'קל' : 'קשה'} | ${mode === 'draw' ? 'הגרלה' : 'הצבה'}\nתוצאה סופית: ${totalScore} נק'\n${totalScore === globalOptimalScore ? `\n🏆 השגתי את השידוך המושלם!\n` : `\n`}\n${details}\n\n${window.location.href}`;
    navigator.share ? navigator.share({ text }) : (navigator.clipboard.writeText(text), alert("הטקסט הועתק ללוח!"));
}
function shareOptimalResults() {
    const diffScore = totalScore - globalOptimalScore;
    const text = `משחק היישובים 📍 - אתגר השידוך המושלם\n\nציון שלי: ${totalScore}\nציון אופטימלי: ${globalOptimalScore}\n${diffScore === 0 ? "הגעתי לשידוך המושלם בדיוק! 🏆" : `הייתי במרחק של ${diffScore} נקודות מהשידוך המושלם! 😅`}\n\nנסו בעצמכם:\n${window.location.href}`;
    navigator.share ? navigator.share({ text }) : (navigator.clipboard.writeText(text), alert("הטקסט הועתק ללוח!"));
}
