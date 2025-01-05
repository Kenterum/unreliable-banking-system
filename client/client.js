import axios from 'axios'; // import axios
import fs from 'fs'; // import fs for file operations
import { dirname, join } from 'path'; // for path manipulation
import { fileURLToPath } from 'url'; // to get __dirname

// Get current directory from `import.meta.url`
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get server host and port from command-line arguments or use default values
const host = process.argv[2] || '127.0.0.1'; // Default host is 127.0.0.1
const port = process.argv[3] || 3000; // Default port is 3000

// The server URLs based on the provided host and port
const balanceUrl = `http://${host}:${port}/getbalance`;
const logsUrl = `http://${host}:${port}/getlogs`;

// Path to the client-side logs file
const logFilePath = join(__dirname, 'logs.txt');

// Function to perform multiple requests to /getbalance
async function runBalanceTests() {
    let results = {
        success: 0,
        forbidden: 0,
        internalError: 0,
        timeout: 0
    };

    // Run 100 GET requests to /getbalance
    for (let i = 0; i < 100; i++) {
        try {
            const response = await axios.get(balanceUrl, {
                headers: {
                    'Cache-Control': 'no-cache' // Prevent caching
                }
            });

            if (response.status === 200) {
                results.success++;
            } else if (response.status === 403) {
                results.forbidden++;
            } else if (response.status === 500) {
                results.internalError++;
            }
        } catch (error) {
            if (error.response && error.response.status === 403) {
                results.forbidden++;
            } else if (error.response && error.response.status === 500) {
                results.internalError++;
            } else {
                results.timeout++; // Handle timeout or other unhandled errors
            }
        }
    }

    // Output the results of the 100 requests
    console.log('Results after 100 requests:');
    console.log(`200 OK: ${results.success}`);
    console.log(`403 Forbidden: ${results.forbidden}`);
    console.log(`500 Internal Server Error: ${results.internalError}`);
    console.log(`Timeout: ${results.timeout}`);

    // Log the results into logs.txt
    const logEntry = `\nClient Test Results (${new Date().toISOString()}):\n200 OK: ${results.success}, 403 Forbidden: ${results.forbidden}, 500 Internal Server Error: ${results.internalError}, Timeout: ${results.timeout}\n`;
    fs.appendFileSync(logFilePath, logEntry);

    // After running the balance tests, fetch the logs
    await fetchLogs();
}

// Function to fetch and display logs from /getlogs
async function fetchLogs() {
    try {
        const response = await axios.get(logsUrl, {
            headers: {
                'Cache-Control': 'no-cache' // Prevent caching of logs
            }
        });
        console.log('Logs from the server:');
        console.log(response.data);
    } catch (error) {
        console.error('Error fetching logs:', error);
    }
}

// Run the balance tests and then fetch the logs
runBalanceTests();
