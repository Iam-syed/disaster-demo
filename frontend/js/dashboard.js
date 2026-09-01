const API_URL = 'http://localhost:5000/api';

const token = localStorage.getItem('disasterToken');
const user = JSON.parse(localStorage.getItem('disasterUser') || 'null');

if (!token || user?.role !== 'authority') {
  window.location.href = 'auth.html';
}

document.getElementById('authorityName').textContent = user?.name || 'Authority';

const reportsList = document.getElementById('reportsList');
const message = document.getElementById('message');
const statusFilter = document.getElementById('statusFilter');
const refreshBtn = document.getElementById('refreshBtn');
let reports = [];
let incidentMap = null;
let markerLayer = null;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}
function formatDate(value) {
  if (!value) return 'Time not provided';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Time not provided' : date.toLocaleString();
}
function titleCase(value) {
  return String(value || '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
function renderStats() {
  const critical = reports.filter(r => String(r.severity).toLowerCase() === 'critical').length;
  const high = reports.filter(r => String(r.severity).toLowerCase() === 'high').length;
  const pending = reports.filter(r => ['new', 'pending'].includes(String(r.status).toLowerCase())).length;
  document.getElementById('totalCount').textContent = reports.length;
  document.getElementById('criticalCount').textContent = critical;
  document.getElementById('highCount').textContent = high;
  document.getElementById('pendingCount').textContent = pending;
}
function renderReports() {
  const filter = statusFilter.value;
  const filtered = filter === 'all' ? reports : reports.filter(r => String(r.status).toLowerCase() === filter);
  if (!filtered.length) {
    reportsList.innerHTML = '<div class="empty-state">No reports match this filter.</div>';
    return;
  }
  reportsList.innerHTML = filtered.map(report => {
    const severity = String(report.severity || 'medium').toLowerCase();
    const status = String(report.status || 'new').toLowerCase();
    const reporter = report.reportedBy?.name || report.reportedBy?.email || 'Unknown reporter';
    const people = report.peopleAffected ?? 0;
    const lat = report.location?.latitude;
    const lng = report.location?.longitude;
    const location = lat !== undefined && lng !== undefined ? `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}` : 'Location unavailable';
    return `<article class="report-card"><div class="report-main"><div class="report-title-row"><h3>${escapeHtml(titleCase(report.type))}</h3><span class="severity-badge ${escapeHtml(severity)}">${escapeHtml(titleCase(severity))}</span></div><p class="description">${escapeHtml(report.description)}</p><div class="report-meta"><span>👤 ${escapeHtml(reporter)}</span><span>👥 ${escapeHtml(people)} affected</span><span>🕒 ${escapeHtml(formatDate(report.createdAt || report.occurredAt))}</span><span>📍 ${escapeHtml(location)}</span></div></div><div class="report-side"><span class="status-badge ${escapeHtml(status)}">${escapeHtml(titleCase(status))}</span><button class="view-btn" data-id="${escapeHtml(report._id)}">View details</button></div></article>`;
  }).join('');
  reportsList.querySelectorAll('.view-btn').forEach(button => {
    button.addEventListener('click', () => { window.location.href = `incident.html?id=${encodeURIComponent(button.dataset.id)}`; });
  });
}
function markerColor(severity) {
  return ({critical:'#dc2626',high:'#ea580c',medium:'#ca8a04',low:'#16a34a'}[severity] || '#2563eb');
}
function updateMap() {
  if (!window.L) return;
  if (!incidentMap) {
    incidentMap = L.map('incidentMap').setView([20.5937, 78.9629], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(incidentMap);
    markerLayer = L.layerGroup().addTo(incidentMap);
  }
  markerLayer.clearLayers();
  const points = [];
  reports.forEach(report => {
    const lat = Number(report.location?.latitude);
    const lng = Number(report.location?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return;
    points.push([lat,lng]);
    const severity = String(report.severity || 'medium').toLowerCase();
    const status = String(report.status || 'new').toLowerCase();
    const color = markerColor(severity);
    const icon = L.divIcon({
      className: '',
      html: `<span style="display:block;width:16px;height:16px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 1px 5px rgba(0,0,0,.4)"></span>`,
      iconSize: [16,16], iconAnchor: [8,8]
    });
    const marker = L.marker([lat,lng], {icon});
    marker.bindPopup(`<div class="popup-title">${escapeHtml(titleCase(report.type))}</div><div><strong>Severity:</strong> ${escapeHtml(titleCase(severity))}</div><div><strong>Status:</strong> ${escapeHtml(titleCase(status))}</div><div><strong>Affected:</strong> ${escapeHtml(report.peopleAffected ?? 0)}</div><div><strong>Reporter:</strong> ${escapeHtml(report.reportedBy?.name || report.reportedBy?.email || 'Unknown')}</div><a class="popup-btn" href="incident.html?id=${encodeURIComponent(report._id)}">View details</a>`);
    markerLayer.addLayer(marker);
  });
  if (points.length === 1) incidentMap.setView(points[0], 13);
  else if (points.length > 1) incidentMap.fitBounds(points, {padding:[30,30], maxZoom:13});
  else incidentMap.setView([20.5937,78.9629],5);
  setTimeout(() => incidentMap.invalidateSize(), 100);
}
async function loadReports() {
  refreshBtn.disabled = true;
  refreshBtn.textContent = 'Loading...';
  message.hidden = true;
  try {
    const response = await fetch(`${API_URL}/reports`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to load reports.');
    reports = data.reports || [];
    renderStats();
    renderReports();
    updateMap();
    document.getElementById('lastUpdated').textContent = `Updated ${new Date().toLocaleTimeString()}`;
  } catch (error) {
    message.textContent = error.message;
    message.hidden = false;
    reportsList.innerHTML = '';
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = 'Refresh reports';
  }
}
statusFilter.addEventListener('change', renderReports);
refreshBtn.addEventListener('click', loadReports);
document.getElementById('logoutBtn').addEventListener('click', () => { localStorage.removeItem('disasterToken'); localStorage.removeItem('disasterUser'); window.location.href = 'auth.html'; });
loadReports();
