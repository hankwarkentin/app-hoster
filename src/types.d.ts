import express from 'express';

export interface Customer {
  id: number;
  name: string;
  email: string;
  api_key_hash: string;
  created_at: string;
  last_used?: string;
}

declare global {
  namespace Express {
    interface Request {
      customer?: Customer;
    }
  }
}
