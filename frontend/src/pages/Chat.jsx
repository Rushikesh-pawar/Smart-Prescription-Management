import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/client.js';

const SUGGESTED_QUESTIONS = [
  'How many patients have I seen this month?',
  'Which patients are on Cetirizine?',
  'Show me everyone diagnosed with allergies',
  'What\'s the BMI distribution across my patients?',
  'List my 5 most recent prescriptions',
];

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function send(text) {
    const userMessage = { role: 'user', content: text };
    const next = [...messages, userMessage];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const { data } = await api.post('/chat', { messages: next });
      setMessages([...next, data.message]);
    } catch (err) {
      const msg = err.response?.data?.error || 'Chat failed';
      const fallback = err.response?.data?.message;
      if (fallback) {
        setMessages([...next, fallback]);
      } else {
        toast.error(msg);
        setMessages(next.slice(0, -1));
        setInput(text);
      }
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    send(input.trim());
  }

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      <div>
        <h1 className="text-2xl font-semibold">Practice assistant</h1>
        <p className="text-sm text-slate-500">
          Ask natural-language questions about your patients and prescriptions. Powered
          by Claude with tool-use over your MongoDB.
        </p>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto mt-4 space-y-3 rounded-lg border border-slate-200 bg-white p-4"
      >
        {messages.length === 0 && !loading && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Try one of these:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => send(q)}
                  className="text-xs rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 hover:bg-brand-50 hover:border-brand-200"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} content={m.content} />
        ))}
        {loading && <Bubble role="assistant" content="…thinking" loading />}
      </div>

      <form onSubmit={onSubmit} className="mt-3 flex gap-2">
        <input
          className="input flex-1"
          placeholder="Ask about your patients…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="btn-primary"
        >
          Send
        </button>
      </form>
    </div>
  );
}

function Bubble({ role, content, loading }) {
  const isUser = role === 'user';
  const text = typeof content === 'string' ? content : JSON.stringify(content);
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
          isUser
            ? 'bg-brand-600 text-white'
            : loading
              ? 'bg-slate-100 text-slate-400 italic'
              : 'bg-slate-100 text-slate-900'
        }`}
      >
        {text}
      </div>
    </div>
  );
}
