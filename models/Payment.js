import mongoose from 'mongoose';

const PaymentSchema = new mongoose.Schema({
  userId:        { type: String },
  walletAddress: { type: String, required: true },
  privateKey:    { type: String, required: true },
  amount:        { type: Number, required: true },
  url_callback:  { type: String },
  realAmount:    { type: Number },
  tx_id:         { type: String },
  realsum:       { type: Number },
  status: {
    type: String,
    enum: ['pending', 'wait', 'lesspay', 'completed', 'frozen', 'delete', 'refaund'],
    default: 'pending',
  },
  currency: {
    type: String,
    enum: ['TRX', 'USDT'],
    default: '',
  },
  createdAt: { type: Date, default: Date.now },
  amlPassed: { type: Boolean },
  amlDetail: { type: Object, default: {} },
});

const Payment = mongoose.model('Payment', PaymentSchema);
export default Payment;
