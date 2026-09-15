# VOID Web

A free-hostable VOID browser-style site with a small Node backend.

## Run locally
1. Install Node.js 20+
2. Open a terminal in this folder.
3. Run: npm install
4. Run: npm start
5. Open http://localhost:3000

## Put it online
Create a new Node/Web Service on a host that supports Node.js, connect/upload this project,
use `npm install` as the build command and `npm start` as the start command.

The host will give you a public HTTPS URL. Once deployed, other computers only need that URL.

## Important limitation
This is a safe HTML/text reader, not a universal browser. Modern sites that depend on scripts,
logins, DRM, anti-bot systems, or embedding protections may not work. The backend blocks private
and local network addresses.
