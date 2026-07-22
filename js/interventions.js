import { saveIntervention } from './database.js';

const form = document.querySelector('#new-intervention-form');
const errorMessage = document.querySelector('#form-error');
const vehicleSelect = form.elements.namedItem('vehicle');
const customVehicleField = document.querySelector('#custom-vehicle-field');
const customVehicleInput = form.elements.namedItem('customVehicle');
const typeSelect = form.elements.namedItem('type');
const customTypeField = document.querySelector('#custom-type-field');
const customTypeInput = form.elements.namedItem('customType');

export function initialiseNewInterventionForm(onSaved) {
  vehicleSelect.addEventListener('change', () => {
    const isCustom = vehicleSelect.value === 'Altro';
    customVehicleField.hidden = !isCustom;
    customVehicleInput.required = isCustom;
    if (!isCustom) customVehicleInput.value = '';
  });
  typeSelect.addEventListener('change', () => {
    const isCustom = typeSelect.value === 'Altro';
    customTypeField.hidden = !isCustom;
    customTypeInput.required = isCustom;
    if (!isCustom) customTypeInput.value = '';
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
      type: formData.get('type') === 'Altro' ? formData.get('customType').trim() : formData.get('type').trim(),
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
      customVehicleInput.required = false;
      customTypeField.hidden = true;
      customTypeInput.required = false;
      onSaved(intervention);
    } catch (error) {
      console.error('Impossibile salvare l’intervento', error);
      errorMessage.hidden = false;
    }
  });
}
