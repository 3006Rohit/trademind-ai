
import React, { useState } from 'react';
import { X, Moon, Sun, Monitor, Palette, User, ShieldCheck, Database, Cloud, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, theme, setTheme }) => {
  const { user, userData, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'appearance' | 'account'>('account');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-trade-panel border border-trade-border w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col h-[500px]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-trade-border bg-trade-panel-focus shrink-0">
          <h2 className="text-lg font-bold text-trade-text flex items-center gap-2">
            <Palette className="w-5 h-5" /> Settings
          </h2>
          <button onClick={onClose} className="text-trade-text-muted hover:text-trade-text transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sidebar + Content Layout */}
        <div className="flex flex-1 overflow-hidden">
            <div className="w-1/3 border-r border-trade-border bg-trade-panel-focus p-2 flex flex-col gap-1">
                <button 
                    onClick={() => setActiveTab('account')}
                    className={`text-left px-3 py-2 rounded text-xs font-bold flex items-center gap-2 ${activeTab === 'account' ? 'bg-trade-accent text-white' : 'text-trade-text-muted hover:bg-trade-panel hover:text-trade-text'}`}
                >
                    <User className="w-4 h-4" /> Account
                </button>
                <button 
                    onClick={() => setActiveTab('appearance')}
                    className={`text-left px-3 py-2 rounded text-xs font-bold flex items-center gap-2 ${activeTab === 'appearance' ? 'bg-trade-accent text-white' : 'text-trade-text-muted hover:bg-trade-panel hover:text-trade-text'}`}
                >
                    <Monitor className="w-4 h-4" /> Appearance
                </button>
            </div>

            <div className="flex-1 p-6 overflow-y-auto bg-trade-bg">
                {activeTab === 'appearance' && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <h3 className="text-sm font-bold text-trade-text uppercase tracking-wider mb-4">Theme</h3>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <button 
                            onClick={() => setTheme('dark')}
                            className={`flex flex-col items-center justify-center gap-3 p-4 rounded-lg border-2 transition-all ${theme === 'dark' ? 'border-trade-accent bg-trade-accent/10' : 'border-trade-border hover:border-trade-text-muted bg-trade-bg'}`}
                            >
                            <Moon className={`w-8 h-8 ${theme === 'dark' ? 'text-trade-accent' : 'text-trade-text-muted'}`} />
                            <span className={`text-sm font-medium ${theme === 'dark' ? 'text-trade-accent' : 'text-trade-text'}`}>Dark Mode</span>
                            </button>

                            <button 
                            onClick={() => setTheme('light')}
                            className={`flex flex-col items-center justify-center gap-3 p-4 rounded-lg border-2 transition-all ${theme === 'light' ? 'border-trade-accent bg-trade-accent/10' : 'border-trade-border hover:border-trade-text-muted bg-trade-bg'}`}
                            >
                            <Sun className={`w-8 h-8 ${theme === 'light' ? 'text-trade-accent' : 'text-trade-text-muted'}`} />
                            <span className={`text-sm font-medium ${theme === 'light' ? 'text-trade-accent' : 'text-trade-text'}`}>Light Mode</span>
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'account' && user && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
                        <div className="text-center">
                            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 mx-auto mb-3 p-1">
                                <img src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`} alt="Avatar" className="w-full h-full rounded-full bg-white" />
                            </div>
                            <h3 className="text-xl font-bold text-trade-text">{user.name}</h3>
                            <p className="text-sm text-trade-text-muted">{user.email}</p>
                            <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 bg-green-900/30 text-green-400 text-[10px] font-bold rounded border border-green-800">
                                <ShieldCheck className="w-3 h-3" /> VERIFIED ACCOUNT
                            </div>
                        </div>

                        <div className="bg-trade-panel rounded-lg border border-trade-border p-4 space-y-3">
                            <h4 className="text-xs font-bold text-trade-text-muted uppercase flex items-center gap-2">
                                <Database className="w-3 h-3" /> Data Persistence
                            </h4>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-trade-text">Account Balance</span>
                                <span className="font-mono text-trade-text-muted">₹{userData?.balance.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-trade-text">Total Trades</span>
                                <span className="font-mono text-trade-text-muted">{userData?.history.length || 0}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-trade-text">Saved Drawings</span>
                                <span className="font-mono text-trade-text-muted">{userData?.drawings.length || 0}</span>
                            </div>
                            <div className="pt-2 border-t border-trade-border flex items-center gap-2 text-[10px] text-green-400">
                                <Cloud className="w-3 h-3" />
                                <span>Synced with TradeMind Cloud</span>
                            </div>
                        </div>

                        <button 
                            onClick={() => { logout(); onClose(); }}
                            className="w-full py-2 border border-red-900/50 text-red-400 hover:bg-red-900/20 rounded font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                        >
                            <LogOut className="w-3 h-3" /> Sign Out
                        </button>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
