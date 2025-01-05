import axios from 'axios';
import chalk from 'chalk';
import { spawn } from 'child_process';
import dotenv from 'dotenv';
import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// Get current directory from `import.meta.url`
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Paths for configuration and logs
const configPath = join(__dirname, 'webmon.json'); // Configuration file
const logPath = join(__dirname, 'webmon_logs.txt'); // Log file for monitoring

// Load configuration
if (!fs.existsSync(configPath)) {
  console.error(chalk.red('Error: Configuration file "webmon.json" is missing!'));
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Extract some values for convenience
const { 
  waittime,        // how long to wait for a response from UBS (ms)
  interval,        // how often to poll the UBS (ms)
  http403,         // { retrytimes, action }
  http500,         // { retrytimes, action }
  timeoutConfig,   // { retrytimes, action } for timeouts
  http200          // { retrytimes, action } for 200 responses (likely "nothing") 
} = config;

// Constants
const UBS_HOST = process.env.UBS_HOST || config.host || '127.0.0.1';
const UBS_PORT = process.env.UBS_PORT || config.port || 3000;
const UBS_URL  = `http://${UBS_HOST}:${UBS_PORT}/getbalance`;

// Track consecutive outcomes
let consecutive403 = 0;
let consecutive500 = 0;
let consecutiveTimeout = 0;

// Child process for UBS
let ubsProcess = null;

/**
 * Logs a message to both console and log file
 */
function logMessage(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} [${level}] ${message}\n`;

  if (level === 'ERROR') {
    console.error(chalk.red(logEntry));
  } else {
    console.log(chalk.green(logEntry));
  }

  fs.appendFileSync(logPath, logEntry);
}

/**
 * Start the UBS server as a child process
 */
function startUBS() {
  if (ubsProcess) {
    logMessage('UBS is already running (or was not cleaned up).', 'ERROR');
    return;
  }

  logMessage('Starting UBS server...', 'INFO');
  // Adjust path if your server.js is in a different location
  ubsProcess = spawn('node', ['server/server.js'], { stdio: 'inherit' });

  // Optionally, you can listen to child_process events:
  ubsProcess.on('exit', (code, signal) => {
    logMessage(`UBS server exited with code ${code}, signal ${signal}`, 'ERROR');
    // If you want auto-restart on crash, you could do that here.
    ubsProcess = null; 
  });
}

/**
 * Restart the UBS server process
 */
function restartUBS() {
  if (ubsProcess) {
    logMessage('Restarting UBS server...', 'INFO');
    ubsProcess.kill(); // kill the old process
    ubsProcess = null;
  }
  startUBS();
}

/**
 * Monitor function that sends a single request to /getbalance
 * and applies the retry logic from config.
 */
async function monitorServer() {
  try {
    // Make request with a timeout from "waittime"
    const response = await axios.get(UBS_URL, { timeout: waittime });

    // If we got here without throwing, we have an HTTP status
    const status = response.status;

    if (status === 200) {
      // Reset counters for 403, 500, timeout
      consecutive403 = 0;
      consecutive500 = 0;
      consecutiveTimeout = 0;

      logMessage(`Success (200) from UBS.`, 'INFO');
      /*
         if (http200.action === 'restart') {
           restartUBS();
         }
      */
    }
    else if (status === 403) {
      consecutive403++;
      logMessage(`UBS returned 403. Count=${consecutive403}`, 'ERROR');

      // Check if we've hit the threshold
      if (consecutive403 >= http403.retrytimes) {
        // Check the action
        if (http403.action === 'restart') {
          restartUBS();
        }
        // Reset the counter so we don't keep restarting endlessly
        consecutive403 = 0;
      }
    }
    else if (status === 500) {
      consecutive500++;
      logMessage(`UBS returned 500. Count=${consecutive500}`, 'ERROR');

      // Check threshold
      if (consecutive500 >= http500.retrytimes) {
        if (http500.action === 'restart') {
          restartUBS();
        }
        consecutive500 = 0;
      }
    }
 
  }
  catch (error) {
    // We only get here if the request times out or fails in some other way
    if (error.code === 'ECONNABORTED') {
      // Timeout
      consecutiveTimeout++;
      logMessage(`Timeout from UBS. Count=${consecutiveTimeout}`, 'ERROR');

      if (consecutiveTimeout >= timeoutConfig.retrytimes) {
        if (timeoutConfig.action === 'restart') {
          restartUBS();
        }
        consecutiveTimeout = 0;
      }
    } else {
      // e.g. ECONNREFUSED if server is down, network error, etc.
      logMessage(`Connection error: ${error.message}`, 'ERROR');
    }
  }
}

/**
 * Start up everything:
 * 1) Start UBS server
 * 2) Repeatedly monitor at intervals
 */
function startMonitoring() {
  // Launch UBS if not already running
  startUBS();

  // Give it a moment to spin up, then start monitoring:
  setTimeout(() => {
    logMessage('Starting UBS monitoring...', 'INFO');
    setInterval(monitorServer, interval);
  }, 2000);
}

// BEGIN
startMonitoring();
