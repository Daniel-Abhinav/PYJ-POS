import React, { useState } from 'react';
import type { View } from '../App';
import { CashIcon, ChartBarIcon, ClipboardListIcon, ArchiveIcon, BellIcon, LogoutIcon, SunIcon, MoonIcon, MenuIcon, XIcon } from './icons/Icons';

interface HeaderProps {
  currentView: View;
  setCurrentView: (view: View) => void;
  role: 'user' | 'admin';
  onLogout: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const NavButton: React.FC<{
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  isMobile?: boolean;
}> = ({ label, icon, isActive, onClick, isMobile = false }) => {
  const baseClasses = "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200";
  const activeClasses = "bg-indigo-600 text-white shadow-lg";
  const inactiveClasses = "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white";
  const mobileClasses = "justify-start w-full text-base";

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses} ${isMobile ? mobileClasses : ''}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
};

const Header: React.FC<HeaderProps> = ({ currentView, setCurrentView, role, onLogout, theme, toggleTheme }) => {
  const isAdmin = role === 'admin';
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleNavClick = (view: View) => {
    setCurrentView(view);
    setIsMobileMenuOpen(false);
  };

  const navItems = (isMobile: boolean) => (
    <>
      <NavButton label="POS" icon={<CashIcon />} isActive={currentView === 'pos'} onClick={() => handleNavClick('pos')} isMobile={isMobile} />
      <NavButton label="Orders" icon={<BellIcon />} isActive={currentView === 'orders'} onClick={() => handleNavClick('orders')} isMobile={isMobile} />
      {isAdmin && (
        <>
          <NavButton label="Dashboard" icon={<ChartBarIcon />} isActive={currentView === 'dashboard'} onClick={() => handleNavClick('dashboard')} isMobile={isMobile} />
          <NavButton label="History" icon={<ClipboardListIcon />} isActive={currentView === 'history'} onClick={() => handleNavClick('history')} isMobile={isMobile} />
          <NavButton label="Inventory" icon={<ArchiveIcon />} isActive={currentView === 'inventory'} onClick={() => handleNavClick('inventory')} isMobile={isMobile} />
        </>
      )}
    </>
  );

  return (
    <header className="bg-white dark:bg-slate-800 shadow-md sticky top-0 z-40">
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-bold">PYJ POS</h1>
          </div>
          
          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems(false)}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>

            <button
              onClick={onLogout}
              className="hidden md:flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 text-slate-600 dark:text-slate-300 hover:bg-red-500 hover:text-white"
              aria-label="Logout"
            >
              <LogoutIcon />
              <span className="hidden sm:inline">Logout</span>
            </button>
            
            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 rounded-md">
                {isMobileMenuOpen ? <XIcon /> : <MenuIcon />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {navItems(true)}
            <button
              onClick={onLogout}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 w-full"
              aria-label="Logout"
            >
              <LogoutIcon />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;