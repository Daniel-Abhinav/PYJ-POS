import React, { useState } from 'react';
import { KeyIcon, UserCircleIcon } from '../components/icons/Icons';

interface LoginViewProps {
  onLogin: (role: 'user' | 'admin', password?: string) => Promise<boolean>;
}

const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [isChoosing, setIsChoosing] = useState(true);
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleUserLogin = async () => {
    setIsLoading(true);
    setError('');
    await onLogin('user');
    // No need to set loading to false, component will unmount
  };

  const handleAdminLoginClick = () => {
    setIsChoosing(false);
    setIsAdminLogin(true);
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    const success = await onLogin('admin', password);
    if (!success) {
      setError('Incorrect password. Please try again.');
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setIsChoosing(true);
    setIsAdminLogin(false);
    setError('');
    setPassword('');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-slate-100 p-4">
      <div className="w-full max-w-sm mx-auto">
        <h1 className="text-4xl font-bold text-center mb-2 text-white">PYJ POS System</h1>
        <p className="text-center text-slate-400 mb-8">Welcome! Please select your role.</p>

        <div className="bg-slate-800 shadow-2xl rounded-lg p-8 transition-all duration-300">
          {isChoosing && (
            <div className="space-y-4">
               <button
                  onClick={handleUserLogin}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-3 bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:bg-indigo-500 transition-colors duration-200 disabled:bg-slate-600 disabled:cursor-wait"
              >
                  <UserCircleIcon />
                  <span>{isLoading ? 'Loading...' : 'Login as User'}</span>
              </button>
               <button
                  onClick={handleAdminLoginClick}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-3 bg-slate-700 text-slate-300 font-semibold py-3 px-4 rounded-lg shadow-lg hover:bg-slate-600 transition-colors duration-200"
              >
                  <KeyIcon />
                  <span>Login as Admin</span>
              </button>
            </div>
          )}

          {isAdminLogin && (
            <form onSubmit={handleAdminSubmit}>
              <h2 className="text-2xl font-bold text-center mb-4 text-white">Admin Login</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="password-input" className="sr-only">Password</label>
                  <input
                    id="password-input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter admin password"
                    autoFocus
                    required
                    className="w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-center"
                  />
                </div>
                {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:bg-indigo-500 transition-colors duration-200 disabled:bg-slate-600 disabled:cursor-wait"
                >
                  {isLoading ? 'Verifying...' : 'Login'}
                </button>
                <button
                  type="button"
                  onClick={handleBack}
                  className="w-full text-center text-slate-400 hover:text-slate-200 text-sm mt-2"
                >
                  &larr; Back to role selection
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginView;
