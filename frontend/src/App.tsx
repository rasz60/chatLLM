import { useState, useEffect } from 'react';
import './App.css';
import ChatWidget from './ChatWidget';
import WorkReport from './pages/WorkReport';
import SalaryReport from './pages/SalaryReport';
import StockBanner from './components/StockBanner';

type Page = 'home' | 'work' | 'salary';

interface MenuItem {
  name: string;
  icon: string;
  action: 'navigate' | 'link' | 'newWindow';
  page?: Page;
  href?: string;
}

const MENU_ITEMS: MenuItem[] = [
  { name: '홈',       icon: 'mdi-home-outline',              action: 'navigate', page: 'home' },
  { name: '소개',     icon: 'mdi-account-question-outline',   action: 'link',     href: '#about' },
  { name: '연락',     icon: 'mdi-email-fast-outline',         action: 'link',     href: '#contact' },
  { name: '업무일지', icon: 'mdi-briefcase-outline',           action: 'navigate', page: 'work' },
  { name: '급여명세서',icon: 'mdi-calendar-month-outline',     action: 'navigate', page: 'salary' },
];

export default function App() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>('home');

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const closeMenu = () => setShowMenu(false);

  const navigate = (page: Page) => {
    setCurrentPage(page);
    closeMenu();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleMenuItemClick = (item: MenuItem) => {
    if (item.action === 'navigate' && item.page) {
      navigate(item.page);
    } else if (item.action === 'link' && item.href) {
      const el = document.querySelector(item.href);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      closeMenu();
    } else if (item.action === 'newWindow' && item.href) {
      const w = window.open('about:blank');
      if (w) w.location.href = item.href;
      closeMenu();
    }
  };

  return (
    <div className="app">
      {/* 헤더: 메뉴가 열려 있으면 스크롤과 무관하게 표시 */}
      <header className={`header ${isScrolled && !showMenu ? 'hidden' : ''}`}>
        <div className="header-content">
          <button className="menu-btn" onClick={() => setShowMenu(prev => !prev)}>
            ≡
          </button>
          <div className="logo">
            <span className="logo-icon" onClick={() => navigate('home')}>
              <img src="https://avatars.githubusercontent.com/u/96821067?v=4" alt="Chat❓Chat❗" />
            </span>
          </div>
          <StockBanner />
        </div>
      </header>

      {/* 메뉴 backdrop + 드롭다운 */}
      {showMenu && (
        <>
          <div className="menu-backdrop" onClick={closeMenu} />
          <div className="menu-dropdown">
            <ul className="menu-list">
              {MENU_ITEMS.map((item, i) => (
                <li key={i} className="menu-item" onClick={() => handleMenuItemClick(item)}>
                  <span className={`menu-icon-btn mdi ${item.icon}`} />
                  <span className="alpha-text">{item.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* 메인 콘텐츠 */}
      <main className="main-content">
        {currentPage === 'home' && <div className="home-placeholder" />}
        {currentPage === 'work' && <WorkReport />}
        {currentPage === 'salary' && <SalaryReport />}
      </main>

      {/* 스크롤 시 나타나는 플로팅 버튼 (z-index > backdrop) */}
      {isScrolled && (
        <>
          <button
            className="floating-btn menu-floating"
            onClick={() => setShowMenu(prev => !prev)}
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
            onClick={() => { closeMenu(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
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
