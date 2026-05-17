/* =====================================================================
   הגדרות ומשתנים גלובליים
   ===================================================================== */
let easyData = [], hardData = [];
const MAX_PENALTY = 600;

let diff = 'easy', mode = 'draw'; 
let currentDataset = [], sessionSettlements = [], totalScore = 0, gameHistory = [], bestScore = Infinity;
let endMapObj = null, endMarkers = [], currentDrawIndex = 0;
let usedDrawCats = new Set(), drawMapSettlement = null, drawMap = null, drawMarker = null, isDrawMapOpen = false;
let placeAssignments = {}, selectedPlaceItem = null;
let previewMapObj = null, previewMarker = null;

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

/* =====================================================================
   פונקציות תצוגה
   ===================================================================== */
function showEl(id, displayType = 'flex') {
    const el = document.getElementById(id);
    if(el) { el.classList.remove('hidden'); el.classList.add(displayType); }
}
function hideEl(id, currentDisplay = 'flex') {
    const el = document.getElementById(id);
    if(el) { el.classList.remove(currentDisplay); el.classList.add('hidden'); }
}

function openTutorial() { showEl('tutorial-modal', 'flex'); }
function closeTutorial() { hideEl('tutorial-modal', 'flex'); localStorage.setItem('israelGameTutorialSeenV3', 'true'); }
function openEndGameModal() { showEl('modal', 'flex'); }
function closeEndGameModal() { hideEl('modal', 'flex'); }

window.onclick = function(event) {
    ['tutorial-modal', 'modal', 'optimal-modal', 'preview-map-modal'].forEach(id => {
        const m = document.getElementById(id);
        if (event.target === m) hideEl(id, 'flex');
    });
}

/* =====================================================================
   מערכת טעינה ואתחול
   ===================================================================== */
document.addEventListener("DOMContentLoaded", () => {
    const twCheck = document.createElement('div');
    twCheck.className = 'w-8'; twCheck.style.position = 'absolute'; twCheck.style.visibility = 'hidden';
    document.body.appendChild(twCheck);
    
    let dataLoaded = false, twLoaded = false;
    
    Promise.all([fetch('easy.json').then(r => r.json()), fetch('hard.json').then(r => r.json())])
        .then(([e, h]) => { easyData = e; hardData = h; dataLoaded = true; checkAllReady(); })
        .catch(err => {
            document.getElementById('loader-title').innerText = "שגיאת נתונים";
            document.getElementById('loader-reload-btn').style.display = 'inline-block';
        });

    let attempts = 0;
    const interval = setInterval(() => {
        attempts++;
        if (getComputedStyle(twCheck).width === '32px') { clearInterval(interval); twCheck.remove(); twLoaded = true; checkAllReady(); }
        else if (attempts > 150) { clearInterval(interval); twLoaded = true; checkAllReady(); }
    }, 50);

    function checkAllReady() { if(dataLoaded && twLoaded) launchGameUI(); }
});

function launchGameUI() {
    document.getElementById('startup-loader').style.display = 'none';
    document.getElementById('app-content').style.display = 'block';
    if (!localStorage.getItem('israelGameTutorialSeenV3')) openTutorial();
    updateInlineButtonsUI();
    initGame();
}

function setDiff(newDiff) {
    if (diff === newDiff) return;
    const count = mode === 'draw' ? currentDrawIndex : Object.keys(placeAssignments).length;
    if (count > 0 && count < 8 && !confirm("החלפת רמת קושי תתחיל משחק חדש. להמשיך?")) return;
    diff = newDiff; updateInlineButtonsUI(); initGame();
}

function setMode(newMode) {
    if (mode === newMode) return;
    const count = mode === 'draw' ? currentDrawIndex : Object.keys(placeAssignments).length;
    if (count > 0 && count < 8 && !confirm("החלפת סגנון תתחיל משחק חדש. להמשיך?")) return;
    mode = newMode; updateInlineButtonsUI(); initGame();
}

function updateInlineButtonsUI() {
    const dE = document.getElementById('inline-diff-easy'), dH = document.getElementById('inline-diff-hard');
    const mD = document.getElementById('inline-mode-draw'), mP = document.getElementById('inline-mode-place');
    dE.className = diff === 'easy' ? "flex-1 rounded-lg font-bold text-[11px] z-10 transition-colors shadow-sm bg-white text-success border border-slate-200" : "flex-1 text-[11px] text-slate-500";
    dH.className = diff === 'hard' ? "flex-1 rounded-lg font-bold text-[11px] z-10 transition-colors shadow-sm bg-white text-danger border border-slate-200" : "flex-1 text-[11px] text-slate-500";
    mD.className = mode === 'draw' ? "flex-1 rounded-lg font-bold text-[11px] z-10 transition-colors shadow-sm bg-white text-primary border border-slate-200" : "flex-1 text-[11px] text-slate-500";
    mP.className = mode === 'place' ? "flex-1 rounded-lg font-bold text-[11px] z-10 transition-colors shadow-sm bg-white text-accent border border-slate-200" : "flex-1 text-[11px] text-slate-500";
}

function initGame() {
    closeEndGameModal(); hideEl('draw-screen', 'flex'); hideEl('place-screen', 'flex'); hideEl('draw-end-controls', 'flex'); hideEl('place-end-controls', 'flex'); showEl('draw-settlement-container', 'flex');
    totalScore = 0; gameHistory = []; currentDrawIndex = 0; usedDrawCats.clear(); drawMapSettlement = null;
    if(isDrawMapOpen) toggleDrawMap();
    placeAssignments = {}; selectedPlaceItem = null;
    
    const saved = localStorage.getItem(`israelGameBestV3_${diff}_${mode}`);
    bestScore = saved ? parseInt(saved) : Infinity;
    document.getElementById('best-score-display').innerText = saved ? bestScore.toLocaleString() : '--';
    
    currentDataset = diff === 'easy' ? easyData : hardData;
    if (!currentDataset || currentDataset.length < 8) return;
    sessionSettlements = [...currentDataset].sort(() => 0.5 - Math.random()).slice(0, 8);

    if (mode === 'draw') { showEl('draw-screen', 'flex'); document.getElementById('draw-score').innerText = '0'; initDrawMode(); }
    else { showEl('place-screen', 'flex'); showEl('place-bank-container', 'block'); initPlaceMode(); }
}

/* =====================================================================
   מצב הגרלה
   ===================================================================== */
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
        if (drawMapSettlement['lat'] || drawMapSettlement['קו רוחב']) { showEl('draw-map-btn', 'inline-block'); mapBtn.innerHTML = `איפה זה <b>${drawMapSettlement["שם יישוב"]}</b>? 🗺️`; } else hideEl('draw-map-btn', 'inline-block');
        if(isDrawMapOpen) toggleDrawMap();
    } else hideEl('draw-prev-panel', 'flex');

    if (currentDrawIndex >= 8) { hideEl('draw-settlement-container', 'flex'); showEl('draw-end-controls', 'flex'); showEndGame(); return; }
    document.getElementById('round-display').innerText = `${currentDrawIndex + 1} / 8`;
    const nameEl = document.getElementById('draw-settlement-name');
    nameEl.style.opacity = 0;
    setTimeout(() => { nameEl.innerText = sessionSettlements[currentDrawIndex]["שם יישוב"]; nameEl.style.opacity = 1; }, 200);
}

function selectDrawCategory(catId) {
    if (usedDrawCats.has(catId)) return;
    const currentSettlement = sessionSettlements[currentDrawIndex];
    const catObj = categories.find(c => c.id === catId);
    
    let bestRank = Infinity, bestCatLabel = "";
    categories.forEach(c => {
        if (!usedDrawCats.has(c.id) || c.id === catId) {
            let rawVal = String(currentSettlement[c.id] || "1221").replace(/,/g, '').trim();
            let r = parseInt(rawVal, 10);
            if (isNaN(r)) r = 1221;
            if (r < bestRank) { bestRank = r; bestCatLabel = c.label; }
        }
    });

    usedDrawCats.add(catId); drawMapSettlement = currentSettlement;

    let rawVal = String(currentSettlement[catId] || "1221").replace(/,/g, '').trim();
    let actualRank = parseInt(rawVal, 10);
    if (isNaN(actualRank)) actualRank = 1221;

    totalScore += Math.min(actualRank, MAX_PENALTY);
    let rankText = actualRank >= MAX_PENALTY ? `מקום ${actualRank} (${MAX_PENALTY} נק')` : `מקום ${actualRank}`;

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
            if (drawMap) { drawMap.remove(); drawMap = null; }
            drawMap = L.map('draw-map', { zoomControl: false, scrollWheelZoom: false, dragging: true }).setView([31.5, 34.8], 7); 
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(drawMap);
            drawMap.invalidateSize();
            const lat = drawMapSettlement['lat'] || drawMapSettlement['קו רוחב'], lon = drawMapSettlement['lon'] || drawMapSettlement['קו אורך'];
            if(lat && lon) {
                drawMarker = L.marker([lat, lon]).addTo(drawMap); drawMap.flyTo([lat, lon], 11, { animate: true, duration: 1.2 });
            }
        }, 300);
    } else {
        wrapper.className = "w-full rounded-xl overflow-hidden transition-all duration-300 h-0 opacity-0 pointer-events-none relative";
        btn.innerHTML = `איפה זה <b>${drawMapSettlement["שם יישוב"]}</b>? 🗺️`;
    }
}

/* =====================================================================
   מצב הצבה וצפייה במפה
   ===================================================================== */
function previewSettlementMap(name) {
    const s = sessionSettlements.find(x => x["שם יישוב"] === name);
    if(!s) return;
    document.getElementById('preview-map-title').innerText = s["שם יישוב"];
    showEl('preview-map-modal', 'flex');
    setTimeout(() => {
        const mapContainer = document.getElementById('preview-map');
        if(mapContainer._leaflet_id) mapContainer.outerHTML = '<div id="preview-map" class="absolute inset-0 z-10"></div>';
        previewMapObj = L.map('preview-map', { zoomControl: false, dragging: true, scrollWheelZoom: false });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(previewMapObj);
        const lat = s['lat'] || s['קו רוחב'], lon = s['lon'] || s['קו אורך'];
        if(lat && lon) {
            previewMarker = L.marker([lat, lon]).addTo(previewMapObj);
            previewMapObj.setView([lat, lon], 11);
        } else {
            previewMapObj.setView([31.5, 34.8], 7);
        }
    }, 300);
}

function initPlaceMode() { renderPlaceBank(); renderPlaceCategories(); hideEl('place-submit-btn', 'block'); }
function renderPlaceBank() {
    const bank = document.getElementById('place-bank'); bank.innerHTML = '';
    sessionSettlements.forEach((s, idx) => {
        if (!Object.values(placeAssignments).some(placed => placed["שם יישוב"] === s["שם יישוב"])) {
            const isSelected = selectedPlaceItem && selectedPlaceItem["שם יישוב"] === s["שם יישוב"];
            bank.innerHTML += `<button onclick="selectForPlace(${idx})" class="px-3 py-1.5 rounded-full text-sm font-bold transition-all ${isSelected ? 'selected-bank-item bg-slate-100 text-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}">${s["שם יישוב"]}</button>`;
        }
    });
    Object.keys(placeAssignments).length === 8 ? (bank.innerHTML = `<span class="text-success font-bold text-sm">כל היישובים שובצו! ✔️</span>`, showEl('place-submit-btn', 'block')) : hideEl('place-submit-btn', 'block');
}
function selectForPlace(idx) { selectedPlaceItem = sessionSettlements[idx]; renderPlaceBank(); }

function renderPlaceCategories() {
    document.getElementById('place-categories').innerHTML = categories.map(cat => {
        const assigned = placeAssignments[cat.id];
        if (assigned) {
            // הוסר מנגנון האיקס לחלוטין. לחיצה פשוט מפעילה את מפת ההצצה.
            return `
                <button onclick="previewSettlementMap('${assigned["שם יישוב"]}')" class="slot-filled p-3 rounded-2xl flex flex-col items-center justify-center border-2 transition-all min-h-[80px] relative scale-tap">
                    <span class="text-xl mb-1">${cat.icon}</span>
                    <span class="font-bold text-slate-500 text-[9px] uppercase">${cat.label}</span>
                    <span class="font-black text-slate-900 text-sm mt-1">${assigned["שם יישוב"]}</span>
                </button>
            `;
        } else {
            return `<button onclick="placeInCategory('${cat.id}')" class="bg-white p-3 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-slate-300 transition-all hover:bg-slate-50 min-h-[80px] scale-tap text-slate-400"><span class="text-2xl mb-1 opacity-50">${cat.icon}</span><span class="font-bold text-[10px] text-center uppercase">${cat.label}</span><span class="text-[9px] mt-1">(הצב כאן)</span></button>`;
        }
    }).join('');
}

function placeInCategory(catId) { if (!selectedPlaceItem) return; placeAssignments[catId] = selectedPlaceItem; selectedPlaceItem = null; renderPlaceBank(); renderPlaceCategories(); }

function submitPlacement() {
    totalScore = 0; gameHistory = [];
    categories.forEach(cat => {
        const s = placeAssignments[cat.id];
        let rawVal = String(s[cat.id] || "1221").replace(/,/g, '').trim();
        let actualRank = parseInt(rawVal, 10);
        if (isNaN(actualRank)) actualRank = 1221;
        
        totalScore += Math.min(actualRank, MAX_PENALTY);
        gameHistory.push({ name: s["שם יישוב"], catLabel: cat.label, actualRank: actualRank, rankText: `מקום ${actualRank}`, icon: cat.icon, obj: s });
    });
    hideEl('place-submit-btn', 'block'); hideEl('place-bank-container', 'block'); showEl('place-end-controls', 'flex'); showEndGame();
}

/* =====================================================================
   סיכום ומפות
   ===================================================================== */
let globalOptimalScore = 0, globalOptimalHtml = "";

function showEndGame() {
    openEndGameModal(); 
    document.getElementById('final-score').innerText = totalScore.toLocaleString();
    if (totalScore < bestScore) { bestScore = totalScore; localStorage.setItem(getBestScoreKey(), totalScore); document.getElementById('best-score-display').innerText = totalScore.toLocaleString(); showEl('new-record-badge', 'block'); } else hideEl('new-record-badge', 'block');
    
    calculateOptimalGameData();
    totalScore === globalOptimalScore ? showEl('perfect-match-ribbon', 'block') : hideEl('perfect-match-ribbon', 'block');
    
    document.getElementById('round-history').innerHTML = gameHistory.map((h, i) => `
        <div class="flex justify-between border-b border-slate-200 pb-1 italic cursor-pointer hover:bg-slate-200 transition-colors px-2 py-1 rounded-md" onclick="focusEndMapMarker(${i})">
            <span>${h.icon} <b>${h.name}</b> (${h.catLabel})</span>
            <span class="font-black text-primary">${h.rankText}</span>
        </div>`).join('');
    
    setTimeout(() => {
        const mapContainer = document.getElementById('end-map');
        if(mapContainer._leaflet_id) mapContainer.outerHTML = '<div id="end-map" class="absolute inset-0 z-10"></div>';
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
                    const formatted = categoryDataMap[c.id].format(h.obj[categoryDataMap[c.id].field]);
                    allDataHtml += c.label === h.catLabel ? `<div class="text-primary font-bold bg-primary/10 rounded px-1 py-0.5">${c.icon} ${c.label}: ${formatted} (#${rankVal})</div>` : `<div class="text-slate-600 px-1">${c.icon} ${c.label}: ${formatted} (#${rankVal})</div>`;
                });
                allDataHtml += `</div>`;
                
                let optTxt = h.catLabel === h.optimalCatLabel ? `<div class="text-success font-bold mt-0.5">✅ בחרת בשידוך האופטימלי!</div>` : `<div class="text-slate-500 mt-0.5 text-[10px]">האופטימלי: ${h.optimalCatIcon} ${h.optimalCatLabel} <span class="font-bold">(${h.optimalRankText})</span></div>`;
                
                marker.bindPopup(`<div class="text-center min-w-[160px]" dir="rtl"><b class="text-sm text-slate-800">${h.name}</b><div class="flex flex-col items-center justify-center text-[11px] mt-1 mb-1" dir="rtl"><div class="text-primary font-bold">בחרת: ${h.icon} ${h.catLabel} (${h.rankText})</div>${optTxt}</div>${allDataHtml}</div></div>`);
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
    for (let i = 0; i < n; i++) {
        costs[i] = [];
        for (let j = 0; j < categories.length; j++) {
            let rawVal = String(sessionSettlements[i][categories[j].id] || "1221").replace(/,/g, '').trim();
            let rank = parseInt(rawVal, 10);
            if (isNaN(rank)) rank = 1221;
            costs[i][j] = Math.min(rank, MAX_PENALTY);
        }
    }
    
    function solve(sIdx, currentScore, currentAssignment, usedCategories) {
        if (sIdx === n) { if (currentScore < minScore) { minScore = currentScore; bestAssignment = [...currentAssignment]; } return; }
        for (let c = 0; c < n; c++) if (!usedCategories[c]) { usedCategories[c] = true; currentAssignment.push(c); solve(sIdx + 1, currentScore + costs[sIdx][c], currentAssignment, usedCategories); currentAssignment.pop(); usedCategories[c] = false; }
    }
    solve(0, 0, [], Array(n).fill(false)); globalOptimalScore = minScore;
    
    globalOptimalHtml = bestAssignment.map((catIdx, sIdx) => {
        const s = sessionSettlements[sIdx], cat = categories[catIdx], actualRank = costs[sIdx][catIdx], rText = actualRank >= MAX_PENALTY ? `מקום ${actualRank} (${MAX_PENALTY} נק')` : `מקום ${actualRank}`;
        const userChoice = gameHistory.find(h => h.name === s["שם יישוב"]);
        if (userChoice) { userChoice.optimalCatLabel = cat.label; userChoice.optimalCatIcon = cat.icon; userChoice.optimalRankText = rText; }
        let comparison = userChoice ? (userChoice.catLabel === cat.label ? `<div class="text-[10px] text-success font-bold mt-1 bg-success/10 inline-block px-2 py-0.5 rounded-full">✅ שיחקת אותה! בחרת אופטימלי</div>` : `<div class="text-[10px] text-slate-500 mt-1">במשחק שלך: ${userChoice.icon} ${userChoice.catLabel} <span class="text-danger font-bold">(${userChoice.rankText})</span></div>`) : "";
        return `<div class="border-b border-slate-200 pb-2 pt-1.5 flex flex-col items-start"><div class="flex justify-between w-full items-center"><span>${cat.icon} <b>${s["שם יישוב"]}</b> (${cat.label})</span><span class="font-black text-success">${rText}</span></div>${comparison}</div>`;
    }).join('');
}

function showOptimalGame() { document.getElementById('optimal-score').innerText = globalOptimalScore.toLocaleString(); document.getElementById('optimal-history').innerHTML = globalOptimalHtml; showEl('optimal-modal', 'flex'); }

function shareResults() {
    let details = gameHistory.map(h => `${h.actualRank <= 150 ? '🟩' : h.actualRank <= 400 ? '🟨' : '🟥'} ${h.name} (${h.catLabel}) - מקום ${h.actualRank}`).join('\n');
    let perfectMatchText = (totalScore === globalOptimalScore) ? `\n🏆 השגתי את השידוך המושלם!\n` : `\n`;
    const text = `משחק היישובים V3 📍\nמצב: ${diff === 'easy' ? 'קל' : 'קשה'} | ${mode === 'draw' ? 'הגרלה' : 'הצבה'}\nתוצאה סופית: ${totalScore} נק'${perfectMatchText}\n${details}\n\n${window.location.href}`;
    navigator.share ? navigator.share({ text }) : (navigator.clipboard.writeText(text), alert("הטקסט הועתק ללוח!"));
}

function shareOptimalResults() {
    const diffScore = totalScore - globalOptimalScore;
    let comparisonText = diffScore === 0 ? "הגעתי לשידוך המושלם בדיוק! 🏆" : `הייתי במרחק של ${diffScore} נקודות מהשידוך המושלם! 😅`;
    const text = `משחק היישובים 📍 - אתגר השידוך המושלם\n\nציון שלי: ${totalScore}\nציון אופטימלי: ${globalOptimalScore}\n${comparisonText}\n\nנסו בעצמכם:\n${window.location.href}`;
    navigator.share ? navigator.share({ text }) : (navigator.clipboard.writeText(text), alert("הטקסט הועתק ללוח!"));
}
