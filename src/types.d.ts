import type { Customer } from './customer';

declare global {
  namespace Express {
    interface Request {
      customer?: Customer;
    }
  }
}
