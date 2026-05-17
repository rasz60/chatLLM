import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import './App.css';
import ChatWidget from './ChatWidget';
import WorkReport from './pages/WorkReport';
import SalaryReport from './pages/SalaryReport';
export default function App() {
    const [isScrolled, setIsScrolled] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [currentPage, setCurrentPage] = useState('home');
    useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 50);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);
    const navigate = (page) => {
        setCurrentPage(page);
        setShowMenu(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    return (_jsxs("div", { className: "app", children: [_jsx("header", { className: `header ${isScrolled ? 'hidden' : ''}`, children: _jsxs("div", { className: "header-content", children: [_jsx("button", { className: "menu-btn", onClick: () => setShowMenu(!showMenu), children: "\u2261" }), _jsx("div", { className: "logo", children: _jsx("span", { className: "logo-icon", onClick: () => navigate('home'), children: _jsx("img", { src: "https://avatars.githubusercontent.com/u/96821067?v=4", alt: "Chat\u2753Chat\u2757" }) }) }), _jsx("div", { className: "header-spacer" })] }) }), showMenu && (_jsx("div", { className: "menu-dropdown", children: _jsxs("ul", { children: [_jsx("li", { children: _jsx("a", { href: "#home", onClick: () => navigate('home'), children: "\uD648" }) }), _jsx("li", { children: _jsx("a", { href: "#about", onClick: () => setShowMenu(false), children: "\uC18C\uAC1C" }) }), _jsx("li", { children: _jsx("a", { href: "#contact", onClick: () => setShowMenu(false), children: "\uC5F0\uB77D" }) }), _jsx("li", { children: _jsx("a", { href: "#work", onClick: e => { e.preventDefault(); navigate('work'); }, children: "\uD83D\uDCBC \uC5C5\uBB34\uC77C\uC9C0" }) }), _jsx("li", { children: _jsx("a", { href: "#salary", onClick: e => { e.preventDefault(); navigate('salary'); }, children: "\uD83D\uDCC5 \uAE09\uC5EC\uBA85\uC138\uC11C" }) })] }) })), _jsxs("main", { className: "main-content", children: [currentPage === 'home' && _jsx("div", { className: "home-placeholder" }), currentPage === 'work' && _jsx(WorkReport, {}), currentPage === 'salary' && _jsx(SalaryReport, {})] }), isScrolled && (_jsxs(_Fragment, { children: [_jsx("button", { className: "floating-btn menu-floating", onClick: () => setShowMenu(!showMenu), title: "\uBA54\uB274", children: "\u2261" }), _jsx("button", { className: "floating-btn home-floating", onClick: () => navigate('home'), title: "\uD648\uC73C\uB85C", children: "\uD83C\uDFE0" }), _jsx("button", { className: "floating-btn top-floating", onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }), title: "\uCD5C\uC0C1\uC704\uB85C", children: "\u2191" })] })), _jsx(ChatWidget, {})] }));
}
