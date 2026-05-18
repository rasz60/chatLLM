import React, { useState, useEffect } from 'react';
import './SalaryReport.css';

interface SalaryGroup {
  [groupName: string]: { [key: string]: string };
}

type RawData = { [year: string]: string[] };

const SalaryReport: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'view' | 'upload'>('view');

  // 파일 목록
  const [rawData, setRawData] = useState<RawData>({});
  const [yearOptions, setYearOptions] = useState<string[]>([]);
  const [monthOptions, setMonthOptions] = useState<string[]>([]);

  // 조회 폼
  const [selectedYear, setSelectedYear] = useState('0');
  const [selectedMonth, setSelectedMonth] = useState('0');
  const [password, setPassword] = useState('');
  const [viewArea, setViewArea] = useState<{ type: 'img' | 'sum' | 'none'; content: string; data: SalaryGroup[] }>({
    type: 'none', content: '', data: [],
  });

  // 업로드 폼
  const [uploadFile, setUploadFile] = useState<File | null>(null);
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
      .then((data: RawData) => {
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
  const openStatement = async (type: 'sum' | 'img') => {
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
        } else {
          setViewArea({ type: 'sum', content: '', data: data.data || [] });
        }
      } else {
        alert('명세서 열기에 실패했습니다. 비밀번호를 확인하세요.');
      }
    } catch {
      alert('명세서를 여는 데 실패했습니다. 관리자에게 문의하세요.');
    } finally {
      setLoading(false);
    }
  };

  // 파일 업로드
  const handleFileUpload = async (overwrite = false) => {
    if (!uploadFile) { alert('파일을 업로드해주세요.'); return; }
    if (!uploadPassword) { alert('비밀번호를 입력해주세요.'); return; }

    setLoading(true);
    setLoadingMsg('명세서를 저장하는 중입니다. 잠시만 기다려 주세요.');

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('password', uploadPassword);
    if (overwrite) formData.append('overwrite', 'true');

    try {
      const res = await fetch('/api/salary/upload_check', { method: 'POST', body: formData });
      const result = await res.json();

      if (result.status === 'exists') {
        setLoading(false);
        if (confirm('이미 해당 날짜의 명세서가 존재합니다. 덮어씌우시겠습니까?')) {
          await handleFileUpload(true);
          return;
        } else {
          alert('업로드가 취소되었습니다.');
        }
      } else if (result.status === 'success') {
        alert('파일이 저장되었습니다.');
        // 목록 갱신
        const listRes = await fetch('/api/salary/get_list');
        const listData: RawData = await listRes.json();
        setRawData(listData);
        setYearOptions(Object.keys(listData).sort().reverse());
        setUploadFile(null);
        setUploadPassword('');
      } else {
        alert(result.msg || '저장에 실패하였습니다.');
      }
    } catch {
      alert('명세서 업로드에 실패하였습니다. 관리자에게 문의하세요.');
    } finally {
      setLoading(false);
    }
  };

  // 간략보기 테이블 렌더링
  const renderSummaryTable = (data: SalaryGroup[]) => {
    return (
      <table className="sr-sum-table">
        <tbody>
          {data.map((item, gi) => {
            const groupName = Object.keys(item)[0];
            const groupData = item[groupName] as { [k: string]: string };
            const pairs = Object.entries(groupData).map(([k, v]) => ({ key: k, val: v && v.trim() !== '' ? v : '-' }));
            const rows: JSX.Element[] = [];
            rows.push(
              <tr key={`g-${gi}`} className="sr-row-group">
                <th colSpan={6}>{groupName}</th>
              </tr>
            );
            if (pairs.length === 0) {
              rows.push(
                <tr key={`empty-${gi}`} className="sr-row-nodata">
                  <td colSpan={6}>내역이 없습니다.</td>
                </tr>
              );
            } else {
              for (let i = 0; i < pairs.length; i += 6) {
                const chunk = pairs.slice(i, i + 6);
                rows.push(
                  <tr key={`k-${gi}-${i}`} className="sr-row-key">
                    {Array.from({ length: 6 }, (_, j) => (
                      <th key={j}>{chunk[j]?.key ?? ''}</th>
                    ))}
                  </tr>
                );
                rows.push(
                  <tr key={`v-${gi}-${i}`} className="sr-row-value">
                    {Array.from({ length: 6 }, (_, j) => (
                      <td key={j}>{chunk[j]?.val ?? ''}</td>
                    ))}
                  </tr>
                );
              }
            }
            return <React.Fragment key={gi}>{rows}</React.Fragment>;
          })}
        </tbody>
      </table>
    );
  };

  return (
    <div className="salary-report">
      {loading && (
        <div className="sr-loading-overlay">
          <div className="sr-spinner" />
          <div className="sr-loading-text">{loadingMsg}</div>
        </div>
      )}

      <div className="sr-tab-container">
        <button className={`sr-tab-btn${activeTab === 'view' ? ' active' : ''}`} onClick={() => setActiveTab('view')}>명세서 조회</button>
        <button className={`sr-tab-btn${activeTab === 'upload' ? ' active' : ''}`} onClick={() => setActiveTab('upload')}>명세서 등록</button>
      </div>

      {/* 명세서 조회 탭 */}
      {activeTab === 'view' && (
        <div>
          <h2>📅 급여명세서 간편 조회</h2>
          <div className="sr-controls">
            <select className="sr-date-select" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
              <option value="0">선택</option>
              {yearOptions.map(y => <option key={y} value={y}>{y}년</option>)}
            </select>
            <select className="sr-date-select" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
              <option value="0">선택</option>
              {monthOptions.map(m => <option key={m} value={m}>{m}월</option>)}
            </select>
            <input
              type="password" placeholder="생년월일 6자리" value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') openStatement('sum'); }}
            />
            <button onClick={() => openStatement('sum')}>간략조회</button>
            <button onClick={() => openStatement('img')}>전체조회</button>
          </div>

          <div className={`sr-view-area${viewArea.type === 'img' ? ' img' : viewArea.type === 'sum' ? ' sum' : ''}`}>
            {viewArea.type === 'none' && (
              <div className="sr-placeholder">조회 조건을 선택하고 조회 버튼을 눌러주세요.</div>
            )}
            {viewArea.type === 'img' && (
              <img src={`data:image/png;base64,${viewArea.content}`} style={{ width: '80%', height: 'auto' }} alt="급여명세서" />
            )}
            {viewArea.type === 'sum' && renderSummaryTable(viewArea.data)}
          </div>
        </div>
      )}

      {/* 명세서 등록 탭 */}
      {activeTab === 'upload' && (
        <div>
          <h2>🪄 급여명세서 파일 업로드</h2>
          <div className="sr-controls">
            <div className="sr-form-group">
              <input
                type="file" accept=".html"
                onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="sr-form-group">
              <label>명세서 비밀번호 입력</label>
              <input
                type="password" placeholder="생년월일 6자리" value={uploadPassword}
                onChange={e => setUploadPassword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleFileUpload(); }}
              />
            </div>
            <button onClick={() => handleFileUpload()}>저장</button>
          </div>
          <p className="sr-notice">※ 파일을 업로드하면 자동으로 날짜를 분석하여 저장합니다.</p>
        </div>
      )}
    </div>
  );
};

export default SalaryReport;
