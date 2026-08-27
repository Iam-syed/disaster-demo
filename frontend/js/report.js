const API_URL = 'http://localhost:5000/api';

const form = document.getElementById('reportForm');
const locationBtn = document.getElementById('locationBtn');
const locationText = document.getElementById('locationText');
const formMessage = document.getElementById('formMessage');

let coordinates = null;

locationBtn?.addEventListener('click', () => {
  if (!navigator.geolocation) {
    locationText.textContent = 'Location is not supported by this browser.';
    return;
  }

  locationBtn.disabled = true;
  locationBtn.textContent = 'Getting location...';

  navigator.geolocation.getCurrentPosition(
    (position) => {
      coordinates = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };

      locationText.textContent = 'Location added ✓';
      locationBtn.textContent = 'Location added';
      locationBtn.disabled = false;
    },
    () => {
      locationText.textContent = 'Location permission was not granted.';
      locationBtn.textContent = 'Try again';
      locationBtn.disabled = false;
    }
  );
});

form?.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!coordinates) {
    formMessage.textContent = 'Please add your location before submitting the report.';
    formMessage.style.display = 'block';
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = 'Submitting...';
  formMessage.style.display = 'none';

  const occurredAt = document.getElementById('time').value;

  const reportData = {
    type: document.getElementById('type').value,
    description: document.getElementById('description').value.trim(),
    peopleAffected: Number(document.getElementById('people').value) || 0,
    occurredAt: occurredAt ? new Date(occurredAt).toISOString() : new Date().toISOString(),
    location: coordinates
  };

  try {
    const response = await fetch(`${API_URL}/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(reportData)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Unable to submit report.');
    }

    formMessage.textContent = `Report submitted successfully. Report ID: ${data.report._id}`;
    formMessage.style.display = 'block';
    form.reset();
    coordinates = null;
    locationText.textContent = 'Location not added yet';
    locationBtn.textContent = 'Use my location';
  } catch (error) {
    formMessage.textContent = `Could not submit report: ${error.message}`;
    formMessage.style.display = 'block';
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Submit report →';
  }
});
