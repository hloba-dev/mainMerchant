import mongoose from 'mongoose';
const { Schema, model, models } = mongoose;

function isValidTronAddress(addr) {
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr);
}

const SubscriptionPaymentSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },

    paymentStatus: {
      type: String,
      enum: ['pending', 'deleted', 'paid'],
      default: 'pending',
      required: true,
    },

    paymentAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    subscriptionStatus: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'inactive',
      required: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    dailyEnergy: {
      type: Number,
      required: true,
      min: 0,
    },

    dailyEnergyIssued: {
      type: Number,
      default: 0,
      min: 0,
    },

    wallet: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: isValidTronAddress,
        message: (props) => `${props.value} не является валидным Tron-адресом!`,
      },
    },

    paymentWallet: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: isValidTronAddress,
        message: (props) => `${props.value} не является валидным Tron-адресом!`,
      },
    },

    privateKey: {
      type: String,
      required: true,
      select: false,
    },
  },
  {
    collection: 'subscriptionPayments',
    timestamps: { createdAt: 'createdAt', updatedAt: false },
  }
);

const SubscriptionPayment =
  models.SubscriptionPayment ||
  model('SubscriptionPayment', SubscriptionPaymentSchema);

export default SubscriptionPayment;
