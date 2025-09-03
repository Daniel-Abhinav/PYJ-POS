import React, { useState } from 'react';
import { KeyIcon, UserCircleIcon } from '../components/icons/Icons';

interface LoginViewProps {
  onLogin: (role: 'user' | 'admin', password?: string) => Promise<boolean>;
}

const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [mode, setMode] = useState<'selection' | 'user' | 'admin'>('selection');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'selection') return;

    setIsLoading(true);
    setError('');
    const success = await onLogin(mode, password);
    if (!success) {
      setError('Incorrect password. Please try again.');
      setIsLoading(false);
    }
  };
  
  const handleRoleSelect = (role: 'user' | 'admin') => {
    setMode(role);
    setError('');
    setPassword('');
  }

  const handleBack = () => {
    setMode('selection');
    setError('');
    setPassword('');
  };

  const renderContent = () => {
    if (mode === 'selection') {
      return (
        <div className="space-y-4">
           <button
              onClick={() => handleRoleSelect('user')}
              className="w-full flex items-center justify-center gap-3 bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:bg-indigo-500 transition-colors duration-200"
          >
              <UserCircleIcon />
              <span>Login as User</span>
          </button>
           <button
              onClick={() => handleRoleSelect('admin')}
              className="w-full flex items-center justify-center gap-3 bg-slate-600 dark:bg-slate-700 text-slate-100 dark:text-slate-300 font-semibold py-3 px-4 rounded-lg shadow-lg hover:bg-slate-500 dark:hover:bg-slate-600 transition-colors duration-200"
          >
              <KeyIcon />
              <span>Login as Admin</span>
          </button>
        </div>
      );
    }

    const roleName = mode.charAt(0).toUpperCase() + mode.slice(1);
    
    return (
      <form onSubmit={handleFormSubmit}>
        <h2 className="text-2xl font-bold text-center mb-4">{roleName} Login</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="password-input" className="sr-only">Password</label>
            <input
              id="password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={`Enter ${mode} password`}
              autoFocus
              required
              className="w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
            />
          </div>
          {error && <p className="text-red-500 dark:text-red-400 text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:bg-indigo-500 transition-colors duration-200 disabled:bg-slate-500 disabled:cursor-wait"
          >
            {isLoading ? 'Verifying...' : 'Login'}
          </button>
          <button
            type="button"
            onClick={handleBack}
            className="w-full text-center text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm mt-2"
          >
            &larr; Back to role selection
          </button>
        </div>
      </form>
    );
  };


  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm mx-auto">
        <h1 className="text-4xl font-bold text-center mb-2">PYJ POS System</h1>
        <p className="text-center text-slate-500 dark:text-slate-400 mb-8">
          {mode === 'selection' ? 'Welcome! Please select your role.' : 'Please enter your password.'}
        </p>

        <div className="bg-white dark:bg-slate-800 shadow-2xl rounded-lg p-8 transition-all duration-300">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default LoginView;