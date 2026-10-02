import React, { useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FiCalendar, FiEye, FiEyeOff, FiFileText, FiKey, FiLogOut, FiPrinter, FiShield, FiTrash2, FiUser, FiX, FiXCircle } from 'react-icons/fi';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/axios';
import { formatBookingSlot } from '../utils/eventSlot';

const strongPasswordPattern = /^(?=(?:.*[A-Za-z]){2})(?=(?:.*\d){2})(?=.*[@#$]).{6,}$/;

const Profile = () => {
    const { user, logout } = useContext(AuthContext);
    const location = useLocation();
    const navigate = useNavigate();
    const [bookings, setBookings] = useState([]);
    const [bookingsLoading, setBookingsLoading] = useState(true);
    const [bookingsError, setBookingsError] = useState('');
    const [cancellingBookingId, setCancellingBookingId] = useState(null);
    const [bookingActionError, setBookingActionError] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [showBookings, setShowBookings] = useState(false);
    const [receiptBooking, setReceiptBooking] = useState(null);
    const [deletePassword, setDeletePassword] = useState('');
    const [showDeletePassword, setShowDeletePassword] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);

    useEffect(() => {
        if (!user) {
            navigate('/login', { replace: true });
            return undefined;
        }
        if (user.role === 'admin') {
            setBookingsLoading(false);
            return undefined;
        }

        let cancelled = false;
        api.get('/bookings/my')
            .then(({ data }) => {
                if (!cancelled) setBookings(data);
            })
            .catch((error) => {
                if (!cancelled) setBookingsError(error.response?.data?.message || 'Could not load your bookings.');
            })
            .finally(() => {
                if (!cancelled) setBookingsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [user, navigate]);

    useEffect(() => {
        if (location.hash === '#password-heading') {
            setShowPasswordForm(true);
            document.getElementById('password-heading')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [location.hash]);

    const handleCancelBooking = async (booking) => {
        const eventTitle = booking.eventId?.title || 'this event';
        if (!window.confirm(`Cancel your booking for ${eventTitle}?`)) return;

        setCancellingBookingId(booking._id);
        setBookingActionError('');
        try {
            await api.delete(`/bookings/${booking._id}`);
            setBookings((currentBookings) => currentBookings.map((currentBooking) => (
                currentBooking._id === booking._id ? { ...currentBooking, status: 'cancelled' } : currentBooking
            )));
        } catch (error) {
            setBookingActionError(error.response?.data?.message || 'Could not cancel this booking.');
        } finally {
            setCancellingBookingId(null);
        }
    };

    const handleChangePassword = async (event) => {
        event.preventDefault();
        setPasswordMessage('');
        setPasswordError('');

        if (!strongPasswordPattern.test(newPassword)) {
            setPasswordError('Use at least 6 characters, 2 letters, 2 numbers, and one of @, #, or $.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError('New passwords do not match.');
            return;
        }

        setPasswordLoading(true);
        try {
            const { data } = await api.patch('/auth/change-password', {
                currentPassword,
                newPassword,
                confirmPassword
            });
            setPasswordMessage(data.message);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error) {
            setPasswordError(error.response?.data?.message || 'Could not change your password.');
        } finally {
            setPasswordLoading(false);
        }
    };

    const handleDeleteAccount = async (event) => {
        event.preventDefault();
        setDeleteError('');
        if (!window.confirm('Delete your account? Your profile details will be anonymized. Existing booking records will be retained.')) return;

        setDeleteLoading(true);
        try {
            await api.delete('/auth/account', { data: { password: deletePassword } });
            logout();
            navigate('/register', { replace: true });
        } catch (error) {
            setDeleteError(error.response?.data?.message || 'Could not delete your account.');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login', { replace: true });
    };

    if (!user) return null;

    const profileImageUrl = user.profileImage
        ? new URL(user.profileImage, api.defaults.baseURL).toString()
        : '';

    return (
        <div className="mx-auto max-w-5xl px-2 py-4 text-gray-900 sm:py-8">
            <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-950 via-gray-900 to-teal-950 px-6 py-7 text-white shadow-xl sm:px-9 sm:py-9">
                <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(ellipse_at_top_right,rgba(45,212,191,0.2),transparent_65%)]" aria-hidden="true" />
                <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-4 sm:gap-5">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-teal-500 text-2xl font-bold text-white ring-4 ring-white/20 shadow-lg sm:h-24 sm:w-24">
                        {profileImageUrl ? (
                            <img src={profileImageUrl} alt="Profile" className="h-full w-full object-cover" />
                        ) : user.name ? (
                            user.name.charAt(0).toUpperCase()
                        ) : (
                            <FiUser aria-hidden="true" />
                        )}
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-300">Your Eventora account</p>
                        <h1 className="mt-2 break-words text-2xl font-bold sm:text-3xl">{user.name || 'Eventora user'}</h1>
                        <p className="mt-1 break-all text-sm text-gray-300">{user.email || 'Manage your profile and preferences'}</p>
                        <span className="mt-3 inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold capitalize text-teal-100">{user.role || 'user'} account</span>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20 focus:outline-none focus:ring-4 focus:ring-white/20 sm:self-center"
                >
                    <FiLogOut aria-hidden="true" /> Log out
                </button>
                </div>
            </header>

            <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-labelledby="profile-info-heading">
                <h2 id="profile-info-heading" className="sr-only">Personal information</h2>
                <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Full name</p>
                    <p className="mt-2 break-words font-semibold text-gray-900">{user.name || 'Not provided'}</p>
                </div>
                <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Email address</p>
                    <p className="mt-2 break-all font-semibold text-gray-900">{user.email || 'Not provided'}</p>
                </div>
                <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Phone number</p>
                    <p className="mt-2 break-all font-semibold text-gray-900">{user.phone || 'Not provided'}</p>
                </div>
                <div className="min-w-0 rounded-xl border border-teal-100 bg-teal-50 p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wider text-teal-800">Account type</p>
                    <p className="mt-2 capitalize font-semibold text-teal-950">{user.role || 'user'}</p>
                </div>
            </section>

            <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="password-heading">
                <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-800"><FiKey aria-hidden="true" /></span>
                    <div className="min-w-0">
                        <h2 id="password-heading" className="text-lg font-bold">Change password</h2>
                        <p className="mt-0.5 text-sm text-gray-500">Keep your account secure with a fresh password.</p>
                    </div>
                    <button
                        type="button"
                        aria-expanded={showPasswordForm}
                        aria-controls="password-form"
                        aria-label={showPasswordForm ? 'Close change password form' : 'Open change password form'}
                        onClick={() => setShowPasswordForm((isOpen) => !isOpen)}
                        className="ml-auto shrink-0 rounded-lg border border-teal-200 px-3 py-2 text-sm font-semibold text-teal-800 transition hover:bg-teal-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-100"
                    >
                        {showPasswordForm ? 'Close' : 'Change'}
                    </button>
                </div>
                {showPasswordForm && <form id="password-form" onSubmit={handleChangePassword} className="mt-6 grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2 text-sm font-medium text-gray-700 sm:col-span-2">
                        Current password
                        <span className="relative block">
                            <input type={showCurrentPassword ? 'text' : 'password'} autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-11 text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-4 focus:ring-gray-200" />
                            <button type="button" aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'} onClick={() => setShowCurrentPassword((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600">
                                {showCurrentPassword ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
                            </button>
                        </span>
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-gray-700">
                        New password
                        <span className="relative block">
                            <input type={showNewPassword ? 'text' : 'password'} autoComplete="new-password" required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-11 text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-4 focus:ring-gray-200" />
                            <button type="button" aria-label={showNewPassword ? 'Hide new password' : 'Show new password'} onClick={() => setShowNewPassword((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600">
                                {showNewPassword ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
                            </button>
                        </span>
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-gray-700">
                        Confirm new password
                        <span className="relative block">
                            <input type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-11 text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-4 focus:ring-gray-200" />
                            <button type="button" aria-label={showConfirmPassword ? 'Hide confirmed password' : 'Show confirmed password'} onClick={() => setShowConfirmPassword((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600">
                                {showConfirmPassword ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
                            </button>
                        </span>
                    </label>
                    {passwordError && <p className="text-sm font-medium text-red-700 sm:col-span-2">{passwordError}</p>}
                    {passwordMessage && <p className="text-sm font-medium text-green-700 sm:col-span-2">{passwordMessage}</p>}
                    <div className="sm:col-span-2">
                        <button type="submit" disabled={passwordLoading} className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60">
                            <FiKey aria-hidden="true" /> {passwordLoading ? 'Updating...' : 'Update password'}
                        </button>
                    </div>
                </form>}
            </section>

            {user.role !== 'admin' && (
                <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="bookings-heading">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-800"><FiCalendar aria-hidden="true" /></span>
                        <div>
                            <h2 id="bookings-heading" className="text-lg font-bold">Event bookings</h2>
                            <p className="mt-0.5 text-sm text-gray-500">Your tickets and booking history.</p>
                        </div>
                        <button
                            type="button"
                            aria-expanded={showBookings}
                            aria-controls="booking-list"
                            aria-label={showBookings ? 'Hide event bookings' : 'Show event bookings'}
                            onClick={() => setShowBookings((isOpen) => !isOpen)}
                            className="ml-auto shrink-0 rounded-lg border border-amber-200 px-3 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-100"
                        >
                            {showBookings ? 'Hide' : 'Show bookings'}
                        </button>
                    </div>
                    <div id="booking-list" hidden={!showBookings} className="mt-5">
                        {bookingActionError && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">{bookingActionError}</p>}
                        {bookingsLoading ? (
                            <p className="text-sm text-gray-500">Loading your bookings...</p>
                        ) : bookingsError ? (
                            <p role="alert" className="text-sm text-red-700">{bookingsError}</p>
                        ) : bookings.length === 0 ? (
                            <p className="text-sm text-gray-500">You don’t have any event bookings yet. <Link to="/" className="font-semibold text-gray-900 underline">Browse events</Link></p>
                        ) : (
                            <ul className="grid gap-3">
                                {bookings.map((booking) => (
                                    <li key={booking._id} className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 transition-colors hover:border-teal-200 hover:bg-white sm:flex-row sm:items-center sm:justify-between sm:p-5">
                                    <div className="min-w-0">
                                        <p className="break-words text-base font-bold text-gray-900">{booking.eventId?.title || 'Event details unavailable'}</p>
                                        <div className="mt-3 grid gap-x-6 gap-y-2 text-sm text-gray-600 sm:grid-cols-2">
                                            <p><span className="font-medium text-gray-700">Event date:</span> {formatBookingSlot(booking)}</p>
                                            <p><span className="font-medium text-gray-700">Location:</span> {booking.eventId?.location || 'Unavailable'}</p>
                                            <p><span className="font-medium text-gray-700">Seats:</span> {booking.selectedSeats?.length ? booking.selectedSeats.join(', ') : booking.selectedSeat || 'Not assigned'}</p>
                                            <p><span className="font-medium text-gray-700">Amount:</span> {booking.amount === 0 ? 'Free' : `₹${booking.amount}`}</p>
                                            <p><span className="font-medium text-gray-700">Payment:</span> {String(booking.paymentStatus || 'not_paid').replace('_', ' ')}</p>
                                            <p><span className="font-medium text-gray-700">Requested:</span> {booking.bookedAt ? new Date(booking.bookedAt).toLocaleDateString() : 'Unavailable'}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${booking.status === 'confirmed' ? 'bg-green-100 text-green-800' : booking.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{booking.status}</span>
                                        <button type="button" onClick={() => setReceiptBooking(booking)} className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-white px-3 py-1.5 text-sm font-semibold text-teal-800 transition hover:bg-teal-50" aria-label={`Generate receipt for ${booking.eventId?.title || 'booking'}`}>
                                            <FiFileText aria-hidden="true" /> Receipt
                                        </button>
                                        {booking.eventId && <Link to={`/events/${booking.eventId._id}`} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-800 transition hover:border-teal-600 hover:text-teal-800">View event</Link>}
                                        {booking.status === 'confirmed' && (
                                            <button type="button" onClick={() => handleCancelBooking(booking)} disabled={cancellingBookingId === booking._id} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60">
                                                <FiXCircle aria-hidden="true" /> {cancellingBookingId === booking._id ? 'Cancelling...' : 'Cancel booking'}
                                            </button>
                                        )}
                                    </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </section>
            )}

            <section className="mt-5 rounded-2xl border border-red-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="privacy-heading">
                <div className="mb-3 flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-700"><FiShield aria-hidden="true" /></span>
                    <div>
                        <h2 id="privacy-heading" className="text-lg font-bold">Account data</h2>
                        <p className="mt-0.5 text-sm text-gray-500">Manage your profile data and access.</p>
                    </div>
                </div>
                <p className="max-w-2xl text-sm leading-6 text-gray-600">
                    Deleting your account removes your profile details and sign-in access. Existing event booking records are retained without your personal details.
                </p>
                {user.role !== 'admin' && (
                    <form onSubmit={handleDeleteAccount} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                        <label className="grid w-full gap-2 text-sm font-medium text-gray-700 sm:max-w-sm">
                            Confirm with your password
                            <span className="relative block">
                                <input type={showDeletePassword ? 'text' : 'password'} autoComplete="current-password" required value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-11 text-gray-900 focus:border-red-700 focus:outline-none focus:ring-4 focus:ring-red-100" />
                                <button type="button" aria-label={showDeletePassword ? 'Hide password' : 'Show password'} onClick={() => setShowDeletePassword((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600">
                                    {showDeletePassword ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
                                </button>
                            </span>
                        </label>
                        <button type="submit" disabled={deleteLoading} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60">
                            <FiTrash2 aria-hidden="true" /> {deleteLoading ? 'Deleting...' : 'Delete account'}
                        </button>
                    </form>
                )}
                {deleteError && <p role="alert" className="mt-3 text-sm font-medium text-red-700">{deleteError}</p>}
            </section>

            {receiptBooking && createPortal(
                <div className="receipt-overlay fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-gray-950/60 p-4">
                    <section className="receipt-print-area relative my-auto w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl sm:p-9" role="dialog" aria-modal="true" aria-labelledby="receipt-heading">
                        <div className="receipt-print-actions absolute right-4 top-4 flex items-center gap-2">
                            <button type="button" onClick={() => window.print()} aria-label="Print or save receipt" title="Print or save receipt" className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-700 transition hover:bg-gray-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-100">
                                <FiPrinter aria-hidden="true" />
                            </button>
                            <button type="button" onClick={() => setReceiptBooking(null)} aria-label="Close receipt" title="Close receipt" className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-700 transition hover:bg-gray-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-gray-200">
                                <FiX aria-hidden="true" />
                            </button>
                        </div>
                        <header className="border-b border-dashed border-gray-300 pb-4 pr-24">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-800">Eventora</p>
                            <h2 id="receipt-heading" className="mt-2 text-2xl font-bold text-gray-950">Booking receipt</h2>
                            <p className="mt-1 break-all text-sm text-gray-500">Booking ID: {receiptBooking._id}</p>
                        </header>
                        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
                            {receiptBooking.eventId?.image ? (
                                <img src={receiptBooking.eventId.image} alt={receiptBooking.eventId.title || 'Event'} className="h-32 w-full object-cover" />
                            ) : (
                                <div className="flex h-32 items-center justify-center bg-gray-100 text-sm font-semibold text-gray-500">Event image unavailable</div>
                            )}
                            <div className="bg-gray-50 px-4 py-3">
                                <p className="text-xs font-bold uppercase tracking-wider text-teal-800">Event</p>
                                <h3 className="mt-1 break-words text-lg font-bold text-gray-900">{receiptBooking.eventId?.title || 'Event details unavailable'}</h3>
                                <div className="mt-2 grid gap-1 text-sm text-gray-600 sm:grid-cols-2">
                                    <p>Date: {formatBookingSlot(receiptBooking)}</p>
                                    <p className="break-words">Location: {receiptBooking.eventId?.location || 'Unavailable'}</p>
                                </div>
                            </div>
                        </div>
                        <div className="grid gap-4 border-b border-dashed border-gray-300 py-4 sm:grid-cols-2">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Booked by</p>
                                <p className="mt-1 break-words font-semibold text-gray-900">{user.name || 'Eventora user'}</p>
                                <p className="mt-1 break-all text-sm text-gray-600">{user.email || 'Not provided'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Booking date</p>
                                <p className="mt-1 font-semibold text-gray-900">{receiptBooking.bookedAt ? new Date(receiptBooking.bookedAt).toLocaleDateString() : 'Unavailable'}</p>
                                <p className="mt-1 text-sm capitalize text-gray-600">Status: {receiptBooking.status || 'pending'}</p>
                            </div>
                        </div>
                        {receiptBooking.attendees?.length > 0 ? (
                            <div className="border-b border-dashed border-gray-300 py-4">
                                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Attendees</p>
                                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                                    {receiptBooking.attendees.map((attendee) => (
                                        <li key={attendee.seat} className="rounded-xl border border-gray-200 bg-white p-3">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <span className="inline-flex min-w-[5.25rem] shrink-0 justify-center rounded-lg bg-teal-50 px-2 py-2 text-xs font-bold uppercase text-teal-900">Seat {attendee.seat}</span>
                                                <div className="min-w-0">
                                                    <p className="break-words font-semibold text-gray-900">{attendee.name}</p>
                                                    <p className="mt-0.5 text-xs text-gray-500">Age {attendee.age}</p>
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ) : (
                            <p className="border-b border-dashed border-gray-300 py-4 text-sm text-gray-600">
                                <span className="font-semibold text-gray-800">Seats:</span> {receiptBooking.selectedSeats?.length ? receiptBooking.selectedSeats.join(', ') : receiptBooking.selectedSeat || 'Not assigned'}
                            </p>
                        )}
                        <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-teal-900">Total amount</p>
                                <p className="mt-1 text-sm capitalize text-gray-700">Payment: {String(receiptBooking.paymentStatus || 'not_paid').replace('_', ' ')}</p>
                            </div>
                            <span className="shrink-0 text-2xl font-bold text-teal-950">{receiptBooking.amount === 0 ? 'Free' : `₹${receiptBooking.amount}`}</span>
                        </div>
                    </section>
                </div>,
                document.body
            )}
        </div>
    );
};

export default Profile;
