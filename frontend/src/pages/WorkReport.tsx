import React, { useState, useEffect } from 'react';
import { marked } from 'marked';
import './WorkReport.css';

interface Work {
  id: string;
  category: string;
  title: string;
  content: string;
  progress: number;
  exStartDate: string;
  exEndDate: string;
  startDate: string;
  endDate: string;
  createDate: string;
  updateDate: string;
  status: number;
  expected: number;
}

interface ModalForm {
  id: string;
  category: string;
  exStartDate: string;
  exEndDate: string;
  startDate: string;
  endDate: string;
  title: string;
  content: string;
  progress: number;
  status: number;
  mmType: 'MD' | 'MM';
}

const CATEGORIES = ['문의','점검','환경설정','장애조치','개발','테스트','회의','교육','인수인계','보고','출장','기타'];

function calcExpected(startStr: string, endStr: string): number {
  if (!startStr || !endStr) return 0;
  const today = new Date();
  const start = new Date(startStr);
  const end = new Date(endStr);
  start.setHours(9, 0, 0, 0);
  end.setHours(18, 0, 0, 0);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  if (today < start) return -1;
  if (today >= end) return 100;
  const total = end.getTime() - start.getTime();
  const current = today.getTime() - start.getTime();
  return Math.min(Math.round((current / total) * 100), 100);
}

function formatDate(dateStr: string, type: 'd' | 'dt'): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  let result = `${y}-${mo}-${d}`;
  if (type === 'dt') {
    const h = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    result += ` ${h}:${mi}:${s}`;
  }
  return result;
}

function toDateInput(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  return date.toISOString().substring(0, 10);
}

function calcMM(startDate: string, endDate: string, type: 'MD' | 'MM'): string {
  if (!startDate || !endDate) return '-';
  const sdate = new Date(startDate);
  const edate = new Date(endDate);
  const diffMs = Math.abs(edate.getTime() - sdate.getTime());
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
  return type === 'MD' ? String(diffDays) : (diffDays / 30).toFixed(1);
}

const defaultForm: ModalForm = {
  id: '', category: '', exStartDate: '', exEndDate: '',
  startDate: '', endDate: '', title: '', content: '',
  progress: 0, status: 0, mmType: 'MD',
};

const WorkReport: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'work' | 'check'>('work');

  // 검색 필터
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchCategory, setSearchCategory] = useState('전체');
  const [searchStatus, setSearchStatus] = useState('0');
  const [keyword, setKeyword] = useState('');

  // 목록
  const [logs, setLogs] = useState<Work[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageLimit, setPageLimit] = useState<number>(() => {
    const s = localStorage.getItem('workPageLimit');
    return s ? parseInt(s) : 15;
  });

  // 로딩
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');

  // 모달
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'view' | 'edit' | 'create'>('view');
  const [showToggleRows, setShowToggleRows] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [form, setForm] = useState<ModalForm>(defaultForm);

  // 계산된 값
  const [expectedProgress, setExpectedProgress] = useState(0);
  const [statusText, setStatusText] = useState('-');
  const [mmValue, setMmValue] = useState('-');
  const [previewHtml, setPreviewHtml] = useState('');

  // 진척율/상태 재계산
  useEffect(() => {
    const sd = form.startDate || form.exStartDate;
    const ed = form.endDate || form.exEndDate;
    const exp = calcExpected(sd, ed);
    setExpectedProgress(exp === -1 ? 0 : exp);
    const prog = form.progress;
    if (form.status !== 0) {
      setStatusText('❌ 삭제');
    } else if (prog === 100) {
      setStatusText('✅ 완료');
    } else if (exp === -1) {
      setStatusText('🤙 예정');
    } else if (prog < exp) {
      setStatusText('🚨 지연');
    } else {
      setStatusText('▶️ 진행중');
    }
    setMmValue(calcMM(sd, ed, form.mmType));
  }, [form.startDate, form.endDate, form.exStartDate, form.exEndDate, form.progress, form.status, form.mmType]);

  // 마크다운 미리보기
  useEffect(() => {
    setPreviewHtml(marked.parse(form.content || '*내용이 없습니다.*') as string);
  }, [form.content]);

  const fetchLogs = async (page: number) => {
    if ((startDate && !endDate) || (!startDate && endDate)) {
      alert('시작/종료일을 모두 입력해주세요.');
      return;
    }
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      alert('시작일이 종료일보다 작을 수 없습니다.');
      return;
    }
    setLoading(true);
    setLoadingMsg('데이터를 불러오는 중 입니다. 잠시만 기다려 주세요.');
    try {
      const payload = { status: searchStatus, startDate, endDate, category: searchCategory, keyword, page, limit: pageLimit };
      const res = await fetch('/api/work/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setTotal(data.total ?? 0);
      setLogs(data.list ?? []);
      setCurrentPage(page);
    } catch {
      alert('데이터를 불러오는 데 실패했습니다. 관리자에게 문의하세요.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, []);

  // 상세 모달
  const openDetailModal = async (id: string) => {
    setLoading(true);
    setLoadingMsg('데이터를 불러오는 중 입니다. 잠시만 기다려 주세요.');
    try {
      const res = await fetch('/api/work/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!data || !data[0]) { alert('데이터를 찾을 수 없습니다.'); return; }
      const w: Work = data[0];
      setForm({
        id: w.id,
        category: w.category,
        exStartDate: toDateInput(w.exStartDate),
        exEndDate: toDateInput(w.exEndDate),
        startDate: toDateInput(w.startDate),
        endDate: toDateInput(w.endDate),
        title: w.title,
        content: w.content,
        progress: w.progress,
        status: w.status,
        mmType: 'MM',
      });
      setModalMode('view');
      setShowToggleRows(true);
      setShowPreview(false);
      setShowModal(true);
    } catch {
      alert('데이터를 불러오는 데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 신규 등록 모달
  const openWriteModal = () => {
    const today = new Date().toISOString().substring(0, 10);
    setForm({ ...defaultForm, exStartDate: today, exEndDate: today });
    setModalMode('create');
    setShowToggleRows(false);
    setShowPreview(false);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setShowPreview(false);
  };

  const saveWorkLog = async (mode: 'save' | 'update') => {
    if (!form.title) { alert('업무 일지 제목을 입력해주세요.'); return; }
    if (!form.content) { alert('업무 일지 내용을 입력해주세요.'); return; }
    if (!confirm('작성한 업무 일지를 저장할까요?')) return;

    const uri = mode === 'save' ? 'create' : 'update';
    const payload = {
      id: form.id, category: form.category, exStartDate: form.exStartDate,
      exEndDate: form.exEndDate, title: form.title, content: form.content,
      startDate: form.startDate, endDate: form.endDate, progress: form.progress,
    };
    setLoading(true);
    setLoadingMsg('업무 일지를 저장하는 중입니다. 잠시만 기다려 주세요.');
    try {
      const res = await fetch('/api/work/' + uri, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      alert(data.message);
    } catch {
      alert('업무 일지 저장에 실패하였습니다. 관리자에게 문의해주세요.');
    } finally {
      setLoading(false);
    }
    closeModal();
    fetchLogs(currentPage);
  };

  const deleteWorkLog = async () => {
    if (!confirm('작성한 업무 일지를 삭제할까요?')) return;
    setLoading(true);
    setLoadingMsg('업무 일지를 삭제하는 중입니다. 잠시만 기다려 주세요.');
    try {
      const res = await fetch('/api/work/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: form.id }),
      });
      const data = await res.json();
      alert(data.message);
    } catch {
      alert('업무 일지 삭제에 실패하였습니다. 관리자에게 문의해주세요.');
    } finally {
      setLoading(false);
    }
    closeModal();
    fetchLogs(currentPage);
  };

  // 상태 배지
  const StatusBadge: React.FC<{ work: Work }> = ({ work }) => {
    if (work.status !== 0) return <span className="status-badge bg-red">삭제</span>;
    const { expected, progress } = work;
    if (expected === -1) return <span className="status-badge bg-yellow">예정</span>;
    if (progress === 100) return <span className="status-badge bg-green">완료</span>;
    if (progress < expected) return <span className="status-badge bg-red">지연</span>;
    return <span className="status-badge bg-blue">진행</span>;
  };

  // 페이지 계산
  const totalPages = Math.ceil(total / pageLimit);
  const startPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const endPage = Math.min(totalPages, startPage + 4);

  // 모달 풋터
  const renderModalFooter = () => {
    if (modalMode === 'create') {
      return <button onClick={() => saveWorkLog('save')}>저장하기</button>;
    }
    if (modalMode === 'edit') {
      return (
        <>
          <button className="wr-secondary" onClick={closeModal}>취소</button>
          <button onClick={() => saveWorkLog('update')}>수정완료</button>
        </>
      );
    }
    return (
      <>
        {form.status === 0 && (
          <>
            <button className="wr-secondary" onClick={() => setModalMode('edit')}>수정하기</button>
            <button className="wr-secondary" style={{ background: '#e74c3c' }} onClick={deleteWorkLog}>삭제</button>
          </>
        )}
        <button className="wr-secondary" onClick={closeModal}>닫기</button>
      </>
    );
  };

  return (
    <div className="work-report">
      {loading && (
        <div className="wr-loading-overlay">
          <div className="wr-spinner" />
          <div className="wr-loading-text">{loadingMsg}</div>
        </div>
      )}

      <h2>💼 업무 일지</h2>

      <div className="wr-tab-container">
        <button className={`wr-tab-btn${activeTab === 'work' ? ' active' : ''}`} onClick={() => setActiveTab('work')}>업무 내역</button>
        <button className={`wr-tab-btn${activeTab === 'check' ? ' active' : ''}`} onClick={() => setActiveTab('check')}>점검 일지</button>
      </div>

      {activeTab === 'work' && (
        <div>
          {/* 검색 조건 */}
          <div className="wr-controls">
            <div className="wr-form-group">
              <label>시작일</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="wr-form-group">
              <label>종료일</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div className="wr-form-group">
              <label>카테고리</label>
              <select value={searchCategory} onChange={e => setSearchCategory(e.target.value)}>
                <option value="전체">전체</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="wr-form-group">
              <label>상태</label>
              <select value={searchStatus} onChange={e => setSearchStatus(e.target.value)}>
                <option value="">전체</option>
                <option value="0">등록</option>
                <option value="1">삭제</option>
                <option value="2">진행</option>
                <option value="3">예정</option>
                <option value="4">지연</option>
                <option value="5">완료</option>
              </select>
            </div>
            <div className="wr-form-group">
              <label>키워드 검색</label>
              <input type="text" value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="제목 검색"
                onKeyDown={e => { if (e.key === 'Enter') { setCurrentPage(1); fetchLogs(1); }}} />
            </div>
            <button onClick={() => { setCurrentPage(1); fetchLogs(1); }}>조회</button>
            <button className="wr-secondary" onClick={() => {
              setStartDate(''); setEndDate(''); setSearchCategory('전체'); setSearchStatus('0'); setKeyword('');
            }}>초기화</button>
            <button className="wr-success" style={{ marginLeft: 'auto' }} onClick={openWriteModal}>
              <span style={{ fontSize: 18, marginRight: 5 }}>+</span> 신규 등록
            </button>
          </div>

          {/* 테이블 상단 */}
          <div className="wr-table-controls">
            <span>총 {total}건</span>
            <div>
              <label style={{ fontSize: 14 }}>보기: </label>
              <select value={pageLimit} style={{ padding: '5px', borderRadius: 4, border: '1px solid #ddd' }}
                onChange={e => {
                  const l = parseInt(e.target.value);
                  setPageLimit(l);
                  localStorage.setItem('workPageLimit', String(l));
                  setCurrentPage(1);
                  setTimeout(() => fetchLogs(1), 0);
                }}>
                <option value="10">10개씩</option>
                <option value="15">15개씩</option>
                <option value="30">30개씩</option>
                <option value="50">50개씩</option>
              </select>
            </div>
          </div>

          {/* 테이블 */}
          <div className="wr-table-wrapper">
            <table className="wr-table">
              <thead>
                <tr>
                  <th style={{ width: 50 }}>#</th>
                  <th style={{ width: 110 }}>시작일</th>
                  <th style={{ width: 110 }}>종료일</th>
                  <th style={{ width: 90 }}>카테고리</th>
                  <th>업무 제목</th>
                  <th style={{ width: 100 }}>예상 진척</th>
                  <th style={{ width: 100 }}>실제 진척</th>
                  <th style={{ width: 90 }}>진행상태</th>
                  <th style={{ width: 180 }}>등록일</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan={9} className="wr-nodata">조회된 업무 일지가 없습니다. 🙃</td></tr>
                ) : logs.map((item, idx) => (
                  <tr key={item.id} onClick={() => openDetailModal(item.id)} style={{ cursor: 'pointer' }}>
                    <td className="wr-tc">{total - ((currentPage - 1) * pageLimit) - idx}</td>
                    <td className="wr-tc">{formatDate(item.startDate, 'd')}</td>
                    <td className="wr-tc">{formatDate(item.endDate, 'd')}</td>
                    <td className="wr-tc">{item.category}</td>
                    <td style={{ fontWeight: 500 }}>{item.title}</td>
                    <td className="wr-tc" style={{ color: '#666' }}>{item.expected === -1 ? 0 : item.expected}%</td>
                    <td className="wr-tc" style={{ fontWeight: 'bold' }}>{item.progress}%</td>
                    <td className="wr-tc"><StatusBadge work={item} /></td>
                    <td className="wr-tc">{formatDate(item.createDate, 'dt')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="wr-pagination">
              <button className="wr-page-btn" disabled={currentPage === 1} onClick={() => fetchLogs(currentPage - 1)}>&lt;</button>
              {Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map(p => (
                <button key={p} className={`wr-page-btn${p === currentPage ? ' active' : ''}`} onClick={() => fetchLogs(p)}>{p}</button>
              ))}
              <button className="wr-page-btn" disabled={currentPage === totalPages} onClick={() => fetchLogs(currentPage + 1)}>&gt;</button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'check' && <div style={{ padding: 20, color: '#666' }}>점검 일지 기능은 준비 중입니다.</div>}

      {/* 모달 */}
      {showModal && (
        <div className="wr-modal">
          <div className="wr-modal-content">
            <div className="wr-modal-header">
              <h3>{modalMode === 'create' ? '업무 등록' : modalMode === 'edit' ? '업무 내용 수정' : '업무 상세 내역'}</h3>
              <button className="wr-close-btn" onClick={closeModal}>&times;</button>
            </div>
            <div className={`wr-modal-body${modalMode === 'view' ? ' view-mode' : ''}`}>

              {/* 진척율/공수 + 실제 시작/종료일 (상세/수정 모드에서만 표시) */}
              {showToggleRows && (
                <>
                  <div className="wr-modal-calculate">
                    <div className="wr-progress-section">
                      <div className="wr-progress-info">
                        <span>예상 진척율 (기간 대비)</span>
                        <span>{expectedProgress}%</span>
                      </div>
                      <div className="wr-progress-info">
                        <span>실제 진척율 (직접 입력)</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          {modalMode !== 'view' ? (
                            <input type="number" min={0} max={100} style={{ width: 70, padding: 5 }} className="editable"
                              value={form.progress}
                              onChange={e => {
                                let v = parseInt(e.target.value) || 0;
                                if (v > 100) v = 100;
                                setForm(f => ({ ...f, progress: v }));
                              }} />
                          ) : null}
                          <span style={{ fontWeight: 'bold' }}>{modalMode === 'view' ? form.progress : ''}%</span>
                        </div>
                      </div>
                      <div className="wr-progress-info">
                        <span>진행 상태</span>
                        <span className={statusText.includes('지연') || statusText.includes('삭제') ? 'wr-warning' : ''}>{statusText}</span>
                      </div>
                    </div>
                    <div className="wr-mm-section">
                      <div className="wr-progress-info">
                        <label>공수</label>
                        <span>{mmValue}</span>
                      </div>
                      <div className="wr-progress-info">
                        <label>공수유형</label>
                        <select value={form.mmType} onChange={e => setForm(f => ({ ...f, mmType: e.target.value as 'MD' | 'MM' }))}>
                          <option value="MD">MD</option>
                          <option value="MM">MM</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="wr-form-row">
                    <div className="wr-form-group">
                      <label>시작일</label>
                      <input type="date" value={form.startDate} className="editable"
                        onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
                    </div>
                    <div className="wr-form-group">
                      <label>종료일</label>
                      <input type="date" value={form.endDate} className="editable"
                        onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
                    </div>
                  </div>
                </>
              )}

              {/* 유형/예정일 */}
              <div className="wr-form-row">
                <div className="wr-form-group">
                  <label>유형</label>
                  <select value={form.category} className="editable"
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    <option value="">선택</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="wr-form-group">
                  <label>시작예정일</label>
                  <input type="date" value={form.exStartDate} className="editable"
                    onChange={e => setForm(f => ({ ...f, exStartDate: e.target.value }))} />
                </div>
                <div className="wr-form-group">
                  <label>종료예정일</label>
                  <input type="date" value={form.exEndDate} className="editable"
                    onChange={e => setForm(f => ({ ...f, exEndDate: e.target.value }))} />
                </div>
              </div>

              {/* 제목 */}
              <div className="wr-form-group" style={{ marginBottom: 15 }}>
                <label>제목</label>
                <input type="text" value={form.title} className="editable"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>

              {/* 마크다운 에디터 */}
              <div className="wr-editor-toolbar">
                <label>업무 상세</label>
                {modalMode !== 'view' && (
                  <button type="button" className={`wr-preview-btn${showPreview ? ' active' : ''}`}
                    onClick={() => setShowPreview(!showPreview)}>
                    {showPreview ? '미리보기 끄기' : '미리보기 켜기'}
                  </button>
                )}
              </div>

              <div className={`wr-editor-container${showPreview ? ' split-view' : ''}`}>
                {modalMode !== 'view' && (
                  <div className="wr-editor-box">
                    <textarea value={form.content} placeholder="마크다운 형식으로 내용을 작성하세요."
                      onChange={e => setForm(f => ({ ...f, content: e.target.value }))} />
                  </div>
                )}
                <div className="wr-preview-box">
                  <div className="wr-preview-content wr-markdown" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                </div>
              </div>
            </div>
            <div className="wr-modal-footer">
              {renderModalFooter()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkReport;
