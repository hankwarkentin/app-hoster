import React, { useEffect, useState } from 'react';
import UploadDialog from './UploadDialog';


// Backend returns a flat app version object with name and bundle_id
interface AppVersionRow {
  id: string;
  app_id: string;
  platform: string;
  version_name: string;
  version_code?: string;
  metadata?: Record<string, any>;
  folder?: string;
  file_url: string;
  uploaded_at: string;
  name: string;
  bundle_id: string;
}


interface AppTableProps {
  token: string;
}

const AppTable: React.FC<AppTableProps> = ({ token }) => {
  const [versions, setVersions] = useState<AppVersionRow[]>([]);
  const [apps, setApps] = useState<{ name: string; bundle_id: string; app_id: string }[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<'name'|'platform'|'uploaded_at'>('uploaded_at');
  const [sortOrder, setSortOrder] = useState<'asc'|'desc'>('desc');
  const [filter, setFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');

  useEffect(() => {
    fetch('/api/apps', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        setVersions(data);
        // Extract unique apps for the user/customer
        const uniqueApps = Array.from(
          new Map(
            data.map((v: AppVersionRow) => [v.app_id, { name: v.name, bundle_id: v.bundle_id, app_id: v.app_id }])
          ).values()
        ) as { name: string; bundle_id: string; app_id: string }[];
        setApps(uniqueApps);
      });
  }, [token]);

  // Filter and sort apps list
  const filteredApps = apps.filter(app => app.name.toLowerCase().includes(filter.toLowerCase()));
  const sortedApps = [...filteredApps].sort((a, b) => {
    let aVal = a.name, bVal = b.name;
    if (sortKey === 'name') {
      // already set
    } else if (sortKey === 'uploaded_at') {
      // Sort by most recent version upload for each app
      const aLatest = versions.filter(v => v.app_id === a.app_id).sort((x, y) => y.uploaded_at.localeCompare(x.uploaded_at))[0]?.uploaded_at || '';
      const bLatest = versions.filter(v => v.app_id === b.app_id).sort((x, y) => y.uploaded_at.localeCompare(x.uploaded_at))[0]?.uploaded_at || '';
      aVal = aLatest;
      bVal = bLatest;
    }
    if (sortOrder === 'asc') return aVal.localeCompare(bVal);
    else return bVal.localeCompare(aVal);
  });

  const handleSort = (key: 'name'|'platform'|'uploaded_at') => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const handleApkUpload = async (file: File) => {
    setUploadError('');
    setUploadSuccess('');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/apps/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      let errorMsg = '';
      if (!res.ok) {
        try {
          const errData = await res.json();
          errorMsg = errData.error || JSON.stringify(errData);
        } catch {
          errorMsg = `Upload failed (${res.status})`;
        }
        throw new Error(errorMsg);
      }
      setUploadSuccess('APK uploaded successfully!');
      setShowModal(false);
      // Refresh app list
      fetch('/api/apps', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => setApps(data));
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <h2 style={{ marginRight: 120 }}>Your Apps</h2>
      <button
        style={{ position: 'absolute', top: 0, right: 0, margin: 8, zIndex: 2 }}
        onClick={() => setShowModal(true)}
      >
        Upload
      </button>
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(30,30,30,0.7)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', color: '#222', padding: 32, borderRadius: 12, boxShadow: '0 2px 24px rgba(0,0,0,0.3)', minWidth: 400, maxWidth: 480 }}>
            <h3 style={{ marginTop: 0, marginBottom: 16, color: '#222' }}>Upload APK File</h3>
            <UploadDialog onUpload={handleApkUpload} />
            <div style={{ marginTop: 20, display: 'flex', alignItems: 'center' }}>
              <button type="button" onClick={() => setShowModal(false)} style={{ marginRight: 12 }}>
                Cancel
              </button>
              {uploadError && <span style={{ color: 'red', marginLeft: 8 }}>{uploadError}</span>}
              {uploadSuccess && <span style={{ color: 'green', marginLeft: 8 }}>{uploadSuccess}</span>}
            </div>
          </div>
        </div>
      )}
      <input
        type="text"
        placeholder="Filter by name..."
        value={filter}
        onChange={e => setFilter(e.target.value)}
        style={{ marginBottom: 12 }}
      />
      {!selectedAppId ? (
        <table className="apphoster-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('name')}>Name</th>
              <th>Bundle ID</th>
              <th onClick={() => handleSort('uploaded_at')}>Latest Upload</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedApps.map((app, idx) => {
              const latestVersion = versions.filter(v => v.app_id === app.app_id).sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at))[0];
              return (
                <tr key={app.app_id} className={idx % 2 === 0 ? 'even' : 'odd'}>
                  <td>{app.name}</td>
                  <td>{app.bundle_id}</td>
                  <td>{latestVersion ? new Date(latestVersion.uploaded_at).toLocaleString() : '-'}</td>
                  <td>
                    <button className="view-btn" onClick={() => setSelectedAppId(app.app_id)}>View Versions</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <div>
          <button className="back-btn" onClick={() => setSelectedAppId(null)} style={{ marginBottom: 12 }}>Back to Apps</button>
          <h3>Versions for {apps.find(a => a.app_id === selectedAppId)?.name}</h3>
          <table className="apphoster-table">
            <thead>
              <tr>
                <th>Version Name</th>
                <th>Platform</th>
                <th>Code</th>
                <th>Folder</th>
                <th>Metadata</th>
                <th>Uploaded At</th>
                <th>File</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {versions.filter(v => v.app_id === selectedAppId).sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at)).map((version, idx) => (
                <tr key={version.id} className={idx % 2 === 0 ? 'even' : 'odd'}>
                  <td>{version.version_name}</td>
                  <td>{version.platform}</td>
                  <td>{version.version_code}</td>
                  <td>{version.folder}</td>
                  <td><pre style={{ fontSize: 12 }}>{JSON.stringify(version.metadata, null, 2)}</pre></td>
                  <td>{new Date(version.uploaded_at).toLocaleString()}</td>
                  <td>
                    <a href={`/api/apps/${version.id}/download`} target="_blank" rel="noopener noreferrer">Download</a>
                  </td>
                  <td>
                    <button className="delete-btn" onClick={() => window.confirm('Delete not implemented yet')}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AppTable;
