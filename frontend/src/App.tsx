import { useState, useEffect } from 'react';
import './App.css';
import ChatWidget from './ChatWidget';
import WorkReport from './pages/WorkReport';
import SalaryReport from './pages/SalaryReport';
import StockBanner from './components/StockBanner';

type Page = 'home' | 'work' | 'salary';

export default function App() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>('home');

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navigate = (page: Page) => {
    setCurrentPage(page);
    setShowMenu(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="app">
      {/* 헤더 */}
      <header className={`header ${isScrolled ? 'hidden' : ''}`}>
        <div className="header-content">
          <button className="menu-btn" onClick={() => setShowMenu(!showMenu)}>
            ≡
          </button>
          <div className="logo">
            <span className="logo-icon" onClick={() => navigate('home')}>
              <img src="https://avatars.githubusercontent.com/u/96821067?v=4" alt="Chat❓Chat❗" />
            </span>
          </div>
          <div className="header-spacer"></div>
          <StockBanner />
        </div>
      </header>

      {/* 메뉴 드롭다운 */}
      {showMenu && (
        <div className="menu-dropdown">
          <ul>
            <li><a href="#home" onClick={() => navigate('home')}>홈</a></li>
            <li><a href="#about" onClick={() => setShowMenu(false)}>소개</a></li>
            <li><a href="#contact" onClick={() => setShowMenu(false)}>연락</a></li>
            <li>
              <a href="#work" onClick={e => { e.preventDefault(); navigate('work'); }}>
                💼 업무일지
              </a>
            </li>
            <li>
              <a href="#salary" onClick={e => { e.preventDefault(); navigate('salary'); }}>
                📅 급여명세서
              </a>
            </li>
          </ul>
        </div>
      )}

      {/* 메인 콘텐츠 */}
      <main className="main-content">
        {currentPage === 'home' && <div className="home-placeholder" />}
        {currentPage === 'work' && <WorkReport />}
        {currentPage === 'salary' && <SalaryReport />}
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
            onClick={() => navigate('home')}
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
