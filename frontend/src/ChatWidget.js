import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './ChatWidget.css';
export default function ChatWidget() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [isMinimized, setIsMinimized] = useState(true);
    const [sessionId, setSessionId] = useState(null);
    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);
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
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };
    const handleSend = async () => {
        if (!input.trim() || loading)
            return;
        const userMessage = {
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
            const botMessage = {
                id: (Date.now() + 1).toString(),
                type: 'bot',
                content: response.data.response,
            };
            setMessages((prev) => [...prev, botMessage]);
        }
        catch (error) {
            console.error('API Error:', error);
            const errorMessage = {
                id: (Date.now() + 1).toString(),
                type: 'bot',
                content: '오류가 발생했습니다. 다시 시도해주세요.',
            };
            setMessages((prev) => [...prev, errorMessage]);
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsxs("div", { className: "chat-widget-wrapper", children: [isMinimized && loading && (_jsxs("div", { className: "minimized-loading-dots", children: [_jsx("span", {}), _jsx("span", {}), _jsx("span", {})] })), _jsxs("div", { className: `chat-widget ${isMinimized ? 'minimized' : ''}`, children: [_jsx("div", { className: "chat-header", onClick: () => !isMinimized && setIsMinimized(true), style: !isMinimized ? { cursor: 'pointer' } : {}, children: _jsxs("div", { className: "chat-header-content", children: [_jsxs("div", { className: "chat-logo", onClick: (e) => { if (isMinimized) {
                                        e.stopPropagation();
                                        setIsMinimized(false);
                                    } }, style: isMinimized ? { cursor: 'pointer' } : {}, children: [_jsx("span", { className: "logo-icon", children: "\uD83E\uDD16" }), _jsx("span", { className: "logo-text", children: isMinimized ? '' : 'Chat❓Chat❗' })] }), _jsx("div", { className: "chat-header-buttons", children: _jsx("button", { className: "header-btn minimize-btn", onClick: (e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }, title: isMinimized ? '최대화' : '최소화', children: isMinimized ? '▲' : '▼' }) })] }) }), !isMinimized && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "chat-messages", children: [messages.length === 0 ? (_jsx("div", { className: "chat-empty", children: _jsx("p", { children: "\uC548\uB155\uD558\uC138\uC694! \uBB34\uC5C7\uC744 \uB3C4\uC640\uB4DC\uB9B4\uAE4C\uC694?" }) })) : (messages.map((msg) => (_jsx("div", { className: `message ${msg.type}`, children: _jsx("div", { className: "message-bubble", children: msg.content }) }, msg.id)))), loading && (_jsx("div", { className: "message bot", children: _jsxs("div", { className: "message-bubble loading", children: [_jsx("span", {}), _jsx("span", {}), _jsx("span", {})] }) })), _jsx("div", { ref: messagesEndRef })] }), _jsxs("div", { className: "chat-input-area", children: [_jsx("textarea", { ref: textareaRef, value: input, onChange: (e) => setInput(e.target.value), onKeyDown: handleKeyDown, placeholder: "\uBA54\uC2DC\uC9C0 \uC785\uB825... (Shift+Enter: \uC904\uBC14\uAFC8)", disabled: loading, rows: 1 }), _jsx("button", { onClick: handleSend, disabled: loading || !input.trim(), children: loading ? '...' : '전송' })] })] }))] })] }));
}
