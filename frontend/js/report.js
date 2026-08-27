const form=document.querySelector('.report-card');
const locationBtn=document.getElementById('locationBtn');
locationBtn?.addEventListener('click',()=>{if(!navigator.geolocation){alert('Location is not supported by this browser.');return}locationBtn.textContent='Getting location...';navigator.geolocation.getCurrentPosition(pos=>{locationBtn.textContent='Location added ✓';locationBtn.dataset.lat=pos.coords.latitude;locationBtn.dataset.lng=pos.coords.longitude},()=>{locationBtn.textContent='Use my location';alert('Could not access your location. Please allow location permission.')});});
form?.addEventListener('submit',e=>{e.preventDefault();alert('Report form is ready. Backend submission will be connected next.');});
