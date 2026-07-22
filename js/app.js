import { initialiseNewInterventionForm } from './interventions.js';
import { renderInterventionList } from './intervention-list.js';
import { listInterventions, purgeExpiredInterventions } from './database.js';
import { closeDiary, initialiseDiary, openDiary } from './diary.js';
import { initialiseSettings } from './settings.js';
import { initialiseRecord, openRecord } from './record.js';

const homeView = document.querySelector('#home-view');
const noticeView = document.querySelector('#notice-view');
const newInterventionView = document.querySelector('#new-intervention-view');
const savedView = document.querySelector('#saved-view');
const interventionsView = document.querySelector('#interventions-view');
const diaryView = document.querySelector('#diary-view');
const settingsView = document.querySelector('#settings-view');
const recordView = document.querySelector('#record-view');
const title = document.querySelector('#notice-title');
const message = document.querySelector('#notice-message');
const status = document.querySelector('#connection-status');
const installButton = document.querySelector('#install-button');
let installPrompt;

const screens = {
  'new-intervention': ['Nuovo Intervento', 'Il modulo rapido per aprire il diario operativo sarà il prossimo passo.'],
  interventions: ['Interventi', 'Qui compariranno solo gli interventi salvati su questo dispositivo.'],
  settings: ['Impostazioni', 'Qui potrai impostare la durata di conservazione dei dati e le preferenze locali.']
};

function updateConnectionStatus() {
  const localPreview = window.location.protocol === 'file:';
  const online = navigator.onLine;
  status.textContent = localPreview ? 'Anteprima locale' : online ? 'Online' : 'Offline';
  status.classList.toggle('offline', !online && !localPreview);
}

function showNotice(action) {
  const [screenTitle, screenMessage] = screens[action];
  title.textContent = screenTitle;
  message.textContent = screenMessage;
  homeView.hidden = true;
  noticeView.hidden = false;
}

async function refreshDashboard() {
  const interventions = await listInterventions();
  const active = interventions.filter((intervention) => intervention.status !== 'closed').length;
  const closed = interventions.length - active;
  const today = new Date().toDateString();
  const createdToday = interventions.filter((intervention) => new Date(intervention.createdAt).toDateString() === today).length;
  document.querySelector('#total-interventions-count').textContent = interventions.length;
  document.querySelector('#active-interventions-count').textContent = active;
  document.querySelector('#closed-interventions-count').textContent = closed;
  document.querySelector('#today-interventions-count').textContent = createdToday;
  document.querySelector('#open-interventions-count').textContent = active;
}

function showHome() {
  [noticeView, newInterventionView, savedView, interventionsView, diaryView, settingsView, recordView].forEach((view) => { view.hidden = true; });
  homeView.hidden = false;
  refreshDashboard().catch((error) => console.error('Riepilogo non disponibile', error));
}

let currentInterventionFilter = 'all';
let currentInterventionSearch = '';
async function showInterventions(filter = 'all') {
  currentInterventionFilter = filter;
  homeView.hidden = true;
  diaryView.hidden = true;
  interventionsView.hidden = false;
  document.querySelectorAll('[data-filter]').forEach((button) => button.classList.toggle('active', button.dataset.filter === filter));
  await renderInterventionList(showDiary, filter, currentInterventionSearch);
}

async function showDiary(id) {
  interventionsView.hidden = true;
  const opened = await openDiary(id);
  if (!opened) showInterventions();
}

async function showRecord(id) {
  diaryView.hidden = true;
  const opened = await openRecord(id);
  if (!opened) showInterventions();
}

function showSettings() {
  homeView.hidden = true;
  settingsView.hidden = false;
}

function showNewIntervention() {
  homeView.hidden = true;
  newInterventionView.hidden = false;
  const departureTime = document.querySelector('[name="departureTime"]');
  if (!departureTime.value) departureTime.value = new Date().toTimeString().slice(0, 5);
  document.querySelector('[name="number"]').focus();
}

document.querySelectorAll('[data-action]').forEach((button) => {
  button.addEventListener('click', () => {
    if (button.dataset.action === 'new-intervention') showNewIntervention();
    else if (button.dataset.action === 'interventions') showInterventions('all');
    else if (button.dataset.action === 'open-interventions') showInterventions('open');
    else if (button.dataset.action === 'settings') showSettings();
    else showNotice(button.dataset.action);
  });
});
document.querySelector('#back-button').addEventListener('click', showHome);
document.querySelectorAll('[data-home]').forEach((button) => button.addEventListener('click', showHome));
document.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', () => showInterventions(button.dataset.filter)));
document.querySelector('#intervention-search').addEventListener('input', (event) => {
  currentInterventionSearch = event.target.value;
  renderInterventionList(showDiary, currentInterventionFilter, currentInterventionSearch);
});
document.querySelector('#saved-home-button').addEventListener('click', showHome);

initialiseNewInterventionForm((intervention) => { newInterventionView.hidden = true; showDiary(intervention.id); });
initialiseDiary({ onBack: () => showInterventions(currentInterventionFilter), onChanged: refreshDashboard });
initialiseRecord({ onBack: showDiary, onSaved: showDiary });
document.querySelector('#open-record').addEventListener('click', async () => {
  const interventionId = document.querySelector('#diary-view').dataset.interventionId;
  if (interventionId) await showRecord(interventionId);
});
initialiseSettings();
purgeExpiredInterventions().then(refreshDashboard).catch((error) => console.error('Pulizia dati scaduti non riuscita', error));

window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
  installButton.hidden = false;
});
installButton.addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = undefined;
  installButton.hidden = true;
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js'));
}
updateConnectionStatus();
