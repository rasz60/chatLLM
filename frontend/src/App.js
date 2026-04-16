import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import './App.css';
import ChatWidget from './ChatWidget';
const MENU_ITEMS = [
    { name: 'about', icon: 'mdi-account-question-outline', action: 'link', href: '#about' },
    { name: 'dlog', icon: 'mdi-math-log', action: 'newWindow', href: 'https://rasz60.github.io/sixt' },
    { name: 'github', icon: 'mdi-github', action: 'newWindow', href: 'https://github.com/rasz60' },
    { name: 'send email', icon: 'mdi-email-fast-outline', action: 'mail' },
];
const AlphaText = ({ text }) => (_jsx("span", { className: "alpha-text", children: text.split('').map((char, i) => char === ' '
        ? _jsx("span", { className: "alpha-space" }, i)
        : _jsx("span", { className: `mdi mdi-alpha-${char}` }, i)) }));
const App = () => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showMailDialog, setShowMailDialog] = useState(false);
    const [mailForm, setMailForm] = useState({ name: '', email: '', message: '' });
    useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 50);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);
    const handleMenuItemClick = (item) => {
        if (item.action === 'newWindow' && item.href) {
            const w = window.open('about:blank');
            if (w)
                w.location.href = item.href;
        }
        else if (item.action === 'link' && item.href) {
            const el = document.querySelector(item.href);
            if (el)
                el.scrollIntoView({ behavior: 'smooth' });
        }
        else if (item.action === 'mail') {
            setShowMailDialog(true);
        }
        setShowMenu(false);
    };
    const handleMailSend = (e) => {
        e.preventDefault();
        const subject = encodeURIComponent(`Contact from ${mailForm.name}`);
        const body = encodeURIComponent(`${mailForm.message}\n\n${mailForm.email}`);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
        setShowMailDialog(false);
        setMailForm({ name: '', email: '', message: '' });
    };
    return (_jsxs("div", { className: "app", children: [_jsx("header", { className: `header ${isScrolled ? 'hidden' : ''}`, children: _jsxs("div", { className: "header-content", children: [_jsx("button", { className: "menu-btn", onClick: () => setShowMenu(!showMenu), children: "\u2261" }), _jsx("div", { className: "logo", children: _jsx("span", { className: "logo-icon", onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }), children: _jsx("img", { src: "https://avatars.githubusercontent.com/u/96821067?v=4", alt: "Chat\u2753Chat\u2757" }) }) }), _jsx("div", { className: "header-spacer" })] }) }), showMenu && (_jsx("div", { className: "menu-dropdown", onClick: () => setShowMenu(false), children: _jsx("div", { className: "menu-list", onClick: (e) => e.stopPropagation(), children: MENU_ITEMS.map((item) => (_jsxs("div", { className: "menu-item", onClick: () => handleMenuItemClick(item), children: [_jsx("button", { className: `mdi ${item.icon} menu-icon-btn` }), _jsx(AlphaText, { text: item.name })] }, item.name))) }) })), _jsx("main", { className: "main-content" }), isScrolled && (_jsxs(_Fragment, { children: [_jsx("button", { className: "floating-btn menu-floating", onClick: () => setShowMenu(!showMenu), title: "\uBA54\uB274", children: "\u2261" }), _jsx("button", { className: "floating-btn home-floating", onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }), title: "\uD648\uC73C\uB85C", children: "\uD83C\uDFE0" }), _jsx("button", { className: "floating-btn top-floating", onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }), title: "\uCD5C\uC0C1\uC704\uB85C", children: "\u2191" })] })), showMailDialog && (_jsx("div", { className: "dialog-overlay", onClick: () => setShowMailDialog(false), children: _jsxs("div", { className: "dialog-panel", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "dialog-header", children: [_jsx("span", { className: "mdi mdi-email-fast-outline dialog-header-icon" }), _jsx("span", { children: "Send Email" }), _jsx("button", { className: "dialog-close", onClick: () => setShowMailDialog(false), children: _jsx("span", { className: "mdi mdi-close" }) })] }), _jsxs("form", { onSubmit: handleMailSend, className: "mail-form", children: [_jsx("input", { type: "text", placeholder: "\uC774\uB984", value: mailForm.name, onChange: (e) => setMailForm({ ...mailForm, name: e.target.value }), required: true }), _jsx("input", { type: "email", placeholder: "\uC774\uBA54\uC77C", value: mailForm.email, onChange: (e) => setMailForm({ ...mailForm, email: e.target.value }), required: true }), _jsx("textarea", { placeholder: "\uBA54\uC2DC\uC9C0", value: mailForm.message, onChange: (e) => setMailForm({ ...mailForm, message: e.target.value }), required: true, rows: 5 }), _jsxs("div", { className: "mail-form-actions", children: [_jsx("button", { type: "button", className: "btn-cancel", onClick: () => setShowMailDialog(false), children: "\uCDE8\uC18C" }), _jsx("button", { type: "submit", className: "btn-send", children: "\uC804\uC1A1" })] })] })] }) })), _jsx(ChatWidget, {})] }));
};
export default App;
