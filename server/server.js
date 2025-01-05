import express from 'express'; // instead of const express = require('express');
import fs from 'fs'; // instead of const fs = require('fs');
import { dirname, join } from 'path'; // for path manipulation
import swaggerUi from 'swagger-ui-express'; // import instead of require
import { fileURLToPath } from 'url'; // to get __dirname
import YAML from 'yamljs'; // import instead of require

const app = express();
const PORT = process.env.PORT || 3000;  // Use dynamic port or default to 3000

// Get current directory from `import.meta.url`
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Swagger setup
const swaggerDocument = YAML.load(join(__dirname, '../docs/swagger.yaml'));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Log file path
const logFilePath = join(__dirname, 'logs.txt');

// Middleware to log request details
const logRequest = (req, res, outcome) => {
    const logEntry = {
        timestamp: new Date().toISOString(),
        ip: req.ip,
        outcome: outcome
    };
    fs.appendFileSync(logFilePath, JSON.stringify(logEntry) + '\n');
};

// Route: /getbalance
app.get('/getbalance', (req, res) => {
    const random = Math.random();

    // Simulate a 20% chance of timeout (we delay response by 10 seconds)
    if (random < 0.2) {
        logRequest(req, res, 'timeout');
        setTimeout(() => {
            // Simulate timeout (no response sent within 10 seconds)
            res.end();
        }, 10000);  // 10-second delay
        return;
    }

    // Simulate a 20% chance of returning 403 Forbidden
    if (random < 0.4) {
        logRequest(req, res, 403);  // Simulate 403 error
        return res.status(403).send('<h1>403 Forbidden</h1>');
    }

    // Simulate a 10% chance of returning 500 Internal Server Error
    if (random < 0.5) {
        logRequest(req, res, 500);  // Simulate 500 error
        return res.status(500).send('<h1>500 Internal Server Error</h1>');
    }

    // Otherwise, simulate a 50% chance of returning 200 OK response
    logRequest(req, res, 200);  // Simulate normal 200 OK response
    return res.status(200).send(`
        <html>
        <head><title>Balance</title></head>
        <body>
            <h1>Your balance is $10,000</h1>
            <p>This is fake financial data</p>
        </body>
        </html>
    `);
});

// Route: /getlogs
app.get('/getlogs', (req, res) => {
    if (!fs.existsSync(logFilePath)) {
        return res.json({ message: 'No logs available' });
    }

    const logData = fs.readFileSync(logFilePath, 'utf8');
    const logEntries = logData
        .split('\n')
        .filter(entry => entry)
        .map(entry => JSON.parse(entry));

    return res.json(logEntries);
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Swagger docs available at http://localhost:${PORT}/docs`);
});
