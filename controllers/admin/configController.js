import Config from '../../models/Config.js';
import * as paySvc from '../../services/paymentService.js';

export const getConfig = async (req, res, next) => {
  try {
    const config = await Config.findOne().lean();
    if (!config) {
      return res.status(404).json({ error: 'Конфигурация не найдена' });
    }
    res.json({ config });
  } catch (e) {
    next(e);
  }
};

export const updateConfig = async (req, res, next) => {
  try {
    const updated = await paySvc.updateConfig(req.body);
    res.json({ success: true, config: updated });
  } catch (e) {
    next(e);
  }
}; 