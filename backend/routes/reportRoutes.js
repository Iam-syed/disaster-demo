const express = require('express');
const Report = require('../models/Report');
const { authenticate, requireAuthority } = require('../middleware/auth');

const router = express.Router();

// Lightweight AI-assisted analysis. It provides a transparent suggestion
// from report text and affected-person count; the authority remains the final decision maker.
function analyzeReport({ type, description, peopleAffected = 0 }) {
  const text = `${type || ''} ${description || ''}`.toLowerCase();
  const rules = [
    ['flood', ['flood', 'flooded', 'water entered', 'waterlogging', 'waterlogged', 'overflow']],
    ['landslide', ['landslide', 'mudslide', 'rockfall', 'rocks fell', 'soil collapsed']],
    ['fire', ['fire', 'flames', 'burning', 'smoke']],
    ['earthquake', ['earthquake', 'tremor', 'shaking']],
    ['cyclone', ['cyclone', 'storm', 'strong winds', 'high winds']],
    ['accident', ['accident', 'collision', 'crash', 'vehicle overturned']],
    ['building_collapse', ['building collapsed', 'house collapsed', 'structure collapsed', 'collapse']],
    ['medical', ['injured', 'injury', 'medical emergency', 'ambulance', 'unconscious']]
  ];

  let incidentType = String(type || '').toLowerCase().trim();
  let matchedKeywords = [];
  let confidence = 0.55;

  for (const [candidate, keywords] of rules) {
    const matches = keywords.filter(keyword => text.includes(keyword));
    if (matches.length && (incidentType === 'unknown' || !incidentType || incidentType === 'other')) {
      incidentType = candidate;
      matchedKeywords = matches;
      confidence = Math.min(0.95, 0.68 + matches.length * 0.08);
      break;
    }
  }

  const people = Math.max(0, Number(peopleAffected) || 0);
  const criticalWords = ['trapped', 'missing', 'collapsed', 'life threatening', 'life-threatening', 'cannot escape', 'urgent'];
  const highWords = ['injured', 'evacuate', 'evacuation', 'severe', 'dangerous', 'blocked', 'stranded'];
  const criticalMatches = criticalWords.filter(word => text.includes(word));
  const highMatches = highWords.filter(word => text.includes(word));

  let severity = 'low';
  if (criticalMatches.length || people >= 50) severity = 'critical';
  else if (highMatches.length || people >= 20) severity = 'high';
  else if (people >= 5 || matchedKeywords.length >= 2) severity = 'medium';

  let urgency = 'routine';
  if (severity === 'critical') urgency = 'immediate';
  else if (severity === 'high') urgency = 'urgent';
  else if (severity === 'medium') urgency = 'soon';

  const severityScore = { low: 25, medium: 50, high: 75, critical: 100 }[severity];
  const peopleScore = Math.min(25, people);
  const keywordScore = Math.min(20, (criticalMatches.length * 12) + (highMatches.length * 7));
  const priorityScore = Math.min(100, Math.round(severityScore * 0.55 + peopleScore + keywordScore));

  return {
    incidentType,
    confidence: Number(confidence.toFixed(2)),
    severity,
    urgency,
    priorityScore,
    matchedKeywords: [...new Set([...matchedKeywords, ...criticalMatches, ...highMatches])],
    explanation: `Suggested from incident description, disaster type and ${people} reported affected people. Authority verification is required before changing the official report.`
  };
}

// Logged-in citizens can submit reports. The JWT identifies the reporter.
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { type, description, peopleAffected, occurredAt, location, photoUrl } = req.body;

    if (!type || !description || location?.latitude === undefined || location?.longitude === undefined) {
      return res.status(400).json({
        error: 'Type, description and valid latitude/longitude are required'
      });
    }

    const report = await Report.create({
      type,
      description,
      peopleAffected,
      occurredAt,
      location,
      photoUrl,
      reportedBy: req.user.userId
    });

    console.log('\n==============================');
    console.log('REPORT SAVED SUCCESSFULLY');
    console.log('Report ID:', report._id.toString());
    console.log('User ID:', req.user.userId);
    console.log('Database: disaster_response');
    console.log('==============================\n');

    res.status(201).json({ message: 'Report submitted successfully', report });
  } catch (error) {
    console.error('REPORT SAVE ERROR:', error);
    next(error);
  }
});

// Authorities can view all reports.
router.get('/', authenticate, requireAuthority, async (req, res, next) => {
  try {
    const reports = await Report.find()
      .sort({ createdAt: -1 })
      .populate('reportedBy', 'name email role');

    res.json({ count: reports.length, reports });
  } catch (error) {
    next(error);
  }
});

// AI-assisted analysis for an individual report. It does not modify the report.
router.post('/:id/analyze', authenticate, requireAuthority, async (req, res, next) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const analysis = analyzeReport(report);
    res.json({ reportId: report._id, analysis });
  } catch (error) {
    console.error('AI ANALYSIS ERROR:', error);
    next(error);
  }
});

// Authorities can view a specific report.
router.get('/:id', authenticate, requireAuthority, async (req, res, next) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate('reportedBy', 'name email role');

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json(report);
  } catch (error) {
    next(error);
  }
});

// Authorities can update report status/severity/priority.
router.patch('/:id', authenticate, requireAuthority, async (req, res, next) => {
  try {
    const allowed = ['status', 'severity', 'priorityScore'];
    const updates = {};

    for (const field of allowed) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const report = await Report.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('reportedBy', 'name email role');

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({ message: 'Report updated successfully', report });
  } catch (error) {
    console.error('REPORT UPDATE ERROR:', error);
    next(error);
  }
});

module.exports = router;
