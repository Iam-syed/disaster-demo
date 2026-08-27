const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    priorityScore: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['active', 'under_response', 'resolved'],
      default: 'active'
    },
    peopleAffected: { type: Number, min: 0, default: 0 },
    location: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      address: { type: String, trim: true }
    },
    reports: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Report' }]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Incident', incidentSchema);
