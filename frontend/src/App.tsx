import React, { useState, useEffect } from 'react';
import './App.css';
import ChatWidget from './ChatWidget';

interface MenuItem {
  name: string;
  icon: string;
  action: 'link' | 'newWindow' | 'mail';
  href?: string;
}

const MENU_ITEMS: MenuItem[] = [
  { name: 'about',      icon: 'mdi-account-question-outline', action: 'link',      href: '#about' },
  { name: 'dlog',       icon: 'mdi-math-log',                 action: 'newWindow', href: 'https://rasz60.github.io/sixt' },
  { name: 'github',     icon: 'mdi-github',                   action: 'newWindow', href: 'https://github.com/rasz60' },
  { name: 'send email', icon: 'mdi-email-fast-outline',        action: 'mail' },
];

function AlphaText({ text }: { text: string }) {
  return (
    <span className="alpha-text">
      {text.split('').map((char, i) =>
        char === ' '
          ? <span key={i} className="alpha-space" />
          : <span key={i} className={`mdi mdi-alpha-${char}`} />
      )}
    </span>
  );
}

export default function App() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showMailDialog, setShowMailDialog] = useState(false);
  const [mailForm, setMailForm] = useState({ name: '', email: '', message: '' });

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleMenuItemClick = (item: MenuItem) => {
    if (item.action === 'newWindow' && item.href) {
      const w = window.open('about:blank');
      if (w) w.location.href = item.href;
    } else if (item.action === 'link' && item.href) {
      const el = document.querySelector(item.href);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else if (item.action === 'mail') {
      setShowMailDialog(true);
    }
    setShowMenu(false);
  };

  const handleMailSend = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(`Contact from ${mailForm.name}`);
    const body = encodeURIComponent(`${mailForm.message}\n\n${mailForm.email}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    setShowMailDialog(false);
    setMailForm({ name: '', email: '', message: '' });
  };

  return (
    <div className="app">
      {/* 헤더 - 원본 그대로 */}
      <header className={`header ${isScrolled ? 'hidden' : ''}`}>
        <div className="header-content">
          <button className="menu-btn" onClick={() => setShowMenu(!showMenu)}>
            ≡
          </button>
          <div className="logo">
            <span className="logo-icon" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <img src="https://avatars.githubusercontent.com/u/96821067?v=4" alt="Chat❓Chat❗" />
            </span>
          </div>
          <div className="header-spacer"></div>
        </div>
      </header>

      {/* 메뉴 드롭다운 */}
      {showMenu && (
        <div className="menu-dropdown" onClick={() => setShowMenu(false)}>
          <div className="menu-list" onClick={(e) => e.stopPropagation()}>
            {MENU_ITEMS.map((item) => (
              <div
                key={item.name}
                className="menu-item"
                onClick={() => handleMenuItemClick(item)}
              >
                <button className={`mdi ${item.icon} menu-icon-btn`} />
                <AlphaText text={item.name} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 메인 콘텐츠 */}
      <main className="main-content">
      </main>

      {/* 스크롤 시 나타나는 플로팅 버튼 - 원본 그대로 */}
      {isScrolled && (
        <>
          <button
            className="floating-btn menu-floating"
            onClick={() => setShowMenu(!showMenu)}
            title="메뉴"
          >
            ≡
          </button>
          <button
            className="floating-btn home-floating"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            title="홈으로"
          >
            🏠
          </button>
          <button
            className="floating-btn top-floating"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            title="최상위로"
          >
            ↑
          </button>
        </>
      )}

      {/* 이메일 다이얼로그 */}
      {showMailDialog && (
        <div className="dialog-overlay" onClick={() => setShowMailDialog(false)}>
          <div className="dialog-panel" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <span className="mdi mdi-email-fast-outline dialog-header-icon" />
              <span>Send Email</span>
              <button className="dialog-close" onClick={() => setShowMailDialog(false)}>
                <span className="mdi mdi-close" />
              </button>
            </div>
            <form onSubmit={handleMailSend} className="mail-form">
              <input
                type="text"
                placeholder="이름"
                value={mailForm.name}
                onChange={(e) => setMailForm({ ...mailForm, name: e.target.value })}
                required
              />
              <input
                type="email"
                placeholder="이메일"
                value={mailForm.email}
                onChange={(e) => setMailForm({ ...mailForm, email: e.target.value })}
                required
              />
              <textarea
                placeholder="메시지"
                value={mailForm.message}
                onChange={(e) => setMailForm({ ...mailForm, message: e.target.value })}
                required
                rows={5}
              />
              <div className="mail-form-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowMailDialog(false)}>취소</button>
                <button type="submit" className="btn-send">전송</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 챗봇 위젯 */}
      <ChatWidget />
    </div>
  );
}
