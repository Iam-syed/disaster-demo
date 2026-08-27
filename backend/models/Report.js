const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    peopleAffected: { type: Number, min: 0, default: 0 },
    occurredAt: { type: Date },
    location: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      address: { type: String, trim: true }
    },
    photoUrl: { type: String, trim: true },
    status: {
      type: String,
      enum: ['new', 'under_review', 'verified', 'resolved'],
      default: 'new'
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Report', reportSchema);
