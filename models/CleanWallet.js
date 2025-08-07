import mongoose from 'mongoose';

const CleanWalletSchema = new mongoose.Schema(
  {
    walletAddress: { type: String, required: true, unique: true },
    exchange:      { type: String, required: true },
  },
  { collection: 'cleanwallets' }
);

const CleanWallet = mongoose.model('CleanWallet', CleanWalletSchema);
export default CleanWallet;
