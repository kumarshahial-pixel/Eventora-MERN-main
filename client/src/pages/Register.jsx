import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { FiCheck, FiEye, FiEyeOff, FiPlus, FiUser, FiX } from 'react-icons/fi';
import PhoneInput from 'react-phone-input-2';
import { isValidPhoneNumber } from 'libphonenumber-js';
import 'react-phone-input-2/lib/style.css';

const Register = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [profileImage, setProfileImage] = useState(null);
    const [profilePreview, setProfilePreview] = useState('');
    const [password, setPassword] = useState('');
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [passwordFocused, setPasswordFocused] = useState(false);
    const [confirmPassword, setConfirmPassword] = useState('');
    const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
    const [otp, setOtp] = useState('');
    const [showOTP, setShowOTP] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const isStrongPassword = (value) => /^(?=(?:.*[A-Za-z]){2})(?=(?:.*\d){2})(?=.*[@#$]).{6,}$/.test(value);
    const passwordRequirements = [
        { label: 'At least 6 characters', met: password.length >= 6 },
        { label: 'At least 2 letters', met: (password.match(/[A-Za-z]/g) || []).length >= 2 },
        { label: 'At least 2 numbers', met: (password.match(/\d/g) || []).length >= 2 },
        { label: 'One special character (@, #, $)', met: /[@#$]/.test(password) }
    ];

    const { register, verifyOTP } = useContext(AuthContext);
    const navigate = useNavigate();

    useEffect(() => {
        if (!profileImage) {
            setProfilePreview('');
            return undefined;
        }

        const previewUrl = URL.createObjectURL(profileImage);
        setProfilePreview(previewUrl);
        return () => URL.revokeObjectURL(previewUrl);
    }, [profileImage]);

    const handleProfileImageChange = (e) => {
        const selectedImage = e.target.files?.[0] || null;
        const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

        if (selectedImage && !allowedImageTypes.includes(selectedImage.type)) {
            setError('Please choose a JPEG, PNG, GIF, or WebP image.');
            e.target.value = '';
            return;
        }
        if (selectedImage && selectedImage.size > 5 * 1024 * 1024) {
            setError('Profile image must be 5 MB or smaller.');
            e.target.value = '';
            return;
        }

        setProfileImage(selectedImage);
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            if (!showOTP) {
                const cleanEmail = email.trim().toLowerCase();
                const cleanName = name.trim();

                if (!password || !confirmPassword) {
                    throw new Error('Please fill in both password fields');
                }
                if (password !== confirmPassword) {
                    throw new Error('Passwords do not match');
                }
                if (!isStrongPassword(password)) {
                    throw new Error('Password must be at least 6 characters and include at least 2 letters, 2 numbers, and one special character (@, #, or $)');
                }
                if (!phone || !isValidPhoneNumber(phone)) {
                    throw new Error('Please enter a valid mobile number with its country code');
                }

                await register(cleanName, cleanEmail, phone, password, confirmPassword, profileImage);
                setShowOTP(true);
                setError('');
            } else {
                await verifyOTP(email.trim().toLowerCase(), otp);
                navigate('/dashboard');
            }
        } catch (err) {
            setError(err.message || err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-scene auth-scene-register">
            <div className="auth-card w-full max-w-md overflow-hidden">
                <div className="border-b border-white/10 bg-white/5 px-6 py-6 text-center sm:px-8">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
                        <span className="text-xl font-bold text-white">E</span>
                    </div>
                    <h2 className="text-3xl font-extrabold tracking-tight text-white">Create an Account</h2>
                    <p className="mt-2 text-sm text-slate-300">Join Eventora and start booking amazing events</p>
                </div>

                <div className="p-6 sm:p-8">
                    {error && (
                        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 shadow-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {!showOTP ? (
                            <>
                                <div className="flex flex-col items-center pb-1">
                                    <label
                                        htmlFor="profile-image"
                                        className="group flex cursor-pointer flex-col items-center rounded-xl focus-within:outline-none"
                                    >
                                        <input
                                            id="profile-image"
                                            type="file"
                                            accept="image/jpeg,image/png,image/gif,image/webp"
                                            onChange={handleProfileImageChange}
                                            className="peer sr-only"
                                        />
                                        <span className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-sky-500 text-white shadow-md ring-4 ring-white transition group-hover:bg-sky-600 peer-focus-visible:ring-sky-300">
                                            {profilePreview ? (
                                                <img src={profilePreview} alt="" className="h-full w-full object-cover" />
                                            ) : (
                                                <FiUser className="h-14 w-14" aria-hidden="true" />
                                            )}
                                            <span className="absolute bottom-0 left-1/2 flex h-8 w-8 -translate-x-1/2 translate-y-1/4 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-white shadow">
                                                <FiPlus className="h-4 w-4" aria-hidden="true" />
                                            </span>
                                        </span>
                                        <span className="mt-3 text-sm font-semibold text-gray-800">Add profile photo</span>
                                        <span className="text-xs text-gray-500">Optional</span>
                                    </label>
                                    {profileImage && (
                                        <span className="mt-1 max-w-full break-all text-center text-xs text-gray-500">
                                            {profileImage.name}
                                        </span>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-gray-700">Full Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-gray-900 shadow-sm transition duration-200 placeholder:text-gray-400 focus:border-gray-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-gray-200"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="John Doe"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-gray-700">Email Address</label>
                                    <input
                                        type="email"
                                        required
                                        className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-gray-900 shadow-sm transition duration-200 placeholder:text-gray-400 focus:border-gray-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-gray-200"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="you@example.com"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-gray-700">Mobile Number</label>
                                    <PhoneInput
                                        country="in"
                                        enableSearch
                                        countryCodeEditable={false}
                                        value={phone.replace(/^\+/, '')}
                                        onChange={(value) => setPhone(value ? `+${value}` : '')}
                                        inputProps={{
                                            name: 'phone',
                                            required: true,
                                            autoComplete: 'tel',
                                            'aria-label': 'Mobile number with country calling code'
                                        }}
                                        containerClass="register-phone-input"
                                        inputClass="register-phone-field"
                                        buttonClass="register-phone-button"
                                        dropdownClass="register-phone-dropdown"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-gray-700">Password</label>
                                    <div className="relative">
                                        <input
                                            type={passwordVisible ? 'text' : 'password'}
                                            required
                                            className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 pr-12 text-gray-900 shadow-sm transition duration-200 placeholder:text-gray-400 focus:border-gray-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-gray-200"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            onFocus={() => setPasswordFocused(true)}
                                            onBlur={() => setPasswordFocused(false)}
                                            placeholder="••••••••"
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
                                    {passwordFocused && (
                                        <ul className="space-y-1 text-sm" aria-live="polite">
                                            {passwordRequirements.map(({ label, met }) => (
                                                <li key={label} className={`flex items-center gap-2 ${met ? 'text-green-700' : 'text-red-600'}`}>
                                                    {met ? <FiCheck aria-hidden="true" /> : <FiX aria-hidden="true" />}
                                                    <span>{label}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-gray-700">Confirm Password</label>
                                    <div className="relative">
                                        <input
                                            type={confirmPasswordVisible ? 'text' : 'password'}
                                            required
                                            className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 pr-12 text-gray-900 shadow-sm transition duration-200 placeholder:text-gray-400 focus:border-gray-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-gray-200"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="Repeat your password"
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
                            </>
                        ) : (
                            <div className="space-y-4 rounded-2xl border border-green-200 bg-green-50 p-4">
                                <p className="text-sm font-medium text-green-800">
                                    An OTP has been sent to your email. Please verify your account.
                                </p>
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-gray-700">Verification Code (OTP)</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="6-digit code"
                                        className="w-full rounded-xl border border-green-300 bg-white px-4 py-3 text-center text-lg font-bold tracking-[0.5em] text-gray-900 shadow-sm transition duration-200 focus:border-green-600 focus:outline-none focus:ring-4 focus:ring-green-200"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value)}
                                        maxLength="6"
                                    />
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-xl bg-gradient-to-r from-gray-900 to-black px-4 py-3 text-base font-bold text-white shadow-lg shadow-gray-900/20 transition duration-200 hover:translate-y-[-1px] hover:shadow-xl hover:shadow-gray-900/25 focus:outline-none focus:ring-4 focus:ring-gray-200 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {loading ? 'Processing...' : (showOTP ? 'Verify & Complete' : 'Sign Up')}
                        </button>
                    </form>

                    {!showOTP && (
                        <p className="mt-6 text-center text-sm text-gray-600">
                            Already have an account?{' '}
                            <Link to="/login" className="font-bold text-gray-900 transition hover:text-black hover:underline">
                                Sign in
                            </Link>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Register;
