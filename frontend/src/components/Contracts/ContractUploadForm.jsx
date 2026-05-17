import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadContract } from '../../api/lexguardClient';
import './ContractUploadForm.css';

export default function ContractUploadForm({ onUploaded }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!file) return setError('Please select a PDF or DOCX file.');

    setLoading(true);
    try {
      const data = await uploadContract(file);
      if (onUploaded) onUploaded();
      navigate(`/contracts/${data.contractId}`);
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="upload-form glass-card fade-in" onSubmit={handleSubmit} id="upload-form">
      <h2 className="upload-title">Upload Contract</h2>
      <p className="upload-subtitle">
        Upload a PDF or DOCX contract to analyze for risky clauses and get plain-language explanations.
      </p>

      <div className="upload-fields">
        <div className="field">
          <label htmlFor="upload-file" className="field-label">Contract File</label>
          <input
            type="file"
            id="upload-file"
            accept=".pdf,.docx"
            className="input file-input"
            onChange={(e) => setFile(e.target.files[0])}
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary upload-btn"
          disabled={loading}
          id="upload-submit"
        >
          {loading ? (
            <>
              <span className="spinner" />
              Analyzing…
            </>
          ) : (
            '⬆ Upload & Analyze'
          )}
        </button>
      </div>

      {error && <p className="upload-error" id="upload-error">{error}</p>}
    </form>
  );
}
