import React, { useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
    FaArrowLeft,
    FaCalendarAlt,
    FaChair,
    FaCheckCircle,
    FaCreditCard,
    FaCouch,
    FaCrown,
    FaLock,
    FaMapMarkerAlt,
    FaMobileAlt,
    FaMoneyBillWave
} from 'react-icons/fa';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/axios';

const loadRazorpayCheckout = () => new Promise((resolve) => {
    if (window.Razorpay) {
        resolve(true);
        return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
});

const toDateInputValue = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

const getEventSlots = (event) => event.slots?.length ? event.slots : [{
    date: event.date,
    startTime: event.startTime || '',
    endTime: event.endTime || '',
    availableSeats: event.availableSeats
}];

const getSeatTypes = (event) => {
    if (event.seatTypes?.length) {
        return [...event.seatTypes].sort((firstType, secondType) => {
            const priority = (seatType) => {
                const name = seatType.name.toLowerCase();
                if (name.includes('premium')) return 0;
                if (name.includes('vip')) return 1;
                return 2;
            };
            return priority(firstType) - priority(secondType);
        });
    }
    const totalSeats = Math.max(1, Number(event.totalSeats) || 1);
    const basePrice = Math.max(0, Number(event.ticketPrice) || 0);
    if (totalSeats === 1) return [{ name: 'Regular', price: basePrice, totalSeats: 1 }];
    if (totalSeats === 2) return [
        { name: 'Regular', price: basePrice, totalSeats: 1 },
        { name: 'VIP', price: Math.round(basePrice * 1.5), totalSeats: 1 }
    ];
    const premiumSeats = Math.max(1, Math.round(totalSeats * 0.2));
    const vipSeats = Math.max(1, Math.round(totalSeats * 0.3));
    return [
        { name: 'Premium', price: Math.round(basePrice * 2), totalSeats: premiumSeats },
        { name: 'VIP', price: Math.round(basePrice * 1.5), totalSeats: vipSeats },
        { name: 'Regular', price: basePrice, totalSeats: Math.max(1, totalSeats - vipSeats - premiumSeats) }
    ];
};

const getSeatTypeForSeat = (event, seat) => {
    let start = 1;
    return getSeatTypes(event).find((seatType) => {
        const end = start + Number(seatType.totalSeats || 0) - 1;
        const matches = seat >= start && seat <= end;
        start = end + 1;
        return matches;
    }) || getSeatTypes(event)[0];
};

const BookingPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);
    const [event, setEvent] = useState(null);
    const [selectedSlotDate, setSelectedSlotDate] = useState('');
    const [bookedSeats, setBookedSeats] = useState([]);
    const [bookingStatus, setBookingStatus] = useState(null);
    const [bookingType, setBookingType] = useState('solo');
    const [partySize, setPartySize] = useState(1);
    const [selectedSeats, setSelectedSeats] = useState([]);
    const [attendees, setAttendees] = useState([]);
    const [paymentChoice, setPaymentChoice] = useState('online');
    const [selectedSeatType, setSelectedSeatType] = useState('');
    const [upiQrPayment, setUpiQrPayment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [bookingLoading, setBookingLoading] = useState(false);
    const [showReview, setShowReview] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const applyExistingBooking = (existingBooking) => {
        if (!existingBooking) {
            setBookingStatus(null);
            setSelectedSeats([]);
            setAttendees([]);
            setSuccessMsg('');
            return;
        }

        setBookingStatus(existingBooking.status);
        const existingSeats = existingBooking.selectedSeats?.length
            ? existingBooking.selectedSeats
            : existingBooking.selectedSeat ? [existingBooking.selectedSeat] : [];
        setSelectedSeats(existingSeats);
        setPartySize(existingSeats.length || 1);
        setBookingType(existingSeats.length > 1 ? 'friends' : 'solo');
        setAttendees(existingSeats.map((seat, index) => {
            const savedAttendee = existingBooking.attendees?.find((attendee) => Number(attendee.seat) === seat)
                || existingBooking.attendees?.[index];
            return { seat, name: savedAttendee?.name || '', age: savedAttendee?.age ?? '', gender: savedAttendee?.gender || '' };
        }));
        setSuccessMsg(existingBooking.status === 'pending'
            ? 'Your booking is awaiting confirmation.'
            : existingBooking.status === 'confirmed' ? 'You already have a confirmed booking for this date.' : '');
    };

    const fetchEvent = async () => {
        try {
            const { data } = await api.get(`/events/${id}`);
            setEvent(data);
            const initialSlots = getEventSlots(data);
            const initialSlot = initialSlots.find((slot) => slot.availableSeats > 0) || initialSlots[0];
            const initialDate = toDateInputValue(initialSlot.date);
            setSelectedSlotDate(initialDate);
            setSelectedSeatType(getSeatTypes(data)[0].name);

            if (user) {
                const [bookingsRes, seatsRes] = await Promise.all([
                    api.get('/bookings/my'),
                    api.get(`/bookings/event/${data._id}/seats`, { params: { date: initialDate } })
                ]);
                setBookedSeats(seatsRes.data);
                const existingBooking = bookingsRes.data.find((booking) => booking.eventId?._id === data._id
                    && toDateInputValue(booking.slotDate || booking.eventId?.date || data.date) === initialDate);
                applyExistingBooking(existingBooking);
            } else {
                setBookedSeats([]);
                applyExistingBooking(null);
            }
        } catch {
            setError('Could not load event details. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEvent();
    }, [id, user]);

    const handleSlotChange = async (nextDate) => {
        setSelectedSlotDate(nextDate);
        setError('');
        setBookedSeats([]);
        applyExistingBooking(null);
        if (!user || !event) return;

        try {
            const [bookingsRes, seatsRes] = await Promise.all([
                api.get('/bookings/my'),
                api.get(`/bookings/event/${event._id}/seats`, { params: { date: nextDate } })
            ]);
            setBookedSeats(seatsRes.data);
            const existingBooking = bookingsRes.data.find((booking) => booking.eventId?._id === event._id
                && toDateInputValue(booking.slotDate || booking.eventId?.date || event.date) === nextDate);
            applyExistingBooking(existingBooking);
        } catch {
            setError('Could not load seats for this event date. Please try again.');
        }
    };

    const syncAttendeesWithSeats = (nextSeats) => {
        setSelectedSeats(nextSeats);
        setAttendees((currentAttendees) => nextSeats.map((seat) => {
            const savedAttendee = currentAttendees.find((attendee) => attendee.seat === seat);
            return savedAttendee || { seat, name: '', age: '', gender: '' };
        }));
    };

    const sanitizeAge = (value) => {
        if (value === '') return '';
        const digitsOnly = String(value).replace(/\D/g, '').slice(0, 3);
        if (digitsOnly === '') return '';
        const numericAge = Number(digitsOnly);
        if (Number.isNaN(numericAge)) return '';
        return String(Math.min(120, Math.max(0, numericAge)));
    };

    const changeAgeByStep = (seat, step) => {
        setAttendees((currentAttendees) => {
            const existingAttendee = currentAttendees.find((attendee) => attendee.seat === seat) || { seat, name: '', age: '', gender: '' };
            const currentAge = existingAttendee.age === '' ? 0 : Number(existingAttendee.age);
            const nextValue = Math.min(120, Math.max(0, currentAge + step));
            const nextAttendees = currentAttendees.filter((attendee) => attendee.seat !== seat);
            return [...nextAttendees, { ...existingAttendee, age: String(nextValue) }].sort((a, b) => a.seat - b.seat);
        });
    };

    const updateAttendeeField = (seat, field, value) => {
        if (field === 'age') {
            const nextAge = sanitizeAge(value);
            setAttendees((currentAttendees) => {
                const existingAttendee = currentAttendees.find((attendee) => attendee.seat === seat);
                const updatedAttendee = existingAttendee || { seat, name: '', age: '', gender: '' };
                const nextAttendees = currentAttendees.filter((attendee) => attendee.seat !== seat);
                return [...nextAttendees, { ...updatedAttendee, age: nextAge }].sort((a, b) => a.seat - b.seat);
            });
            return;
        }

        setAttendees((currentAttendees) => {
            const existingAttendee = currentAttendees.find((attendee) => attendee.seat === seat);
            const updatedAttendee = existingAttendee || { seat, name: '', age: '', gender: '' };
            const nextAttendees = currentAttendees.filter((attendee) => attendee.seat !== seat);
            return [...nextAttendees, { ...updatedAttendee, [field]: value }].sort((a, b) => a.seat - b.seat);
        });
    };

    const handleReview = () => {
        if (!user) {
            navigate('/login');
            return;
        }
        if (selectedSeats.length !== partySize) {
            setError(`Select ${partySize} seat${partySize === 1 ? '' : 's'} to continue.`);
            return;
        }
        const hasInvalidAttendee = selectedSeats.some((seat) => {
            const attendee = attendees.find((person) => person.seat === seat) || { seat, name: '', age: '', gender: '' };
            const ageValue = String(attendee.age ?? '').trim();
            const age = Number(ageValue);
            return !attendee.name?.trim() || ageValue === '' || !Number.isInteger(age) || age < 0 || age > 120 || !['Male', 'Female'].includes(attendee.gender);
        });
        if (hasInvalidAttendee) {
            setError('Enter a valid name, age, and gender for every attendee.');
            return;
        }
        setError('');
        setUpiQrPayment(null);
        setShowReview(true);
    };

    const handleVerifyUpiPayment = async () => {
        if (!upiQrPayment?.bookingId) {
            setError('Generate a QR code first before confirming the payment.');
            return;
        }

        try {
            setBookingLoading(true);
            setError('');
            const { data } = await api.post('/bookings/verify-upi-payment', {
                bookingId: upiQrPayment.bookingId,
                paymentReference: `UPI-${Date.now()}`
            });
            setBookingStatus(data.booking.status);
            setBookedSeats((current) => [...current, ...selectedSeats]);
            setSuccessMsg('UPI payment received. Booking confirmed!');
            setShowReview(false);
            setUpiQrPayment(null);
            if (data.booking?.status === 'confirmed') {
                navigate('/payment-success', { replace: true, state: { bookingId: data.booking._id } });
            }
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'UPI payment could not be verified. Please try again.');
        } finally {
            setBookingLoading(false);
        }
    };

    const handleConfirmBooking = async () => {
        setBookingLoading(true);
        setError('');
        setSuccessMsg('');
        let paymentBookingId = null;

        try {
            const bookingPayload = {
                eventId: event._id,
                slotDate: selectedSlotDate,
                selectedSeats,
                seatType: selectedSeatType || undefined,
                seatTypeDetails: selectedSeatDetails,
                attendees: selectedSeats.map((seat) => {
                    const attendee = attendees.find((person) => person.seat === seat);
                    return { name: attendee.name.trim(), age: Number(attendee.age), gender: attendee.gender };
                })
            };

            if (total === 0 || paymentChoice === 'cash') {
                const { data } = await api.post('/bookings', {
                    ...bookingPayload,
                    paymentMethod: total === 0 ? 'free' : 'cash'
                });
                setBookingStatus(data.booking?.status || 'confirmed');
                setBookedSeats((current) => [...current, ...selectedSeats]);
                setSuccessMsg(total === 0 ? 'Free booking confirmed!' : 'Booking confirmed. Pay in cash at the venue.');
                setShowReview(false);
                setBookingLoading(false);
                if (data.booking?.status === 'confirmed') {
                    navigate('/payment-success', { replace: true, state: { bookingId: data.booking._id } });
                }
                return;
            }

            if (paymentChoice === 'upi_qr') {
                const { data } = await api.post('/bookings/upi-qr', bookingPayload);
                setUpiQrPayment({
                    bookingId: data.bookingId,
                    qrCode: data.qrCode,
                    amount: data.amount,
                    upiId: data.upiId,
                    message: data.message
                });
                setSuccessMsg('Scan the QR code and then click “I have paid”.');
                setBookingLoading(false);
                return;
            }

            const checkoutReady = await loadRazorpayCheckout();
            if (!checkoutReady) throw new Error('Could not load secure checkout. Please try again.');

            const { data: paymentData } = await api.post('/bookings/payment-order', bookingPayload);
            paymentBookingId = paymentData.bookingId;
            let checkoutFinished = false;
            let holdReleased = false;
            const releasePaymentHold = async () => {
                if (holdReleased) return;
                holdReleased = true;
                try {
                    await api.delete(`/bookings/${paymentBookingId}`);
                } catch {
                    // Expired holds are released by the server when bookings are read.
                }
            };

            const checkout = new window.Razorpay({
                key: paymentData.keyId,
                amount: paymentData.order.amount,
                currency: paymentData.order.currency,
                name: 'Eventora',
                description: `${event.title} tickets`,
                order_id: paymentData.order.id,
                prefill: { name: user.name, email: user.email, contact: user.phone },
                theme: { color: '#0f766e' },
                handler: async (paymentResponse) => {
                    checkoutFinished = true;
                    try {
                        const { data: verification } = await api.post('/bookings/verify-payment', {
                            bookingId: paymentBookingId,
                            ...paymentResponse
                        });
                        setBookingStatus(verification.booking.status);
                        setBookedSeats((current) => [...current, ...selectedSeats]);
                        setSuccessMsg('Payment received. Booking confirmed!');
                        if (verification.booking.status === 'confirmed') {
                            navigate('/payment-success', { replace: true, state: { bookingId: verification.booking._id } });
                        }
                    } catch (verificationError) {
                        setError(verificationError.response?.data?.message || 'Payment verification failed. Please contact support.');
                    } finally {
                        setShowReview(false);
                        setBookingLoading(false);
                    }
                }
            });

            checkout.on('payment.failed', async (paymentFailure) => {
                checkoutFinished = true;
                await releasePaymentHold();
                setError(paymentFailure.error?.description || 'Payment failed. Please try again.');
                setShowReview(false);
                setBookingLoading(false);
            });
            checkout.on('modal.ondismiss', async () => {
                if (checkoutFinished) return;
                checkoutFinished = true;
                await releasePaymentHold();
                setError('Payment cancelled. No booking was confirmed.');
                setShowReview(false);
                setBookingLoading(false);
            });

            setShowReview(false);
            checkout.open();
        } catch (requestError) {
            if (paymentBookingId) {
                try {
                    await api.delete(`/bookings/${paymentBookingId}`);
                } catch {
                    // Expired holds are released by the server when bookings are read.
                }
            }
            setError(requestError.response?.data?.message || requestError.message || 'Booking failed. Please try again.');
            setShowReview(false);
            setBookingLoading(false);
        }
    };

    if (loading) return <div className="py-24 text-center text-sm font-semibold text-gray-600">Loading event and available seats...</div>;
    if (!event) return <div className="py-24 text-center text-sm font-semibold text-red-700">{error || 'Event not found.'}</div>;

    const eventSlots = getEventSlots(event);
    const selectedSlot = eventSlots.find((slot) => toDateInputValue(slot.date) === selectedSlotDate) || eventSlots[0];
    const isSoldOut = selectedSlot.availableSeats <= 0;
    const isUnavailable = isSoldOut || bookingStatus === 'pending' || bookingStatus === 'confirmed';
    const availablePartySizes = Array.from({ length: Math.min(6, selectedSlot.availableSeats) }, (_, index) => index + 1);
    const currentSeatType = getSeatTypes(event).find((seatType) => seatType.name === selectedSeatType) || null;
    const selectedSeatDetails = selectedSeats.map((seat) => {
        const seatType = getSeatTypeForSeat(event, seat);
        return { seat, type: seatType.name, price: Number(seatType.price) || 0 };
    });
    const ticketPrice = currentSeatType ? Number(currentSeatType.price) : Number(event.ticketPrice || 0);
    const requiresPayment = selectedSeatDetails.some((detail) => detail.price > 0);
    const total = selectedSeatDetails.reduce((sum, detail) => sum + detail.price, 0);
    const hasMixedSeatTypes = new Set(selectedSeatDetails.map((detail) => detail.type)).size > 1;
    const seatTypeRanges = getSeatTypes(event)
        .map((seatType, index, seatTypes) => {
            const start = seatTypes.slice(0, index).reduce((totalSeats, item) => totalSeats + Number(item.totalSeats || 0), 1);
            return { ...seatType, start, end: start + Number(seatType.totalSeats || 0) - 1 };
        });
    const hasValidAttendees = selectedSeats.every((seat) => {
        const attendee = attendees.find((person) => person.seat === seat);
        const ageValue = String(attendee?.age ?? '').trim();
        const age = Number(ageValue);
        return Boolean(attendee?.name.trim()) && ageValue !== '' && Number.isInteger(age) && age >= 0 && age <= 120 && ['Male', 'Female'].includes(attendee?.gender);
    });
    const canReviewBooking = selectedSeats.length === partySize && hasValidAttendees;

    return (
        <div className="eventora-booking-page mx-auto max-w-6xl">
            <Link to={`/events/${id}`} className="eventora-booking-back">
                <FaArrowLeft aria-hidden="true" /> Event details
            </Link>

            <header className="eventora-booking-cover">
                {event.image && <img src={event.image} alt="" />}
                <div className="eventora-booking-cover-shade" />
                <div className="eventora-booking-cover-copy">
                    <span className="eventora-booking-category">{event.category || 'Event'}</span>
                    <h1>{event.title}</h1>
                    <div className="eventora-booking-meta">
                        <span><FaCalendarAlt aria-hidden="true" />{new Date(`${selectedSlotDate}T00:00:00`).toLocaleDateString()}{selectedSlot.startTime ? ` · ${selectedSlot.startTime}-${selectedSlot.endTime}` : ''}</span>
                        <span><FaMapMarkerAlt aria-hidden="true" />{event.location}</span>
                    </div>
                </div>
                <div className="eventora-booking-cover-price">
                    <span>Ticket price</span>
                    <strong>{hasMixedSeatTypes ? 'Mixed' : ticketPrice === 0 ? 'Free' : `₹${ticketPrice}`}</strong>
                    <small>per person</small>
                </div>
            </header>

            <div className="eventora-booking-content">
                <section className="eventora-booking-main">
                    <div className="eventora-booking-section-heading">
                        <div>
                            <p className="eventora-booking-kicker">01 / YOUR EXPERIENCE</p>
                            <h2>Choose your seats</h2>
                            <p>{selectedSlot.availableSeats} of {event.totalSeats} seats available for this date</p>
                        </div>
                        <span className="eventora-booking-seat-count">{selectedSeats.length}<span> / {partySize}</span></span>
                    </div>

                    {getSeatTypes(event).length > 1 ? (
                        <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <p className="mb-2 text-sm font-bold uppercase tracking-[0.2em] text-slate-600">Seat type</p>
                            <div className="flex flex-wrap gap-2">
                                {getSeatTypes(event).map((seatType) => (
                                    <button
                                        key={seatType.name}
                                        type="button"
                                        onClick={() => setSelectedSeatType(seatType.name)}
                                        className={`rounded-lg border px-3 py-2 text-sm font-semibold ${selectedSeatType === seatType.name ? 'border-gray-900 bg-gray-900 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
                                    >
                                        {seatType.name} · ₹{seatType.price}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {bookingStatus === 'pending' && <div className="eventora-booking-notice">Your booking is awaiting confirmation. You cannot start another booking for this event.</div>}
                    {bookingStatus === 'confirmed' && <div className="eventora-booking-notice eventora-booking-notice-success"><FaCheckCircle aria-hidden="true" /> Your ticket booking is confirmed.</div>}

                    <label className="mb-5 grid gap-2 rounded-lg border border-emerald-100 bg-emerald-50/60 p-4 text-sm font-bold text-slate-800">
                        Choose date and time
                        <select value={selectedSlotDate} onChange={(inputEvent) => handleSlotChange(inputEvent.target.value)} className="min-h-11 rounded-md border border-slate-300 bg-white px-3 font-medium text-slate-800">
                            {eventSlots.map((slot) => {
                                const slotDate = toDateInputValue(slot.date);
                                const dateLabel = new Date(`${slotDate}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                                return <option key={slotDate} value={slotDate} disabled={slot.availableSeats <= 0}>{dateLabel} · {slot.startTime}-{slot.endTime} · {slot.availableSeats} seats left</option>;
                            })}
                        </select>
                    </label>

                    <div className="eventora-booking-party">
                        <span className="eventora-booking-label">Booking type</span>
                        <div className="eventora-booking-segmented" role="group" aria-label="Booking type">
                            <button type="button" aria-pressed={bookingType === 'solo'} disabled={isUnavailable} onClick={() => { setBookingType('solo'); setPartySize(1); syncAttendeesWithSeats([]); }}>
                                <FaChair aria-hidden="true" /> Just me
                            </button>
                            <button type="button" aria-pressed={bookingType === 'friends'} disabled={isUnavailable} onClick={() => { setBookingType('friends'); setPartySize((current) => Math.max(2, current)); syncAttendeesWithSeats([]); }}>
                                With friends
                            </button>
                        </div>
                        {bookingType === 'friends' && (
                            <div className="eventora-booking-party-size">
                                <span className="eventora-booking-label">Number of seats</span>
                                <div className="flex flex-wrap gap-2">
                                    {availablePartySizes.map((size) => (
                                        <button key={size} type="button" aria-pressed={partySize === size} disabled={isUnavailable} onClick={() => { setPartySize(size); syncAttendeesWithSeats([]); }}>
                                            {size}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="eventora-seat-map">
                        <div className="eventora-stage"><span>STAGE</span></div>
                        <div className="eventora-seat-legend" aria-label="Seat availability legend">
                            <span><i className="eventora-legend-available" />Available</span>
                            <span><i className="eventora-legend-selected" />Selected</span>
                            <span><i className="eventora-legend-booked" />Booked</span>
                        </div>
                        <div className="eventora-seat-types" aria-label="Choose seats by type">
                            {seatTypeRanges.map((seatType, visualIndex) => {
                                const typeKey = seatType.name.toLowerCase().replace(/\s+/g, '-');
                                const isPremium = typeKey.includes('premium') || typeKey.includes('vip');
                                return (
                                    <section key={seatType.name} className={`eventora-seat-type ${isPremium ? 'is-premium' : ''}`}>
                                        <div className="eventora-seat-type-heading">
                                            <div className="eventora-seat-type-title">
                                                <span className="eventora-seat-type-icon" aria-hidden="true">{isPremium ? <FaCrown /> : <FaChair />}</span>
                                                <div>
                                                    <h3>{seatType.name} {isPremium && <span className="eventora-premium-badge">PREMIUM</span>}</h3>
                                                    <p>{seatType.totalSeats} seats · {Number(seatType.price) === 0 ? 'Free' : `₹${seatType.price}`}</p>
                                                </div>
                                            </div>
                                            <span className="eventora-seat-type-range">{visualIndex === 0 ? 'Near stage · ' : ''}Seats {seatType.start}-{seatType.end}</span>
                                        </div>
                                        <div className="eventora-seat-grid" aria-label={`${seatType.name} seats`}>
                                            {Array.from({ length: Number(seatType.totalSeats || 0) }, (_, index) => seatType.start + index).map((seat) => {
                                                const isBooked = bookedSeats.includes(seat);
                                                const isSelected = selectedSeats.includes(seat);
                                                return (
                                                    <button
                                                        key={seat}
                                                        type="button"
                                                        aria-label={`${seatType.name} seat ${seat}${isBooked ? ', booked' : isSelected ? ', selected' : ', available'}`}
                                                        aria-pressed={isSelected}
                                                        disabled={isBooked || isUnavailable}
                                                        onClick={() => {
                                                            if (isSelected) {
                                                                syncAttendeesWithSeats(selectedSeats.filter((selected) => selected !== seat));
                                                            } else if (selectedSeats.length < partySize) {
                                                                setSelectedSeatType(seatType.name);
                                                                syncAttendeesWithSeats([...selectedSeats, seat]);
                                                            }
                                                        }}
                                                        className={isBooked ? 'is-booked' : isSelected ? 'is-selected' : ''}
                                                    >
                                                        <span className="eventora-seat-icon" aria-hidden="true"><FaCouch /></span>
                                                        <span>{seat}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </section>
                                );
                            })}
                        </div>
                    </div>

                    {selectedSeats.length > 0 && (
                        <div className="eventora-attendee-section">
                            <div className="eventora-booking-section-heading eventora-attendee-heading">
                                <div>
                                    <p className="eventora-booking-kicker">02 / GUEST DETAILS</p>
                                    <h2>Who is coming?</h2>
                                    <p>Add a name and age for each ticket.</p>
                                </div>
                            </div>
                            <div className="eventora-attendee-grid">
                                {selectedSeats.map((seat) => {
                                    const attendee = attendees.find((person) => person.seat === seat) || { seat, name: '', age: '', gender: '' };
                                    return (
                                        <fieldset key={seat} className="eventora-attendee-fields">
                                            <legend>Seat {seat}</legend>
                                            <label>
                                                <span>Full name</span>
                                                <input type="text" autoComplete="off" required maxLength={100} value={attendee.name} disabled={isUnavailable} onChange={(inputEvent) => updateAttendeeField(seat, 'name', inputEvent.target.value)} />
                                            </label>
                                            <label>
                                                <span>Gender</span>
                                                <select required value={attendee.gender} disabled={isUnavailable} onChange={(inputEvent) => updateAttendeeField(seat, 'gender', inputEvent.target.value)}>
                                                    <option value="">Select</option>
                                                    <option value="Male">Male</option>
                                                    <option value="Female">Female</option>
                                                </select>
                                            </label>
                                            <label>
                                                <span>Age</span>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        pattern="[0-9]*"
                                                        value={attendee.age}
                                                        disabled={isUnavailable}
                                                        onChange={(inputEvent) => updateAttendeeField(seat, 'age', inputEvent.target.value)}
                                                        className="w-full"
                                                    />
                                                    <div className="flex flex-col gap-1">
                                                        <button type="button" className="h-5 w-5 rounded-sm border border-slate-300 bg-white text-xs leading-none text-slate-700" onClick={() => changeAgeByStep(seat, 1)} disabled={isUnavailable}>▲</button>
                                                        <button type="button" className="h-5 w-5 rounded-sm border border-slate-300 bg-white text-xs leading-none text-slate-700" onClick={() => changeAgeByStep(seat, -1)} disabled={isUnavailable}>▼</button>
                                                    </div>
                                                </div>
                                            </label>
                                        </fieldset>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </section>

                <aside className="eventora-booking-summary">
                    <div className="eventora-summary-topline"><FaLock aria-hidden="true" /> SECURE CHECKOUT</div>
                    <h2>Your booking</h2>
                    <p className="eventora-summary-event">{event.title}</p>
                    <div className="eventora-summary-details">
                        <span><FaCalendarAlt aria-hidden="true" />{new Date(`${selectedSlotDate}T00:00:00`).toLocaleDateString()}{selectedSlot.startTime ? ` · ${selectedSlot.startTime}-${selectedSlot.endTime}` : ''}</span>
                        <span><FaMapMarkerAlt aria-hidden="true" />{event.location}</span>
                    </div>
                    <div className="eventora-summary-divider" />
                    <div className="eventora-summary-line"><span>Tickets</span><strong>{selectedSeats.length} {selectedSeats.length === 1 ? 'ticket' : 'tickets'}</strong></div>
                    <div className="eventora-summary-line"><span>Price per ticket</span><strong>{hasMixedSeatTypes ? 'Mixed pricing' : ticketPrice === 0 ? 'Free' : `₹${ticketPrice}`}</strong></div>
                    {selectedSeatDetails.length > 0 && <div className="eventora-summary-line"><span>Seat types</span><strong>{[...new Set(selectedSeatDetails.map((detail) => detail.type))].join(', ')}</strong></div>}
                    {selectedSeats.length > 0 && <p className="eventora-summary-seats">Seats {selectedSeats.join(', ')}</p>}
                    <div className="eventora-summary-total"><span>Total</span><strong>{total === 0 ? 'Free' : `₹${total}`}</strong></div>

                    {error && <p className="eventora-booking-feedback eventora-booking-feedback-error" role="alert">{error}</p>}
                    {successMsg && <p className="eventora-booking-feedback eventora-booking-feedback-success" role="status">{successMsg}</p>}

                    {user ? (
                        <button type="button" className="eventora-booking-cta" onClick={handleReview} disabled={isUnavailable || bookingLoading || !canReviewBooking}>
                            {bookingLoading ? 'Processing...' : bookingStatus === 'confirmed' ? 'Booking confirmed' : bookingStatus === 'pending' ? 'Awaiting confirmation' : isSoldOut ? 'Sold out' : selectedSeats.length !== partySize ? `Select ${partySize} seat${partySize === 1 ? '' : 's'} to continue` : !hasValidAttendees ? 'Add attendee details' : 'Confirm ticket'}
                        </button>
                    ) : (
                        <Link to="/login" className="eventora-booking-cta">Log in to book</Link>
                    )}
                    <p className="eventora-booking-secure-note"><FaLock aria-hidden="true" /> Your payment details stay secure.</p>
                </aside>
            </div>

            {showReview && createPortal(
                <div className="eventora-review-backdrop">
                    <section role="dialog" aria-modal="true" aria-labelledby="eventora-review-title" className="eventora-review-dialog">
                        <div className="eventora-review-content">
                            <p className="eventora-booking-kicker">03 / FINAL REVIEW</p>
                            <h2 id="eventora-review-title">Ready for the event?</h2>
                            <p className="eventora-review-subtitle">Check your ticket details before confirming.</p>
                            <div className="eventora-review-event">
                                <strong>{event.title}</strong>
                                <span>{new Date(`${selectedSlotDate}T00:00:00`).toLocaleDateString()} · {selectedSlot.startTime}-{selectedSlot.endTime} · {event.location}</span>
                                <span>Seats {selectedSeats.join(', ')}</span>
                            </div>
                            {requiresPayment && (
                                <fieldset className="eventora-payment-options">
                                    <legend>Choose how to pay</legend>
                                    <label className={paymentChoice === 'online' ? 'is-active' : ''}>
                                        <input type="radio" name="payment-choice" value="online" checked={paymentChoice === 'online'} onChange={() => { setPaymentChoice('online'); setUpiQrPayment(null); }} />
                                        <span><FaCreditCard aria-hidden="true" /><FaMobileAlt aria-hidden="true" /> Online payment</span>
                                        <small>UPI, cards and netbanking</small>
                                    </label>
                                    <label className={paymentChoice === 'upi_qr' ? 'is-active' : ''}>
                                        <input type="radio" name="payment-choice" value="upi_qr" checked={paymentChoice === 'upi_qr'} onChange={() => { setPaymentChoice('upi_qr'); setUpiQrPayment(null); }} />
                                        <span><FaMobileAlt aria-hidden="true" /> UPI QR payment</span>
                                        <small>Scan QR and confirm after paying</small>
                                    </label>
                                    <label className={paymentChoice === 'cash' ? 'is-active' : ''}>
                                        <input type="radio" name="payment-choice" value="cash" checked={paymentChoice === 'cash'} onChange={() => { setPaymentChoice('cash'); setUpiQrPayment(null); }} />
                                        <span><FaMoneyBillWave aria-hidden="true" /> Pay at venue</span>
                                        <small>Pay in cash when you arrive</small>
                                    </label>
                                </fieldset>
                            )}
                            {requiresPayment && paymentChoice === 'upi_qr' && upiQrPayment && (
                                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
                                    <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">Scan and pay</p>
                                    <img src={upiQrPayment.qrCode} alt="UPI QR code" className="mx-auto h-56 w-56 rounded-lg border border-slate-200 bg-white p-2" />
                                    <p className="mt-3 text-sm font-medium text-slate-700">UPI ID: {upiQrPayment.upiId}</p>
                                    <p className="text-sm font-medium text-slate-700">Amount: ₹{upiQrPayment.amount}</p>
                                </div>
                            )}
                            <div className="eventora-review-guests">
                                {selectedSeats.map((seat) => {
                                    const attendee = attendees.find((person) => person.seat === seat);
                                    return <div key={seat}><span>Seat {seat}: {attendee?.name}</span><span>{attendee?.gender} · Age {attendee?.age}</span></div>;
                                })}
                            </div>
                            <div className="eventora-review-total"><span>Total</span><strong>{total === 0 ? 'Free' : `₹${total}`}</strong></div>
                        </div>
                        <div className="eventora-review-actions">
                            <button type="button" className="eventora-review-back" onClick={() => setShowReview(false)} disabled={bookingLoading}>Go back</button>
                            <button
                                type="button"
                                className="eventora-review-confirm"
                                onClick={paymentChoice === 'upi_qr' && upiQrPayment ? handleVerifyUpiPayment : handleConfirmBooking}
                                disabled={bookingLoading}
                            >
                                {bookingLoading
                                    ? 'Processing...'
                                    : paymentChoice === 'upi_qr' && upiQrPayment
                                        ? 'I have paid'
                                        : requiresPayment && paymentChoice === 'online'
                                            ? 'Confirm and pay'
                                            : 'Confirm ticket'}
                            </button>
                        </div>
                    </section>
                </div>,
                document.body
            )}
        </div>
    );
};

export default BookingPage;