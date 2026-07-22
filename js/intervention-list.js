import { listInterventions } from './database.js';

const list = document.querySelector('#intervention-list');
const emptyState = document.querySelector('#interventions-empty');
const errorState = document.querySelector('#interventions-error');

function formatDate(value) {
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(new Date(value));
}

function interventionCard(intervention, onOpen) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'intervention-card';
  const header = document.createElement('div');
  header.className = 'intervention-card-header';
  const number = document.createElement('span');
  number.className = 'intervention-number';
  number.textContent = intervention.number || intervention.progressive ? `${intervention.number || '—'}/${intervention.progressive || '—'}` : 'INTERVENTO IN COMPILAZIONE';
  const badge = document.createElement('span');
  badge.className = 'status-badge';
  badge.textContent = intervention.status === 'closed' ? 'CHIUSO' : 'IN CORSO';
  if (intervention.status === 'closed') badge.classList.add('status-closed');
  header.append(number, badge);

  const type = document.createElement('h3');
  type.textContent = intervention.type || 'Tipologia da completare';
  const location = document.createElement('p');
  location.className = 'intervention-location';
  location.textContent = intervention.municipality || intervention.address ? `⌖ ${intervention.municipality || 'Luogo da completare'}${intervention.address ? ` · ${intervention.address}` : ''}` : '⌖ Luogo da completare';
  const updated = document.createElement('p');
  updated.className = 'intervention-update';
  updated.textContent = `Aggiornato ${formatDate(intervention.updatedAt)}`;
  card.append(header, type, location, updated);
  card.addEventListener('click', () => onOpen(intervention.id));
  return card;
}

export async function renderInterventionList(onOpen, filter = 'all', search = '') {
  list.replaceChildren();
  emptyState.hidden = true;
  errorState.hidden = true;

  try {
    const allInterventions = await listInterventions();
    const byStatus = filter === 'all' ? allInterventions : allInterventions.filter((intervention) => filter === 'open' ? intervention.status !== 'closed' : intervention.status === 'closed');
    const query = search.trim().toLocaleLowerCase('it');
    const interventions = query ? byStatus.filter((intervention) => JSON.stringify(intervention).toLocaleLowerCase('it').includes(query)) : byStatus;
    if (!interventions.length) {
      emptyState.hidden = false;
      return;
    }
    interventions.forEach((intervention) => list.append(interventionCard(intervention, onOpen)));
  } catch (error) {
    console.error('Impossibile leggere gli interventi', error);
    errorState.hidden = false;
  }
}
