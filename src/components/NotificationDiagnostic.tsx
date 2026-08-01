import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ExternalLink, 
  Bell, 
  Play, 
  RefreshCw, 
  ShieldAlert,
  Info,
  Terminal
} from 'lucide-react';

interface DiagnosticLog {
  id: string;
  time: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  details?: string;
}

export function NotificationDiagnostic() {
  const [permissionStatus, setPermissionStatus] = useState<string>('unknown');
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isInIframe, setIsInIframe] = useState<boolean>(false);
  const [isSecure, setIsSecure] = useState<boolean>(false);
  const [hasSW, setHasSW] = useState<boolean>(false);
  const [hasPushManager, setHasPushManager] = useState<boolean>(false);
  const [logs, setLogs] = useState<DiagnosticLog[]>([]);
  const [isTesting, setIsTesting] = useState<boolean>(false);

  const addLog = (type: 'info' | 'success' | 'warning' | 'error', message: string, details?: string) => {
    const time = new Date().toLocaleTimeString('ro-RO', { hour12: false });
    const id = Math.random().toString(36).substring(2, 9);
    setLogs((prev) => [{ id, time, type, message, details }, ...prev]);
  };

  const checkStatus = () => {
    const supported = 'Notification' in window;
    const inIframe = window.self !== window.top;
    const secure = window.isSecureContext;
    const sw = 'serviceWorker' in navigator;
    const push = 'PushManager' in window;
    const perm = supported ? Notification.permission : 'unsupported';

    setIsSupported(supported);
    setIsInIframe(inIframe);
    setIsSecure(secure);
    setHasSW(sw);
    setHasPushManager(push);
    setPermissionStatus(perm);

    return { supported, inIframe, secure, sw, push, perm };
  };

  useEffect(() => {
    const status = checkStatus();
    addLog('info', 'Initializare diagnostic Notificări Push Web');
    if (!status.supported) {
      addLog('error', 'API-ul Notification nu este suportat de acest browser.');
    } else {
      addLog('info', `Stare permisiune initiala: '${status.perm}'`);
    }

    if (status.inIframe) {
      addLog(
        'warning',
        'Aplicația ruleaza intr-un iFrame (Preview AI Studio).',
        'Browserele moderne (Chrome, Edge, Safari) blocheaza sau ignora solicitarea de permisiuni Push din iFrame-uri din motive de securitate.'
      );
    }

    if (!status.secure) {
      addLog('error', 'Contextul nu este securizat (HTTPS necesar pentru Web Push).');
    }
  }, []);

  const handleRunFullDiagnostic = async () => {
    setIsTesting(true);
    addLog('info', '--- RULARE DIAGNOSTIC COMPLET ---');
    const status = checkStatus();

    // 1. Check Browser Support
    if (!status.supported) {
      addLog('error', 'Esec: Browserul nu suporta API-ul Notification.');
      setIsTesting(false);
      return;
    }
    addLog('success', 'Verificare API Notification: Suportat');

    // 2. Check Iframe
    if (status.inIframe) {
      addLog(
        'warning',
        'Detectat mediu iFrame embed',
        'Pentru ca notificările sa functioneze corect, deschide aplicația intr-un tab separat.'
      );
    } else {
      addLog('success', 'Aplicația ruleaza in fereastra principala (top window)');
    }

    // 3. Request Permission
    try {
      addLog('info', 'Solicitare permisiune Notification.requestPermission()...');
      const res = await Notification.requestPermission();
      setPermissionStatus(res);

      if (res === 'granted') {
        addLog('success', 'Permisiune acordata cu succes! (granted)');
      } else if (res === 'denied') {
        addLog(
          'error',
          'Permisiune respinsa (denied)',
          'Utilizatorul sau browserul a blocat notificările pentru acest domeniu. Verifica setările de securitate ale browserului.'
        );
      } else {
        addLog(
          'warning',
          'Permisiune neacordata (default)',
          'Promptul a fost inchis sau ignorat/blocat de browser.'
        );
      }
    } catch (err: any) {
      addLog('error', 'Exceptie la solicitarea permisiunii', err?.message || String(err));
    }

    // 4. Test Trigger Notification
    if (Notification.permission === 'granted') {
      try {
        addLog('info', 'Incercare generare notificare de test...');
        const notif = new Notification('AI.TRADE Diagnostic', {
          body: 'Notificările Web Push pe desktop funcționează corect!',
          icon: 'https://cdn-icons-png.flaticon.com/512/2950/2950073.png',
        });

        notif.onclick = () => {
          window.focus();
        };

        addLog('success', 'Notificarea de test a fost trimisa catre sistemul de operare.');
      } catch (err: any) {
        addLog(
          'error',
          'Eroare la crearea obiectului Notification',
          err?.message || String(err)
        );
      }
    } else {
      addLog(
        'warning',
        'Notificarea de test nu a putut fi trimisa deoarece permisiunea nu este "granted".'
      );
    }

    setIsTesting(false);
  };

  const handleTestSimulatedPush = () => {
    if (!('Notification' in window)) {
      alert('Notification API nu este disponibil.');
      return;
    }

    if (Notification.permission !== 'granted') {
      addLog('warning', 'Nu se poate trimite notificarea. Permisiunea nu este "granted".');
      alert(`Stare permisiune: ${Notification.permission}. Trebuie sa acorzi permisiuni mai intai!`);
      return;
    }

    try {
      const n = new Notification('🚨 Semnal AI.TRADE Test', {
        body: 'Cumpărare automată BTCUSDT la prețul $98,450.00 (Probabilitate AI: 88%)',
        icon: 'https://cdn-icons-png.flaticon.com/512/2950/2950073.png',
      });
      addLog('success', 'Notificare simulata declansata cu succes!');
    } catch (err: any) {
      addLog('error', 'Eroare la declansarea notificarii', err?.message || String(err));
    }
  };

  const openNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  return (
    <div className="bg-zinc-900/60 border border-white/10 rounded-2xl p-6 shadow-xl space-y-6">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-serif text-white">Diagnostic Notificări Web Push</h3>
            <p className="text-xs text-zinc-400">
              Uneltele de testare directă pentru starea permisiunilor Push API și blocajele de iFrame/Browser.
            </p>
          </div>
        </div>
        <button
          onClick={checkStatus}
          className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs flex items-center gap-1.5 transition-colors"
          title="Reîmprospătează starea"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Re-verifică</span>
        </button>
      </div>

      {/* Status Grid Badges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Permission Badge */}
        <div className="bg-zinc-800/50 p-3.5 rounded-xl border border-white/5 flex flex-col justify-between">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
            Permisiune Push
          </span>
          <div className="mt-2 flex items-center gap-2">
            {permissionStatus === 'granted' && (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-semibold text-emerald-400 uppercase">GRANTED</span>
              </>
            )}
            {permissionStatus === 'denied' && (
              <>
                <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="text-xs font-semibold text-rose-400 uppercase">DENIED (BLOCAT)</span>
              </>
            )}
            {permissionStatus === 'default' && (
              <>
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs font-semibold text-amber-400 uppercase">DEFAULT</span>
              </>
            )}
            {permissionStatus === 'unsupported' && (
              <>
                <XCircle className="w-4 h-4 text-zinc-500 shrink-0" />
                <span className="text-xs font-semibold text-zinc-500 uppercase">FĂRĂ SUPORT</span>
              </>
            )}
          </div>
        </div>

        {/* Frame Context */}
        <div className="bg-zinc-800/50 p-3.5 rounded-xl border border-white/5 flex flex-col justify-between">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
            Mediu Execuție
          </span>
          <div className="mt-2 flex items-center gap-2">
            {isInIframe ? (
              <>
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs font-semibold text-amber-300">iFrame Preview</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-semibold text-emerald-400">Tab Separata</span>
              </>
            )}
          </div>
        </div>

        {/* Secure Context */}
        <div className="bg-zinc-800/50 p-3.5 rounded-xl border border-white/5 flex flex-col justify-between">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
            Context Securizat
          </span>
          <div className="mt-2 flex items-center gap-2">
            {isSecure ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-semibold text-emerald-400">HTTPS / Localhost</span>
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="text-xs font-semibold text-rose-400">HTTP Nesigur</span>
              </>
            )}
          </div>
        </div>

        {/* Service Worker */}
        <div className="bg-zinc-800/50 p-3.5 rounded-xl border border-white/5 flex flex-col justify-between">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
            Push API / SW
          </span>
          <div className="mt-2 flex items-center gap-2">
            {hasSW || hasPushManager ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-semibold text-emerald-400">Disponibil</span>
              </>
            ) : (
              <>
                <Info className="w-4 h-4 text-zinc-400 shrink-0" />
                <span className="text-xs font-semibold text-zinc-400">Notification Doar</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Warning Alert Banner for iFrame context */}
      {isInIframe && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3 text-amber-200">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-amber-300">
              Atenție: Te afli în fereastra de preview (iFrame)!
            </p>
            <p className="text-amber-200/80">
              Browserele moderne precum Google Chrome blochează dialogurile de permisiune Web Push în iframe-uri. Pentru a permite notificările desktop, deschide aplicația într-un tab nou al browserului.
            </p>
            <button
              onClick={openNewTab}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded-lg text-xs font-medium transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Deschide Aplicația în Tab Nou</span>
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleRunFullDiagnostic}
          disabled={isTesting}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-lg text-xs flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          <Play className="w-3.5 h-3.5" />
          <span>{isTesting ? 'Se testează...' : 'Rulează Diagnostic Complet'}</span>
        </button>

        <button
          onClick={handleTestSimulatedPush}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-lg text-xs border border-white/10 flex items-center gap-2 transition-colors"
        >
          <Bell className="w-3.5 h-3.5 text-emerald-400" />
          <span>Trimite Notificare Simulata</span>
        </button>

        <button
          onClick={openNewTab}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-lg text-xs border border-white/10 flex items-center gap-2 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Deschide în Tab Nou</span>
        </button>
      </div>

      {/* Realtime Diagnostic Terminal Logs */}
      <div className="bg-black/80 rounded-xl border border-white/10 p-4 font-mono text-xs space-y-2">
        <div className="flex items-center justify-between border-b border-white/10 pb-2 text-zinc-500 text-[11px]">
          <div className="flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5" />
            <span>Console Diagnostic Web Push</span>
          </div>
          <button
            onClick={() => setLogs([])}
            className="text-[10px] hover:text-zinc-300 underline"
          >
            Șterge Istoric
          </button>
        </div>

        <div className="max-h-48 overflow-y-auto space-y-1.5 pt-1">
          {logs.length === 0 ? (
            <p className="text-zinc-600 italic">Niciun jurnal înregistrat încă. Apasă pe "Rulează Diagnostic Complet".</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex flex-col text-[11px] leading-relaxed">
                <div className="flex items-start gap-2">
                  <span className="text-zinc-600 shrink-0">[{log.time}]</span>
                  <span
                    className={
                      log.type === 'success'
                        ? 'text-emerald-400 font-semibold'
                        : log.type === 'error'
                        ? 'text-rose-400 font-semibold'
                        : log.type === 'warning'
                        ? 'text-amber-400'
                        : 'text-zinc-300'
                    }
                  >
                    {log.type === 'success' && '✓ '}
                    {log.type === 'error' && '✗ '}
                    {log.type === 'warning' && '⚠ '}
                    {log.message}
                  </span>
                </div>
                {log.details && (
                  <div className="ml-16 text-[10px] text-zinc-500 bg-zinc-900/80 p-1.5 rounded border border-white/5 my-0.5">
                    {log.details}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
