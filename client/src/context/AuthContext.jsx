import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [creator, setCreator] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('creatorToken'));
  const [reviewer, setReviewer] = useState(null);
  const [reviewerAccountToken, setReviewerAccountToken] = useState(localStorage.getItem('reviewerAccountToken'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      setLoading(true);
      try {
        if (token) {
          api.setCreatorToken(token);
          try {
            const data = await api.getMe();
            if (mounted) setCreator(data);
          } catch {
            if (mounted) {
              setCreator(null);
              setToken(null);
              api.setCreatorToken(null);
            }
          }
        } else if (mounted) {
          setCreator(null);
        }

        if (reviewerAccountToken) {
          api.setReviewerAccountToken(reviewerAccountToken);
          try {
            const data = await api.getReviewerMe();
            if (mounted) setReviewer(data);
          } catch {
            if (mounted) {
              setReviewer(null);
              setReviewerAccountToken(null);
              api.setReviewerAccountToken(null);
            }
          }
        } else if (mounted) {
          setReviewer(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    bootstrap();
    return () => {
      mounted = false;
    };
  }, [token, reviewerAccountToken]);

  const login = async (email, password) => {
    const data = await api.login(email, password);
    setToken(data.token);
    setCreator(data.creator);
    return data;
  };

  const register = async (email, password, name) => {
    const data = await api.register(email, password, name);
    setToken(data.token);
    setCreator(data.creator);
    return data;
  };

  const reviewerLogin = async (email, password) => {
    const data = await api.reviewerLogin(email, password);
    setReviewerAccountToken(data.token);
    setReviewer(data.reviewer);
    return data;
  };

  const reviewerRegister = async (name, email, password) => {
    const data = await api.reviewerRegister(name, email, password);
    setReviewerAccountToken(data.token);
    setReviewer(data.reviewer);
    return data;
  };

  const reviewerLogout = () => {
    api.setReviewerAccountToken(null);
    api.setReviewerToken(null);
    setReviewerAccountToken(null);
    setReviewer(null);
  };

  const logout = () => {
    api.setCreatorToken(null);
    setToken(null);
    setCreator(null);
  };

  return (
    <AuthContext.Provider
      value={{
        creator,
        token,
        reviewer,
        reviewerAccountToken,
        loading,
        login,
        register,
        reviewerLogin,
        reviewerRegister,
        logout,
        reviewerLogout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
