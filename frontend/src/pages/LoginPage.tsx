import { useState, FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './LoginPage.css';

// ── Validation (백엔드와 동일 기준) ──────────────────────────────
const RE_USERNAME = /^[a-zA-Z0-9][a-zA-Z0-9_-]{4,19}$/;
const RE_EMAIL    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_PHONE    = /^01[0-9]-\d{3,4}-\d{4}$/;

function validateUsername(v: string): string {
  if (v.length < 5)  return '5자 이상 입력하세요.';
  if (v.length > 20) return '20자 이하로 입력하세요.';
  if (!RE_USERNAME.test(v)) return '영문/숫자로 시작, 영문·숫자·밑줄(_)·하이픈(-) 만 사용 가능합니다.';
  return '';
}
function validatePassword(v: string): string {
  if (v.length < 8)         return '8자 이상 입력하세요.';
  if (v.length > 30)        return '30자 이하로 입력하세요.';
  if (!/[a-zA-Z]/.test(v)) return '영문(a-z, A-Z)을 포함해야 합니다.';
  if (!/[0-9]/.test(v))    return '숫자(0-9)를 포함해야 합니다.';
  return '';
}
function validateEmail(v: string): string {
  return RE_EMAIL.test(v) ? '' : '올바른 이메일 형식이 아닙니다.';
}
function validatePhone(v: string): string {
  return RE_PHONE.test(v) ? '' : '형식에 맞게 입력하세요. (예: 010-1234-5678)';
}

// ── Password strength hints ───────────────────────────────────────
function PwHints({ value }: { value: string }) {
  const checks = [
    { label: '8자 이상',  ok: value.length >= 8 },
    { label: '영문 포함', ok: /[a-zA-Z]/.test(value) },
    { label: '숫자 포함', ok: /[0-9]/.test(value) },
  ];
  return (
    <div className="lp-pw-hints">
      {checks.map(c => (
        <span key={c.label} className={c.ok ? 'lp-hint-ok' : 'lp-hint-no'}>
          {c.ok ? '✓' : '○'} {c.label}
        </span>
      ))}
    </div>
  );
}

// ── Verify row (email / phone) ────────────────────────────────────
interface VerifyRowProps {
  type: 'email' | 'phone';
  value: string;
  onChange: (v: string) => void;
  verified: boolean;
  onVerified: () => void;
}

function VerifyRow({ type, value, onChange, verified, onVerified }: VerifyRowProps) {
  const [sent, setSent]           = useState(false);
  const [code, setCode]           = useState('');
  const [sending, setSending]     = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [msg, setMsg]             = useState('');

  const fieldError = value
    ? (type === 'email' ? validateEmail(value) : validatePhone(value))
    : '';

  const sendCode = async () => {
    if (fieldError) { setMsg(fieldError); return; }
    setSending(true); setMsg('');
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: value, type }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error); return; }
      setSent(true);
      setMsg('인증코드를 발송했습니다. (5분 유효)');
    } finally { setSending(false); }
  };

  const verifyCode = async () => {
    if (code.length !== 6) { setMsg('6자리 인증코드를 입력하세요.'); return; }
    setVerifying(true); setMsg('');
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: value, code }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error); return; }
      onVerified();
    } finally { setVerifying(false); }
  };

  return (
    <div className="lp-field">
      <label>
        {type === 'email' ? '이메일' : '휴대폰'}
        {verified && <span className="lp-verified-badge">✓ 인증완료</span>}
      </label>
      <div className="lp-input-row">
        <input
          type={type === 'email' ? 'email' : 'tel'}
          placeholder={type === 'email' ? 'example@email.com' : '010-1234-5678'}
          value={value}
          onChange={e => { onChange(e.target.value); setSent(false); setMsg(''); }}
          disabled={verified}
          autoComplete={type === 'email' ? 'email' : 'tel'}
        />
        {!verified && (
          <button type="button" className="lp-verify-btn" onClick={sendCode} disabled={sending || !value || !!fieldError}>
            {sending ? '발송 중...' : sent ? '재발송' : '인증발송'}
          </button>
        )}
      </div>
      {fieldError && !msg && <p className="lp-field-error">{fieldError}</p>}
      {sent && !verified && (
        <div className="lp-input-row lp-code-row">
          <input
            type="text"
            placeholder="인증코드 6자리"
            maxLength={6}
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
          />
          <button type="button" className="lp-verify-btn lp-verify-confirm" onClick={verifyCode} disabled={verifying}>
            {verifying ? '확인 중...' : '확인'}
          </button>
        </div>
      )}
      {msg && (
        <p className={`lp-field-msg ${msg.includes('발송') ? 'lp-msg-ok' : 'lp-field-error'}`}>{msg}</p>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────
export default function LoginPage() {
  const { login, register, enterGuest } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const [username, setUsername]   = useState('');
  const [password, setPassword]   = useState('');
  const [verifyMethod, setVerifyMethod] = useState<'email' | 'phone'>('email');
  const [contact, setContact]     = useState('');
  const [contactVerified, setContactVerified] = useState(false);
  const [error, setError]         = useState('');
  const [busy, setBusy]           = useState(false);

  const switchMode = (m: 'login' | 'register') => {
    setMode(m); setError('');
    setUsername(''); setPassword('');
    setContact(''); setContactVerified(false);
  };

  const switchMethod = (m: 'email' | 'phone') => {
    setVerifyMethod(m);
    setContact('');
    setContactVerified(false);
  };

  const usernameErr = mode === 'register' && username ? validateUsername(username) : '';
  const passwordErr = mode === 'register' && password ? validatePassword(password) : '';

  const registerReady =
    !validateUsername(username) &&
    !validatePassword(password) &&
    contactVerified;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(username, password);
      } else {
        const email = verifyMethod === 'email' ? contact : '';
        const phone = verifyMethod === 'phone' ? contact : '';
        await register(username, password, email, phone);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lp-overlay">
      <div className="lp-card">
        <div className="lp-logo"><span>ㅁ-ㅁ7</span></div>

        <div className="lp-tabs">
          <button className={`lp-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => switchMode('login')}>
            로그인
          </button>
          <button className={`lp-tab ${mode === 'register' ? 'active' : ''}`} onClick={() => switchMode('register')}>
            회원가입
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="lp-field">
            <label>아이디</label>
            <input
              type="text"
              placeholder="5~20자, 영문·숫자·_·-"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
            />
            {usernameErr && <p className="lp-field-error">{usernameErr}</p>}
          </div>

          <div className="lp-field">
            <label>비밀번호</label>
            <input
              type="password"
              placeholder={mode === 'register' ? '8자 이상, 영문+숫자 포함' : '비밀번호를 입력하세요'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            {passwordErr && <p className="lp-field-error">{passwordErr}</p>}
            {mode === 'register' && password && <PwHints value={password} />}
          </div>

          {mode === 'register' && (
            <>
              {/* 인증 방법 선택 */}
              <div className="lp-field">
                <label>인증 수단</label>
                <div className="lp-method-tabs">
                  <button
                    type="button"
                    className={`lp-method-tab ${verifyMethod === 'email' ? 'active' : ''}`}
                    onClick={() => switchMethod('email')}
                  >
                    📧 이메일
                  </button>
                  <button
                    type="button"
                    className={`lp-method-tab ${verifyMethod === 'phone' ? 'active' : ''}`}
                    onClick={() => switchMethod('phone')}
                  >
                    📱 휴대폰
                  </button>
                </div>
              </div>

              <VerifyRow
                type={verifyMethod}
                value={contact}
                onChange={v => { setContact(v); setContactVerified(false); }}
                verified={contactVerified}
                onVerified={() => setContactVerified(true)}
              />
            </>
          )}

          {error && <p className="lp-error">{error}</p>}

          <button
            className="lp-submit"
            type="submit"
            disabled={busy || !username || !password || (mode === 'register' && !registerReady)}
          >
            {busy ? '처리 중...' : mode === 'login' ? '로그인' : '가입하기'}
          </button>
        </form>

        <div className="lp-divider"><span>또는</span></div>
        <button className="lp-guest-btn" type="button" onClick={enterGuest}>
          둘러보기
        </button>
      </div>
    </div>
  );
}
