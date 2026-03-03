import type { Request, Response, NextFunction } from 'express';
import { findCustomerByApiKey } from './customer.js';

export async function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.header('x-api-key');
  console.log('apiKey header:', apiKey);
  if (!apiKey) {
    console.log('No API key provided');
    return res.status(401).json({ error: 'API key required' });
  }
  const customer = await findCustomerByApiKey(apiKey);
  console.log('Customer found:', customer);
  if (!customer) {
    console.log('Invalid API key');
    return res.status(403).json({ error: 'Invalid API key' });
  }
  // Optionally update last_used timestamp
  req['customer'] = customer;
  next();
}
