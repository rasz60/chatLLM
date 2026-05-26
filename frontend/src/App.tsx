import { useState, useEffect } from 'react';
import './App.css';
import ChatWidget from './ChatWidget';
import WorkReport from './pages/WorkReport';
import SalaryReport from './pages/SalaryReport';
import StockBanner from './components/StockBanner';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';

type Page = 'home' | 'work' | 'salary';
type RequiredRole = 'all' | 'user' | 'admin';

interface MenuItem {
  name: string;
  icon: string;
  action: 'navigate' | 'link' | 'newWindow';
  page?: Page;
  href?: string;
  requiredRole: RequiredRole;
}

const MENU_ITEMS: MenuItem[] = [
  { name: '홈',        icon: 'mdi-home-outline',            action: 'navigate', page: 'home',   requiredRole: 'all'   },
  { name: '소개',      icon: 'mdi-account-question-outline', action: 'link',     href: '#about', requiredRole: 'all'   },
  { name: '연락',      icon: 'mdi-email-fast-outline',       action: 'link',     href: '#contact', requiredRole: 'all' },
  { name: '업무일지',  icon: 'mdi-briefcase-outline',        action: 'navigate', page: 'work',   requiredRole: 'user'  },
  { name: '급여명세서', icon: 'mdi-calendar-month-outline',  action: 'navigate', page: 'salary', requiredRole: 'admin' },
];

function AppInner() {
  const { user, loading, isGuest, logout } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>('home');

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (loading) return null;
  if (!user && !isGuest) return <LoginPage />;

  const canAccess = (item: MenuItem): boolean => {
    if (item.requiredRole === 'all') return true;
    if (isGuest) return false;
    if (item.requiredRole === 'admin') return user?.role === 'admin';
    return !!user;
  };

  const closeMenu = () => setShowMenu(false);

  const navigate = (page: Page) => {
    setCurrentPage(page);
    closeMenu();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleMenuItemClick = (item: MenuItem) => {
    if (!canAccess(item)) return;
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

  const roleLabel: Record<RequiredRole, string> = {
    all: '',
    user: '(로그인 필요)',
    admin: '(관리자 전용)',
  };

  return (
    <div className="app">
      <header className={`header ${isScrolled && !showMenu ? 'hidden' : ''}`}>
        <div className="header-content">
          <button className="menu-btn" onClick={() => setShowMenu(prev => !prev)}>≡</button>
          <div className="logo">
            <span className="logo-icon" onClick={() => navigate('home')}>
              <img src="https://avatars.githubusercontent.com/u/96821067?v=4" alt="Chat❓Chat❗" />
            </span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
            <StockBanner />
            <button
              className="sb-ctrl-btn"
              onClick={logout}
              title={isGuest ? '로그인하기' : `로그아웃 (${user?.username})`}
              style={{ fontSize: 16 }}
            >
              {isGuest ? '🔑' : '👤'}
            </button>
          </div>
        </div>
      </header>

      {showMenu && (
        <>
          <div className="menu-backdrop" onClick={closeMenu} />
          <div className="menu-dropdown">
            <ul className="menu-list">
              {MENU_ITEMS.map((item, i) => {
                const accessible = canAccess(item);
                return (
                  <li
                    key={i}
                    className={`menu-item ${!accessible ? 'menu-item-locked' : ''}`}
                    onClick={() => handleMenuItemClick(item)}
                    title={!accessible ? roleLabel[item.requiredRole] : undefined}
                  >
                    <span className={`menu-icon-btn mdi ${item.icon}`} />
                    <span className="alpha-text">{item.name}</span>
                    {!accessible && <span className="menu-lock">🔒</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}

      <main className="main-content">
        {currentPage === 'home' && <div className="home-placeholder" />}
        {currentPage === 'work' && (user ? <WorkReport /> : null)}
        {currentPage === 'salary' && (user?.role === 'admin' ? <SalaryReport /> : null)}
      </main>

      {isScrolled && (
        <>
          <button className="floating-btn menu-floating" onClick={() => setShowMenu(prev => !prev)} title="메뉴">≡</button>
          <button className="floating-btn home-floating" onClick={() => navigate('home')} title="홈으로">🏠</button>
          <button className="floating-btn top-floating" onClick={() => { closeMenu(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} title="최상위로">↑</button>
        </>
      )}

      <ChatWidget />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
