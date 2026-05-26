import React, { useState, useEffect } from 'react';
import * as diff from 'diff';
import { getClausesDetailed } from '../../api/lexguardClient';
import './RedlineReview.css';

export default function RedlineReview({ contractId }) {
    const [clauses, setClauses] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getClausesDetailed(contractId, 1, 1000).then(data => {
            setClauses(data.clauses || []);
            setLoading(false);
        }).catch(err => {
            console.error(err);
            setLoading(false);
        });
    }, [contractId]);

    const redlinedClauses = clauses.filter(c => c.rewritten_text);

    const [selectedIdx, setSelectedIdx] = useState(0);
    const [inlineMode, setInlineMode] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    
    // Feedback state
    const [feedbackState, setFeedbackState] = useState({ status: 'idle', isRejecting: false, comment: '' });

    // Reset feedback state when clause changes
    useEffect(() => {
        setFeedbackState({ status: 'idle', isRejecting: false, comment: '' });
    }, [selectedIdx]);

    const submitFeedback = async (approved) => {
        try {
            const BASE = import.meta.env.VITE_API_URL || '/api';
            const token = localStorage.getItem('lexguard_token');
            const payload = {
                clauseId: currentClause._id,
                contractId: contractId,
                approved: approved,
                userComment: feedbackState.comment,
                originalText: currentClause.rawText,
                rewrittenText: currentClause.rewritten_text
            };

            const res = await fetch(`${BASE}/feedback/rewrite`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setFeedbackState({ ...feedbackState, status: 'submitted' });
            }
        } catch (err) {
            console.error('Failed to submit feedback:', err);
        }
    };

    if (loading) {
        return (
            <div className="redline-review-container" style={{ textAlign: 'center', padding: '2rem' }}>
                Loading AI Redlines...
            </div>
        );
    }

    // If no clauses were redlined (Zero Risk Empty State)
    if (redlinedClauses.length === 0) {
        return (
            <div className="redline-review-container">
                <div className="empty-state">
                    <h3>✅ This contract passed all compliance checks.</h3>
                    <p>No predatory clauses were found. No redlines required.</p>
                </div>
            </div>
        );
    }

    const currentClause = redlinedClauses[selectedIdx];

    const handleDownload = async () => {
        setIsDownloading(true);
        try {
            const BASE = import.meta.env.VITE_API_URL || '/api';
            const token = localStorage.getItem('lexguard_token');
            const res = await fetch(`${BASE}/contracts/${contractId}/download-cleaned`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error('Download failed');

            const blob = new Blob([await res.arrayBuffer()], { 
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `LexGuard_Cleaned_${contractId}.docx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            console.error('Download error:', err);
            alert('Failed to download redlined document.');
        } finally {
            setIsDownloading(false);
        }
    };

    // Render inline diff
    const renderInlineDiff = (oldText, newText) => {
        const diffParts = diff.diffWordsWithSpace(oldText || '', newText || '');
        return diffParts.map((part, index) => {
            if (part.added) {
                return <span key={index} className="diff-added">{part.value}</span>;
            }
            if (part.removed) {
                return <span key={index} className="diff-removed">{part.value}</span>;
            }
            return <span key={index}>{part.value}</span>;
        });
    };

    return (
        <div className="redline-review-container">
            <div className="redline-header">
                <div className="redline-title">
                    AI Contract Redliner
                </div>
                <div className="redline-controls">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Select Clause</span>
                        <select 
                            className="clause-selector"
                            value={selectedIdx}
                            onChange={(e) => setSelectedIdx(parseInt(e.target.value))}
                        >
                            {redlinedClauses.map((c, i) => (
                                <option key={c._id || i} value={i}>
                                    Clause {c.segmentIndex + 1}: {c.clause_type ? c.clause_type.replace(/_/g, ' ') : 'Section'}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="toggle-container">
                        <span>Inline Redline Mode</span>
                        <label className="switch">
                            <input 
                                type="checkbox" 
                                checked={inlineMode} 
                                onChange={() => setInlineMode(!inlineMode)} 
                            />
                            <span className="slider"></span>
                        </label>
                    </div>
                </div>
            </div>

            {inlineMode ? (
                <div className="redline-content">
                    <div className="redline-panel">
                        <div className="panel-title">Inline Diff</div>
                        <div className="panel-box">
                            {renderInlineDiff(currentClause.rawText, currentClause.rewritten_text)}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="redline-content">
                    <div className="redline-panel">
                        <div className="panel-title">CURRENT DRAFT</div>
                        <div className="panel-box">
                            {currentClause.rawText}
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>
                        →
                    </div>
                    <div className="redline-panel">
                        <div className="panel-title ai">AI RECOMMENDATION</div>
                        <div className="panel-box ai-box">
                            {currentClause.rewritten_text}
                        </div>
                    </div>
                </div>
            )}

            {/* Feedback UI */}
            {feedbackState.status === 'submitted' ? (
                <div className="feedback-success">
                    ✅ Thank you for your feedback! This helps improve LexGuard's legal models.
                </div>
            ) : (
                <div className="feedback-container">
                    <p className="feedback-question">Is this rewrite legally sound and fair?</p>
                    <div className="feedback-buttons">
                        <button className="feedback-btn approve" onClick={() => submitFeedback(true)}>
                            👍 Approve
                        </button>
                        <button className="feedback-btn reject" onClick={() => setFeedbackState({ ...feedbackState, isRejecting: !feedbackState.isRejecting })}>
                            👎 Reject
                        </button>
                    </div>
                    {feedbackState.isRejecting && (
                        <div className="reject-comment-box">
                            <textarea 
                                placeholder="What's wrong with this rewrite? (Optional)"
                                value={feedbackState.comment}
                                onChange={(e) => setFeedbackState({ ...feedbackState, comment: e.target.value })}
                            />
                            <button className="submit-feedback-btn" onClick={() => submitFeedback(false)}>Submit Feedback</button>
                        </div>
                    )}
                </div>
            )}

            <div className="redline-footer">
                <div className="risk-level-display">
                    <span className="risk-label">Risk Level</span>
                    <span className={`risk-value ${currentClause.risk_level}`}>
                        {currentClause.risk_level ? currentClause.risk_level.charAt(0).toUpperCase() + currentClause.risk_level.slice(1) : 'Unknown'}
                    </span>
                </div>
                <button 
                    className="download-btn" 
                    onClick={handleDownload}
                    disabled={isDownloading}
                >
                    {isDownloading ? 'Generating...' : 'Download Cleaned .docx'}
                </button>
            </div>
        </div>
    );
}
