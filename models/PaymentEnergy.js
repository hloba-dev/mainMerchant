import mongoose from 'mongoose';

const PaymentEnergySchema = new mongoose.Schema({
  userId:                { type: String },
  walletAddress:         { type: String, required: true },
  walletAddressForEnergy:{ type: String, required: true },
  privateKey:            { type: String, required: true },
  amount:                { type: Number, required: true },
  amountEnergy:          { type: Number, required: true },
  url_callback:          { type: String },
  realAmount:            { type: Number },
  tx_id:                 { type: String },
  realsum:               { type: Number },
  status: {
    type: String,
    enum: ['pending', 'wait', 'lesspay', 'completed', 'frozen', 'delete', 'refaund'],
    default: 'pending',
  },
  currency: {
    type: String,
    enum: ['TRX'],
    default: '',
  },
  createdAt: { type: Date, default: Date.now },
});

const PaymentEnergy = mongoose.model('PaymentEnergy', PaymentEnergySchema);
export default PaymentEnergy;
