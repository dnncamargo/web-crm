import { useEffect } from 'react';
import { gapi } from 'gapi-script';

declare global {
  interface Window {
    gapi: any;
  }
}

const CLIENT_ID = '996833302397-gsksfg2ujfqgt27jg5ulti0ffrnmje9a.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/calendar';


export const useGoogleAuth = () => {
  useEffect(() => {
    // Só executa no client
    if (typeof window !== 'undefined') {
      const start = () => {
        window.gapi.client.init({
          clientId: CLIENT_ID,
          scope: SCOPES,
        });
      };

      const loadGapi = () => {
        window.gapi.load('client:auth2', start);
      };

      if (!window.gapi) {
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = loadGapi;
        document.body.appendChild(script);
      } else {
        loadGapi();
      }
    }
  }, []);
};