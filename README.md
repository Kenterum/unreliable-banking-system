# Unreliable Banking Server and Monitoring System

## Introduction

This repository contains an **unreliable banking server (UBS)** and a separate monitoring component called **webmon**:

1. **Unreliable Banking Server (UBS)**  
   - Provides an endpoint at `/getbalance` that randomly returns:
     - **200 OK** (50% chance)  
     - **403 Forbidden** (20% chance)  
     - **500 Internal Server Error** (10% chance)  
     - **Timeout** (20% chance, achieved by delaying the response for 10 seconds)  
   - Logs each request (timestamp, IP, and outcome) in a local file.  
   - Also exposes a `/getlogs` route to retrieve these logs in JSON format.

2. **Monitoring Component (webmon)**  
   - Runs as a separate script (`webmon.js`), which **spawns and supervises** the UBS.  
   - Reads rules from `webmon.json` to specify how many consecutive errors (403, 500, timeouts) are tolerated before UBS is **restarted** automatically.  
   - Logs each monitoring attempt and any restarts to `webmon_logs.txt`.  
   - Demonstrates how to handle unreliable services: **webmon** checks the server’s health, restarts it if needed, and logs all such events for troubleshooting.

---

## Prerequisites

- **Node.js v14 or above**  
- **npm** (commonly bundled with Node.js)

You can verify installation by running:
```bash
node -v
npm -v
```

---

## Repository Structure

Below is an example of how the project is laid out in this repository:

```
server/
  server.js         # Unreliable server code
  logs.txt          # Server logs (written each time /getbalance is hit)
client/
  client.js         # Client script to send multiple requests to /getbalance
  logs.txt          # Client-side logs summarizing request outcomes
docs/
  swagger.yaml      # Swagger/OpenAPI specification for the server
webmon.js           # Monitoring script (spawns and restarts the server as needed)
webmon.json         # Configuration for webmon (retry rules, intervals, host, port, etc.)
webmon_logs.txt     # Logs recorded by webmon
README.md           # This document
```

---

## Installation

1. **Clone the Repository**:
   ```bash
   git clone <REPO-URL>
   cd unreliable-banking-system
   ```
2. **Install Dependencies**:
   ```bash
   npm install
   ```
   This installs packages like `express`, `axios`, `chalk`, `concurrently`, etc.

3. **Check `webmon.json`** (Optional Adjustments):
   - Ensure the `host` and `port` match your preferred setup (defaults: `127.0.0.1` and `3000`).
   - Confirm `waittime`, `interval`, and `retrytimes` entries for `http403`, `http500`, and `timeoutConfig`.

---

## Running the Entire System

### **`npm start`** (Concurrent Approach)

A script in `package.json` uses **concurrently** to run three commands in parallel:

1. **`npm run webmon`** → starts `webmon.js`, which **spawns** the UBS (`server.js`) as a child process and begins monitoring.  
2. **`npm run wait-for-webmon`** → waits a few seconds to allow the server to initialize.  
3. **`npm run client`** → sends 100 requests to `/getbalance`, logs the outcome, and prints a summary in the console.

Run:
```bash
npm start
```
**Note**: If the server is slow to initialize or if 5 seconds isn’t enough, the client might encounter extra `500` errors or timeouts. Increase the waiting time (e.g., `sleep 10`) if that happens frequently.

---

## Running Components Individually

If you want more control or wish to debug specific parts, you can start each piece separately:

1. **Server Only**
   ```bash
   npm run server
   ```
   - Launches `server.js` on port 3000.
   - You can then open a **new terminal** and run `npm run client` to test.  
   - **Important**: If you later run `webmon`, it might conflict with the already running server process on port 3000.

2. **webmon Only**
   ```bash
   npm run webmon
   ```
   - Starts `webmon.js`, which spawns `server.js` as a child process, monitors outcomes, and **restarts** the server on consecutive 403/500/timeout errors.  
   - Use another terminal to run `npm run client` whenever you want to load-test the server.

3. **Client Only**
   ```bash
   npm run client
   ```
   - Sends 100 requests to `[host:port]/getbalance` (defaults to `127.0.0.1:3000`).  
   - Prints how many `200`, `403`, `500`, or `timeout` outcomes occurred.  
   - Appends a summary to `client/logs.txt`.

---

## webmon Details

1. **Reading `webmon.json`**  
   - Example entry:
     ```json
     "http403": {
       "retrytimes": 2,
       "action": "restart"
     }
     ```
     Means if we see consecutive 403 errors twice, **webmon** kills and respawns the UBS.

2. **Monitoring Logic**  
   - **webmon.js** pings `/getbalance` every `interval` ms (e.g., 10 seconds).  
   - If consecutive errors (403, 500, or timeouts) exceed the `retrytimes` limit, webmon restarts the server process.  
   - Success (`200`) resets the counters to zero.

3. **Restart Mechanism**  
   - Uses Node.js `child_process` to spawn `server.js`.  
   - On too many consecutive failures, webmon kills the old process and spawns a fresh one.  
   - Every attempt or restart is logged in `webmon_logs.txt`.

4. **Example of a Restart Trigger**  
   ```txt
   [ERROR] Timeout from UBS. Count=2
   [INFO]  Restarting UBS server...
   [INFO]  Starting UBS server...
   ```
   This indicates two back-to-back timeouts triggered a server restart.

---

## Logs and Observations

- **Server Logs (`server/logs.txt`)**  
  Each request to `/getbalance` logs a JSON line containing the `timestamp`, `ip`, and the outcome (`200`, `403`, `500`, or `"timeout"`).

- **Client Logs (`client/logs.txt`)**  
  Summaries of how many `200`, `403`, `500`, or timeouts occurred in batches of 100 requests.

- **webmon Logs (`webmon_logs.txt`)**  
  Includes `[INFO]` messages for successful checks, `[ERROR]` for failures, and lines noting server restarts. Helpful for diagnosing when and why restarts occurred.

---

## Swagger Documentation

A **Swagger UI** is provided under the `/docs` endpoint. You can:

1. Ensure the server is running (via `npm run server`, `npm run webmon`, or `npm start`).
2. Open your browser at:
   ```
   http://localhost:3000/docs
   ```
3. Use the interactive API page to test `/getbalance` (random outcomes) and `/getlogs` (logs in JSON format).

---

## Known Issues and Limitations

- **Randomness**: With random outcomes, you can see skewed distributions or unexpected results in small samples.  
- **Startup Timing**: If the client starts while the server is still initializing, you’ll get more 500 or timeout errors. Increase the wait or run the scripts separately to avoid this.  
- **Port Conflicts**: Avoid running both `npm run server` and `npm run webmon` concurrently on port 3000, or you could get an EADDRINUSE error.

---

## Conclusion

This project demonstrates a Node.js–based **unreliable banking server** and a corresponding **monitoring system (webmon)** that automatically restarts the server on repeated failures. You can run everything concurrently via `npm start` or manage each component manually for better control. Logging (server, client, and webmon) helps visualize how often errors occur, and whether the monitoring logic is effectively restarting the server to maintain availability. Customize `webmon.json` for different retry logic, intervals, or wait times to see how the system adapts to changing requirements.