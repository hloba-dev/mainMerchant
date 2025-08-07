import Config from '../models/Config.js';

export default {
  get: () => Config.findOne(),
  update: async ({ mainWallet, freezeWallet, energyWallet }) => {
    let cfg = await Config.findOne();
    if (!cfg) {
      cfg = await Config.create({ mainWallet, freezeWallet, energyWallet });
    } else {
      cfg.mainWallet   = mainWallet;
      cfg.freezeWallet = freezeWallet;
      cfg.energyWallet = energyWallet;
      await cfg.save();
    }
    return cfg;
  },
};
