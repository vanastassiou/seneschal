/**
 * OAuth configuration for seneschal sync
 * Copy this file to config.js and add your credentials
 *
 * Setup instructions:
 * 1. Go to https://console.cloud.google.com
 * 2. Create a project (or select existing)
 * 3. Enable APIs: Google Drive API, Google Picker API
 * 4. Go to APIs & Services > Credentials
 * 5. Create OAuth 2.0 Client ID (Web application type)
 *    - Add authorized JavaScript origin: http://localhost:8080
 *    - Add authorized redirect URI: http://localhost:8080/
 * 6. Copy the Client ID and Client Secret below
 * 7. Create an API Key and copy it below
 */

export const config = {
  google: {
    clientId: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
    clientSecret: 'YOUR_GOOGLE_CLIENT_SECRET',
    apiKey: 'YOUR_GOOGLE_API_KEY'
  },
  redirectUri: window.location.origin + window.location.pathname
};
