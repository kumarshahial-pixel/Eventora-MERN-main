import React, { useContext, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaDownload, FaTicketAlt, FaTimesCircle } from 'react-icons/fa';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/axios';
import { formatBookingSlot } from '../utils/eventSlot';

const MyBookings = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [downloadingBookingId, setDownloadingBookingId] = useState(null);
    const [cancellationBooking, setCancellationBooking] = useState(null);
    const [selectedCancellationSeats, setSelectedCancellationSeats] = useState([]);
    const [cancellingSeats, setCancellingSeats] = useState(false);

    const fetchBookings = async () => {
        setLoading(true);
        setError('');
        try {
            const { data } = await api.get('/bookings/my');
            setBookings(data);
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Could not load your bookings. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }
        fetchBookings();
    }, [user, navigate]);

    const cancelBooking = async (bookingId) => {
        if (!window.confirm('Are you sure you want to cancel this booking request?')) return;
        try {
            await api.delete(`/bookings/${bookingId}`);
            fetchBookings();
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Could not cancel this booking. Please try again.');
        }
    };

    const openCancellationOptions = (booking) => {
        if (booking.status === 'confirmed' && booking.selectedSeats?.length > 1) {
            setCancellationBooking(booking);
            setSelectedCancellationSeats([]);
            return;
        }
        cancelBooking(booking._id);
    };

    const cancelSelectedSeats = async () => {
        if (!cancellationBooking || selectedCancellationSeats.length === 0) return;
        const ticketDescription = selectedCancellationSeats.length === 1
            ? `ticket for seat ${selectedCancellationSeats[0]}`
            : `tickets for seats ${selectedCancellationSeats.join(', ')}`;
        if (!window.confirm(`Are you sure you want to cancel the ${ticketDescription}? This cannot be undone.`)) return;

        setCancellingSeats(true);
        setError('');
        try {
            await api.post(`/bookings/${cancellationBooking._id}/cancel-seats`, { seatNumbers: selectedCancellationSeats });
            setCancellationBooking(null);
            setSelectedCancellationSeats([]);
            await fetchBookings();
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Could not cancel the selected tickets. Please try again.');
        } finally {
            setCancellingSeats(false);
        }
    };

    const downloadTicket = async (bookingId) => {
        setDownloadingBookingId(bookingId);
        setError('');
        try {
            const { data } = await api.get(`/bookings/${bookingId}/ticket`, { responseType: 'blob' });
            const ticketUrl = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
            const downloadLink = document.createElement('a');
            downloadLink.href = ticketUrl;
            downloadLink.download = `Eventora-ticket-${bookingId}.pdf`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            downloadLink.remove();
            window.setTimeout(() => URL.revokeObjectURL(ticketUrl), 1000);
        } catch {
            setError('Could not download the ticket PDF. Please try again.');
        } finally {
            setDownloadingBookingId(null);
        }
    };

    return (
        <div className="mx-auto max-w-7xl px-2 py-6">
            <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-800">Your Eventora account</p>
                    <h1 className="mt-1 text-3xl font-bold text-slate-950 sm:text-4xl">My Bookings</h1>
                    <p className="mt-2 text-sm text-slate-600">Review your event bookings, seats, and payment status.</p>
                </div>
                <Link to="/dashboard" className="inline-flex items-center rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-teal-800">
                    Explore events
                </Link>
            </header>

            {error && <div role="alert" className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

            {loading ? (
                <div className="py-16 text-center text-sm font-semibold text-slate-500">Loading your bookings...</div>
            ) : bookings.length === 0 ? (
                <div className="border-y border-slate-200 py-16 text-center">
                    <FaTicketAlt className="mx-auto text-3xl text-slate-300" aria-hidden="true" />
                    <p className="mt-4 text-lg font-semibold text-slate-700">You haven't booked any events yet.</p>
                    <Link to="/dashboard" className="mt-5 inline-flex rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-black">
                        Find an event
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {bookings.map((booking) => (
                        <article key={booking._id} className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                            <div className="flex flex-1 flex-col p-5">
                                {booking.eventId ? (
                                    <>
                                        <div className="mb-5 flex items-start justify-between gap-3">
                                            <h2 className="text-lg font-bold leading-tight text-slate-900">{booking.eventId.title}</h2>
                                            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${booking.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : booking.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {booking.status}
                                            </span>
                                        </div>
                                        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                                            <div>
                                                <dt className="text-xs font-semibold uppercase text-slate-400">Event date</dt>
                                                <dd className="mt-1 font-medium text-slate-800">{formatBookingSlot(booking)}</dd>
                                            </div>
                                            <div>
                                                <dt className="text-xs font-semibold uppercase text-slate-400">Seat{booking.selectedSeats?.length > 1 ? 's' : ''}</dt>
                                                <dd className="mt-1 font-medium text-slate-800">
                                                    {booking.selectedSeats?.length ? booking.selectedSeats.join(', ') : booking.selectedSeat || 'Not assigned'}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt className="text-xs font-semibold uppercase text-slate-400">Amount</dt>
                                                <dd className="mt-1 font-medium text-slate-800">{booking.amount === 0 ? 'Free' : `₹${booking.amount}`}</dd>
                                            </div>
                                            <div>
                                                <dt className="text-xs font-semibold uppercase text-slate-400">Requested</dt>
                                                <dd className="mt-1 font-medium text-slate-800">{new Date(booking.bookedAt).toLocaleDateString()}</dd>
                                            </div>
                                            {booking.status !== 'cancelled' && (
                                                <div className="col-span-2">
                                                    <dt className="text-xs font-semibold uppercase text-slate-400">Payment</dt>
                                                    <dd className="mt-1 font-medium capitalize text-slate-800">{booking.paymentStatus.replace('_', ' ')}</dd>
                                                </div>
                                            )}
                                        </dl>
                                    </>
                                ) : (
                                    <p className="italic text-red-500">Event details unavailable (the event may have been deleted).</p>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 p-4">
                                {booking.eventId && booking.status !== 'cancelled' ? (
                                    <>
                                        <div className="flex flex-wrap items-center gap-3">
                                            <Link to={`/events/${booking.eventId._id}`} className="text-sm font-semibold text-slate-800 transition hover:text-teal-800 hover:underline">
                                                View event
                                            </Link>
                                            {booking.status === 'confirmed' && (
                                                <button type="button" onClick={() => downloadTicket(booking._id)} disabled={downloadingBookingId === booking._id} className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-wait disabled:opacity-60">
                                                    <FaDownload aria-hidden="true" /> {downloadingBookingId === booking._id ? 'Preparing PDF...' : 'Ticket PDF'}
                                                </button>
                                            )}
                                        </div>
                                        <button type="button" onClick={() => openCancellationOptions(booking)} className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50">
                                            <FaTimesCircle aria-hidden="true" /> Cancel booking
                                        </button>
                                    </>
                                ) : (
                                    <div className="w-full text-center text-sm font-medium text-slate-500">Booking cancelled</div>
                                )}
                            </div>
                        </article>
                    ))}
                </div>
            )}
            {cancellationBooking && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4">
                    <section role="dialog" aria-modal="true" aria-labelledby="cancel-ticket-heading" className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
                        <h2 id="cancel-ticket-heading" className="text-xl font-bold text-slate-950">Select tickets to cancel</h2>
                        <p className="mt-2 text-sm text-slate-600">Choose one or more seats. Unselected tickets will remain booked.</p>
                        <fieldset className="mt-5 grid gap-2">
                            <legend className="sr-only">Tickets in this booking</legend>
                            {cancellationBooking.selectedSeats.map((seat) => {
                                const attendee = cancellationBooking.attendees?.find((person) => person.seat === seat);
                                const checked = selectedCancellationSeats.includes(seat);
                                return (
                                    <label key={seat} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 ${checked ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}`}>
                                        <input type="checkbox" checked={checked} onChange={() => setSelectedCancellationSeats((current) => checked ? current.filter((value) => value !== seat) : [...current, seat])} className="h-4 w-4 accent-red-600" />
                                        <span className="font-semibold text-slate-800">Seat {seat}</span>
                                        {attendee?.name && <span className="min-w-0 truncate text-sm text-slate-500">{attendee.name}</span>}
                                    </label>
                                );
                            })}
                        </fieldset>
                        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <button type="button" onClick={() => setCancellationBooking(null)} disabled={cancellingSeats} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Keep booking</button>
                            <button type="button" onClick={cancelSelectedSeats} disabled={!selectedCancellationSeats.length || cancellingSeats} className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">{cancellingSeats ? 'Cancelling...' : `Cancel ${selectedCancellationSeats.length || ''} selected ticket${selectedCancellationSeats.length === 1 ? '' : 's'}`}</button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
};

export default MyBookings;