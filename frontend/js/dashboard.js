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

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
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
  const pending = reports.filter(r => String(r.status).toLowerCase() === 'pending').length;

  document.getElementById('totalCount').textContent = reports.length;
  document.getElementById('criticalCount').textContent = critical;
  document.getElementById('highCount').textContent = high;
  document.getElementById('pendingCount').textContent = pending;
}

function renderReports() {
  const filter = statusFilter.value;
  const filtered = filter === 'all'
    ? reports
    : reports.filter(r => String(r.status).toLowerCase() === filter);

  if (!filtered.length) {
    reportsList.innerHTML = '<div class="empty-state">No reports match this filter.</div>';
    return;
  }

  reportsList.innerHTML = filtered.map(report => {
    const severity = String(report.severity || 'medium').toLowerCase();
    const status = String(report.status || 'pending').toLowerCase();
    const reporter = report.reportedBy?.name || report.reportedBy?.email || 'Unknown reporter';
    const people = report.peopleAffected ?? 0;

    return `
      <article class="report-card">
        <div class="report-main">
          <div class="report-title-row">
            <h3>${escapeHtml(titleCase(report.type))}</h3>
            <span class="severity-badge ${escapeHtml(severity)}">${escapeHtml(titleCase(severity))}</span>
          </div>
          <p class="description">${escapeHtml(report.description)}</p>
          <div class="report-meta">
            <span>👤 ${escapeHtml(reporter)}</span>
            <span>👥 ${escapeHtml(people)} affected</span>
            <span>🕒 ${escapeHtml(formatDate(report.createdAt || report.occurredAt))}</span>
            <span>📍 ${escapeHtml(Number(report.location?.latitude).toFixed(5))}, ${escapeHtml(Number(report.location?.longitude).toFixed(5))}</span>
          </div>
        </div>
        <div class="report-side">
          <span class="status-badge ${escapeHtml(status)}">${escapeHtml(titleCase(status))}</span>
          <button class="view-btn" data-id="${escapeHtml(report._id)}">View details</button>
        </div>
      </article>`;
  }).join('');

  reportsList.querySelectorAll('.view-btn').forEach(button => {
    button.addEventListener('click', () => {
      window.location.href = `incident.html?id=${encodeURIComponent(button.dataset.id)}`;
    });
  });
}

async function loadReports() {
  refreshBtn.disabled = true;
  refreshBtn.textContent = 'Loading...';
  message.hidden = true;

  try {
    const response = await fetch(`${API_URL}/reports`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to load reports.');

    reports = data.reports || [];
    renderStats();
    renderReports();
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
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('disasterToken');
  localStorage.removeItem('disasterUser');
  window.location.href = 'auth.html';
});

loadReports();
