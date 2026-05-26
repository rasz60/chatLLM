import { useState, useEffect, useCallback, useRef } from 'react';
import './StockBanner.css';
import { useAuth } from '../contexts/AuthContext';

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

const POLL_MS = 1000;

function marketDisplay(market: string): string {
  if (!market) return '';
  const code = market.startsWith('overseas:') ? market.split(':')[1] : market;
  return KIS_EXCHANGE_NAMES[code] ?? code;
}

function formatPrice(price: string): string {
  const n = parseFloat(price);
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

function computeDisplay(p: PriceData, refPrice?: number): { rate: string; sign: string } {
  if (refPrice && refPrice > 0) {
    const current = parseFloat(p.price);
    if (!isNaN(current) && current > 0) {
      const pct = (current - refPrice) / refPrice * 100;
      const sign = pct > 0.005 ? '2' : pct < -0.005 ? '5' : '3';
      return { rate: Math.abs(pct).toFixed(2), sign };
    }
  }
  return { rate: p.rate, sign: p.sign };
}

export default function StockBanner() {
  const { authFetch } = useAuth();
  const [minimized, setMinimized] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [refPrices, setRefPrices] = useState<Record<string, number>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // 관심종목 초기 로드
  useEffect(() => {
    authFetch('/api/stock/watchlist')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.stocks)) setStocks(d.stocks); })
      .catch(() => {});
  }, [authFetch]);

  // 기준가 초기 로드
  useEffect(() => {
    authFetch('/api/stock/refprice')
      .then(r => r.json())
      .then(d => { if (d.data) setRefPrices(d.data); })
      .catch(() => {});
  }, [authFetch]);

  // 배너 슬라이드: 3초마다 다음 종목으로 전환
  useEffect(() => {
    setCurrentIndex(0);
  }, [stocks.length]);

  useEffect(() => {
    if (stocks.length <= 1) return;
    const id = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % stocks.length);
    }, 3000);
    return () => clearInterval(id);
  }, [stocks.length]);

  // 가격 1초 갱신
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

  // 종목 검색 디바운스
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
        setResults(Array.isArray(data.output) && data.output.length > 0 ? data.output : []);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 500);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const addStock = (r: SearchResult) => {
    if (stocks.find(s => s.code === r.pdno)) { setQuery(''); setResults([]); return; }
    const item: StockItem = { code: r.pdno, name: r.prdt_name, market: r.market ?? '' };
    setStocks(prev => [...prev, item]);
    authFetch('/api/stock/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    }).catch(() => {});
    setQuery('');
    setResults([]);
  };

  const removeStock = (code: string) => {
    setStocks(prev => prev.filter(s => s.code !== code));
    setPrices(prev => { const n = { ...prev }; delete n[code]; return n; });
    authFetch('/api/stock/watchlist', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    }).catch(() => {});
    authFetch('/api/stock/refprice', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    }).catch(() => {});
    setRefPrices(prev => { const n = { ...prev }; delete n[code]; return n; });
  };

  const handleRefPriceChange = (code: string, value: string) => {
    if (value === '') {
      authFetch('/api/stock/refprice', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      }).catch(() => {});
      setRefPrices(prev => { const n = { ...prev }; delete n[code]; return n; });
    } else {
      const price = parseFloat(value);
      if (isNaN(price) || price <= 0) return;
      authFetch('/api/stock/refprice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, ref_price: price }),
      }).catch(() => {});
      setRefPrices(prev => ({ ...prev, [code]: price }));
    }
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
        ) : (() => {
          const s = stocks[currentIndex] ?? stocks[0];
          const p = prices[s.code];
          const disp = p ? computeDisplay(p, refPrices[s.code]) : null;
          const cls = disp ? signClass(disp.sign) : '';
          return (
            <div className="sb-stocks">
              <div key={currentIndex} className={`sb-stock-item sb-stock-slide ${cls}`} onClick={() => setShowModal(true)}>
                <span className="sb-name">{s.name}</span>
                <span className="sb-price">{p ? formatPrice(p.price) : '─'}</span>
                {disp && (
                  <span className="sb-rate">
                    {refPrices[s.code] && <span className="sb-ref-dot" title="기준가 설정됨">●</span>}
                    {signArrow(disp.sign)}{parseFloat(disp.rate).toFixed(2)}%
                  </span>
                )}
              </div>
            </div>
          );
        })()}

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
                    placeholder="종목명·코드 (삼성전자, 005930, Apple, AAPL)"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    autoFocus
                  />
                  {searching && <span className="sb-hint">검색 중...</span>}
                </div>
                <div className="sb-results">
                  {!query.trim() && (
                    <p className="sb-hint-msg">국내: 종목명·코드 (삼성전자, 005930)<br />해외: 티커·영문명 (AAPL, Apple)</p>
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
                      <div className="sb-selected-top">
                        <span className="sb-selected-name">{s.name}</span>
                        <button className="sb-remove" onClick={() => removeStock(s.code)}>✕</button>
                      </div>
                      <div className="sb-selected-bottom">
                        <span className="sb-selected-code">{s.code}</span>
                        <div className="sb-ref-wrap">
                          <span className="sb-ref-label">기준가</span>
                          <input
                            type="number"
                            className="sb-ref-input"
                            placeholder="전날 종가"
                            value={refPrices[s.code] ?? ''}
                            min={0}
                            onChange={e => handleRefPriceChange(s.code, e.target.value)}
                          />
                        </div>
                      </div>
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
