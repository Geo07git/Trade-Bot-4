const fs = require('fs');
const path = require('path');

console.log('Starting Total Hard Reset...');

// 1. Reset bot_state.json
const botStatePath = path.join(process.cwd(), 'bot_state.json');
if (fs.existsSync(botStatePath)) {
  try {
    const state = JSON.parse(fs.readFileSync(botStatePath, 'utf8'));
    state.balance = 1000;
    state.initialBalance = 1000;
    state.positions = [];
    state.tradeHistory = [];
    state.logs = [];
    state.accumulationBalance = 0;
    state.sessionCycleCount = 1;
    state.circuitBreakerTriggered = false;
    state.circuitBreakerReason = null;
    state.totalTradesExecuted = 0;
    fs.writeFileSync(botStatePath, JSON.stringify(state, null, 2));
    console.log('✓ bot_state.json reset successfully.');
  } catch (e) {
    console.error('Error resetting bot_state.json:', e);
  }
}

// 2. Reset trading_journal.json
const journalPath = path.join(process.cwd(), 'data', 'trading_journal.json');
if (fs.existsSync(journalPath)) {
  try {
    fs.writeFileSync(journalPath, JSON.stringify({ entries: [] }, null, 2));
    console.log('✓ data/trading_journal.json cleared successfully.');
  } catch (e) {
    console.error('Error clearing trading_journal.json:', e);
  }
}

// 3. Reset momentum_paper_state.json
const paperStatePath = path.join(process.cwd(), 'server', 'data', 'momentum_paper_state.json');
if (fs.existsSync(paperStatePath)) {
  try {
    const paperState = JSON.parse(fs.readFileSync(paperStatePath, 'utf8'));
    paperState.paperBalanceUSDT = 1000;
    paperState.startingBalanceUSDT = 1000;
    paperState.positions = [];
    paperState.tradeHistory = [];
    paperState.totalRealizedPnL = 0;
    fs.writeFileSync(paperStatePath, JSON.stringify(paperState, null, 2));
    console.log('✓ momentum_paper_state.json reset successfully.');
  } catch (e) {
    console.error('Error resetting momentum_paper_state.json:', e);
  }
}

// 4. Clear events & snapshots
const eventsPath = path.join(process.cwd(), 'server', 'data', 'tradebot_events.json');
if (fs.existsSync(eventsPath)) {
  fs.writeFileSync(eventsPath, JSON.stringify([], null, 2));
}

const snapshotsPath = path.join(process.cwd(), 'server', 'data', 'daily_snapshots.json');
if (fs.existsSync(snapshotsPath)) {
  fs.writeFileSync(snapshotsPath, JSON.stringify([], null, 2));
}

console.log('Total Hard Reset completed successfully!');
