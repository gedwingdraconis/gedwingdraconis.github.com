    (function() {
const SECRET_KEY = 'ZeroSagara89.*';
const API_BASE = window.location.origin;
const LS_KEY = 'cv-cursos-backup';

// ---- TEMAS ----
const themeToggle = document.getElementById('themeToggle');
const body = document.body;

function setTheme(mode) {
    body.classList.toggle('dark', mode === 'dark');
    themeToggle.textContent = mode === 'dark' ? '☀️ Modo Claro' : '🌙 Modo Oscuro';
    localStorage.setItem('cv-theme', mode);
}

const saved = localStorage.getItem('cv-theme');
if (saved) setTheme(saved);
else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) setTheme('dark');

themeToggle.addEventListener('click', () => setTheme(body.classList.contains('dark') ? 'light' : 'dark'));

// ---- CURSOS ----
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const container = document.getElementById('coursesContainer');
const lightbox = document.getElementById('lightbox');
const lightboxContent = document.getElementById('lightboxContent');
const lightboxClose = document.getElementById('lightboxClose');

const delOverlay = document.getElementById('modalOverlay');
const delInput = document.getElementById('passwordInput');
const delConfirm = document.getElementById('modalConfirm');
const delCancel = document.getElementById('modalCancel');
const delError = document.getElementById('modalError');

const upKeyOverlay = document.getElementById('uploadKeyOverlay');
const upKeyInput = document.getElementById('uploadKeyInput');
const upKeyConfirm = document.getElementById('uploadKeyConfirm');
const upKeyCancel = document.getElementById('uploadKeyCancel');
const upKeyError = document.getElementById('uploadKeyError');

const instOverlay = document.getElementById('institutionOverlay');
const instInput = document.getElementById('institutionInput');
const instConfirm = document.getElementById('institutionConfirm');
const instCancel = document.getElementById('institutionCancel');

let folders = [];
let pendingFile = null;
let useServer = false;

// ---- PERSISTENCIA ----
function loadFromLS() {
    try { const d = localStorage.getItem(LS_KEY); return d ? JSON.parse(d) : []; } catch { return []; }
}
function saveToLS(data) { localStorage.setItem(LS_KEY, JSON.stringify(data)); }

async function loadFolders() {
    try {
        const r = await fetch(API_BASE + '/api/cursos', { signal: AbortSignal.timeout(1000) });
        const data = await r.json();
        if (Array.isArray(data)) { useServer = true; folders = data; }
        else { useServer = false; folders = loadFromLS(); }
    } catch { useServer = false; folders = loadFromLS(); }
    renderCourses();
}

async function uploadToServer(institution, b64, file) {
    const r = await fetch(API_BASE + '/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: SECRET_KEY, institution, fileName: file.name, type: file.type, data: b64 })
    });
    return r.json();
}

function addToLS(institution, dataUrl, file) {
    const list = loadFromLS();
    let folder = list.find(f => f.institution === institution);
    if (!folder) { folder = { institution, files: [] }; list.push(folder); }
    if (!folder.files.some(f => f.fileName === file.name))
        folder.files.push({ fileName: file.name, type: file.type, data: dataUrl.split(',')[1] });
    saveToLS(list);
    return list;
}

function deleteFromLS(institution) {
    const list = loadFromLS().filter(f => f.institution !== institution);
    saveToLS(list);
    return list;
}

// ---- KEY MODALS ----
uploadBtn.addEventListener('click', () => {
    upKeyError.classList.remove('show');
    upKeyInput.value = '';
    upKeyOverlay.classList.add('active');
    setTimeout(() => upKeyInput.focus(), 100);
});
function closeUpKey() { upKeyOverlay.classList.remove('active'); }
function confirmUpKey() {
    if (upKeyInput.value !== SECRET_KEY) { upKeyError.classList.add('show'); upKeyInput.value = ''; upKeyInput.focus(); return; }
    closeUpKey(); fileInput.click();
}
upKeyConfirm.addEventListener('click', confirmUpKey);
upKeyCancel.addEventListener('click', closeUpKey);
upKeyOverlay.addEventListener('click', (e) => { if (e.target === upKeyOverlay) closeUpKey(); });
upKeyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirmUpKey(); if (e.key === 'Escape') closeUpKey(); });

fileInput.addEventListener('change', function(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const f = files[0];
    if (f.type !== 'image/png' && f.type !== 'application/pdf') return;
    pendingFile = f;
    instInput.value = '';
    instOverlay.classList.add('active');
    setTimeout(() => instInput.focus(), 100);
    fileInput.value = '';
});
function closeInst() { instOverlay.classList.remove('active'); pendingFile = null; }
function confirmInst() {
    const institution = instInput.value.trim();
    if (!institution) { instInput.style.borderColor = 'var(--danger)'; setTimeout(() => instInput.style.borderColor = '', 1500); instInput.focus(); return; }
    const reader = new FileReader();
    reader.onload = async function(ev) {
        const dataUrl = ev.target.result;
        const b64 = dataUrl.split(',')[1];
        if (useServer) {
            const resp = await uploadToServer(institution, b64, pendingFile);
            if (!resp.ok) { alert('Error: ' + (resp.error || '')); pendingFile = null; instOverlay.classList.remove('active'); return; }
        } else { addToLS(institution, dataUrl, pendingFile); }
        await loadFolders();
        pendingFile = null;
        instOverlay.classList.remove('active');
    };
    reader.readAsDataURL(pendingFile);
}
instConfirm.addEventListener('click', confirmInst);
instCancel.addEventListener('click', closeInst);
instOverlay.addEventListener('click', (e) => { if (e.target === instOverlay) closeInst(); });
instInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirmInst(); if (e.key === 'Escape') closeInst(); });

// ---- DELETE MODAL ----
let deleteTarget = null;
function openDelModal(inst) {
    deleteTarget = inst;
    delError.classList.remove('show');
    delInput.value = '';
    delOverlay.classList.add('active');
    setTimeout(() => delInput.focus(), 100);
}
function closeDel() { delOverlay.classList.remove('active'); deleteTarget = null; }
async function confirmDelete() {
    if (delInput.value !== SECRET_KEY) { delError.classList.add('show'); delInput.value = ''; delInput.focus(); return; }
    if (useServer) {
        const r = await fetch(API_BASE + '/api/delete-folder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: SECRET_KEY, institution: deleteTarget })
        });
        const resp = await r.json();
        if (!resp.ok) { alert('Error: ' + (resp.error || '')); closeDel(); return; }
    } else { deleteFromLS(deleteTarget); }
    await loadFolders();
    closeDel();
}
delConfirm.addEventListener('click', confirmDelete);
delCancel.addEventListener('click', closeDel);
delOverlay.addEventListener('click', (e) => { if (e.target === delOverlay) closeDel(); });
delInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirmDelete(); if (e.key === 'Escape') closeDel(); });

// ---- LIGHTBOX ----
function openLightbox(src, type) {
    lightboxContent.innerHTML = '';
    if (type === 'image/png') {
        const img = document.createElement('img');
        img.src = src;
        lightboxContent.appendChild(img);
    } else {
        const embed = document.createElement('embed');
        embed.src = src + '#toolbar=0';
        embed.type = 'application/pdf';
        lightboxContent.appendChild(embed);
    }
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
}
function closeLightbox() {
    lightbox.classList.remove('active');
    lightboxContent.innerHTML = '';
    document.body.style.overflow = '';
}
lightboxClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && lightbox.classList.contains('active')) closeLightbox(); });

// ---- RENDER ----
function renderCourses() {
    container.innerHTML = '';

    if (!folders.length) {
        container.innerHTML = '<div class="empty-courses">Aún no has subido ningún curso. ¡Usa el botón de arriba para comenzar!</div>';
        return;
    }

    folders.forEach((folder, fIdx) => {
        const card = document.createElement('div');
        card.className = 'institution-card';

        const header = document.createElement('div');
        header.className = 'institution-card-header';
                header.innerHTML = '🏛️ ' + folder.institution + ' <button class="header-delete-btn" data-inst="' + folder.institution + '"><i class="fas fa-trash-alt"></i></button>';
        card.appendChild(header);

                header.querySelector('.header-delete-btn').addEventListener('click', () => openDelModal(folder.institution));

        if (folder.files.length === 1) {
            const file = folder.files[0];
            const src = 'data:' + file.type + ';base64,' + file.data;
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'text-align:center;cursor:pointer;';
            if (file.type === 'image/png') {
                const img = document.createElement('img');
                img.src = src;
                img.alt = file.fileName;
                img.style.cssText = 'max-width:100%;max-height:500px;border-radius:12px;box-shadow:0 6px 20px rgba(0,0,0,0.12);';
                wrapper.appendChild(img);
                img.addEventListener('click', () => openLightbox(src, file.type));
            } else {
                const embed = document.createElement('embed');
                embed.src = src + '#toolbar=0';
                embed.type = 'application/pdf';
                embed.style.cssText = 'width:100%;height:500px;border-radius:12px;';
                wrapper.appendChild(embed);
                embed.addEventListener('click', () => openLightbox(src, file.type));
            }
            const label = document.createElement('div');
            label.className = 'slide-file-label';
            label.textContent = file.fileName.replace(/\.[^/.]+$/, '');
            wrapper.appendChild(label);
            card.appendChild(wrapper);
        } else {
            const carouselId = 'ic-' + fIdx;
            const trackId = carouselId + '-t';
            const dotsId = carouselId + '-d';
            let currentIdx = 0;

            const carDiv = document.createElement('div');
            carDiv.className = 'inst-carousel';
            carDiv.id = carouselId;

            const trackDiv = document.createElement('div');
            trackDiv.className = 'inst-carousel-track';
            trackDiv.id = trackId;

            folder.files.forEach((file) => {
                const slide = document.createElement('div');
                slide.className = 'inst-carousel-slide';
                const src = 'data:' + file.type + ';base64,' + file.data;
                if (file.type === 'image/png') {
                    const img = document.createElement('img');
                    img.src = src;
                    img.alt = file.fileName;
                    img.addEventListener('click', () => openLightbox(src, file.type));
                    slide.appendChild(img);
                } else {
                    const embed = document.createElement('embed');
                    embed.src = src + '#toolbar=0';
                    embed.type = 'application/pdf';
                    embed.addEventListener('click', () => openLightbox(src, file.type));
                    slide.appendChild(embed);
                }
                const label = document.createElement('div');
                label.className = 'slide-file-label';
                label.textContent = file.fileName.replace(/\.[^/.]+$/, '');
                slide.appendChild(label);
                trackDiv.appendChild(slide);
            });

            carDiv.appendChild(trackDiv);

            if (folder.files.length > 1) {
                const prevBtn = document.createElement('button');
                prevBtn.className = 'inst-carousel-btn prev';
                prevBtn.textContent = '‹';
                prevBtn.addEventListener('click', () => showSlideC(carouselId, trackId, dotsId, folder.files.length, 'prev'));
                carDiv.appendChild(prevBtn);

                const nextBtn = document.createElement('button');
                nextBtn.className = 'inst-carousel-btn next';
                nextBtn.textContent = '›';
                nextBtn.addEventListener('click', () => showSlideC(carouselId, trackId, dotsId, folder.files.length, 'next'));
                carDiv.appendChild(nextBtn);
            }

            card.appendChild(carDiv);

            const dotsDiv = document.createElement('div');
            dotsDiv.className = 'inst-carousel-dots';
            dotsDiv.id = dotsId;
            card.appendChild(dotsDiv);

            for (let i = 0; i < folder.files.length; i++) {
                const dot = document.createElement('button');
                dot.className = 'inst-carousel-dot' + (i === 0 ? ' active' : '');
                dot.addEventListener('click', () => {
                    goToSlide(trackId, dotsId, i);
                });
                dotsDiv.appendChild(dot);
            }

            currentIdx = 0;
            trackDiv.style.transform = 'translateX(0%)';
        }

        container.appendChild(card);
    });
}

function showSlideC(carId, trackId, dotsId, total, dir) {
    const track = document.getElementById(trackId);
    if (!track) return;
    const currentTransform = track.style.transform;
    let idx = 0;
    const match = currentTransform.match(/-?(\d+)%/);
    if (match) idx = parseInt(match[1]) / 100;
    if (dir === 'prev') idx--;
    else idx++;
    if (idx < 0) idx = total - 1;
    if (idx >= total) idx = 0;
    goToSlide(trackId, dotsId, idx);
}

function goToSlide(trackId, dotsId, idx) {
    const track = document.getElementById(trackId);
    const dots = document.getElementById(dotsId);
    if (!track || !dots) return;
    track.style.transform = 'translateX(-' + (idx * 100) + '%)';
    Array.from(dots.children).forEach((d, i) => {
        d.classList.toggle('active', i === idx);
    });
}

loadFolders();
    })();
