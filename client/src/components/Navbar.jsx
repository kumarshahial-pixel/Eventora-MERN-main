import React, { useContext, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { FaTicketAlt } from 'react-icons/fa';
import { FiChevronDown, FiGrid, FiUser } from 'react-icons/fi';
import api from '../utils/axios';

const Navbar = () => {
    const { user, logout } = useContext(AuthContext);
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const isHomePage = pathname === '/';
    const [profileOpen, setProfileOpen] = useState(false);
    const profileRef = useRef(null);

    useEffect(() => {
        const handleOutsideClick = (event) => {
            if (!profileRef.current?.contains(event.target)) setProfileOpen(false);
        };
        const handleEscape = (event) => {
            if (event.key === 'Escape') setProfileOpen(false);
        };

        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('keydown', handleEscape);
        };
    }, []);

    const handleLogout = () => {
        setProfileOpen(false);
        logout();
        navigate('/login');
    };

    const profileImageUrl = user?.profileImage
        ? new URL(user.profileImage, api.defaults.baseURL).toString()
        : '';

    return (
        <nav className={`eventora-navbar bg-gray-900 shadow-lg ${isHomePage ? 'eventora-navbar-home' : ''}`}>
            <div className={`container mx-auto px-4 ${isHomePage ? 'eventora-navbar-container' : ''}`}>
                <div className="flex flex-col md:flex-row justify-between items-center py-4 gap-4">
                    <div className="flex items-center gap-4">
                        <Link to="/" className="eventora-brand text-white text-2xl font-bold flex items-center gap-2">
                            <FaTicketAlt /> Eventora
                        </Link>
                    </div>
                    <div className={`flex flex-wrap items-center justify-center gap-4 sm:gap-6 md:justify-end ${isHomePage ? 'eventora-navbar-home-actions' : ''}`}>
                        {isHomePage && !user && (
                            <div className="eventora-home-nav">
                                <a href="#top">Home</a>
                                <a href="#about">About us</a>
                                <a href="#event-list">Events</a>
                            </div>
                        )}
                        {!user && (
                            <div className="flex items-center gap-2">
                                <Link to="/login" className="rounded-lg border border-white/30 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10">Login</Link>
                                <Link to="/register" className="rounded-lg bg-teal-500 px-3 py-2 text-sm font-semibold text-gray-950 transition hover:bg-teal-300">Sign Up</Link>
                            </div>
                        )}
                        {user ? (
                            <>
                                <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                                    <Link to="/" className="eventora-nav-link text-gray-200 hover:text-white transition">Home</Link>
                                    <Link to={user.role === 'admin' ? '/admin' : '/dashboard'} className="eventora-nav-link inline-flex items-center gap-2 text-gray-200 transition hover:text-white">
                                        <FiGrid aria-hidden="true" />
                                        {user.role === 'admin' ? 'Admin dashboard' : 'Dashboard'}
                                    </Link>
                                    {user.role !== 'admin' && <Link to="/my-bookings" className="eventora-nav-link text-gray-200 transition hover:text-white">My Bookings</Link>}
                                    <Link to="/profile" className="eventora-nav-link text-gray-200 hover:text-white transition">Profile</Link>
                                </div>
                                <div className="relative" ref={profileRef}>
                                    <button
                                        type="button"
                                        aria-label="Open profile menu"
                                        aria-expanded={profileOpen}
                                        aria-controls="profile-menu"
                                        onClick={() => setProfileOpen((open) => !open)}
                                        className="flex items-center gap-2 rounded-full text-white transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-white/70"
                                    >
                                        <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-white/70 bg-gray-700">
                                            {profileImageUrl ? (
                                                <img src={profileImageUrl} alt="" className="h-full w-full object-cover" />
                                            ) : (
                                                <FiUser className="h-5 w-5" aria-hidden="true" />
                                            )}
                                        </span>
                                        <FiChevronDown className={`h-4 w-4 transition-transform ${profileOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                                    </button>
                                    {profileOpen && (
                                        <div id="profile-menu" className="absolute right-0 top-full z-50 mt-3 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 bg-white p-4 text-left text-gray-900 shadow-xl">
                                            <p className="text-xs font-semibold uppercase text-gray-500">Account</p>
                                            <p className="mt-2 break-words font-semibold">{user.name || 'Eventora user'}</p>
                                            <p className="mt-1 break-all text-sm text-gray-600">{user.email}</p>
                                            {user.phone && <p className="mt-2 break-all text-sm text-gray-600">{user.phone}</p>}
                                            <p className="mt-2 text-xs capitalize text-gray-500">{user.role || 'user'}</p>
                                            <Link
                                                to="/profile"
                                                onClick={() => setProfileOpen(false)}
                                                className="mt-4 block w-full rounded-lg border border-gray-200 px-4 py-2 text-center text-sm font-semibold text-gray-800 transition hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-200"
                                            >
                                                Profile & Settings
                                            </Link>
                                            <Link
                                                to="/profile#password-heading"
                                                onClick={() => setProfileOpen(false)}
                                                className="mt-2 block w-full rounded-lg px-4 py-2 text-center text-sm font-semibold text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-200"
                                            >
                                                Change password
                                            </Link>
                                            <button
                                                type="button"
                                                onClick={handleLogout}
                                                className="mt-2 w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black focus:outline-none focus:ring-4 focus:ring-gray-200"
                                            >
                                                Logout
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            null
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
