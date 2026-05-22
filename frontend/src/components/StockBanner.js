import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback, useRef } from 'react';
import './StockBanner.css';
const STORAGE_KEY = 'watchlist_stocks';
const POLL_MS = 30000;
function formatPrice(price) {
    const n = parseInt(price, 10);
    return isNaN(n) ? price : n.toLocaleString('ko-KR');
}
function signClass(sign) {
    if (sign === '1' || sign === '2')
        return 'sb-up';
    if (sign === '4' || sign === '5')
        return 'sb-down';
    return 'sb-flat';
}
function signArrow(sign) {
    if (sign === '1' || sign === '2')
        return '▲';
    if (sign === '4' || sign === '5')
        return '▼';
    return '━';
}
export default function StockBanner() {
    const [minimized, setMinimized] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [stocks, setStocks] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        }
        catch {
            return [];
        }
    });
    const [prices, setPrices] = useState({});
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const debounceRef = useRef();
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stocks));
    }, [stocks]);
    const fetchPrices = useCallback(async () => {
        if (stocks.length === 0)
            return;
        const updates = {};
        await Promise.all(stocks.map(async (s) => {
            try {
                const res = await fetch('/api/stock/price', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: s.code }),
                });
                const data = await res.json();
                if (data.output) {
                    updates[s.code] = {
                        price: data.output.stck_prpr || '-',
                        change: data.output.prdy_vrss || '0',
                        rate: data.output.prdy_ctrt || '0.00',
                        sign: data.output.prdy_vrss_sign || '3',
                    };
                }
            }
            catch { /* ignore per-stock errors */ }
        }));
        setPrices(prev => ({ ...prev, ...updates }));
    }, [stocks]);
    useEffect(() => {
        fetchPrices();
        const id = setInterval(fetchPrices, POLL_MS);
        return () => clearInterval(id);
    }, [fetchPrices]);
    useEffect(() => {
        clearTimeout(debounceRef.current);
        if (!query.trim()) {
            setResults([]);
            return;
        }
        debounceRef.current = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await fetch('/api/stock/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: query.trim() }),
                });
                const data = await res.json();
                if (data.output?.pdno) {
                    setResults([{ pdno: data.output.pdno, prdt_name: data.output.prdt_name }]);
                }
                else {
                    setResults([]);
                }
            }
            catch {
                setResults([]);
            }
            finally {
                setSearching(false);
            }
        }, 500);
        return () => clearTimeout(debounceRef.current);
    }, [query]);
    const addStock = (r) => {
        if (!stocks.find(s => s.code === r.pdno)) {
            setStocks(prev => [...prev, { code: r.pdno, name: r.prdt_name }]);
        }
        setQuery('');
        setResults([]);
    };
    const removeStock = (code) => {
        setStocks(prev => prev.filter(s => s.code !== code));
        setPrices(prev => { const n = { ...prev }; delete n[code]; return n; });
    };
    if (minimized) {
        return (_jsx("button", { className: "sb-icon-btn", onClick: () => setMinimized(false), title: "\uC8FC\uAC00 \uBCF4\uAE30", children: "\uD83D\uDCC8" }));
    }
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "sb-banner", children: [stocks.length === 0 ? (_jsx("span", { className: "sb-empty", onClick: () => setShowModal(true), children: "\uC120\uD0DD\uB41C \uC885\uBAA9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." })) : (_jsx("div", { className: "sb-stocks", children: stocks.map(s => {
                            const p = prices[s.code];
                            const cls = p ? signClass(p.sign) : '';
                            return (_jsxs("div", { className: `sb-stock-item ${cls}`, onClick: () => setShowModal(true), children: [_jsx("span", { className: "sb-name", children: s.name }), _jsx("span", { className: "sb-price", children: p ? formatPrice(p.price) : '─' }), p && (_jsxs("span", { className: "sb-rate", children: [signArrow(p.sign), Math.abs(parseFloat(p.rate)).toFixed(2), "%"] }))] }, s.code));
                        }) })), _jsxs("div", { className: "sb-controls", children: [_jsx("button", { className: "sb-ctrl-btn", onClick: () => setShowModal(true), title: "\uC885\uBAA9 \uC124\uC815", children: "\u2699" }), _jsx("button", { className: "sb-ctrl-btn", onClick: () => setMinimized(true), title: "\uCD5C\uC18C\uD654", children: "\u2501" })] })] }), showModal && (_jsx("div", { className: "sb-overlay", onClick: () => setShowModal(false), children: _jsxs("div", { className: "sb-modal", onClick: e => e.stopPropagation(), children: [_jsxs("div", { className: "sb-modal-header", children: [_jsx("h3", { children: "\uD83D\uDCC8 \uC885\uBAA9 \uC124\uC815" }), _jsx("button", { className: "sb-close", onClick: () => setShowModal(false), children: "\u2715" })] }), _jsxs("div", { className: "sb-modal-body", children: [_jsxs("div", { className: "sb-col-left", children: [_jsxs("div", { className: "sb-search-wrap", children: [_jsx("input", { type: "text", className: "sb-search-input", placeholder: "\uC885\uBAA9\uCF54\uB4DC \uC785\uB825 (\uC608: 005930)", value: query, onChange: e => setQuery(e.target.value), autoFocus: true }), searching && _jsx("span", { className: "sb-hint", children: "\uAC80\uC0C9 \uC911..." })] }), _jsxs("div", { className: "sb-results", children: [!query.trim() && (_jsxs("p", { className: "sb-hint-msg", children: ["\uC885\uBAA9\uCF54\uB4DC 6\uC790\uB9AC\uB97C \uC785\uB825\uD558\uBA74", _jsx("br", {}), "\uC885\uBAA9 \uC815\uBCF4\uB97C \uBD88\uB7EC\uC635\uB2C8\uB2E4."] })), query.trim() && !searching && results.length === 0 && (_jsx("p", { className: "sb-hint-msg", children: "\uAC80\uC0C9 \uACB0\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4." })), results.map(r => (_jsxs("div", { className: "sb-result-row", onClick: () => addStock(r), children: [_jsx("span", { className: "sb-result-name", children: r.prdt_name }), _jsx("span", { className: "sb-result-code", children: r.pdno })] }, r.pdno)))] })] }), _jsxs("div", { className: "sb-col-right", children: [_jsxs("div", { className: "sb-col-title", children: ["\uC120\uD0DD \uC885\uBAA9 (", stocks.length, ")"] }), _jsx("div", { className: "sb-selected", children: stocks.length === 0 ? (_jsx("p", { className: "sb-hint-msg", children: "\uC120\uD0DD\uB41C \uC885\uBAA9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." })) : stocks.map(s => (_jsxs("div", { className: "sb-selected-row", children: [_jsx("span", { className: "sb-selected-name", children: s.name }), _jsx("span", { className: "sb-selected-code", children: s.code }), _jsx("button", { className: "sb-remove", onClick: () => removeStock(s.code), children: "\u2715" })] }, s.code))) })] })] })] }) }))] }));
}
