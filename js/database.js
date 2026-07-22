const DB_NAME = 'vvf-smartreport-next';
const DB_VERSION = 1;
const INTERVENTIONS_STORE = 'interventions';

export function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(INTERVENTIONS_STORE)) {
        const store = database.createObjectStore(INTERVENTIONS_STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
        store.createIndex('status', 'status');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveIntervention(intervention) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(INTERVENTIONS_STORE, 'readwrite');
    transaction.objectStore(INTERVENTIONS_STORE).put(intervention);
    transaction.oncomplete = () => { database.close(); resolve(intervention); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
  });
}

export async function listInterventions() {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(INTERVENTIONS_STORE, 'readonly');
    const request = transaction.objectStore(INTERVENTIONS_STORE).getAll();
    request.onsuccess = () => {
      database.close();
      resolve(request.result.sort((first, second) => second.updatedAt.localeCompare(first.updatedAt)));
    };
    request.onerror = () => { database.close(); reject(request.error); };
  });
}

export async function getIntervention(id) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(INTERVENTIONS_STORE, 'readonly').objectStore(INTERVENTIONS_STORE).get(id);
    request.onsuccess = () => { database.close(); resolve(request.result); };
    request.onerror = () => { database.close(); reject(request.error); };
  });
}

export async function deleteIntervention(id) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(INTERVENTIONS_STORE, 'readwrite');
    transaction.objectStore(INTERVENTIONS_STORE).delete(id);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
  });
}

export async function purgeExpiredInterventions(now = new Date().toISOString()) {
  const interventions = await listInterventions();
  const expired = interventions.filter((intervention) => intervention.expiresAt && intervention.expiresAt <= now);
  await Promise.all(expired.map((intervention) => deleteIntervention(intervention.id)));
  return expired.length;
}
