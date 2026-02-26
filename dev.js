#!/usr/bin/env node
'use strict';
// When an IDE or watcher runs "node dev", run the real dev script instead.
const { spawn } = require('child_process');
spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  shell: true,
  cwd: __dirname,
}).on('exit', (code) => process.exit(code ?? 0));
