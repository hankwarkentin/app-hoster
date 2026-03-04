import { useEffect, useState } from 'react';
import AppTable from './AppTable';
import SignIn from './SignIn';
import './App.css';

const FRONTEND_VERSION = '1.0.0';

function App() {
  const [token, setToken] = useState<string | null>(null);
  const [backendVersion, setBackendVersion] = useState<string>('');

  useEffect(() => {
    fetch('/api/version')
      .then(res => res.json())
      .then(data => setBackendVersion(data.version || ''));
  }, []);

  return (
    <div className="App">
      <h1>AppHoster</h1>
      {!token ? (
        <SignIn onSignIn={setToken} />
      ) : (
        <AppTable token={token} />
      )}
      <div style={{ position: 'fixed', right: 12, bottom: 8, fontSize: 12, color: '#888' }}>
        Frontend v{FRONTEND_VERSION} | Backend v{backendVersion}
      </div>
    </div>
  );
}

export default App;
