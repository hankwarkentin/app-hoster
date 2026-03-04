
import { useEffect, useState } from 'react';
import './App.css';

interface AppVersion {
  id: string;
  name: string;
  bundle_id: string;
  platform: string;
  version_name: string;
  version_code?: string;
  folder?: string;
  uploaded_at: string;
  metadata?: Record<string, any>;
}

function App() {
  const [apps, setApps] = useState<AppVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchApps() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('http://localhost:8000/api/apps', {
          headers: { 'x-api-key': 'test-bootstrap-key' },
        });
        if (!res.ok) throw new Error('Failed to fetch apps');
        const data = await res.json();
        setApps(data);
      } catch (err: any) {
        setError(err.message || 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchApps();
  }, []);

  return (
    <div className="App">
      <h1>AppHoster - App Browser</h1>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Bundle ID</th>
            <th>Platform</th>
            <th>Version</th>
            <th>Uploaded</th>
          </tr>
        </thead>
        <tbody>
          {apps.map(app => (
            <tr key={app.id}>
              <td>{app.name}</td>
              <td>{app.bundle_id}</td>
              <td>{app.platform}</td>
              <td>{app.version_name}</td>
              <td>{new Date(app.uploaded_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
