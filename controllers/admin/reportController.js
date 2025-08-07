import * as repSvc from '../../services/reportService.js';

export const reports = async (req, res, next) => {
  try {
    res.render('reports', await repSvc.todayStats());
  } catch (e) {
    next(e);
  }
};
