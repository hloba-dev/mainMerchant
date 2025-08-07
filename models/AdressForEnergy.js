import mongoose from 'mongoose';

const AdressForEnergySchema = new mongoose.Schema(
  {
    walletAddress: { type: String, required: true, unique: true },
    privateKey   : { type: String, required: true },
    userId       : { type: String },
    addedAt      : { type: Date, default: Date.now },
  },
  { collection: 'adressesforenergy' }
);

const AdressForEnergy = mongoose.model('AdressForEnergy', AdressForEnergySchema);
export default AdressForEnergy;
