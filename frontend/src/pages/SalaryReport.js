import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState, useEffect } from 'react';
import './SalaryReport.css';
const SalaryReport = () => {
    const [activeTab, setActiveTab] = useState('view');
    // 파일 목록
    const [rawData, setRawData] = useState({});
    const [yearOptions, setYearOptions] = useState([]);
    const [monthOptions, setMonthOptions] = useState([]);
    // 조회 폼
    const [selectedYear, setSelectedYear] = useState('0');
    const [selectedMonth, setSelectedMonth] = useState('0');
    const [password, setPassword] = useState('');
    const [viewArea, setViewArea] = useState({
        type: 'none', content: '', data: [],
    });
    // 업로드 폼
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadPassword, setUploadPassword] = useState('');
    // 로딩
    const [loading, setLoading] = useState(false);
    const [loadingMsg, setLoadingMsg] = useState('');
    // 초기 파일 목록 로드
    useEffect(() => {
        setLoading(true);
        setLoadingMsg('페이지를 불러오는 중입니다. 잠시만 기다려 주세요.');
        fetch('/api/salary/get_list')
            .then(r => r.json())
            .then((data) => {
            setRawData(data);
            setYearOptions(Object.keys(data).sort().reverse());
        })
            .catch(() => alert('데이터를 불러오는 데 실패했습니다. 관리자에게 문의하세요.'))
            .finally(() => setLoading(false));
    }, []);
    // 연도 변경 시 월 옵션 업데이트
    useEffect(() => {
        if (selectedYear === '0' || !rawData[selectedYear]) {
            setMonthOptions([]);
            setSelectedMonth('0');
            return;
        }
        setMonthOptions(rawData[selectedYear]);
        setSelectedMonth('0');
    }, [selectedYear, rawData]);
    // 명세서 조회
    const openStatement = async (type) => {
        if (selectedYear === '0' || selectedMonth === '0') {
            alert('연도와 월을 선택해 주세요.');
            return;
        }
        if (!password) {
            alert('비밀번호를 입력해 주세요.');
            return;
        }
        setLoading(true);
        setLoadingMsg('명세서를 불러오는 중입니다. 잠시만 기다려 주세요.');
        try {
            const payload = { year: selectedYear, month: selectedMonth, password, viewtype: type };
            const res = await fetch('/api/salary/open_file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (data.status === 'success') {
                if (type === 'img') {
                    setViewArea({ type: 'img', content: data.screenshot, data: [] });
                }
                else {
                    setViewArea({ type: 'sum', content: '', data: data.data || [] });
                }
            }
            else {
                alert('명세서 열기에 실패했습니다. 비밀번호를 확인하세요.');
            }
        }
        catch {
            alert('명세서를 여는 데 실패했습니다. 관리자에게 문의하세요.');
        }
        finally {
            setLoading(false);
        }
    };
    // 파일 업로드
    const handleFileUpload = async (overwrite = false) => {
        if (!uploadFile) {
            alert('파일을 업로드해주세요.');
            return;
        }
        if (!uploadPassword) {
            alert('비밀번호를 입력해주세요.');
            return;
        }
        setLoading(true);
        setLoadingMsg('명세서를 저장하는 중입니다. 잠시만 기다려 주세요.');
        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('password', uploadPassword);
        if (overwrite)
            formData.append('overwrite', 'true');
        try {
            const res = await fetch('/api/salary/upload_check', { method: 'POST', body: formData });
            const result = await res.json();
            if (result.status === 'exists') {
                setLoading(false);
                if (confirm('이미 해당 날짜의 명세서가 존재합니다. 덮어씌우시겠습니까?')) {
                    await handleFileUpload(true);
                    return;
                }
                else {
                    alert('업로드가 취소되었습니다.');
                }
            }
            else if (result.status === 'success') {
                alert('파일이 저장되었습니다.');
                // 목록 갱신
                const listRes = await fetch('/api/salary/get_list');
                const listData = await listRes.json();
                setRawData(listData);
                setYearOptions(Object.keys(listData).sort().reverse());
                setUploadFile(null);
                setUploadPassword('');
            }
            else {
                alert(result.msg || '저장에 실패하였습니다.');
            }
        }
        catch {
            alert('명세서 업로드에 실패하였습니다. 관리자에게 문의하세요.');
        }
        finally {
            setLoading(false);
        }
    };
    // 간략보기 테이블 렌더링
    const renderSummaryTable = (data) => {
        return (_jsx("table", { className: "sr-sum-table", children: _jsx("tbody", { children: data.map((item, gi) => {
                    const groupName = Object.keys(item)[0];
                    const groupData = item[groupName];
                    const pairs = Object.entries(groupData).map(([k, v]) => ({ key: k, val: v && v.trim() !== '' ? v : '-' }));
                    const rows = [];
                    rows.push(_jsx("tr", { className: "sr-row-group", children: _jsx("th", { colSpan: 6, children: groupName }) }, `g-${gi}`));
                    if (pairs.length === 0) {
                        rows.push(_jsx("tr", { className: "sr-row-nodata", children: _jsx("td", { colSpan: 6, children: "\uB0B4\uC5ED\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." }) }, `empty-${gi}`));
                    }
                    else {
                        for (let i = 0; i < pairs.length; i += 6) {
                            const chunk = pairs.slice(i, i + 6);
                            rows.push(_jsx("tr", { className: "sr-row-key", children: Array.from({ length: 6 }, (_, j) => (_jsx("th", { children: chunk[j]?.key ?? '' }, j))) }, `k-${gi}-${i}`));
                            rows.push(_jsx("tr", { className: "sr-row-value", children: Array.from({ length: 6 }, (_, j) => (_jsx("td", { children: chunk[j]?.val ?? '' }, j))) }, `v-${gi}-${i}`));
                        }
                    }
                    return _jsx(React.Fragment, { children: rows }, gi);
                }) }) }));
    };
    return (_jsxs("div", { className: "salary-report", children: [loading && (_jsxs("div", { className: "sr-loading-overlay", children: [_jsx("div", { className: "sr-spinner" }), _jsx("div", { className: "sr-loading-text", children: loadingMsg })] })), _jsxs("div", { className: "sr-tab-container", children: [_jsx("button", { className: `sr-tab-btn${activeTab === 'view' ? ' active' : ''}`, onClick: () => setActiveTab('view'), children: "\uBA85\uC138\uC11C \uC870\uD68C" }), _jsx("button", { className: `sr-tab-btn${activeTab === 'upload' ? ' active' : ''}`, onClick: () => setActiveTab('upload'), children: "\uBA85\uC138\uC11C \uB4F1\uB85D" })] }), activeTab === 'view' && (_jsxs("div", { children: [_jsx("h2", { children: "\uD83D\uDCC5 \uAE09\uC5EC\uBA85\uC138\uC11C \uAC04\uD3B8 \uC870\uD68C" }), _jsxs("div", { className: "sr-controls", children: [_jsxs("select", { className: "sr-date-select", value: selectedYear, onChange: e => setSelectedYear(e.target.value), children: [_jsx("option", { value: "0", children: "\uC120\uD0DD" }), yearOptions.map(y => _jsxs("option", { value: y, children: [y, "\uB144"] }, y))] }), _jsxs("select", { className: "sr-date-select", value: selectedMonth, onChange: e => setSelectedMonth(e.target.value), children: [_jsx("option", { value: "0", children: "\uC120\uD0DD" }), monthOptions.map(m => _jsxs("option", { value: m, children: [m, "\uC6D4"] }, m))] }), _jsx("input", { type: "password", placeholder: "\uC0DD\uB144\uC6D4\uC77C 6\uC790\uB9AC", value: password, onChange: e => setPassword(e.target.value), onKeyDown: e => { if (e.key === 'Enter')
                                    openStatement('sum'); } }), _jsx("button", { onClick: () => openStatement('sum'), children: "\uAC04\uB7B5\uC870\uD68C" }), _jsx("button", { onClick: () => openStatement('img'), children: "\uC804\uCCB4\uC870\uD68C" })] }), _jsxs("div", { className: `sr-view-area${viewArea.type === 'img' ? ' img' : viewArea.type === 'sum' ? ' sum' : ''}`, children: [viewArea.type === 'none' && (_jsx("div", { className: "sr-placeholder", children: "\uC870\uD68C \uC870\uAC74\uC744 \uC120\uD0DD\uD558\uACE0 \uC870\uD68C \uBC84\uD2BC\uC744 \uB20C\uB7EC\uC8FC\uC138\uC694." })), viewArea.type === 'img' && (_jsx("img", { src: `data:image/png;base64,${viewArea.content}`, style: { width: '80%', height: 'auto' }, alt: "\uAE09\uC5EC\uBA85\uC138\uC11C" })), viewArea.type === 'sum' && renderSummaryTable(viewArea.data)] })] })), activeTab === 'upload' && (_jsxs("div", { children: [_jsx("h2", { children: "\uD83E\uDE84 \uAE09\uC5EC\uBA85\uC138\uC11C \uD30C\uC77C \uC5C5\uB85C\uB4DC" }), _jsxs("div", { className: "sr-controls", children: [_jsx("div", { className: "sr-form-group", children: _jsx("input", { type: "file", accept: ".html", onChange: e => setUploadFile(e.target.files?.[0] ?? null) }) }), _jsxs("div", { className: "sr-form-group", children: [_jsx("label", { children: "\uBA85\uC138\uC11C \uBE44\uBC00\uBC88\uD638 \uC785\uB825" }), _jsx("input", { type: "password", placeholder: "\uC0DD\uB144\uC6D4\uC77C 6\uC790\uB9AC", value: uploadPassword, onChange: e => setUploadPassword(e.target.value), onKeyDown: e => { if (e.key === 'Enter')
                                            handleFileUpload(); } })] }), _jsx("button", { onClick: () => handleFileUpload(), children: "\uC800\uC7A5" })] }), _jsx("p", { className: "sr-notice", children: "\u203B \uD30C\uC77C\uC744 \uC5C5\uB85C\uB4DC\uD558\uBA74 \uC790\uB3D9\uC73C\uB85C \uB0A0\uC9DC\uB97C \uBD84\uC11D\uD558\uC5EC \uC800\uC7A5\uD569\uB2C8\uB2E4." })] }))] }));
};
export default SalaryReport;
