import { delegateEnergyDynamic } from '../../utils/tronHelpers.js';

export const page = (req, res) => res.render('delegateEnergy');

export const delegateEnergy = async (req, res, next) => {
  try {
    const { energy, tronAddress } = req.body;
    if (!energy || !tronAddress)
      return res.status(400).json({ error: 'Не указаны energy и/или tronAddress' });

    const energyNum = parseInt(energy, 10);
    if (isNaN(energyNum) || energyNum <= 0)
      return res.status(400).json({ error: 'Неверное значение energy' });

    const result = await delegateEnergyDynamic(energyNum, tronAddress);
    if (result.errno)
      return res.status(500).json({ error: 'Ошибка делегирования энергии' });

    res.json({ success: true });
  } catch (e) {
    next(e);
  }
};