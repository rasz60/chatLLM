import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './ChatWidget.css';

interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
}

const ChatWidget = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 텍스트에어 높이 자동 조절
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  // Shift+Enter: 줄바꿈, Enter: 전송
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await axios.post('/api/chat', {
        message: userMessage.content,
        chat_history: messages.map((m) => ({
          role: m.type === 'user' ? 'user' : 'assistant',
          content: m.content,
        })),
        session_id: sessionId ?? '',
      });

      // 첫 응답에서 session_id 저장
      if (!sessionId && response.data.session_id) {
        setSessionId(response.data.session_id);
      }

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: response.data.response,
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error('API Error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: '오류가 발생했습니다. 다시 시도해주세요.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-widget-wrapper">
      {isMinimized && loading && (
        <div className="minimized-loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      )}
      <div className={`chat-widget ${isMinimized ? 'minimized' : ''}`}>
      <div
        className="chat-header"
        onClick={() => !isMinimized && setIsMinimized(true)}
        style={!isMinimized ? { cursor: 'pointer' } : {}}
      >
        <div className="chat-header-content">
          <div
            className="chat-logo"
            onClick={(e) => { if (isMinimized) { e.stopPropagation(); setIsMinimized(false); } }}
            style={isMinimized ? { cursor: 'pointer' } : {}}
          >
            <span className="logo-icon">🤖</span>
            <span className="logo-text">{isMinimized ? '' : 'Chat❓Chat❗'}</span>
          </div>
          <div className="chat-header-buttons">
            <button
              className="header-btn minimize-btn"
              onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
              title={isMinimized ? '최대화' : '최소화'}
            >
              {isMinimized ? '▲' : '▼'}
            </button>
          </div>
        </div>
      </div>

      {!isMinimized && (
        <>
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="chat-empty">
                <p>안녕하세요! 무엇을 도와드릴까요?</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`message ${msg.type}`}>
                  <div className="message-bubble">{msg.content}</div>
                </div>
              ))
            )}
            {loading && (
              <div className="message bot">
                <div className="message-bubble loading">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-area">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="메시지 입력... (Shift+Enter: 줄바꿈)"
              disabled={loading}
              rows={1}
            />
            <button onClick={handleSend} disabled={loading || !input.trim()}>
              {loading ? '...' : '전송'}
            </button>
          </div>
        </>
      )}
      </div>
    </div>
  );
};

export default ChatWidget;
