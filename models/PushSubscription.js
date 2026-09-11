import mongoose from 'mongoose';

const pushSubscriptionSchema = new mongoose.Schema({
  userId: { type: String, index: true },
  username: String,
  endpoint: { type: String, required: true, unique: true },
  keys: {
    p256dh: String,
    auth: String,
  },
}, { timestamps: true });

export default mongoose.model('PushSubscription', pushSubscriptionSchema, 'push_subscriptions');
