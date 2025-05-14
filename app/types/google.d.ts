export {}

declare global {
  interface Window {
    google: typeof google
  }

  namespace google {
    namespace accounts {
      namespace oauth2 {
        interface TokenResponse {
          access_token: string
          expires_in: number
          error?: string
        }

        interface TokenClientConfig {
          client_id: string
          scope: string
          callback: (response: TokenResponse) => void
        }

        interface TokenClient {
          requestAccessToken: (options?: { prompt?: string }) => void
        }

        function initTokenClient(config: TokenClientConfig): TokenClient
      }
    }
  }
}
