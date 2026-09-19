const Report = require('../models/Report');
const Incident = require('../models/Incident');

const EARTH_RADIUS_KM = 6371;
const MAX_DISTANCE_KM = 2;
const MAX_TIME_GAP_MS = 2 * 60 * 60 * 1000;
const MIN_TEXT_SIMILARITY = 0.35;

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function distanceKm(a, b) {
  const lat1 = Number(a.latitude);
  const lon1 = Number(a.longitude);
  const lat2 = Number(b.latitude);
  const lon2 = Number(b.longitude);
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

function tokenize(text = '') {
  return new Set(
    String(text).toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length >= 3)
  );
}

function textSimilarity(a = '', b = '') {
  const first = tokenize(a);
  const second = tokenize(b);
  if (!first.size || !second.size) return 0;

  let intersection = 0;
  for (const word of first) {
    if (second.has(word)) intersection++;
  }

  const union = new Set([...first, ...second]).size;
  return union ? intersection / union : 0;
}

function sameType(a, b) {
  const first = String(a || '').trim().toLowerCase();
  const second = String(b || '').trim().toLowerCase();
  return first === second || first === 'other' || second === 'other';
}

function timeOf(report) {
  return new Date(report.occurredAt || report.createdAt).getTime();
}

function reportsLookLikeSameIncident(report, candidate) {
  const distance = distanceKm(report.location, candidate.location);
  if (distance > MAX_DISTANCE_KM) {
    return { match: false, distance, similarity: 0 };
  }

  const timeGap = Math.abs(timeOf(report) - timeOf(candidate));
  if (timeGap > MAX_TIME_GAP_MS) {
    return { match: false, distance, similarity: 0 };
  }

  const typeMatch = sameType(report.type, candidate.type);
  const similarity = textSimilarity(report.description, candidate.description);

  const match = typeMatch
    ? similarity >= MIN_TEXT_SIMILARITY || distance <= 0.75
    : similarity >= 0.65;

  return { match, distance, similarity };
}

async function findMatchingReports(report) {
  const time = timeOf(report);
  const candidates = await Report.find({
    _id: { $ne: report._id },
    createdAt: {
      $gte: new Date(time - MAX_TIME_GAP_MS),
      $lte: new Date(time + MAX_TIME_GAP_MS)
    },
    'location.latitude': {
      $gte: Number(report.location.latitude) - 0.03,
      $lte: Number(report.location.latitude) + 0.03
    },
    'location.longitude': {
      $gte: Number(report.location.longitude) - 0.03,
      $lte: Number(report.location.longitude) + 0.03
    }
  }).sort({ createdAt: -1 });

  return candidates
    .map(candidate => ({
      candidate,
      ...reportsLookLikeSameIncident(report, candidate)
    }))
    .filter(item => item.match)
    .sort((a, b) => b.similarity - a.similarity || a.distance - b.distance);
}

function chooseSeverity(reports) {
  const order = { low: 1, medium: 2, high: 3, critical: 4 };
  return reports.reduce(
    (highest, report) =>
      order[report.severity] > order[highest] ? report.severity : highest,
    'low'
  );
}

function calculatePriority(reports) {
  const severityScore = { low: 25, medium: 50, high: 75, critical: 100 };
  const severity = chooseSeverity(reports);
  const people = reports.reduce(
    (sum, report) => sum + (Number(report.peopleAffected) || 0),
    0
  );

  return Math.min(
    100,
    Math.round(severityScore[severity] * 0.7 + Math.min(30, people))
  );
}

async function addReportToIncident(report, incident) {
  const reportIds = incident.reportIds.some(
    id => String(id) === String(report._id)
  )
    ? incident.reportIds
    : [...incident.reportIds, report._id];

  const reports = await Report.find({ _id: { $in: reportIds } });

  incident.reportIds = reportIds;
  incident.reportCount = reportIds.length;
  incident.peopleAffected = reports.reduce(
    (sum, item) => sum + (Number(item.peopleAffected) || 0),
    0
  );
  incident.severity = chooseSeverity(reports);
  incident.priorityScore = calculatePriority(reports);

  if (reports.every(item => item.status === 'resolved')) {
    incident.status = 'resolved';
  }

  await incident.save();

  report.incidentId = incident._id;
  await report.save();

  return incident;
}

async function clusterReport(report) {
  const matches = await findMatchingReports(report);

  if (!matches.length) {
    const incident = await Incident.create({
      type: report.type,
      title: report.description.slice(0, 80),
      location: report.location,
      severity: report.severity,
      status: report.status,
      reportIds: [report._id],
      reportCount: 1,
      peopleAffected: Number(report.peopleAffected) || 0,
      priorityScore: calculatePriority([report])
    });

    report.incidentId = incident._id;
    await report.save();

    return { incident, duplicate: false, matchedReports: [] };
  }

  const matchedIncidentId = matches.find(
    item => item.candidate.incidentId
  )?.candidate.incidentId;

  let incident = matchedIncidentId
    ? await Incident.findById(matchedIncidentId)
    : null;

  if (!incident) {
    const base = matches[0].candidate;

    incident = await Incident.create({
      type: base.type,
      title: base.description.slice(0, 80),
      location: base.location,
      severity: base.severity,
      status: base.status,
      reportIds: [base._id],
      reportCount: 1,
      peopleAffected: Number(base.peopleAffected) || 0,
      priorityScore: calculatePriority([base])
    });

    base.incidentId = incident._id;
    await base.save();
  }

  await addReportToIncident(report, incident);

  return {
    incident,
    duplicate: true,
    matchedReports: matches.map(item => ({
      reportId: item.candidate._id,
      distanceKm: Number(item.distance.toFixed(2)),
      textSimilarity: Number(item.similarity.toFixed(2))
    }))
  };
}

async function clusterAllReports() {
  const reports = await Report.find().sort({ createdAt: 1 });
  let clustered = 0;

  for (const report of reports) {
    if (!report.incidentId) {
      await clusterReport(report);
      clustered++;
    }
  }

  return { clustered };
}

module.exports = {
  clusterReport,
  clusterAllReports,
  distanceKm,
  textSimilarity
};
