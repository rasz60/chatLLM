import React, { useState, useEffect } from 'react';
import './App.css';
import ChatWidget from './ChatWidget';

export default function App() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="app">
      {/* 헤더 */}
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
        <div className="menu-dropdown">
          <ul>
            <li><a href="#home">홈</a></li>
            <li><a href="#about">소개</a></li>
            <li><a href="#contact">연락</a></li>
          </ul>
        </div>
      )}

      {/* 메인 콘텐츠 */}
      <main className="main-content">
      </main>

      {/* 스크롤 시 나타나는 플로팅 버튼 */}
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

      {/* 챗봇 위젯 */}
      <ChatWidget />
    </div>
  );
}
