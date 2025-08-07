import mongoose from 'mongoose';

const ConfigSchema = new mongoose.Schema({
  mainWallet:   { type: String, required: true },
  freezeWallet: { type: String, required: true },
  energyWallet: { type: String, required: true },
});

const Config = mongoose.model('Config', ConfigSchema);
export default Config;