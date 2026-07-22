import { saveIntervention } from './database.js';

const form = document.querySelector('#new-intervention-form');
const errorMessage = document.querySelector('#form-error');
const vehicleSelect = form.elements.namedItem('vehicle');
const customVehicleField = document.querySelector('#custom-vehicle-field');
const customVehicleInput = form.elements.namedItem('customVehicle');
const typeSelect = form.elements.namedItem('type');
const typeCategorySelect = form.elements.namedItem('typeCategory');

export function initialiseNewInterventionForm(onSaved) {
  vehicleSelect.addEventListener('change', () => {
    const isCustom = vehicleSelect.value === 'Altro';
    customVehicleField.hidden = !isCustom;
    if (!isCustom) customVehicleInput.value = '';
  });
  typeCategorySelect.addEventListener('change', () => {
    const values = typeCategorySelect._types?.[typeCategorySelect.value] || [];
    typeSelect.replaceChildren(new Option(typeCategorySelect.value ? 'Seleziona tipologia…' : 'Prima scegli la categoria…', ''));
    values.forEach((value) => typeSelect.add(new Option(value, value)));
  });
  fetch('./js/catalogs.json').then((response) => response.json()).then((catalogs) => {
    typeCategorySelect._types = catalogs.tipologie;
    Object.keys(catalogs.tipologie).forEach((category) => typeCategorySelect.add(new Option(category, category)));
  }).catch(() => {
    typeSelect.replaceChildren(new Option('Catalogo non disponibile', ''));
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorMessage.hidden = true;

    const formData = new FormData(form);
    const now = new Date();
    const intervention = {
      id: crypto.randomUUID(),
      number: formData.get('number').trim(),
      progressive: formData.get('progressive').trim(),
      typeCategory: formData.get('typeCategory').trim(),
      type: formData.get('type').trim(),
      municipality: formData.get('municipality').trim(),
      address: formData.get('address').trim(),
      departureTime: formData.get('departureTime'),
      teamLeader: formData.get('teamLeader').trim(),
      vehicle: formData.get('vehicle') === 'Altro' ? formData.get('customVehicle').trim() : formData.get('vehicle').trim(),
      status: 'in-progress',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      events: []
    };

    try {
      await saveIntervention(intervention);
      form.reset();
      customVehicleField.hidden = true;
      typeSelect.replaceChildren(new Option('Prima scegli la categoria…', ''));
      onSaved(intervention);
    } catch (error) {
      console.error('Impossibile salvare l’intervento', error);
      errorMessage.hidden = false;
    }
  });
}
