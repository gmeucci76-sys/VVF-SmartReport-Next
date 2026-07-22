import { purgeExpiredInterventions } from './database.js';

const form = document.querySelector('#settings-form');
const retention = document.querySelector('#retention-days');
const message = document.querySelector('#settings-message');

export function initialiseSettings() {
  retention.value = localStorage.getItem('vvf-retention-days') || '7';
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    localStorage.setItem('vvf-retention-days', retention.value);
    message.textContent = 'Impostazioni salvate su questo dispositivo.';
  });
  document.querySelector('#purge-expired').addEventListener('click', async () => {
    const removed = await purgeExpiredInterventions();
    message.textContent = removed ? `${removed} interventi scaduti eliminati.` : 'Nessun intervento scaduto da eliminare.';
  });
}
