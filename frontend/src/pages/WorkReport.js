import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { marked } from 'marked';
import './WorkReport.css';
const CATEGORIES = ['문의', '점검', '환경설정', '장애조치', '개발', '테스트', '회의', '교육', '인수인계', '보고', '출장', '기타'];
function calcExpected(startStr, endStr) {
    if (!startStr || !endStr)
        return 0;
    const today = new Date();
    const start = new Date(startStr);
    const end = new Date(endStr);
    start.setHours(9, 0, 0, 0);
    end.setHours(18, 0, 0, 0);
    if (isNaN(start.getTime()) || isNaN(end.getTime()))
        return 0;
    if (today < start)
        return -1;
    if (today >= end)
        return 100;
    const total = end.getTime() - start.getTime();
    const current = today.getTime() - start.getTime();
    return Math.min(Math.round((current / total) * 100), 100);
}
function formatDate(dateStr, type) {
    if (!dateStr)
        return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime()))
        return '';
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
function toDateInput(dateStr) {
    if (!dateStr)
        return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime()))
        return '';
    return date.toISOString().substring(0, 10);
}
function calcMM(startDate, endDate, type) {
    if (!startDate || !endDate)
        return '-';
    const sdate = new Date(startDate);
    const edate = new Date(endDate);
    const diffMs = Math.abs(edate.getTime() - sdate.getTime());
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
    return type === 'MD' ? String(diffDays) : (diffDays / 30).toFixed(1);
}
const defaultForm = {
    id: '', category: '', exStartDate: '', exEndDate: '',
    startDate: '', endDate: '', title: '', content: '',
    progress: 0, status: 0, mmType: 'MD',
};
const WorkReport = () => {
    const [activeTab, setActiveTab] = useState('work');
    // 검색 필터
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [searchCategory, setSearchCategory] = useState('전체');
    const [searchStatus, setSearchStatus] = useState('0');
    const [keyword, setKeyword] = useState('');
    // 목록
    const [logs, setLogs] = useState([]);
    const [total, setTotal] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageLimit, setPageLimit] = useState(() => {
        const s = localStorage.getItem('workPageLimit');
        return s ? parseInt(s) : 15;
    });
    // 로딩
    const [loading, setLoading] = useState(false);
    const [loadingMsg, setLoadingMsg] = useState('');
    // 모달
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('view');
    const [showToggleRows, setShowToggleRows] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [form, setForm] = useState(defaultForm);
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
        }
        else if (prog === 100) {
            setStatusText('✅ 완료');
        }
        else if (exp === -1) {
            setStatusText('🤙 예정');
        }
        else if (prog < exp) {
            setStatusText('🚨 지연');
        }
        else {
            setStatusText('▶️ 진행중');
        }
        setMmValue(calcMM(sd, ed, form.mmType));
    }, [form.startDate, form.endDate, form.exStartDate, form.exEndDate, form.progress, form.status, form.mmType]);
    // 마크다운 미리보기
    useEffect(() => {
        setPreviewHtml(marked.parse(form.content || '*내용이 없습니다.*'));
    }, [form.content]);
    const fetchLogs = async (page) => {
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
        }
        catch {
            alert('데이터를 불러오는 데 실패했습니다. 관리자에게 문의하세요.');
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        fetchLogs(1);
    }, []);
    // 상세 모달
    const openDetailModal = async (id) => {
        setLoading(true);
        setLoadingMsg('데이터를 불러오는 중 입니다. 잠시만 기다려 주세요.');
        try {
            const res = await fetch('/api/work/read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });
            const data = await res.json();
            if (!data || !data[0]) {
                alert('데이터를 찾을 수 없습니다.');
                return;
            }
            const w = data[0];
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
        }
        catch {
            alert('데이터를 불러오는 데 실패했습니다.');
        }
        finally {
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
    const saveWorkLog = async (mode) => {
        if (!form.title) {
            alert('업무 일지 제목을 입력해주세요.');
            return;
        }
        if (!form.content) {
            alert('업무 일지 내용을 입력해주세요.');
            return;
        }
        if (!confirm('작성한 업무 일지를 저장할까요?'))
            return;
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
        }
        catch {
            alert('업무 일지 저장에 실패하였습니다. 관리자에게 문의해주세요.');
        }
        finally {
            setLoading(false);
        }
        closeModal();
        fetchLogs(currentPage);
    };
    const deleteWorkLog = async () => {
        if (!confirm('작성한 업무 일지를 삭제할까요?'))
            return;
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
        }
        catch {
            alert('업무 일지 삭제에 실패하였습니다. 관리자에게 문의해주세요.');
        }
        finally {
            setLoading(false);
        }
        closeModal();
        fetchLogs(currentPage);
    };
    // 상태 배지
    const StatusBadge = ({ work }) => {
        if (work.status !== 0)
            return _jsx("span", { className: "status-badge bg-red", children: "\uC0AD\uC81C" });
        const { expected, progress } = work;
        if (expected === -1)
            return _jsx("span", { className: "status-badge bg-yellow", children: "\uC608\uC815" });
        if (progress === 100)
            return _jsx("span", { className: "status-badge bg-green", children: "\uC644\uB8CC" });
        if (progress < expected)
            return _jsx("span", { className: "status-badge bg-red", children: "\uC9C0\uC5F0" });
        return _jsx("span", { className: "status-badge bg-blue", children: "\uC9C4\uD589" });
    };
    // 페이지 계산
    const totalPages = Math.ceil(total / pageLimit);
    const startPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
    const endPage = Math.min(totalPages, startPage + 4);
    // 모달 풋터
    const renderModalFooter = () => {
        if (modalMode === 'create') {
            return _jsx("button", { onClick: () => saveWorkLog('save'), children: "\uC800\uC7A5\uD558\uAE30" });
        }
        if (modalMode === 'edit') {
            return (_jsxs(_Fragment, { children: [_jsx("button", { className: "wr-secondary", onClick: closeModal, children: "\uCDE8\uC18C" }), _jsx("button", { onClick: () => saveWorkLog('update'), children: "\uC218\uC815\uC644\uB8CC" })] }));
        }
        return (_jsxs(_Fragment, { children: [form.status === 0 && (_jsxs(_Fragment, { children: [_jsx("button", { className: "wr-secondary", onClick: () => setModalMode('edit'), children: "\uC218\uC815\uD558\uAE30" }), _jsx("button", { className: "wr-secondary", style: { background: '#e74c3c' }, onClick: deleteWorkLog, children: "\uC0AD\uC81C" })] })), _jsx("button", { className: "wr-secondary", onClick: closeModal, children: "\uB2EB\uAE30" })] }));
    };
    return (_jsxs("div", { className: "work-report", children: [loading && (_jsxs("div", { className: "wr-loading-overlay", children: [_jsx("div", { className: "wr-spinner" }), _jsx("div", { className: "wr-loading-text", children: loadingMsg })] })), _jsx("h2", { children: "\uD83D\uDCBC \uC5C5\uBB34 \uC77C\uC9C0" }), _jsxs("div", { className: "wr-tab-container", children: [_jsx("button", { className: `wr-tab-btn${activeTab === 'work' ? ' active' : ''}`, onClick: () => setActiveTab('work'), children: "\uC5C5\uBB34 \uB0B4\uC5ED" }), _jsx("button", { className: `wr-tab-btn${activeTab === 'check' ? ' active' : ''}`, onClick: () => setActiveTab('check'), children: "\uC810\uAC80 \uC77C\uC9C0" })] }), activeTab === 'work' && (_jsxs("div", { children: [_jsxs("div", { className: "wr-controls", children: [_jsxs("div", { className: "wr-form-group", children: [_jsx("label", { children: "\uC2DC\uC791\uC77C" }), _jsx("input", { type: "date", value: startDate, onChange: e => setStartDate(e.target.value) })] }), _jsxs("div", { className: "wr-form-group", children: [_jsx("label", { children: "\uC885\uB8CC\uC77C" }), _jsx("input", { type: "date", value: endDate, onChange: e => setEndDate(e.target.value) })] }), _jsxs("div", { className: "wr-form-group", children: [_jsx("label", { children: "\uCE74\uD14C\uACE0\uB9AC" }), _jsxs("select", { value: searchCategory, onChange: e => setSearchCategory(e.target.value), children: [_jsx("option", { value: "\uC804\uCCB4", children: "\uC804\uCCB4" }), CATEGORIES.map(c => _jsx("option", { value: c, children: c }, c))] })] }), _jsxs("div", { className: "wr-form-group", children: [_jsx("label", { children: "\uC0C1\uD0DC" }), _jsxs("select", { value: searchStatus, onChange: e => setSearchStatus(e.target.value), children: [_jsx("option", { value: "", children: "\uC804\uCCB4" }), _jsx("option", { value: "0", children: "\uB4F1\uB85D" }), _jsx("option", { value: "1", children: "\uC0AD\uC81C" }), _jsx("option", { value: "2", children: "\uC9C4\uD589" }), _jsx("option", { value: "3", children: "\uC608\uC815" }), _jsx("option", { value: "4", children: "\uC9C0\uC5F0" }), _jsx("option", { value: "5", children: "\uC644\uB8CC" })] })] }), _jsxs("div", { className: "wr-form-group", children: [_jsx("label", { children: "\uD0A4\uC6CC\uB4DC \uAC80\uC0C9" }), _jsx("input", { type: "text", value: keyword, onChange: e => setKeyword(e.target.value), placeholder: "\uC81C\uBAA9 \uAC80\uC0C9", onKeyDown: e => { if (e.key === 'Enter') {
                                            setCurrentPage(1);
                                            fetchLogs(1);
                                        } } })] }), _jsx("button", { onClick: () => { setCurrentPage(1); fetchLogs(1); }, children: "\uC870\uD68C" }), _jsx("button", { className: "wr-secondary", onClick: () => {
                                    setStartDate('');
                                    setEndDate('');
                                    setSearchCategory('전체');
                                    setSearchStatus('0');
                                    setKeyword('');
                                }, children: "\uCD08\uAE30\uD654" }), _jsxs("button", { className: "wr-success", style: { marginLeft: 'auto' }, onClick: openWriteModal, children: [_jsx("span", { style: { fontSize: 18, marginRight: 5 }, children: "+" }), " \uC2E0\uADDC \uB4F1\uB85D"] })] }), _jsxs("div", { className: "wr-table-controls", children: [_jsxs("span", { children: ["\uCD1D ", total, "\uAC74"] }), _jsxs("div", { children: [_jsx("label", { style: { fontSize: 14 }, children: "\uBCF4\uAE30: " }), _jsxs("select", { value: pageLimit, style: { padding: '5px', borderRadius: 4, border: '1px solid #ddd' }, onChange: e => {
                                            const l = parseInt(e.target.value);
                                            setPageLimit(l);
                                            localStorage.setItem('workPageLimit', String(l));
                                            setCurrentPage(1);
                                            setTimeout(() => fetchLogs(1), 0);
                                        }, children: [_jsx("option", { value: "10", children: "10\uAC1C\uC529" }), _jsx("option", { value: "15", children: "15\uAC1C\uC529" }), _jsx("option", { value: "30", children: "30\uAC1C\uC529" }), _jsx("option", { value: "50", children: "50\uAC1C\uC529" })] })] })] }), _jsx("div", { className: "wr-table-wrapper", children: _jsxs("table", { className: "wr-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: { width: 50 }, children: "#" }), _jsx("th", { style: { width: 110 }, children: "\uC2DC\uC791\uC77C" }), _jsx("th", { style: { width: 110 }, children: "\uC885\uB8CC\uC77C" }), _jsx("th", { style: { width: 90 }, children: "\uCE74\uD14C\uACE0\uB9AC" }), _jsx("th", { children: "\uC5C5\uBB34 \uC81C\uBAA9" }), _jsx("th", { style: { width: 100 }, children: "\uC608\uC0C1 \uC9C4\uCC99" }), _jsx("th", { style: { width: 100 }, children: "\uC2E4\uC81C \uC9C4\uCC99" }), _jsx("th", { style: { width: 90 }, children: "\uC9C4\uD589\uC0C1\uD0DC" }), _jsx("th", { style: { width: 180 }, children: "\uB4F1\uB85D\uC77C" })] }) }), _jsx("tbody", { children: logs.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 9, className: "wr-nodata", children: "\uC870\uD68C\uB41C \uC5C5\uBB34 \uC77C\uC9C0\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uD83D\uDE43" }) })) : logs.map((item, idx) => (_jsxs("tr", { onClick: () => openDetailModal(item.id), style: { cursor: 'pointer' }, children: [_jsx("td", { className: "wr-tc", children: total - ((currentPage - 1) * pageLimit) - idx }), _jsx("td", { className: "wr-tc", children: formatDate(item.startDate, 'd') }), _jsx("td", { className: "wr-tc", children: formatDate(item.endDate, 'd') }), _jsx("td", { className: "wr-tc", children: item.category }), _jsx("td", { style: { fontWeight: 500 }, children: item.title }), _jsxs("td", { className: "wr-tc", style: { color: '#666' }, children: [item.expected === -1 ? 0 : item.expected, "%"] }), _jsxs("td", { className: "wr-tc", style: { fontWeight: 'bold' }, children: [item.progress, "%"] }), _jsx("td", { className: "wr-tc", children: _jsx(StatusBadge, { work: item }) }), _jsx("td", { className: "wr-tc", children: formatDate(item.createDate, 'dt') })] }, item.id))) })] }) }), totalPages > 1 && (_jsxs("div", { className: "wr-pagination", children: [_jsx("button", { className: "wr-page-btn", disabled: currentPage === 1, onClick: () => fetchLogs(currentPage - 1), children: "<" }), Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map(p => (_jsx("button", { className: `wr-page-btn${p === currentPage ? ' active' : ''}`, onClick: () => fetchLogs(p), children: p }, p))), _jsx("button", { className: "wr-page-btn", disabled: currentPage === totalPages, onClick: () => fetchLogs(currentPage + 1), children: ">" })] }))] })), activeTab === 'check' && _jsx("div", { style: { padding: 20, color: '#666' }, children: "\uC810\uAC80 \uC77C\uC9C0 \uAE30\uB2A5\uC740 \uC900\uBE44 \uC911\uC785\uB2C8\uB2E4." }), showModal && (_jsx("div", { className: "wr-modal", children: _jsxs("div", { className: "wr-modal-content", children: [_jsxs("div", { className: "wr-modal-header", children: [_jsx("h3", { children: modalMode === 'create' ? '업무 등록' : modalMode === 'edit' ? '업무 내용 수정' : '업무 상세 내역' }), _jsx("button", { className: "wr-close-btn", onClick: closeModal, children: "\u00D7" })] }), _jsxs("div", { className: `wr-modal-body${modalMode === 'view' ? ' view-mode' : ''}`, children: [showToggleRows && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "wr-modal-calculate", children: [_jsxs("div", { className: "wr-progress-section", children: [_jsxs("div", { className: "wr-progress-info", children: [_jsx("span", { children: "\uC608\uC0C1 \uC9C4\uCC99\uC728 (\uAE30\uAC04 \uB300\uBE44)" }), _jsxs("span", { children: [expectedProgress, "%"] })] }), _jsxs("div", { className: "wr-progress-info", children: [_jsx("span", { children: "\uC2E4\uC81C \uC9C4\uCC99\uC728 (\uC9C1\uC811 \uC785\uB825)" }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 5 }, children: [modalMode !== 'view' ? (_jsx("input", { type: "number", min: 0, max: 100, style: { width: 70, padding: 5 }, className: "editable", value: form.progress, onChange: e => {
                                                                                let v = parseInt(e.target.value) || 0;
                                                                                if (v > 100)
                                                                                    v = 100;
                                                                                setForm(f => ({ ...f, progress: v }));
                                                                            } })) : null, _jsxs("span", { style: { fontWeight: 'bold' }, children: [modalMode === 'view' ? form.progress : '', "%"] })] })] }), _jsxs("div", { className: "wr-progress-info", children: [_jsx("span", { children: "\uC9C4\uD589 \uC0C1\uD0DC" }), _jsx("span", { className: statusText.includes('지연') || statusText.includes('삭제') ? 'wr-warning' : '', children: statusText })] })] }), _jsxs("div", { className: "wr-mm-section", children: [_jsxs("div", { className: "wr-progress-info", children: [_jsx("label", { children: "\uACF5\uC218" }), _jsx("span", { children: mmValue })] }), _jsxs("div", { className: "wr-progress-info", children: [_jsx("label", { children: "\uACF5\uC218\uC720\uD615" }), _jsxs("select", { value: form.mmType, onChange: e => setForm(f => ({ ...f, mmType: e.target.value })), children: [_jsx("option", { value: "MD", children: "MD" }), _jsx("option", { value: "MM", children: "MM" })] })] })] })] }), _jsxs("div", { className: "wr-form-row", children: [_jsxs("div", { className: "wr-form-group", children: [_jsx("label", { children: "\uC2DC\uC791\uC77C" }), _jsx("input", { type: "date", value: form.startDate, className: "editable", onChange: e => setForm(f => ({ ...f, startDate: e.target.value })) })] }), _jsxs("div", { className: "wr-form-group", children: [_jsx("label", { children: "\uC885\uB8CC\uC77C" }), _jsx("input", { type: "date", value: form.endDate, className: "editable", onChange: e => setForm(f => ({ ...f, endDate: e.target.value })) })] })] })] })), _jsxs("div", { className: "wr-form-row", children: [_jsxs("div", { className: "wr-form-group", children: [_jsx("label", { children: "\uC720\uD615" }), _jsxs("select", { value: form.category, className: "editable", onChange: e => setForm(f => ({ ...f, category: e.target.value })), children: [_jsx("option", { value: "", children: "\uC120\uD0DD" }), CATEGORIES.map(c => _jsx("option", { value: c, children: c }, c))] })] }), _jsxs("div", { className: "wr-form-group", children: [_jsx("label", { children: "\uC2DC\uC791\uC608\uC815\uC77C" }), _jsx("input", { type: "date", value: form.exStartDate, className: "editable", onChange: e => setForm(f => ({ ...f, exStartDate: e.target.value })) })] }), _jsxs("div", { className: "wr-form-group", children: [_jsx("label", { children: "\uC885\uB8CC\uC608\uC815\uC77C" }), _jsx("input", { type: "date", value: form.exEndDate, className: "editable", onChange: e => setForm(f => ({ ...f, exEndDate: e.target.value })) })] })] }), _jsxs("div", { className: "wr-form-group", style: { marginBottom: 15 }, children: [_jsx("label", { children: "\uC81C\uBAA9" }), _jsx("input", { type: "text", value: form.title, className: "editable", style: { width: '100%', boxSizing: 'border-box' }, onChange: e => setForm(f => ({ ...f, title: e.target.value })) })] }), _jsxs("div", { className: "wr-editor-toolbar", children: [_jsx("label", { children: "\uC5C5\uBB34 \uC0C1\uC138" }), modalMode !== 'view' && (_jsx("button", { type: "button", className: `wr-preview-btn${showPreview ? ' active' : ''}`, onClick: () => setShowPreview(!showPreview), children: showPreview ? '미리보기 끄기' : '미리보기 켜기' }))] }), _jsxs("div", { className: `wr-editor-container${showPreview ? ' split-view' : ''}`, children: [modalMode !== 'view' && (_jsx("div", { className: "wr-editor-box", children: _jsx("textarea", { value: form.content, placeholder: "\uB9C8\uD06C\uB2E4\uC6B4 \uD615\uC2DD\uC73C\uB85C \uB0B4\uC6A9\uC744 \uC791\uC131\uD558\uC138\uC694.", onChange: e => setForm(f => ({ ...f, content: e.target.value })) }) })), _jsx("div", { className: "wr-preview-box", children: _jsx("div", { className: "wr-preview-content wr-markdown", dangerouslySetInnerHTML: { __html: previewHtml } }) })] })] }), _jsx("div", { className: "wr-modal-footer", children: renderModalFooter() })] }) }))] }));
};
export default WorkReport;
