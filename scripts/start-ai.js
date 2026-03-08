/**
 * Start the Python AI service (uvicorn). Prefers project venv, then system python/py.
 * Run from project root; the script uses the ai/ directory as cwd.
 */
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const rootDir = path.join(__dirname, '..');
const aiDir = path.join(rootDir, 'ai');
const args = ['-m', 'uvicorn', 'ai_service:app', '--host', '127.0.0.1', '--port', '8000'];

// Prefer venv: project root venv or ai/venv (Windows: Scripts\python.exe, Unix: bin/python)
const venvCandidates = [
  path.join(rootDir, 'venv', 'Scripts', 'python.exe'),
  path.join(rootDir, 'venv', 'bin', 'python'),
  path.join(aiDir, 'venv', 'Scripts', 'python.exe'),
  path.join(aiDir, 'venv', 'bin', 'python'),
].filter((p) => fs.existsSync(p));

// On Windows, try Python Launcher (py) and common install paths if not in PATH
const isWin = process.platform === 'win32';
let systemOrder = isWin ? ['py', 'python'] : ['python3', 'python'];
if (isWin) {
  const pyPaths = [];
  const localAppData = process.env.LOCALAPPDATA;
  const programFiles = process.env['ProgramFiles'];
  if (localAppData) {
    try {
      const pyDir = path.join(localAppData, 'Programs', 'Python');
      if (fs.existsSync(pyDir)) {
        const versions = fs.readdirSync(pyDir).filter((d) => /^Python\d+/.test(d)).sort().reverse();
        for (const v of versions) {
          const exe = path.join(pyDir, v, 'python.exe');
          if (fs.existsSync(exe)) pyPaths.push(exe);
        }
      }
    } catch (_) {}
  }
  if (programFiles) {
    try {
      const pfDir = path.join(programFiles, 'Python');
      if (fs.existsSync(pfDir)) {
        const versions = fs.readdirSync(pfDir).filter((d) => /^Python\d+/.test(d)).sort().reverse();
        for (const v of versions) {
          const exe = path.join(pfDir, v, 'python.exe');
          if (fs.existsSync(exe)) pyPaths.push(exe);
        }
      }
    } catch (_) {}
  }
  systemOrder = [...pyPaths, ...systemOrder];
}

const tryOrder = venvCandidates.length > 0 ? [...venvCandidates, ...systemOrder] : systemOrder;
let index = 0;

function run() {
  const cmd = tryOrder[index];
  if (!cmd) {
    const hint = isWin
      ? 'Install Python from python.org or run: py -m venv ai\\venv && ai\\venv\\Scripts\\pip install -r ai\\requirements.txt'
      : 'Create a venv: cd ai && python3 -m venv venv && venv/bin/pip install -r requirements.txt';
    console.error('[ai] Python not found. ' + hint);
    process.exit(1);
  }
  const isVenv = cmd.includes('venv');
  const useShell = isWin && !isVenv && (cmd === 'py' || cmd === 'python');
  const child = spawn(cmd, args, {
    cwd: aiDir,
    stdio: 'inherit',
    shell: useShell,
    env: { ...process.env, VIRTUAL_ENV: isVenv ? path.dirname(path.dirname(cmd)) : process.env.VIRTUAL_ENV },
  });
  child.on('error', (err) => {
    if (err.code === 'ENOENT') {
      index++;
      run();
      return;
    }
    console.error('[ai] Failed to start:', err.message);
    process.exit(1);
  });
  child.on('exit', (code, signal) => {
    if (code === 0 && !signal) return;
    if (code !== 0 && index + 1 < tryOrder.length) {
      index++;
      run();
      return;
    }
    process.exit(code != null ? code : 1);
  });
}

run();
