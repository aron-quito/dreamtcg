/**
 * DreamsTCG Configuration
 */

// Dynamically determine the API base URL based on the current host.
// This ensures it works on localhost, 127.0.0.1, or any local IP.
export const API_BASE = `${window.location.protocol}//${window.location.hostname}:3001/api`;
export const SERVER_BASE = `${window.location.protocol}//${window.location.hostname}:3001`;

console.log("[CONFIG] API_BASE detected as:", API_BASE);
