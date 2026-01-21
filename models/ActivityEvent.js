import mongoose from 'mongoose';

const activityEventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ['login', 'upload', 'whatsapp'],
      index: true,
    },
    // Ej: 'm1', 'm2', 'm3', 'm4', 'sales', 'operacion', 'install'
    module: {
      type: String,
      default: '',
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    username: { type: String, default: '' },
    role: { type: String, default: '' },
    region: { type: String, default: '' },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

activityEventSchema.index({ createdAt: -1 });

export default mongoose.model('ActivityEvent', activityEventSchema);

