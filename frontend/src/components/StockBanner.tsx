import { useState, useEffect, useCallback, useRef } from 'react';
import './StockBanner.css';

interface StockItem {
  code: string;
  name: string;
  market: string; // "KOSPI"|"KOSDAQ" / "overseas:NAS" 등
}

interface PriceData {
  price: string;
  change: string;
  rate: string;
  sign: string;
}

interface SearchResult {
  pdno: string;
  prdt_name: string;
  market?: string;
}

const KIS_EXCHANGE_NAMES: Record<string, string> = {
  NAS: 'NASDAQ', NYS: 'NYSE', AMS: 'AMEX',
  TSE: '도쿄', HKS: '홍콩', SHS: '상해', SZS: '심천',
};

function marketDisplay(market: string): string {
  if (!market) return '';
  const code = market.startsWith('overseas:') ? market.split(':')[1] : market;
  return KIS_EXCHANGE_NAMES[code] ?? code;
}

const STORAGE_KEY = 'watchlist_stocks';
const POLL_MS = 30000;

function formatPrice(price: string): string {
  const n = parseInt(price, 10);
  return isNaN(n) ? price : n.toLocaleString('ko-KR');
}

function signClass(sign: string): string {
  if (sign === '1' || sign === '2') return 'sb-up';
  if (sign === '4' || sign === '5') return 'sb-down';
  return 'sb-flat';
}

function signArrow(sign: string): string {
  if (sign === '1' || sign === '2') return '▲';
  if (sign === '4' || sign === '5') return '▼';
  return '━';
}

export default function StockBanner() {
  const [minimized, setMinimized] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [stocks, setStocks] = useState<StockItem[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  });
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stocks));
  }, [stocks]);

  const fetchPrices = useCallback(async () => {
    if (stocks.length === 0) return;
    const updates: Record<string, PriceData> = {};
    await Promise.all(stocks.map(async s => {
      try {
        const res = await fetch('/api/stock/price', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: s.code, market: s.market || '' }),
        });
        const data = await res.json();
        if (data.output) {
          const o = data.output;
          updates[s.code] = {
            // 국내: stck_prpr / prdy_vrss / prdy_ctrt / prdy_vrss_sign
            // 해외: last / diff / rate / sign
            price:  o.stck_prpr || o.last  || '-',
            change: o.prdy_vrss || o.diff  || '0',
            rate:   o.prdy_ctrt || o.rate  || '0.00',
            sign:   o.prdy_vrss_sign || o.sign || '3',
          };
        }
      } catch { /* ignore per-stock errors */ }
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
    if (!query.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch('/api/stock/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: query.trim() }),
        });
        const data = await res.json();
        if (Array.isArray(data.output) && data.output.length > 0) {
          setResults(data.output);
        } else {
          setResults([]);
        }
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 500);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const addStock = (r: SearchResult) => {
    if (!stocks.find(s => s.code === r.pdno)) {
      setStocks(prev => [...prev, { code: r.pdno, name: r.prdt_name, market: r.market ?? '' }]);
    }
    setQuery('');
    setResults([]);
  };

  const removeStock = (code: string) => {
    setStocks(prev => prev.filter(s => s.code !== code));
    setPrices(prev => { const n = { ...prev }; delete n[code]; return n; });
  };

  if (minimized) {
    return (
      <button className="sb-icon-btn" onClick={() => setMinimized(false)} title="주가 보기">
        📈
      </button>
    );
  }

  return (
    <>
      <div className="sb-banner">
        {stocks.length === 0 ? (
          <span className="sb-empty" onClick={() => setShowModal(true)}>
            선택된 종목이 없습니다.
          </span>
        ) : (
          <div className="sb-stocks">
            {stocks.map(s => {
              const p = prices[s.code];
              const cls = p ? signClass(p.sign) : '';
              return (
                <div key={s.code} className={`sb-stock-item ${cls}`} onClick={() => setShowModal(true)}>
                  <span className="sb-name">{s.name}</span>
                  <span className="sb-price">{p ? formatPrice(p.price) : '─'}</span>
                  {p && (
                    <span className="sb-rate">
                      {signArrow(p.sign)}{Math.abs(parseFloat(p.rate)).toFixed(2)}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="sb-controls">
          <button className="sb-ctrl-btn" onClick={() => setShowModal(true)} title="종목 설정">⚙</button>
          <button className="sb-ctrl-btn" onClick={() => setMinimized(true)} title="최소화">━</button>
        </div>
      </div>

      {showModal && (
        <div className="sb-overlay" onClick={() => setShowModal(false)}>
          <div className="sb-modal" onClick={e => e.stopPropagation()}>

            <div className="sb-modal-header">
              <h3>📈 종목 설정</h3>
              <button className="sb-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div className="sb-modal-body">
              {/* 좌: 검색 */}
              <div className="sb-col-left">
                <div className="sb-search-wrap">
                  <input
                    type="text"
                    className="sb-search-input"
                    placeholder="종목코드·이름 (005930, 삼성, AAPL, Apple)"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    autoFocus
                  />
                  {searching && <span className="sb-hint">검색 중...</span>}
                </div>
                <div className="sb-results">
                  {!query.trim() && (
                    <p className="sb-hint-msg">국내: 종목코드·한글명<br />해외: 티커·영문명 입력</p>
                  )}
                  {query.trim() && !searching && results.length === 0 && (
                    <p className="sb-hint-msg">검색 결과가 없습니다.</p>
                  )}
                  {results.map(r => (
                    <div key={`${r.pdno}-${r.market}`} className="sb-result-row" onClick={() => addStock(r)}>
                      <span className="sb-result-name">{r.prdt_name}</span>
                      <span className="sb-result-code">
                        {r.market && <span className="sb-result-market">[{marketDisplay(r.market)}]</span>}
                        {r.pdno}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 우: 선택 목록 */}
              <div className="sb-col-right">
                <div className="sb-col-title">선택 종목 ({stocks.length})</div>
                <div className="sb-selected">
                  {stocks.length === 0 ? (
                    <p className="sb-hint-msg">선택된 종목이 없습니다.</p>
                  ) : stocks.map(s => (
                    <div key={s.code} className="sb-selected-row">
                      <span className="sb-selected-name">{s.name}</span>
                      <span className="sb-selected-code">{s.code}</span>
                      <button className="sb-remove" onClick={() => removeStock(s.code)}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
