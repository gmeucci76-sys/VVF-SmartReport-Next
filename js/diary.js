import { deleteIntervention, getIntervention, saveIntervention } from './database.js';

const view = document.querySelector('#diary-view');
const title = document.querySelector('#diary-title');
const details = document.querySelector('#diary-details');
const status = document.querySelector('#diary-status');
const events = document.querySelector('#event-list');
const eventForm = document.querySelector('#event-form');
const eventTime = document.querySelector('#event-time');
const eventDescription = document.querySelector('#event-description');
const empty = document.querySelector('#events-empty');
const photoInput = document.querySelector('#photo-input');
const videoInput = document.querySelector('#video-input');
const audioInput = document.querySelector('#audio-input');
const attachments = document.querySelector('#attachment-list');
const recordAudioButton = document.querySelector('#record-audio');
let activeIntervention;
let recorder;
let audioStream;
let audioChunks = [];

const categoryLabels = {
  operational: 'Operativo',
  controlRoom: 'Sala Operativa',
  safety: 'Sicurezza',
  material: 'Materiali',
  critical: 'Critico',
  other: 'Altro'
};

function formatDate(value) {
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function reportSection(title, rows) {
  const filledRows = rows.filter(([, value]) => value !== undefined && value !== null && value !== '' && value !== false && (!Array.isArray(value) || value.length));
  if (!filledRows.length) return '';
  const content = filledRows.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(Array.isArray(value) ? value.join(', ') : value === true ? 'Sì' : value)}</td></tr>`).join('');
  return `<section><h3>${escapeHtml(title)}</h3><table>${content}</table></section>`;
}

function renderEvents() {
  events.replaceChildren();
  const ordered = [...activeIntervention.events].sort((first, second) => first.createdAt.localeCompare(second.createdAt));
  empty.hidden = ordered.length > 0;
  ordered.forEach((event) => {
    const item = document.createElement('article');
    item.className = `event-item event-${event.category}`;
    const top = document.createElement('div');
    top.className = 'event-topline';
    const time = document.createElement('strong');
    time.textContent = event.time;
    const category = document.createElement('span');
    category.textContent = categoryLabels[event.category] || categoryLabels.other;
    top.append(time, category);
    const text = document.createElement('p');
    text.textContent = event.description;
    const actions = document.createElement('div');
    actions.className = 'event-actions';
    const editButton = document.createElement('button');
    editButton.className = 'event-edit';
    editButton.type = 'button';
    editButton.textContent = 'Modifica';
    editButton.addEventListener('click', async () => {
      const description = prompt('Modifica l’evento:', event.description);
      if (description === null) return;
      const text = description.trim();
      if (!text) return;
      const time = prompt('Ora dell’evento (HH:MM):', event.time);
      if (time === null) return;
      event.description = text;
      event.time = time.trim() || event.time;
      activeIntervention.updatedAt = new Date().toISOString();
      await saveIntervention(activeIntervention);
      renderEvents();
    });
    const deleteButton = document.createElement('button');
    deleteButton.className = 'event-delete';
    deleteButton.type = 'button';
    deleteButton.textContent = 'Elimina';
    deleteButton.addEventListener('click', async () => {
      if (!confirm('Eliminare questo evento dal diario?')) return;
      activeIntervention.events = activeIntervention.events.filter((savedEvent) => savedEvent.id !== event.id);
      activeIntervention.updatedAt = new Date().toISOString();
      await saveIntervention(activeIntervention);
      renderEvents();
    });
    actions.append(editButton, deleteButton);
    item.append(top, text, actions);
    events.append(item);
  });
}

function renderAttachments() {
  attachments.replaceChildren();
  (activeIntervention.attachments || []).forEach((attachment) => {
    const item = document.createElement('div');
    item.className = 'attachment-item';
    const media = attachment.kind === 'audio' ? document.createElement('audio') : attachment.kind === 'video' ? document.createElement('video') : document.createElement('img');
    if (attachment.kind === 'audio' || attachment.kind === 'video') {
      media.controls = true;
      media.src = URL.createObjectURL(attachment.blob);
    } else {
      media.src = attachment.data;
      media.alt = `Foto acquisita alle ${attachment.time}`;
    }
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Elimina foto';
    remove.addEventListener('click', async () => {
      if (!confirm('Eliminare questa foto dal dispositivo?')) return;
      activeIntervention.attachments = activeIntervention.attachments.filter((saved) => saved.id !== attachment.id);
      activeIntervention.updatedAt = new Date().toISOString();
      await saveIntervention(activeIntervention);
      renderAttachments();
    });
    item.append(media, remove);
    attachments.append(item);
  });
}

function renderHeader() {
  const number = activeIntervention.number || activeIntervention.progressive ? `${activeIntervention.number || '—'}/${activeIntervention.progressive || '—'}` : 'Intervento in compilazione';
  title.textContent = `${number} · ${activeIntervention.type || 'Tipologia da completare'}`;
  details.textContent = [activeIntervention.municipality || 'Luogo da completare', activeIntervention.address, activeIntervention.vehicle].filter(Boolean).join(' · ');
  status.textContent = activeIntervention.status === 'closed' ? 'CHIUSO' : 'IN CORSO';
  status.className = `status-badge ${activeIntervention.status === 'closed' ? 'status-closed' : ''}`;
  eventForm.hidden = activeIntervention.status === 'closed';
}

export async function openDiary(id) {
  activeIntervention = await getIntervention(id);
  if (!activeIntervention) return false;
  activeIntervention.events ||= [];
  activeIntervention.attachments ||= [];
  view.dataset.interventionId = activeIntervention.id;
  view.hidden = false;
  renderHeader();
  renderEvents();
  renderAttachments();
  eventTime.value = new Date().toTimeString().slice(0, 5);
  return true;
}

export function closeDiary() {
  activeIntervention = undefined;
  delete view.dataset.interventionId;
  view.hidden = true;
}

export function initialiseDiary({ onBack, onChanged }) {
  document.querySelector('#diary-back').addEventListener('click', () => { closeDiary(); onBack(); });
  eventForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const description = eventDescription.value.trim();
    if (!description) return;
    activeIntervention.events.push({
      id: crypto.randomUUID(), time: eventTime.value || new Date().toTimeString().slice(0, 5),
      category: 'operational', description, createdAt: new Date().toISOString()
    });
    activeIntervention.updatedAt = new Date().toISOString();
    await saveIntervention(activeIntervention);
    eventDescription.value = '';
    eventTime.value = new Date().toTimeString().slice(0, 5);
    renderEvents();
    onChanged();
  });
  document.querySelector('#close-intervention').addEventListener('click', async () => {
    if (!confirm('Chiudere l’intervento? Potrai ancora consultare il diario finché non lo elimini.')) return;
    activeIntervention.status = 'closed';
    activeIntervention.closedAt = new Date().toISOString();
    const retentionDays = Number(localStorage.getItem('vvf-retention-days') || 7);
    activeIntervention.expiresAt = new Date(Date.now() + retentionDays * 86400000).toISOString();
    activeIntervention.updatedAt = activeIntervention.closedAt;
    await saveIntervention(activeIntervention);
    renderHeader();
    onChanged();
  });
  document.querySelector('#delete-intervention').addEventListener('click', async () => {
    if (!confirm('Eliminare definitivamente l’intervento e tutti i suoi dati da questo dispositivo?')) return;
    await deleteIntervention(activeIntervention.id);
    closeDiary();
    onBack();
    onChanged();
  });
  photoInput.addEventListener('change', async () => {
    const files = Array.from(photoInput.files).filter((file) => file.type.startsWith('image/'));
    if (!files.length) return;
    const images = await Promise.all(files.map((file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ id: crypto.randomUUID(), kind: 'image', data: reader.result, time: new Date().toTimeString().slice(0, 5) });
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    }))));
    activeIntervention.attachments.push(...images);
    activeIntervention.updatedAt = new Date().toISOString();
    await saveIntervention(activeIntervention);
    photoInput.value = '';
    renderAttachments();
    onChanged();
  });
  videoInput.addEventListener('change', async () => {
    const files = Array.from(videoInput.files).filter((file) => file.type.startsWith('video/'));
    if (!files.length) return;
    activeIntervention.attachments.push(...files.map((file) => ({ id: crypto.randomUUID(), kind: 'video', blob: file, time: new Date().toTimeString().slice(0, 5) })));
    activeIntervention.updatedAt = new Date().toISOString();
    await saveIntervention(activeIntervention);
    videoInput.value = '';
    renderAttachments();
    onChanged();
  });
  audioInput.addEventListener('change', async () => {
    const files = Array.from(audioInput.files).filter((file) => file.type.startsWith('audio/'));
    if (!files.length) return;
    activeIntervention.attachments.push(...files.map((file) => ({ id: crypto.randomUUID(), kind: 'audio', blob: file, time: new Date().toTimeString().slice(0, 5) })));
    activeIntervention.updatedAt = new Date().toISOString();
    await saveIntervention(activeIntervention);
    audioInput.value = '';
    renderAttachments();
    onChanged();
  });
  recordAudioButton.addEventListener('click', async () => {
    if (recorder?.state === 'recording') {
      recorder.stop();
      recordAudioButton.textContent = '🎙 Salvataggio audio…';
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      alert('La registrazione audio non è supportata da questo dispositivo.');
      return;
    }
    try {
      audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      recorder = new MediaRecorder(audioStream);
      recorder.addEventListener('dataavailable', (event) => { if (event.data.size) audioChunks.push(event.data); });
      recorder.addEventListener('stop', async () => {
        const blob = new Blob(audioChunks, { type: recorder.mimeType || 'audio/webm' });
        activeIntervention.attachments.push({ id: crypto.randomUUID(), kind: 'audio', blob, time: new Date().toTimeString().slice(0, 5) });
        activeIntervention.updatedAt = new Date().toISOString();
        await saveIntervention(activeIntervention);
        audioStream.getTracks().forEach((track) => track.stop());
        recorder = undefined;
        audioStream = undefined;
        recordAudioButton.textContent = '🎙 Registra audio';
        renderAttachments();
        onChanged();
      }, { once: true });
      recorder.start();
      recordAudioButton.textContent = '■ Ferma audio';
    } catch (error) {
      console.error('Registrazione audio non disponibile', error);
      recordAudioButton.textContent = '🎙 Registra audio';
      alert('Il microfono non è disponibile. Verifica il permesso sul dispositivo.');
    }
  });
  document.querySelector('#add-location').addEventListener('click', () => {
    if (!navigator.geolocation) { alert('La posizione non è supportata da questo dispositivo.'); return; }
    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      activeIntervention.events.push({
        id: crypto.randomUUID(), time: new Date().toTimeString().slice(0, 5), category: 'safety',
        description: `Posizione rilevata: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (precisione ±${Math.round(accuracy)} m).`,
        createdAt: new Date().toISOString()
      });
      activeIntervention.updatedAt = new Date().toISOString();
      await saveIntervention(activeIntervention);
      renderEvents();
      onChanged();
    }, () => alert('Non è stato possibile acquisire la posizione. Verifica i permessi del dispositivo.'), { enableHighAccuracy: true, timeout: 10000 });
  });
  document.querySelector('#print-report').addEventListener('click', () => {
    const eventRows = activeIntervention.events.map((event) => `<li><strong>${escapeHtml(event.time)}</strong> — ${escapeHtml(event.description)}</li>`).join('');
    const report = window.open('', '_blank', 'noopener,noreferrer');
    if (!report) { alert('Consenti l’apertura della finestra per esportare il PDF.'); return; }
    const number = escapeHtml(activeIntervention.number);
    const progressive = escapeHtml(activeIntervention.progressive);
    const type = escapeHtml(activeIntervention.type);
    const municipality = escapeHtml(activeIntervention.municipality);
    const address = activeIntervention.address ? ` · ${escapeHtml(activeIntervention.address)}` : '';
    const details = activeIntervention.details || {};
    const structuredData = [
      reportSection('Orari', [['Partenza', activeIntervention.departureTime], ['Arrivo', activeIntervention.arrivalTime], ['Rientro', activeIntervention.returnTime]]),
      reportSection('Codici intervento', [['Categoria luogo', details.placeCategory], ['Luogo specifico', details.place], ['Categoria sostanza', details.substanceCategory], ['Sostanza specifica', details.substance], ['Categoria causa', details.causeCategory], ['Causa specifica', details.cause], ['Note', details.codeNotes]]),
      reportSection('Squadra e mezzi', [['Mezzo di partenza', details.departureVehicle || activeIntervention.vehicle], ['Capo squadra', details.teamLeader], ['Autista', details.driver], ['Operatori', details.operators], ['Mezzo di appoggio', details.supportVehicle], ['Autista mezzo di appoggio', details.supportDriver], ['Operatori mezzo di appoggio', details.supportOperators], ['Mezzi di supporto', details.supportVehicles], ['Nuclei speciali', details.specialUnits], ['Enti intervenuti', details.entities]]),
      reportSection('Informazioni scheda', [['Funzionario di guardia', details.dutyOfficer], ['Luogo di lavoro (D.Lgs. 81/2008)', details.workplace], ['Boschi bruciati (mq)', details.woodsArea], ['Pascoli bruciati (mq)', details.pastureArea], ['Altra superficie (mq)', details.otherArea], ['Descrizione altra superficie', details.otherAreaDescription], ['Evacuazione / allontanamento persone', details.evacuation], ['Mezzi aerei COAU', details.airCOAU], ['Mezzi aerei regionali', details.airRegional], ['Elicottero VVF', details.airRescue], ['Canadair', details.canadair], ['Presenza DOS', details.dos]]),
      reportSection('Relazione operativa', [['Info e situazione all’arrivo', details.arrivalSituation], ['Si provvedeva a', details.actionsTaken], ['Risultati ottenuti', details.results], ['Presumibile causa del sinistro', details.presumedCause], ['Provvedimenti di tutela', details.protectiveMeasures], ['Attività di Polizia Giudiziaria', details.judicialPoliceActivity]])
    ].join('');
    const attachments = activeIntervention.attachments || [];
    const attachmentSummary = reportSection('Allegati', [['Foto', attachments.filter((attachment) => attachment.kind === 'image' || !attachment.kind).length], ['Audio', attachments.filter((attachment) => attachment.kind === 'audio').length], ['Video', attachments.filter((attachment) => attachment.kind === 'video').length]]);
    report.document.write(`<!doctype html><html lang="it"><head><title>Intervento ${number}/${progressive}</title><style>body{font-family:Arial,sans-serif;max-width:760px;margin:35px auto;color:#18212b}h1{color:#b5121b;margin-bottom:4px}h2{margin-top:0}h3{margin:28px 0 9px;padding-bottom:6px;border-bottom:2px solid #b5121b}li{margin:10px 0;line-height:1.4}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:8px;border-bottom:1px solid #dfe4e8;text-align:left;vertical-align:top}th{width:36%;color:#53606c}@media print{body{margin:0}}</style></head><body><h1>VVF SmartReport</h1><h2>Intervento ${number}/${progressive}</h2><p><strong>${type || 'Tipologia da completare'}</strong><br>${municipality || 'Luogo da completare'}${address}</p>${structuredData}<h3>Diario operativo</h3><ol>${eventRows || '<li>Nessun evento registrato.</li>'}</ol>${attachmentSummary}</body></html>`);
    report.document.close();
    report.focus();
    report.print();
  });
}
