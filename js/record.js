import { getIntervention, saveIntervention } from './database.js';

const form = document.querySelector('#complete-record-form');
const view = document.querySelector('#record-view');
const title = document.querySelector('#record-title');
let activeIntervention;
let catalogs;

async function loadCatalogs() {
  if (!catalogs) catalogs = await fetch('./js/catalogs.json').then((response) => response.json());
  return catalogs;
}

function options(select, values, selected = '', emptyLabel = 'Seleziona…') {
  select.replaceChildren(new Option(emptyLabel, ''));
  values.forEach((value) => select.add(new Option(value, value, false, value === selected)));
}

function setDependentOptions(categoryId, valueId, catalogName, selectedValue = '') {
  const category = document.querySelector(`#${categoryId}`);
  const value = document.querySelector(`#${valueId}`);
  const update = () => options(value, Object.values(catalogs[catalogName][category.value] || {}).flat(), selectedValue, 'Prima seleziona la categoria…');
  category.addEventListener('change', () => { selectedValue = ''; update(); });
  update();
}

function setField(name, value) {
  const field = form.elements.namedItem(name);
  if (!field) return;
  if (field.type === 'checkbox') field.checked = Boolean(value);
  else field.value = Array.isArray(value) ? value.join('\n') : (value || '');
}

function getValue(name) {
  const field = form.elements.namedItem(name);
  if (!field) return '';
  return field.type === 'checkbox' ? field.checked : field.value.trim();
}

function syncVehicleOther(name, savedValue = '') {
  const select = form.elements.namedItem(name);
  const other = form.elements.namedItem(`${name}Other`);
  const wrapper = document.querySelector(`[data-vehicle-other="${name}"]`);
  const knownValues = [...select.options].map((option) => option.value).filter((value) => value && value !== 'other');
  const useOther = savedValue && !knownValues.includes(savedValue);
  select.value = useOther ? 'other' : (savedValue || '');
  other.value = useOther ? savedValue : '';
  wrapper.hidden = select.value !== 'other';
}

function selectedVehicle(name) {
  const select = form.elements.namedItem(name);
  return select.value === 'other' ? getValue(`${name}Other`) : select.value;
}

function addSmartListItem(list, value = '') {
  const row = document.createElement('div');
  row.className = 'smart-list-row';
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value;
  input.setAttribute('list', list.dataset.datalist);
  input.placeholder = 'Seleziona o scrivi…';
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.textContent = '−';
  remove.setAttribute('aria-label', 'Rimuovi voce');
  remove.addEventListener('click', () => row.remove());
  row.append(input, remove);
  list.querySelector('.smart-list-items').append(row);
}

function renderSmartList(field, values = []) {
  const list = document.querySelector(`.smart-list[data-list-field="${field}"]`);
  list.querySelector('.smart-list-items').replaceChildren();
  values.forEach((value) => addSmartListItem(list, value));
}

function smartListValues(field) {
  return [...document.querySelectorAll(`.smart-list[data-list-field="${field}"] input`)].map((input) => input.value.trim()).filter(Boolean);
}

export async function openRecord(id) {
  activeIntervention = await getIntervention(id);
  if (!activeIntervention) return false;
  activeIntervention.details ||= {};
  await loadCatalogs();
  const data = activeIntervention.details;
  title.textContent = activeIntervention.number || activeIntervention.progressive ? `Scheda ${activeIntervention.number || '—'}/${activeIntervention.progressive || '—'}` : 'Scheda intervento';
  options(document.querySelector('#record-type-category'), Object.keys(catalogs.tipologie), data.typeCategory, 'Seleziona categoria…');
  options(document.querySelector('#record-place-category'), Object.keys(catalogs.luoghi), data.placeCategory, 'Seleziona categoria…');
  options(document.querySelector('#record-substance-category'), Object.keys(catalogs.sostanze), data.substanceCategory, 'Seleziona categoria…');
  options(document.querySelector('#record-cause-category'), Object.keys(catalogs.cause), data.causeCategory, 'Seleziona categoria…');
  setDependentOptions('record-type-category', 'record-type', 'tipologie', activeIntervention.type);
  setDependentOptions('record-place-category', 'record-place', 'luoghi', data.place);
  setDependentOptions('record-substance-category', 'record-substance', 'sostanze', data.substance);
  setDependentOptions('record-cause-category', 'record-cause', 'cause', data.cause);
  ['number', 'progressive', 'municipality', 'address', 'departureTime', 'arrivalTime', 'returnTime'].forEach((key) => setField(key, activeIntervention[key]));
  Object.entries(data).forEach(([key, value]) => setField(key, value));
  syncVehicleOther('departureVehicle', data.departureVehicle || activeIntervention.vehicle || '');
  syncVehicleOther('supportVehicle', data.supportVehicle || '');
  renderSmartList('supportVehicles', data.supportVehicles || []);
  renderSmartList('specialUnits', data.specialUnits || []);
  renderSmartList('entities', data.entities || []);
  view.hidden = false;
  return true;
}

export function closeRecord() { activeIntervention = undefined; view.hidden = true; }

export function initialiseRecord({ onBack, onSaved }) {
  document.querySelector('#record-back').addEventListener('click', () => {
    const interventionId = activeIntervention?.id;
    closeRecord();
    onBack(interventionId);
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const listFields = ['operators', 'supportOperators', 'supportVehicles', 'specialUnits', 'entities'];
    const data = {};
    [...form.elements].filter((field) => field.name).forEach((field) => {
      if (['number', 'progressive', 'municipality', 'address', 'departureTime', 'arrivalTime', 'returnTime', 'type'].includes(field.name)) return;
      data[field.name] = listFields.includes(field.name) ? field.value.split('\n').map((value) => value.trim()).filter(Boolean) : (field.type === 'checkbox' ? field.checked : field.value.trim());
    });
    ['supportVehicles', 'specialUnits', 'entities'].forEach((field) => { data[field] = smartListValues(field); });
    data.departureVehicle = selectedVehicle('departureVehicle');
    data.supportVehicle = selectedVehicle('supportVehicle');
    delete data.departureVehicleOther;
    delete data.supportVehicleOther;
    activeIntervention.number = getValue('number');
    activeIntervention.progressive = getValue('progressive');
    activeIntervention.type = getValue('type') || activeIntervention.type;
    activeIntervention.municipality = getValue('municipality');
    activeIntervention.address = getValue('address');
    activeIntervention.departureTime = getValue('departureTime');
    activeIntervention.arrivalTime = getValue('arrivalTime');
    activeIntervention.returnTime = getValue('returnTime');
    activeIntervention.vehicle = data.departureVehicle || activeIntervention.vehicle;
    activeIntervention.details = data;
    activeIntervention.updatedAt = new Date().toISOString();
    await saveIntervention(activeIntervention);
    const savedId = activeIntervention.id;
    closeRecord();
    onSaved(savedId);
  });
  ['departureVehicle', 'supportVehicle'].forEach((name) => {
    form.elements.namedItem(name).addEventListener('change', () => {
      const select = form.elements.namedItem(name);
      const other = form.elements.namedItem(`${name}Other`);
      document.querySelector(`[data-vehicle-other="${name}"]`).hidden = select.value !== 'other';
      if (select.value !== 'other') other.value = '';
    });
  });
  document.querySelectorAll('.btn-add-list').forEach((button) => button.addEventListener('click', () => addSmartListItem(button.closest('.smart-list'))));
}
