const mongoose = require('mongoose');

const logisticsSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['supply_drop', 'evac_transport', 'medical_supply', 'fuel_delivery', 'equipment_transfer'],
      required: true,
    },
    destinationSector: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'staging', 'in-transit', 'delivered', 'cancelled'],
      default: 'pending',
    },
    items: [
      {
        name: { type: String, required: true },
        quantity: { type: Number, required: true },
        unit: { type: String, default: 'units' },
      },
    ],
    etaMinutes: { type: Number },
    predictiveModel: {
      estimatedDemand: { type: String },
      confidence: { type: Number },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Logistics', logisticsSchema);
