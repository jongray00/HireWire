import { useState, useRef } from 'react';

const ACCEPTED_TYPES = '.pdf,.docx,.txt,.md,.html';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function KnowledgeBaseTab({ documents = [], employeeId, credentials, onDocumentsChange }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleUpload = async (file) => {
    if (!file) return;
    setError('');

    if (file.size > MAX_FILE_SIZE) {
      setError(`File too large (${formatFileSize(file.size)}). Maximum is 10MB.`);
      return;
    }

    if (!credentials?.spaceUrl || !credentials?.projectId || !credentials?.apiToken) {
      setError('SignalWire credentials not configured.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('employeeId', employeeId);
      formData.append('spaceUrl', credentials.spaceUrl);
      formData.append('projectId', credentials.projectId);
      formData.append('apiToken', credentials.apiToken);

      const resp = await fetch('/api/signalwire/upload-document', { method: 'POST', body: formData });
      const data = await resp.json();

      if (!data.success) {
        setError(data.error || 'Upload failed');
        return;
      }

      const newDocs = [...documents, {
        document_id: data.document.document_id,
        filename: data.document.filename,
        size: data.document.size,
        uploaded_at: new Date().toISOString(),
      }];
      onDocumentsChange(newDocs);
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (documentId) => {
    if (!credentials?.spaceUrl) return;

    try {
      const resp = await fetch('/api/signalwire/delete-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId,
          documentId,
          spaceUrl: credentials.spaceUrl,
          projectId: credentials.projectId,
          apiToken: credentials.apiToken,
        }),
      });
      const data = await resp.json();
      if (data.success) {
        onDocumentsChange(documents.filter(d => d.document_id !== documentId));
      } else {
        setError(data.error || 'Delete failed');
      }
    } catch (err) {
      setError(err.message || 'Delete failed');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  return (
    <div style={{ marginTop: '1rem' }}>
      <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Knowledge Base Documents</h4>
      <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.75rem' }}>
        Upload documents for the agent to search during calls. Supports PDF, DOCX, TXT, MD, HTML (max 10MB each).
      </p>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? '#044cf6' : '#d1d5db'}`,
          borderRadius: '0.5rem',
          padding: '1.5rem',
          textAlign: 'center',
          cursor: uploading ? 'wait' : 'pointer',
          backgroundColor: dragOver ? '#f0f4ff' : '#fafafa',
          transition: 'all 0.15s',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          onChange={(e) => handleUpload(e.target.files?.[0])}
          style={{ display: 'none' }}
        />
        {uploading ? (
          <p style={{ color: '#666', fontSize: '0.875rem' }}>Uploading...</p>
        ) : (
          <p style={{ color: '#888', fontSize: '0.875rem' }}>
            Drop a file here or click to browse
          </p>
        )}
      </div>

      {error && (
        <p style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.5rem' }}>{error}</p>
      )}

      {/* Document list */}
      {documents.length > 0 && (
        <div style={{ marginTop: '0.75rem' }}>
          {documents.map((doc) => (
            <div
              key={doc.document_id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.5rem 0.75rem',
                borderBottom: '1px solid #e5e7eb',
                fontSize: '0.85rem',
              }}
            >
              <div>
                <span style={{ fontWeight: 500 }}>{doc.filename}</span>
                <span style={{ color: '#888', marginLeft: '0.5rem' }}>
                  {formatFileSize(doc.size)}
                </span>
                <span style={{ color: '#aaa', marginLeft: '0.5rem', fontSize: '0.75rem' }}>
                  {new Date(doc.uploaded_at).toLocaleDateString()}
                </span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(doc.document_id); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#dc2626',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  padding: '0.25rem 0.5rem',
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
