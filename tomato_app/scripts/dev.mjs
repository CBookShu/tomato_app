import { spawn } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const electronPath = require.resolve('electron/cli.js');

// Start Vite dev server
const vite = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  shell: true
});

// Wait for Vite to be ready, then start Electron
let electronStarted = false;

vite.on('spawn', () => {
  console.log('Vite dev server starting...');

  // Wait a bit for Vite to start
  setTimeout(() => {
    if (!electronStarted) {
      electronStarted = true;
      console.log('Starting Electron...');

      const electron = spawn('node', [electronPath, '.'], {
        stdio: 'inherit',
        env: {
          ...process.env,
          NODE_ENV: 'development'
        }
      });

      electron.on('close', (code) => {
        console.log(`Electron exited with code ${code}`);
        vite.kill();
        process.exit(code || 0);
      });
    }
  }, 3000);
});

vite.on('close', (code) => {
  console.log(`Vite exited with code ${code}`);
  process.exit(code || 0);
});

// Handle cleanup
process.on('SIGINT', () => {
  vite.kill();
  process.exit(0);
});
