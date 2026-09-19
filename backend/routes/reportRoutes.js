const express = require('express');
const path = require('path');
const { spawnSync } = require('child_process');
const Report = require('../models/Report');
const Incident = require('../models/Incident');
const { authenticate, requireAuthority } = require('../middleware/auth');
const { clusterReport, clusterAllReports } = require('../services/duplicateDetection');

const router = express.Router();

function analyzeReportWithModel(report) {
  const pythonCommand = process.env.AI_PYTHON_COMMAND || (process.platform === 'win32' ? 'python' : 'python3');
  const scriptPath = path.join(__dirname, '..', '..', 'ai', 'predict.py');

  const payload = JSON.stringify({
    type: report.type,
    description: report.description,
    peopleAffected: report.peopleAffected || 0
  });

  const result = spawnSync(pythonCommand, [scriptPath], {
    input: payload,
    encoding: 'utf8',
    timeout: 15000,
    windowsHide: true
  });

  if (result.error) {
    if (result.error.code === 'ENOENT') {
      throw new Error(
        'Python ML runtime not found. Install Python and the packages in ai/requirements.txt.'
      );
    }
    throw result.error;
  }

  if (result.status !== 0) {
    const message = (result.stderr || '').trim();
    if (message.includes('Trained model not found')) {
      throw new Error('Trained severity model not found. Run: python ai/train_model.py');
    }
    throw new Error(message || 'ML prediction failed.');
  }

  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error('ML prediction returned invalid JSON.');
  }
}

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

    const clustering = await clusterReport(report);

    console.log('\n==============================');
    console.log('REPORT SAVED SUCCESSFULLY');
    console.log('Report ID:', report._id.toString());
    console.log('User ID:', req.user.userId);
    console.log('Incident ID:', clustering.incident._id.toString());
    console.log('Duplicate:', clustering.duplicate);
    console.log('Database: disaster_response');
    console.log('==============================\n');

    res.status(201).json({
      message: clustering.duplicate
        ? 'Report submitted and linked to an existing incident'
        : 'Report submitted successfully',
      report,
      incident: clustering.incident,
      duplicate: clustering.duplicate,
      matchedReports: clustering.matchedReports
    });
  } catch (error) {
    console.error('REPORT SAVE ERROR:', error);
    next(error);
  }
});

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

router.get('/incidents', authenticate, requireAuthority, async (req, res, next) => {
  try {
    const incidents = await Incident.find()
      .sort({ priorityScore: -1, updatedAt: -1 })
      .populate('reportIds', 'type description peopleAffected severity status createdAt reportedBy')
      .populate('reportIds.reportedBy', 'name email');

    res.json({ count: incidents.length, incidents });
  } catch (error) {
    next(error);
  }
});

router.post('/incidents/cluster-all', authenticate, requireAuthority, async (req, res, next) => {
  try {
    const result = await clusterAllReports();
    res.json({
      message: 'Unclustered reports processed successfully',
      ...result
    });
  } catch (error) {
    console.error('CLUSTERING ERROR:', error);
    next(error);
  }
});

router.get('/incidents/:id', authenticate, requireAuthority, async (req, res, next) => {
  try {
    const incident = await Incident.findById(req.params.id)
      .populate({
        path: 'reportIds',
        populate: { path: 'reportedBy', select: 'name email role' }
      });

    if (!incident) return res.status(404).json({ error: 'Incident not found' });

    res.json(incident);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/analyze', authenticate, requireAuthority, async (req, res, next) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const analysis = analyzeReportWithModel(report);
    res.json({ reportId: report._id, analysis });
  } catch (error) {
    console.error('AI ANALYSIS ERROR:', error);
    next(error);
  }
});

router.get('/:id', authenticate, requireAuthority, async (req, res, next) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate('reportedBy', 'name email role')
      .populate('incidentId', 'type title severity priorityScore status reportCount peopleAffected');

    if (!report) return res.status(404).json({ error: 'Report not found' });

    res.json(report);
  } catch (error) {
    next(error);
  }
});

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
    )
      .populate('reportedBy', 'name email role')
      .populate('incidentId', 'type title severity priorityScore status reportCount peopleAffected');

    if (!report) return res.status(404).json({ error: 'Report not found' });

    if (report.incidentId) {
      const linkedReports = await Report.find({ incidentId: report.incidentId._id });
      const order = { low: 1, medium: 2, high: 3, critical: 4 };
      const severity = linkedReports.reduce(
        (highest, item) => order[item.severity] > order[highest] ? item.severity : highest,
        'low'
      );
      const priorityScore = Math.min(
        100,
        Math.round(({ low: 25, medium: 50, high: 75, critical: 100 }[severity] * 0.7) +
          Math.min(30, linkedReports.reduce((sum, item) => sum + (Number(item.peopleAffected) || 0), 0)))
      );

      await Incident.findByIdAndUpdate(report.incidentId._id, {
        severity,
        priorityScore,
        status: linkedReports.every(item => item.status === 'resolved') ? 'resolved' : report.incidentId.status
      });
    }

    res.json({ message: 'Report updated successfully', report });
  } catch (error) {
    console.error('REPORT UPDATE ERROR:', error);
    next(error);
  }
});

module.exports = router;
