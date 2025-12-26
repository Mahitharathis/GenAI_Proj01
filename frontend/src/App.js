import React, { useState, useEffect } from 'react';
import './App.css';

const API_BASE_URL = 'http://localhost:8000';

function App() {
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [newDocument, setNewDocument] = useState('');
  const [documentMetadata, setDocumentMetadata] = useState('');
  const [activeTab, setActiveTab] = useState('query');
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);

  // Fetch documents on component mount
  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/documents`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
    }
  };

  const handleQuery = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${API_BASE_URL}/query/?q=${encodeURIComponent(query)}`, {
        method: 'GET',
      });

      if (response.ok) {
        const data = await response.json();
        setAnswer(data.answer);
        setSources([]); // Backend doesn't return sources yet, but we can add this later
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'An error occurred while processing your query.');
      }
    } catch (err) {
      setError('Failed to connect to the server. Make sure the backend is running.');
      console.error('Query error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddDocument = async (e) => {
    e.preventDefault();
    if (!newDocument.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      let metadata = {};
      if (documentMetadata.trim()) {
        try {
          metadata = JSON.parse(documentMetadata);
        } catch (err) {
          setError('Invalid JSON in metadata field');
          setIsLoading(false);
          return;
        }
      }

      const response = await fetch(`${API_BASE_URL}/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: newDocument,
          metadata: metadata
        }),
      });

      if (response.ok) {
        setNewDocument('');
        setDocumentMetadata('');
        fetchDocuments(); // Refresh the documents list
        setError('');
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to add document.');
      }
    } catch (err) {
      setError('Failed to connect to the server. Make sure the backend is running.');
      console.error('Add document error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDocument = async (documentId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/documents/${documentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchDocuments(); // Refresh the documents list
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to delete document.');
      }
    } catch (err) {
      setError('Failed to connect to the server.');
      console.error('Delete document error:', err);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setError('');
      setUploadResult(null);
    } else {
      setError('Please select a valid PDF file.');
      setSelectedFile(null);
    }
  };

  const handlePDFUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a PDF file to upload.');
      return;
    }

    setIsLoading(true);
    setError('');
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch(`${API_BASE_URL}/upload-pdf/`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setUploadResult(data);
        setSelectedFile(null);
        // Reset file input
        const fileInput = document.getElementById('pdf-file-input');
        if (fileInput) fileInput.value = '';
        setError('');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to upload PDF.');
      }
    } catch (err) {
      setError('Failed to connect to the server. Make sure the backend is running.');
      console.error('PDF upload error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🤖 RAG Application</h1>
        <p>Retrieval-Augmented Generation Demo</p>
      </header>

      <main className="App-main">
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'query' ? 'active' : ''}`}
            onClick={() => setActiveTab('query')}
          >
            Query Documents
          </button>
          <button 
            className={`tab ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            Upload PDF
          </button>
          <button 
            className={`tab ${activeTab === 'manage' ? 'active' : ''}`}
            onClick={() => setActiveTab('manage')}
          >
            Manage Documents
          </button>
        </div>

        {error && (
          <div className="error-message">
            <strong>Error:</strong> {error}
          </div>
        )}

        {activeTab === 'query' && (
          <div className="query-section">
            <div className="query-form">
              <h2>Ask a Question</h2>
              <form onSubmit={handleQuery}>
                <div className="input-group">
                  <textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Enter your question here..."
                    rows="3"
                    disabled={isLoading}
                  />
                </div>
                <button type="submit" disabled={isLoading || !query.trim()}>
                  {isLoading ? '🤔 Thinking...' : '🔍 Search'}
                </button>
              </form>
            </div>

            {answer && (
              <div className="results">
                <div className="answer-section">
                  <h3>💡 Answer</h3>
                  <div className="answer-content">
                    {answer}
                  </div>
                </div>

                {sources.length > 0 && (
                  <div className="sources-section">
                    <h3>📚 Sources</h3>
                    <div className="sources-list">
                      {sources.map((source, index) => (
                        <div key={index} className="source-item">
                          <strong>Source {index + 1}:</strong> {source}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="upload-section">
            <div className="upload-form">
              <h2>📄 Upload PDF Document</h2>
              <p>Upload a PDF file to add it to the knowledge base for querying.</p>
              
              <form onSubmit={handlePDFUpload}>
                <div className="input-group">
                  <label htmlFor="pdf-file-input">Select PDF File:</label>
                  <input
                    id="pdf-file-input"
                    type="file"
                    accept=".pdf"
                    onChange={handleFileSelect}
                    disabled={isLoading}
                    className="file-input"
                  />
                  {selectedFile && (
                    <div className="file-info">
                      <strong>Selected:</strong> {selectedFile.name} 
                      <span className="file-size">
                        ({Math.round(selectedFile.size / 1024)} KB)
                      </span>
                    </div>
                  )}
                </div>
                
                <button type="submit" disabled={isLoading || !selectedFile}>
                  {isLoading ? '📤 Uploading...' : '📤 Upload PDF'}
                </button>
              </form>
            </div>

            {uploadResult && (
              <div className="upload-results">
                <div className="success-message">
                  <h3>✅ Upload Successful!</h3>
                  <p><strong>Status:</strong> {uploadResult.status}</p>
                  
                  {uploadResult.tables && uploadResult.tables.length > 0 && (
                    <div className="tables-section">
                      <h4>📊 Extracted Tables ({uploadResult.tables.length})</h4>
                      <div className="tables-list">
                        {uploadResult.tables.map((table, index) => (
                          <div key={index} className="table-preview">
                            <h5>Table {index + 1}:</h5>
                            <div className="table-content">
                              <pre>{table}</pre>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <p className="next-steps">
                    💡 Your PDF has been processed and is now available for querying. 
                    Go to the "Query Documents" tab to ask questions about the content.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'manage' && (
          <div className="manage-section">
            <div className="add-document">
              <h2>Add New Document</h2>
              <form onSubmit={handleAddDocument}>
                <div className="input-group">
                  <label>Document Content:</label>
                  <textarea
                    value={newDocument}
                    onChange={(e) => setNewDocument(e.target.value)}
                    placeholder="Enter document content..."
                    rows="6"
                    disabled={isLoading}
                  />
                </div>
                <div className="input-group">
                  <label>Metadata (Optional JSON):</label>
                  <textarea
                    value={documentMetadata}
                    onChange={(e) => setDocumentMetadata(e.target.value)}
                    placeholder='{"topic": "example", "author": "John Doe"}'
                    rows="2"
                    disabled={isLoading}
                  />
                </div>
                <button type="submit" disabled={isLoading || !newDocument.trim()}>
                  {isLoading ? '⏳ Adding...' : '📄 Add Document'}
                </button>
              </form>
            </div>

            <div className="documents-list">
              <h2>Knowledge Base ({documents.length} documents)</h2>
              {documents.length === 0 ? (
                <p className="empty-state">
                  No documents in the knowledge base yet. Add some documents to get started!
                </p>
              ) : (
                <div className="documents-grid">
                  {documents.map((doc) => (
                    <div key={doc.id} className="document-card">
                      <div className="document-content">
                        <strong>Preview:</strong>
                        <p>{doc.content_preview}</p>
                        {doc.metadata && Object.keys(doc.metadata).length > 0 && (
                          <div className="document-metadata">
                            <strong>Metadata:</strong>
                            <pre>{JSON.stringify(doc.metadata, null, 2)}</pre>
                          </div>
                        )}
                        <small>Created: {new Date(doc.created_at).toLocaleString()}</small>
                      </div>
                      <button
                        className="delete-button"
                        onClick={() => handleDeleteDocument(doc.id)}
                        title="Delete document"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;