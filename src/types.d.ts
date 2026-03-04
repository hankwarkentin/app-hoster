import type { Customer } from './customer';

declare global {
  namespace Express {
    interface Request {
      customer?: Customer;
    }
  }
}

export interface AppVersion {
  id: string;
  app_id: string;
  platform: string;
  version_name: string;
  version_code?: string;
  folder?: string;
  file_url: string;
  uploaded_at: string;
  metadata?: Record<string, any>;
}
