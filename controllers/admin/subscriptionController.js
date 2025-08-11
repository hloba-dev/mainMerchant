import * as subSvc from '../../services/subscriptionService.js';

export const listSubscriptions = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const data = await subSvc.list(page, limit);
        res.json(data);
    } catch (e) {
        next(e);
    }
};

export const getSubscriptionById = async (req, res, next) => {
    try {
        const sub = await subSvc.getById(req.params.id);
        if (!sub) return res.status(404).json({ error: 'Subscription not found' });
        res.json(sub);
    } catch (e) {
        next(e);
    }
};

export const updateSubscription = async (req, res, next) => {
    try {
        const updated = await subSvc.update(req.params.id, req.body);
        if (!updated) return res.status(404).json({ error: 'Subscription not found' });
        res.json({ success: true, subscription: updated });
    } catch (e) {
        next(e);
    }
};
