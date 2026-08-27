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

form?.addEventListener('submit', (event) => {
  event.preventDefault();

  formMessage.textContent = coordinates
    ? 'Report captured successfully. Backend processing will be connected next.'
    : 'Report captured. Add your location when possible for better response coordination.';

  formMessage.style.display = 'block';
});
