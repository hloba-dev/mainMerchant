import PaymentEnergy from '../models/PaymentEnergy.js';
import EnergyAddr from '../models/AdressForEnergy.js';
import { generateOneTimeWalletUSDT } from './walletService.js';
import { startOfTodayUTC } from '../utils/validators.js';

export async function allocateWallet() {
  const picked = await EnergyAddr.findOneAndDelete(
    { addedAt: { $lt: startOfTodayUTC() } },
    null,
    { sort: { addedAt: 1 } }
  ).lean();
  return picked || generateOneTimeWalletUSDT();
}

export { PaymentEnergy };
