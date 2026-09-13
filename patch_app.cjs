const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Add import
const importTarget = `import { EngineStatusBanner } from './components/EngineStatusBanner';`;
const importReplacement = `import { EngineStatusBanner } from './components/EngineStatusBanner';
import { ShortcutBar } from './components/ShortcutBar';`;
code = code.replace(importTarget, importReplacement);

// Add state and function inside App()
const stateTarget = `  const activeView: ViewState = validViews.includes(currentView) ? currentView : 'dashboard';`;
const stateReplacement = `  const activeView: ViewState = validViews.includes(currentView) ? currentView : 'dashboard';
  const { terminalActiveTab, setTerminalActiveTab } = useTradingStore();
  const [isReconciling, setIsReconciling] = useState(false);

  const handleManualReconcile = async () => {
    setIsReconciling(true);
    try {
      const res = await fetch('/api/bot/reconcile', { method: 'POST' });
      const data = await res.json();
    } catch (err) {
      console.error('Reconcile error', err);
    } finally {
      setIsReconciling(false);
    }
  };`;
code = code.replace(stateTarget, stateReplacement);

// Insert component
const renderTarget = `      <main className="flex-1 h-full overflow-hidden relative flex flex-col">`;
const renderReplacement = `      <main className="flex-1 h-full overflow-hidden relative flex flex-col">
        <ShortcutBar 
          currentView={activeView}
          setCurrentView={setCurrentView}
          activeTab={terminalActiveTab}
          setActiveTab={setTerminalActiveTab}
          isReconciling={isReconciling}
          handleManualReconcile={handleManualReconcile}
        />`;
code = code.replace(renderTarget, renderReplacement);

fs.writeFileSync('src/App.tsx', code);
console.log('App.tsx patched');
