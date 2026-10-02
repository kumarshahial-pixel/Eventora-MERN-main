import React, { useState, useContext, useEffect, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { FiEye, FiEyeOff } from 'react-icons/fi';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [otp, setOtp] = useState('');
    const [showOTP, setShowOTP] = useState(false);
    const [showReset, setShowReset] = useState(false);
    const [resetStep, setResetStep] = useState('email');
    const [resetOtp, setResetOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newPasswordVisible, setNewPasswordVisible] = useState(false);
    const [confirmPassword, setConfirmPassword] = useState('');
    const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const googleButtonRef = useRef(null);
    const isStrongPassword = (value) => /^(?=(?:.*[A-Za-z]){2})(?=(?:.*\d){2})(?=.*[@#$]).{6,}$/.test(value);

    const { login, googleLogin, verifyOTP, forgotPassword, verifyResetOTP, resetPassword } = useContext(AuthContext);
    const navigate = useNavigate();

    useEffect(() => {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        if (!clientId || !googleButtonRef.current) return undefined;

        const renderGoogleButton = () => {
            if (!window.google?.accounts?.id || !googleButtonRef.current) return false;
            window.google.accounts.id.initialize({
                client_id: clientId,
                callback: async ({ credential }) => {
                    setLoading(true);
                    setError('');
                    try {
                        const data = await googleLogin(credential);
                        navigate(data.role === 'admin' ? '/admin' : '/dashboard');
                    } catch (err) {
                        setError(err.message || err);
                    } finally {
                        setLoading(false);
                    }
                }
            });
            window.google.accounts.id.renderButton(googleButtonRef.current, {
                theme: 'outline',
                size: 'large',
                width: 350,
                text: 'signin_with'
            });
            return true;
        };

        if (renderGoogleButton()) return undefined;
        const timer = window.setInterval(() => {
            if (renderGoogleButton()) window.clearInterval(timer);
        }, 200);
        return () => window.clearInterval(timer);
    }, [googleLogin, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const cleanEmail = email.trim().toLowerCase();
            if (!showOTP) {
                const data = await login(cleanEmail, password);
                if (data.role === 'admin') navigate('/admin');
                else navigate('/dashboard');
            } else {
                const data = await verifyOTP(cleanEmail, otp);
                if (data.role === 'admin') navigate('/admin');
                else navigate('/dashboard');
            }
        } catch (err) {
            if (err.needsVerification) {
                setShowOTP(true);
                setError('Account not verified. A new OTP has been sent to your email.');
            } else {
                setError(err.message || err);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPasswordRequest = async () => {
        const cleanEmail = email.trim().toLowerCase();
        if (!cleanEmail) {
            setError('Please enter your email address first.');
            return;
        }

        setLoading(true);
        setError('');
        try {
            await forgotPassword(cleanEmail);
            setResetStep('otp');
            setShowReset(true);
            setError('OTP sent to your email. Please check your inbox.');
        } catch (err) {
            setError(err.message || err);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyResetOTP = async () => {
        const cleanEmail = email.trim().toLowerCase();
        if (!cleanEmail || !resetOtp.trim()) {
            setError('Please enter the OTP sent to your email.');
            return;
        }

        setLoading(true);
        setError('');
        try {
            await verifyResetOTP(cleanEmail, resetOtp.trim());
            setResetStep('password');
            setError('OTP verified. Please enter your new password.');
        } catch (err) {
            setError(err.message || err);
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async () => {
        const cleanEmail = email.trim().toLowerCase();
        if (!cleanEmail || !resetOtp.trim()) {
            setError('Please verify the OTP first.');
            return;
        }

        if (!newPassword || !confirmPassword) {
            setError('Please enter and confirm your new password.');
            return;
        }

        if (!isStrongPassword(newPassword)) {
            setError('Password must be at least 6 characters and include at least 2 letters, 2 numbers, and one special character (@, #, or $).');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        setError('');
        try {
            await resetPassword(cleanEmail, resetOtp.trim(), newPassword, confirmPassword);
            setShowReset(false);
            setResetStep('email');
            setPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setResetOtp('');
            setError('Password reset successfully. Please sign in with your new password.');
        } catch (err) {
            setError(err.message || err);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => (
        <div className="space-y-5">
            {resetStep === 'email' && (
                <>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                        <input
                            type="email"
                            required
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-700 focus:border-gray-700 transition shadow-sm"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={handleForgotPasswordRequest}
                        disabled={loading}
                        className="w-full bg-gray-900 text-white font-bold py-3 rounded-lg hover:bg-black focus:ring-4 focus:ring-gray-200 transition shadow-md"
                    >
                        {loading ? 'Sending OTP...' : 'Send OTP'}
                    </button>
                </>
            )}

            {resetStep === 'otp' && (
                <>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Verification Code (OTP)</label>
                        <input
                            type="text"
                            required
                            placeholder="6-digit code"
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-700 transition shadow-sm font-bold tracking-widest text-center text-lg"
                            value={resetOtp}
                            onChange={(e) => setResetOtp(e.target.value)}
                            maxLength="6"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={handleVerifyResetOTP}
                        disabled={loading}
                        className="w-full bg-gray-900 text-white font-bold py-3 rounded-lg hover:bg-black focus:ring-4 focus:ring-gray-200 transition shadow-md"
                    >
                        {loading ? 'Verifying...' : 'Verify OTP'}
                    </button>
                </>
            )}

            {resetStep === 'password' && (
                <>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
                        <div className="relative">
                            <input
                                type={newPasswordVisible ? 'text' : 'password'}
                                required
                                className="w-full px-4 py-3 pr-12 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-700 focus:border-gray-700 transition shadow-sm"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                className="absolute right-3 top-1/2 z-10 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
                                aria-label={newPasswordVisible ? 'Hide new password' : 'Show new password'}
                                aria-pressed={newPasswordVisible}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => setNewPasswordVisible((visible) => !visible)}
                            >
                                {newPasswordVisible ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm New Password</label>
                        <div className="relative">
                            <input
                                type={confirmPasswordVisible ? 'text' : 'password'}
                                required
                                className="w-full px-4 py-3 pr-12 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-700 focus:border-gray-700 transition shadow-sm"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                className="absolute right-3 top-1/2 z-10 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
                                aria-label={confirmPasswordVisible ? 'Hide confirmation password' : 'Show confirmation password'}
                                aria-pressed={confirmPasswordVisible}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => setConfirmPasswordVisible((visible) => !visible)}
                            >
                                {confirmPasswordVisible ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
                            </button>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleResetPassword}
                        disabled={loading}
                        className="w-full bg-gray-900 text-white font-bold py-3 rounded-lg hover:bg-black focus:ring-4 focus:ring-gray-200 transition shadow-md"
                    >
                        {loading ? 'Updating...' : 'Reset Password'}
                    </button>
                </>
            )}

            <button
                type="button"
                className="w-full mt-3 text-sm font-medium text-gray-600 hover:text-gray-900 hover:underline transition"
                onClick={() => {
                    setShowReset(false);
                    setResetStep('email');
                    setResetOtp('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setError('');
                }}
            >
                Back to Sign In
            </button>
        </div>
    );

    return (
        <div className="auth-scene auth-scene-login">
            <div className="auth-card max-w-md p-6 sm:p-8">
            <div className="mb-8 text-center">
                <h2 className="text-3xl font-extrabold text-gray-900 mb-2">{showReset ? 'Reset Password' : 'Welcome Back'}</h2>
                <p className="text-gray-500">
                    {showReset
                        ? 'Enter your email to receive a reset OTP.'
                        : 'Sign in to your Eventora account'}
                </p>
            </div>

            {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-center shadow-inner border border-red-100">{error}</div>}

            {showReset ? (
                resetForm()
            ) : (
                <>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {!showOTP ? (
                            <>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                                    <input
                                        type="email"
                                        required
                                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-700 focus:border-gray-700 transition shadow-sm"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                                    <div className="relative">
                                        <input
                                            type={passwordVisible ? 'text' : 'password'}
                                            required
                                            className="w-full px-4 py-3 pr-12 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-700 focus:border-gray-700 transition shadow-sm"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
                                            aria-label={passwordVisible ? 'Hide password' : 'Show password'}
                                            aria-pressed={passwordVisible}
                                            onMouseDown={(event) => event.preventDefault()}
                                            onClick={() => setPasswordVisible((visible) => !visible)}
                                        >
                                            {passwordVisible ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
                                        </button>
                                    </div>
                                    <div className="mt-3 text-right">
                                        <button
                                            type="button"
                                            className="text-sm font-medium text-gray-600 hover:text-gray-900 hover:underline transition"
                                            onClick={() => {
                                                setShowReset(true);
                                                setResetStep('email');
                                                setError('');
                                            }}
                                        >
                                            Forgot password?
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Verification Code (OTP)</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="6-digit code"
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-700 transition shadow-sm font-bold tracking-widest text-center text-lg"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    maxLength="6"
                                />
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gray-900 text-white font-bold py-3 rounded-lg hover:bg-black focus:ring-4 focus:ring-gray-200 transition shadow-md"
                        >
                            {loading ? 'Processing...' : (showOTP ? 'Verify OTP & Log In' : 'Sign In')}
                        </button>
                    </form>

                    {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
                        <>
                            <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                                <span className="h-px flex-1 bg-gray-200"></span>
                                or continue with
                                <span className="h-px flex-1 bg-gray-200"></span>
                            </div>
                            <div ref={googleButtonRef} className="flex justify-center"></div>
                        </>
                    )}

                    <p className="text-center mt-8 text-gray-600">
                        Don&apos;t have an account? <Link to="/register" className="text-gray-900 font-bold hover:underline">Create one</Link>
                    </p>
                </>
            )}
            </div>
        </div>
    );
};

export default Login;
