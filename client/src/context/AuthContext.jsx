import React, { createContext, useState, useEffect } from 'react';
import api from '../utils/axios';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const userInfo = localStorage.getItem('userInfo');
        if (userInfo) {
            setUser(JSON.parse(userInfo));
        }
        setLoading(false);
    }, []);

    const login = async (email, password) => {
        try {
            const { data } = await api.post('/auth/login', { email, password });
            setUser(data);
            localStorage.setItem('userInfo', JSON.stringify(data));
            localStorage.setItem('token', data.token);
            return data;
        } catch (error) {
            if (error.response?.data?.needsVerification) throw error.response.data;
            throw error.response?.data?.message || 'Login failed';
        }
    };

    const googleLogin = async (credential) => {
        try {
            const { data } = await api.post('/auth/google', { credential });
            setUser(data);
            localStorage.setItem('userInfo', JSON.stringify(data));
            localStorage.setItem('token', data.token);
            return data;
        } catch (error) {
            throw error.response?.data?.message || 'Google login failed';
        }
    };

    const register = async (name, email, phone, password, confirmPassword, profileImage) => {
        try {
            const formData = new FormData();
            formData.append('name', name);
            formData.append('email', email);
            formData.append('phone', phone);
            formData.append('password', password);
            formData.append('confirmPassword', confirmPassword);
            if (profileImage) formData.append('profileImage', profileImage);

            const { data } = await api.post('/auth/register', formData);
            return data; // Returns { message, email }
        } catch (error) {
            throw error.response?.data?.message || 'Registration failed';
        }
    };

    const verifyOTP = async (email, otp) => {
        try {
            const { data } = await api.post('/auth/verify-otp', { email, otp });
            setUser(data);
            localStorage.setItem('userInfo', JSON.stringify(data));
            localStorage.setItem('token', data.token);
            return data;
        } catch (error) {
            throw error.response?.data?.message || 'OTP verification failed';
        }
    };

    const forgotPassword = async (email) => {
        try {
            const { data } = await api.post('/auth/forgot-password', { email });
            return data;
        } catch (error) {
            throw error.response?.data?.message || 'Password reset request failed';
        }
    };

    const verifyResetOTP = async (email, otp) => {
        try {
            const { data } = await api.post('/auth/verify-reset-otp', { email, otp });
            return data;
        } catch (error) {
            throw error.response?.data?.message || 'OTP verification failed';
        }
    };

    const resetPassword = async (email, otp, password, confirmPassword) => {
        try {
            const { data } = await api.post('/auth/reset-password', { email, otp, password, confirmPassword });
            return data;
        } catch (error) {
            throw error.response?.data?.message || 'Password reset failed';
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('userInfo');
        localStorage.removeItem('token');
    };

    return (
        <AuthContext.Provider value={{ user, login, googleLogin, register, verifyOTP, forgotPassword, verifyResetOTP, resetPassword, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
