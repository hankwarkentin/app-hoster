declare module 'cookie-parser' {
  import type { RequestHandler } from 'express';
  function cookieParser(secret?: string | Buffer | (string | Buffer)[], options?: any): RequestHandler;
  namespace cookieParser {}
  export = cookieParser;
}
