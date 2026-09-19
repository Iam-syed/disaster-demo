const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, trim: true },
    title: { type: String, trim: true },
    location: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      address: { type: String, trim: true }
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    priorityScore: { type: Number, default: 0, min: 0, max: 100 },
    status: {
      type: String,
      enum: ['new', 'under_review', 'verified', 'resolved'],
      default: 'new'
    },
    reportIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Report' }],
    reportCount: { type: Number, default: 1, min: 1 },
    peopleAffected: { type: Number, default: 0, min: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Incident', incidentSchema);
