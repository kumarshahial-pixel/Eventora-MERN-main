import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/axios';
import { useNavigate } from 'react-router-dom';
import { formatBookingSlot } from '../utils/eventSlot';

const emptyEventForm = {
    title: '', description: '', date: '', endDate: '', startTime: '', endTime: '', repeatEveryDays: '2',
    location: '', category: '', totalSeats: '', ticketPrice: '', image: '', seatTypes: [{ name: 'General', price: '', totalSeats: '' }]
};

const AdminDashboard = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [events, setEvents] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showEventForm, setShowEventForm] = useState(false);
    const [formData, setFormData] = useState(emptyEventForm);

    useEffect(() => {
        if (!user || user.role !== 'admin') {
            navigate('/login');
            return;
        }
        fetchData();
    }, [user, navigate]);

    const fetchData = async () => {
        try {
            const [eventsRes, bookingsRes] = await Promise.all([
                api.get('/events'),
                api.get('/bookings/my') // Admin gets all bookings
            ]);
            setEvents(eventsRes.data);
            setBookings(bookingsRes.data);
        } catch (error) {
            console.error('Error fetching admin data', error);
        } finally {
            setLoading(false);
        }
    };

    const updateSeatType = (index, field, value) => {
        setFormData((current) => ({
            ...current,
            seatTypes: current.seatTypes.map((seatType, seatTypeIndex) =>
                seatTypeIndex === index ? { ...seatType, [field]: value } : seatType
            )
        }));
    };

    const addSeatType = () => {
        setFormData((current) => ({
            ...current,
            seatTypes: [...current.seatTypes, { name: '', price: '', totalSeats: '' }]
        }));
    };

    const removeSeatType = (index) => {
        setFormData((current) => ({
            ...current,
            seatTypes: current.seatTypes.length > 1 ? current.seatTypes.filter((_, seatTypeIndex) => seatTypeIndex !== index) : [{ name: 'General', price: '', totalSeats: '' }]
        }));
    };

    const handleCreateEvent = async (e) => {
        e.preventDefault();
        try {
            const seatTypes = formData.seatTypes
                .map((seatType) => ({
                    name: seatType.name.trim(),
                    price: Number(seatType.price) || 0,
                    totalSeats: Number(seatType.totalSeats) || 0
                }))
                .filter((seatType) => seatType.name && seatType.totalSeats > 0);

            const payload = {
                ...formData,
                ticketPrice: Number(formData.ticketPrice) || 0,
                totalSeats: Number(formData.totalSeats) || 0,
                seatTypes: seatTypes.length ? seatTypes : [{ name: 'General', price: Number(formData.ticketPrice) || 0, totalSeats: Number(formData.totalSeats) || 1 }]
            };
            await api.post('/events', payload);
            setShowEventForm(false);
            setFormData(emptyEventForm);
            fetchData();
        } catch (error) {
            alert(error.response?.data?.message || 'Error creating event');
        }
    };

    const handleDeleteEvent = async (id) => {
        if (window.confirm('Are you sure you want to delete this event?')) {
            try {
                await api.delete(`/events/${id}`);
                fetchData();
            } catch (error) {
                alert('Error deleting event');
            }
        }
    };

    const handleConfirmBooking = async (id, paymentStatus) => {
        try {
            await api.put(`/bookings/${id}/confirm`, { paymentStatus });
            fetchData();
        } catch (error) {
            alert(error.response?.data?.message || 'Error confirming booking');
        }
    };

    const handleCancelBooking = async (id) => {
        if (window.confirm('Cancel this user\'s booking request?')) {
            try {
                await api.delete(`/bookings/${id}`);
                fetchData();
            } catch (error) {
                alert(error.response?.data?.message || 'Error cancelling booking');
            }
        }
    };

    if (loading) return <div className="text-center py-20 text-xl font-semibold">Loading admin panel...</div>;

    return (
        <div className="max-w-7xl mx-auto">
            <div className="bg-black text-white rounded-2xl p-6 sm:p-8 mb-8 shadow-lg flex flex-col md:flex-row justify-between items-center gap-6 text-center md:text-left">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold mb-2">Admin Dashboard</h1>
                    <p className="text-gray-300">Manage events and manually confirm bookings.</p>
                </div>
                <button
                    onClick={() => setShowEventForm(!showEventForm)}
                    className="w-full md:w-auto bg-white text-black font-bold py-3 px-6 rounded-lg hover:bg-gray-100 transition shadow-md"
                >
                    {showEventForm ? 'Cancel Creation' : '+ Create New Event'}
                </button>
            </div>

            {/* Admin Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-1">Total Revenue</p>
                        <h3 className="text-3xl font-black text-green-600">₹{bookings.reduce((sum, b) => b.paymentStatus === 'paid' && b.status === 'confirmed' ? sum + b.amount : sum, 0)}</h3>
                    </div>
                    <div className="w-12 h-12 bg-green-100 text-green-500 rounded-full flex items-center justify-center text-xl font-bold">₹</div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-1">Paid Clients</p>
                        <h3 className="text-3xl font-black text-blue-600">{new Set(bookings.filter(b => b.paymentStatus === 'paid' && b.status === 'confirmed').map(b => b.userId?._id)).size}</h3>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center text-xl font-bold">👤</div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-1">Pending Requests</p>
                        <h3 className="text-3xl font-black text-yellow-600">{bookings.filter(b => b.status === 'pending').length}</h3>
                    </div>
                    <div className="w-12 h-12 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center text-xl font-bold">⏳</div>
                </div>
            </div>

            {showEventForm && (
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 mb-8 animation-slideDown">
                    <h2 className="text-2xl font-bold mb-6 text-gray-800">Create New Event</h2>
                    <form onSubmit={handleCreateEvent} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <input required type="text" placeholder="Event Title" className="border px-4 py-3 rounded-lg focus:ring-2 focus:ring-gray-700 outline-none transition" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                        <input required type="text" placeholder="Category (e.g., Tech, Music)" className="border px-4 py-3 rounded-lg focus:ring-2 focus:ring-gray-700 outline-none transition" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} />
                        <label className="grid gap-1 text-sm font-semibold text-gray-700">First date<input required type="date" className="border px-4 py-3 rounded-lg focus:ring-2 focus:ring-gray-700 outline-none transition" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} /></label>
                        <label className="grid gap-1 text-sm font-semibold text-gray-700">Last date<input required type="date" min={formData.date} className="border px-4 py-3 rounded-lg focus:ring-2 focus:ring-gray-700 outline-none transition" value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} /></label>
                        <label className="grid gap-1 text-sm font-semibold text-gray-700">Starts at<input required type="time" className="border px-4 py-3 rounded-lg focus:ring-2 focus:ring-gray-700 outline-none transition" value={formData.startTime} onChange={e => setFormData({ ...formData, startTime: e.target.value })} /></label>
                        <label className="grid gap-1 text-sm font-semibold text-gray-700">Ends at<input required type="time" className="border px-4 py-3 rounded-lg focus:ring-2 focus:ring-gray-700 outline-none transition" value={formData.endTime} onChange={e => setFormData({ ...formData, endTime: e.target.value })} /></label>
                        <label className="grid gap-1 text-sm font-semibold text-gray-700">Repeat every<select className="border px-4 py-3 rounded-lg focus:ring-2 focus:ring-gray-700 outline-none transition" value={formData.repeatEveryDays} onChange={e => setFormData({ ...formData, repeatEveryDays: e.target.value })}><option value="2">2 days</option><option value="4">4 days</option></select></label>
                        <p className="self-end pb-3 text-sm text-gray-500">Dates repeat through the last date; seat capacity resets for each date.</p>
                        <input required type="text" placeholder="Location" className="border px-4 py-3 rounded-lg focus:ring-2 focus:ring-gray-700 outline-none transition" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} />
                        <input type="number" placeholder="Total Seats (calculated from types)" className="border px-4 py-3 rounded-lg focus:ring-2 focus:ring-gray-700 outline-none transition" value={formData.totalSeats} onChange={e => setFormData({ ...formData, totalSeats: e.target.value })} />
                        <input type="number" placeholder="Default price (optional)" className="border px-4 py-3 rounded-lg focus:ring-2 focus:ring-gray-700 outline-none transition" value={formData.ticketPrice} onChange={e => setFormData({ ...formData, ticketPrice: e.target.value })} />

                        <div className="md:col-span-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
                            <div className="mb-3 flex items-center justify-between">
                                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-700">Seat Types</h3>
                                <button type="button" onClick={addSeatType} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700">+ Add type</button>
                            </div>
                            <div className="space-y-3">
                                {formData.seatTypes.map((seatType, index) => (
                                    <div key={`seat-type-${index}`} className="grid grid-cols-1 gap-3 md:grid-cols-[1.2fr_1fr_1fr_auto]">
                                        <input type="text" placeholder="Seat type name" value={seatType.name} onChange={(e) => updateSeatType(index, 'name', e.target.value)} className="border px-3 py-2 rounded-lg focus:ring-2 focus:ring-gray-700 outline-none transition" />
                                        <input required type="number" min="0" placeholder="Category price" value={seatType.price} onChange={(e) => updateSeatType(index, 'price', e.target.value)} className="border px-3 py-2 rounded-lg focus:ring-2 focus:ring-gray-700 outline-none transition" />
                                        <input type="number" min="1" placeholder="Seats" value={seatType.totalSeats} onChange={(e) => updateSeatType(index, 'totalSeats', e.target.value)} className="border px-3 py-2 rounded-lg focus:ring-2 focus:ring-gray-700 outline-none transition" />
                                        <button type="button" onClick={() => removeSeatType(index)} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-600">Remove</button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <input type="text" placeholder="Image URL (Provide any direct link to an image)" className="w-full border px-4 py-3 rounded-lg focus:ring-2 focus:ring-gray-700 outline-none transition" value={formData.image} onChange={e => setFormData({ ...formData, image: e.target.value })} />
                        </div>

                        <textarea required placeholder="Event Description" className="border px-4 py-3 rounded-lg md:col-span-2 h-32 focus:ring-2 focus:ring-gray-700 outline-none transition" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                        <button type="submit" className="md:col-span-2 bg-gray-900 text-white font-bold py-3 mt-2 rounded-lg hover:bg-black transition shadow-md">Publish Event</button>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Events Section */}
                <div className="flex flex-col">
                    <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-600 text-sm">{events.length}</span>
                        All Events
                    </h2>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <ul className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                            {events.length === 0 ? <li className="p-6 text-gray-500 text-center">No events created yet.</li> :
                                events.map(event => (
                                    <li key={event._id} className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-gray-50 transition border-b border-gray-100 last:border-0">
                                        <div>
                                            <h4 className="font-bold text-gray-900 mb-1 leading-tight">{event.title}</h4>
                                            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                                                <span className="flex items-center gap-1 font-medium"><div className="w-2 h-2 rounded-full bg-blue-500"></div> {new Date(event.date).toLocaleDateString()}</span>
                                                <span className="flex items-center gap-1 font-medium"><div className={`w-2 h-2 rounded-full ${event.availableSeats > 0 ? 'bg-green-500' : 'bg-red-500'}`}></div> {event.availableSeats}/{event.totalSeats} seats</span>
                                            </div>
                                        </div>
                                        <button onClick={() => handleDeleteEvent(event._id)} className="w-full sm:w-auto text-red-500 hover:text-white hover:bg-red-500 border border-red-200 px-4 py-2 rounded-lg text-sm font-bold transition shadow-sm shrink-0">
                                            Delete
                                        </button>
                                    </li>
                                ))
                            }
                        </ul>
                    </div>
                </div>

                {/* Bookings Section */}
                <div className="flex flex-col">
                    <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-100 text-yellow-700 text-sm font-bold">{bookings.length}</span>
                        Booking Requests
                    </h2>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <ul className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                            {bookings.length === 0 ? <li className="p-6 text-gray-500 text-center">No bookings yet.</li> :
                                bookings.map(booking => (
                                    <li key={booking._id} className={`p-6 hover:bg-gray-50 transition border-l-4 ${booking.status === 'pending' ? 'border-l-yellow-400' : booking.status === 'confirmed' ? 'border-l-green-400' : 'border-l-red-400'}`}>
                                        <div className="flex justify-between items-start mb-3">
                                            <h4 className="font-bold text-gray-900 text-lg leading-tight">{booking.eventId?.title || 'Deleted Event'}</h4>
                                            <div className="flex flex-col gap-1 items-end shrink-0 ml-4">
                                                <span className={`px-2 py-1 text-[10px] font-black rounded uppercase tracking-wider ${booking.status === 'confirmed' ? 'bg-green-100 text-green-700' : booking.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{booking.status}</span>
                                                {booking.status !== 'cancelled' && <span className={`px-2 py-1 text-[10px] font-black rounded uppercase tracking-wider ${booking.paymentStatus === 'paid' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-800'}`}>{booking.paymentStatus.replace('_', ' ')}</span>}
                                            </div>
                                        </div>
                                        <div className="bg-gray-50 rounded-lg p-3 mb-3 border border-gray-100 text-sm">
                                            <p className="text-gray-700 flex items-center gap-2 mb-1">
                                                <span className="font-bold w-16 text-gray-500 uppercase text-xs">User:</span>
                                                <span className="font-semibold">{booking.userId?.name}</span>
                                                <span className="text-gray-400">({booking.userId?.email})</span>
                                            </p>
                                            <p className="text-gray-700 flex items-center gap-2 mb-1">
                                                <span className="font-bold w-16 text-gray-500 uppercase text-xs">Amount:</span>
                                                <span className={`font-semibold ${booking.amount === 0 ? 'text-green-600' : ''}`}>{booking.amount === 0 ? 'Free' : `₹${booking.amount}`}</span>
                                            </p>
                                            <p className="text-gray-700 flex items-center gap-2 mb-1">
                                                <span className="font-bold w-16 text-gray-500 uppercase text-xs">Seat:</span>
                                                <span className="font-semibold">{booking.selectedSeats?.length ? booking.selectedSeats.join(', ') : booking.selectedSeat || 'Not assigned'}</span>
                                            </p>
                                            <p className="text-gray-700 flex items-center gap-2 mb-1">
                                                <span className="font-bold w-16 text-gray-500 uppercase text-xs">Date:</span>
                                                <span>{formatBookingSlot(booking)} · Booked {new Date(booking.bookedAt).toLocaleString()}</span>
                                            </p>
                                            {booking.eventId && (
                                                <p className="text-gray-700 flex items-center gap-2 mt-2 pt-2 border-t border-gray-200">
                                                    <span className="font-bold w-16 text-gray-500 uppercase text-xs">Seats:</span>
                                                    <span className={`font-bold ${booking.eventId.availableSeats > 0 ? 'text-green-600' : 'text-red-500'}`}>{booking.eventId.availableSeats}</span> remaining of {booking.eventId.totalSeats}
                                                </p>
                                            )}
                                        </div>

                                        {/* Action buttons for admin */}
                                        {booking.status === 'pending' && booking.paymentMethod === 'razorpay' && (
                                            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                                                <p className="text-sm font-semibold text-amber-900">Awaiting online payment</p>
                                                <button onClick={() => handleCancelBooking(booking._id)} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50">
                                                    Reject booking
                                                </button>
                                            </div>
                                        )}
                                        {booking.status === 'pending' && booking.paymentMethod !== 'razorpay' && (
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                <button onClick={() => handleConfirmBooking(booking._id, 'paid')} className="flex-1 min-w-[120px] bg-green-50 text-green-700 hover:bg-green-600 hover:text-white border border-green-200 text-xs font-bold py-2.5 px-3 rounded-lg shadow-sm transition">
                                                    ✓ Approve as Paid
                                                </button>
                                                <button onClick={() => handleConfirmBooking(booking._id, 'not_paid')} className="flex-1 min-w-[120px] bg-gray-50 text-gray-700 hover:bg-gray-800 hover:text-white border border-gray-200 text-xs font-bold py-2.5 px-3 rounded-lg shadow-sm transition">
                                                    ✓ Approve Undecided
                                                </button>
                                                <button onClick={() => handleCancelBooking(booking._id)} className="w-[80px] bg-red-50 text-red-600 hover:bg-red-500 hover:text-white border border-red-200 text-xs font-bold py-2.5 px-3 rounded-lg transition">
                                                    ✕ Reject
                                                </button>
                                            </div>
                                        )}
                                    </li>
                                ))
                            }
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
