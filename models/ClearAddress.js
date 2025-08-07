import mongoose from 'mongoose';

const ClearAddressSchema = new mongoose.Schema(
  {
    walletAddress: { type: String, required: true, unique: true },
    privateKey:    { type: String, required: true },
    userId:        { type: String },
    addedAt:       { type: Date, default: Date.now },
  },
  { collection: 'clearaddresses' }
);

const ClearAddress = mongoose.model('ClearAddress', ClearAddressSchema);
export default ClearAddress;
