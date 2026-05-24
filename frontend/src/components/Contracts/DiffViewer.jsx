import React from 'react';
import * as diff from 'diff';

export default function DiffViewer({ oldText, newText }) {
  if (!oldText || !newText) {
    return <span>{newText || oldText}</span>;
  }

  // Generate diff
  const diffs = diff.diffWords(oldText, newText);

  return (
    <div className="diff-viewer" style={{ lineHeight: '1.6', fontFamily: 'Courier, monospace', fontSize: '0.95rem' }}>
      {diffs.map((part, index) => {
        if (part.added) {
          return (
            <ins 
              key={index} 
              style={{ 
                backgroundColor: 'rgba(16, 185, 129, 0.15)', 
                color: '#065f46', 
                textDecoration: 'none',
                fontWeight: 'bold',
                padding: '0 2px',
                borderRadius: '2px'
              }}
            >
              {part.value}
            </ins>
          );
        }
        if (part.removed) {
          return (
            <del 
              key={index} 
              style={{ 
                backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                color: '#991b1b',
                textDecoration: 'line-through',
                padding: '0 2px',
                borderRadius: '2px',
                opacity: 0.7
              }}
            >
              {part.value}
            </del>
          );
        }
        return <span key={index} style={{ color: 'var(--text-secondary)' }}>{part.value}</span>;
      })}
    </div>
  );
}
