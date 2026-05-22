import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import './App.css';
import ChatWidget from './ChatWidget';
import WorkReport from './pages/WorkReport';
import SalaryReport from './pages/SalaryReport';
import StockBanner from './components/StockBanner';
const MENU_ITEMS = [
    { name: '홈', icon: 'mdi-home-outline', action: 'navigate', page: 'home' },
    { name: '소개', icon: 'mdi-account-question-outline', action: 'link', href: '#about' },
    { name: '연락', icon: 'mdi-email-fast-outline', action: 'link', href: '#contact' },
    { name: '업무일지', icon: 'mdi-briefcase-outline', action: 'navigate', page: 'work' },
    { name: '급여명세서', icon: 'mdi-calendar-month-outline', action: 'navigate', page: 'salary' },
];
export default function App() {
    const [isScrolled, setIsScrolled] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [currentPage, setCurrentPage] = useState('home');
    useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 50);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);
    const closeMenu = () => setShowMenu(false);
    const navigate = (page) => {
        setCurrentPage(page);
        closeMenu();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const handleMenuItemClick = (item) => {
        if (item.action === 'navigate' && item.page) {
            navigate(item.page);
        }
        else if (item.action === 'link' && item.href) {
            const el = document.querySelector(item.href);
            if (el)
                el.scrollIntoView({ behavior: 'smooth' });
            closeMenu();
        }
        else if (item.action === 'newWindow' && item.href) {
            const w = window.open('about:blank');
            if (w)
                w.location.href = item.href;
            closeMenu();
        }
    };
    return (_jsxs("div", { className: "app", children: [_jsx("header", { className: `header ${isScrolled && !showMenu ? 'hidden' : ''}`, children: _jsxs("div", { className: "header-content", children: [_jsx("button", { className: "menu-btn", onClick: () => setShowMenu(prev => !prev), children: "\u2261" }), _jsx("div", { className: "logo", children: _jsx("span", { className: "logo-icon", onClick: () => navigate('home'), children: _jsx("img", { src: "https://avatars.githubusercontent.com/u/96821067?v=4", alt: "Chat\u2753Chat\u2757" }) }) }), _jsx(StockBanner, {})] }) }), showMenu && (_jsxs(_Fragment, { children: [_jsx("div", { className: "menu-backdrop", onClick: closeMenu }), _jsx("div", { className: "menu-dropdown", children: _jsx("ul", { className: "menu-list", children: MENU_ITEMS.map((item, i) => (_jsxs("li", { className: "menu-item", onClick: () => handleMenuItemClick(item), children: [_jsx("span", { className: `menu-icon-btn mdi ${item.icon}` }), _jsx("span", { className: "alpha-text", children: item.name })] }, i))) }) })] })), _jsxs("main", { className: "main-content", children: [currentPage === 'home' && _jsx("div", { className: "home-placeholder" }), currentPage === 'work' && _jsx(WorkReport, {}), currentPage === 'salary' && _jsx(SalaryReport, {})] }), isScrolled && (_jsxs(_Fragment, { children: [_jsx("button", { className: "floating-btn menu-floating", onClick: () => setShowMenu(prev => !prev), title: "\uBA54\uB274", children: "\u2261" }), _jsx("button", { className: "floating-btn home-floating", onClick: () => navigate('home'), title: "\uD648\uC73C\uB85C", children: "\uD83C\uDFE0" }), _jsx("button", { className: "floating-btn top-floating", onClick: () => { closeMenu(); window.scrollTo({ top: 0, behavior: 'smooth' }); }, title: "\uCD5C\uC0C1\uC704\uB85C", children: "\u2191" })] })), _jsx(ChatWidget, {})] }));
}
