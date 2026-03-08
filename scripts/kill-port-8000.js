/**
 * Frees port 8000 before starting the AI service so a previous run doesn't block.
 * Exits 0 so the next command in the dev script always runs.
 */
const { execSync } = require('child_process');
try {
  execSync('npx kill-port 8000', { stdio: 'inherit' });
} catch {
  // Port was free or kill-port failed; continue
}
process.exit(0);
