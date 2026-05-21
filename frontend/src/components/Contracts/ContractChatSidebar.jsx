import { useState, useRef, useEffect } from 'react';
import { chatWithContract } from '../../api/lexguardClient';
import './ContractChatSidebar.css';

export default function ContractChatSidebar({ contractId }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hi! I am LexGuard Chat. You can ask me any questions about this contract.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (overrideText = null) => {
    const textToSend = typeof overrideText === 'string' ? overrideText : input;
    if (!textToSend.trim()) return;

    setMessages(prev => [...prev, { role: 'user', text: textToSend.trim() }]);
    setInput('');
    setLoading(true);

    try {
      const { reply } = await chatWithContract(contractId, textToSend.trim());
      setMessages(prev => [...prev, { role: 'assistant', text: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: '⚠️ Error: ' + err.message }]);
    } finally {
      setLoading(false);
    }
  };

  const shortcodes = [
    '🔍 Analyze Notice Period',
    '🛡️ Check Indemnification Caps',
    '🏛️ Verify IP Ownership'
  ];

  return (
    <div className="chat-sidebar glass-card">
      <div className="chat-header">
        <h3>💬 Chat with Contract (Agent 5)</h3>
      </div>
      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`chat-bubble ${m.role}`}>
            {m.text}
          </div>
        ))}
        {loading && (
          <div className="chat-bubble assistant loading">
            <span className="dot"></span><span className="dot"></span><span className="dot"></span>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="chat-shortcodes">
        {shortcodes.map((sc, i) => (
          <button 
            key={i} 
            className="chat-shortcode-chip"
            onClick={() => handleSend(sc)}
            disabled={loading}
          >
            {sc}
          </button>
        ))}
      </div>
      <div className="chat-input-area">
        <input 
          type="text" 
          placeholder="Ask a question..." 
          value={input} 
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
        />
        <button onClick={() => handleSend()} disabled={loading || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
