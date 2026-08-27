const express = require('express');
const Report = require('../models/Report');
const { authenticate, requireAuthority } = require('../middleware/auth');

const router = express.Router();

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
