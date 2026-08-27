const express = require('express');
const Report = require('../models/Report');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const { type, description, peopleAffected, occurredAt, location, photoUrl } = req.body;

    if (!type || !description || !location?.latitude || !location?.longitude) {
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
      photoUrl
    });

    res.status(201).json({ message: 'Report submitted successfully', report });
  } catch (error) {
    next(error);
  }
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const reports = await Report.find()
      .sort({ createdAt: -1 })
      .populate('reportedBy', 'name email role');

    res.json({ count: reports.length, reports });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticate, async (req, res, next) => {
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

module.exports = router;
