import React from 'react';
import type { View } from '../App';
import { CashIcon, ChartBarIcon, ClipboardListIcon, ArchiveIcon, BellIcon } from './icons/Icons';

interface HeaderProps {
  currentView: View;
  setCurrentView: (view: View) => void;
}

const NavButton: React.FC<{
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}> = ({ label, icon, isActive, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col sm:flex-row items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
        isActive
          ? 'bg-indigo-600 text-white shadow-lg'
          : 'text-slate-300 hover:bg-slate-700 hover:text-white'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
};

const Header: React.FC<HeaderProps> = ({ currentView, setCurrentView }) => {
  return (
    <header className="bg-slate-800 shadow-md">
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-white">PYJ POS</h1>
          </div>
          <div className="flex items-center space-x-1 sm:space-x-2">
            <NavButton
              label="POS"
              icon={<CashIcon />}
              isActive={currentView === 'pos'}
              onClick={() => setCurrentView('pos')}
            />
            <NavButton
              label="Orders"
              icon={<BellIcon />}
              isActive={currentView === 'orders'}
              onClick={() => setCurrentView('orders')}
            />
            <NavButton
              label="Dashboard"
              icon={<ChartBarIcon />}
              isActive={currentView === 'dashboard'}
              onClick={() => setCurrentView('dashboard')}
            />
            <NavButton
              label="History"
              icon={<ClipboardListIcon />}
              isActive={currentView === 'history'}
              onClick={() => setCurrentView('history')}
            />
            <NavButton
              label="Inventory"
              icon={<ArchiveIcon />}
              isActive={currentView === 'inventory'}
              onClick={() => setCurrentView('inventory')}
            />
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Header;
