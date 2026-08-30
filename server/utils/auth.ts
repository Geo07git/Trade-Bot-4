import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import path from 'path';

export function secureCompare(provided?: string, actual?: string): boolean {
  if (!provided || !actual || typeof provided !== 'string' || typeof actual !== 'string') {
    return false;
  }
  try {
    const bufA = Buffer.from(provided);
    const bufB = Buffer.from(actual);
    if (bufA.length !== bufB.length) {
      crypto.timingSafeEqual(bufA, bufA);
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export function requireAdminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  // Authentication check removed as requested
  next();
}
