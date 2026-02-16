import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserData } from '../types';
import { authService } from '../services/authService';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginEmail: (email: string, pass: string) => Promise<void>;
  loginGoogle: (email?: string) => Promise<void>;
  
  initiateSignup: (email: string, pass: string, name: string) => Promise<void>;
  verifyOtpAndRegister: (email: string, pass: string, name: string, otp: string, generatedOtp: string) => Promise<void>;
  
  logout: () => void;
  userData: UserData | null;
  saveUserData: (data: Partial<UserData>) => void;
}

const AuthContext = createContext<AuthContextType>(null!);

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
        const storedUser = localStorage.getItem('trade_active_session');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          // Safely attempt to load user data, fallback if missing
          try {
              const data = authService.getUserData(parsedUser.id);
              setUserData(data);
          } catch (e) {
              console.warn("Failed to load user data, resetting session");
              localStorage.removeItem('trade_active_session');
              setUser(null);
          }
        }
    } catch (e) {
        console.error("Session corrupted, clearing storage", e);
        localStorage.removeItem('trade_active_session');
        setUser(null);
    } finally {
        setLoading(false);
    }
  }, []);

  const handleAuthSuccess = (authUser: User) => {
    setUser(authUser);
    localStorage.setItem('trade_active_session', JSON.stringify(authUser));
    const data = authService.getUserData(authUser.id);
    setUserData(data);
  };

  const loginEmail = async (email: string, pass: string) => {
    const authUser = await authService.login(email, pass);
    handleAuthSuccess(authUser);
  };

  const initiateSignup = async (email: string, pass: string, name: string): Promise<void> => {
      const exists = await authService.checkEmailExists(email);
      if (exists) throw new Error("Account already exists with this email.");
      await authService.initiateSignup(email, pass, name);
  };

  const verifyOtpAndRegister = async (email: string, pass: string, name: string, inputOtp: string, generatedOtp: string) => {
      if (generatedOtp !== 'WAITING_FOR_SERVER' && inputOtp !== generatedOtp) {
          throw new Error("Invalid Verification Code");
      }
      const authUser = await authService.verifyAndRegister(email, pass, name, inputOtp);
      handleAuthSuccess(authUser);
  };

  const loginGoogle = async (mockEmail?: string) => {
    const email = mockEmail || 'demo.trader@gmail.com';
    const name = 'Google User';
    const authUser = await authService.googleLogin(email, name);
    handleAuthSuccess(authUser);
  };

  const logout = () => {
    setUser(null);
    setUserData(null);
    localStorage.removeItem('trade_active_session');
    localStorage.removeItem('trade_jwt_token');
  };

  const saveUserDataFn = (partialData: Partial<UserData>) => {
      if (!user || !userData) return;
      const newData = { ...userData, ...partialData };
      setUserData(newData); 
      authService.saveUserData(user.id, newData);
  };

  return (
    <AuthContext.Provider value={{ 
        user, 
        loading, 
        loginEmail, 
        loginGoogle, 
        initiateSignup, 
        verifyOtpAndRegister, 
        logout,
        userData,
        saveUserData: saveUserDataFn
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);