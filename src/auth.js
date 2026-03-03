import { findCustomerByApiKey } from './customer.js';
export async function apiKeyAuth(req, res, next) {
    const apiKey = req.header('x-api-key');
    if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
    }
    const customer = await findCustomerByApiKey(apiKey);
    if (!customer) {
        return res.status(403).json({ error: 'Invalid API key' });
    }
    // Optionally update last_used timestamp
    req['customer'] = customer;
    next();
}
//# sourceMappingURL=auth.js.map