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
  const adminPassword = process.env.ADMIN_PASSWORD || process.env.BOT_API_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  let isLiveMode = false;
  try {
    const stateFile = path.join(process.cwd(), 'bot_state.json');
    if (fs.existsSync(stateFile)) {
      const data = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      if (data && data.binanceMode === 'live') {
        isLiveMode = true;
      }
    }
  } catch {
    // ignore
  }

  const mustBeProtected = isProduction || isLiveMode;

  if (!adminPassword) {
    if (mustBeProtected) {
      console.error('[SECURITY CRITICAL] ADMIN_PASSWORD or BOT_API_SECRET is not set in production or live trading mode! Rejecting request.');
      return res.status(500).json({
        success: false,
        error: 'Eroare critică de securitate: ADMIN_PASSWORD sau BOT_API_SECRET nu este configurat în mediu de producție / mod Live.'
      });
    } else {
      console.warn('[SECURITY WARNING] ADMIN_PASSWORD / BOT_API_SECRET nu este setat. Rutele mutative sunt deschise (fail-open în dev/testnet). Setați ADMIN_PASSWORD în .env pentru securitate completă.');
      return next();
    }
  }

  const provided = (req.headers['x-admin-password'] || req.headers['authorization']?.replace('Bearer ', '') || req.body?.adminPassword) as string;
  if (!provided || !secureCompare(provided, adminPassword)) {
    return res.status(401).json({
      success: false,
      error: 'Neautorizat. Parolă admin invalidă sau lipsă (x-admin-password / ADMIN_PASSWORD).'
    });
  }
  next();
}
