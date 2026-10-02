import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FaArrowRight, FaCalendarAlt, FaChair, FaMapMarkerAlt, FaTicketAlt } from 'react-icons/fa';
import api from '../utils/axios';

const EventDetail = () => {
    const { id } = useParams();
    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchEvent = async () => {
            try {
                const { data } = await api.get(`/events/${id}`);
                setEvent(data);
            } catch {
                setError('Could not load event details. Please try again.');
            } finally {
                setLoading(false);
            }
        };
        fetchEvent();
    }, [id]);

    if (loading) return <div className="py-24 text-center text-sm font-semibold text-gray-600">Loading event...</div>;
    if (!event) return <div className="py-24 text-center text-sm font-semibold text-red-700">{error || 'Event not found.'}</div>;

    const eventSlots = event.slots?.length ? event.slots : [{ date: event.date, availableSeats: event.availableSeats }];
    const firstAvailableSlot = eventSlots.find((slot) => slot.availableSeats > 0) || eventSlots[0];
    const isSoldOut = eventSlots.every((slot) => slot.availableSeats <= 0);
    const eventDateLabel = eventSlots.length > 1
        ? `${eventSlots.length} dates available`
        : new Date(event.date).toLocaleDateString();

    return (
        <div className="eventora-event-page mx-auto max-w-6xl">
            <Link to="/" className="eventora-event-back"><FaArrowRight aria-hidden="true" /> Browse events</Link>
            <header className="eventora-event-cover">
                {event.image && <img src={event.image} alt="" />}
                <div className="eventora-event-cover-shade" />
                <div className="eventora-event-cover-copy">
                    <span className="eventora-event-category">{event.category || 'Eventora pick'}</span>
                    <h1>{event.title}</h1>
                    <div className="eventora-event-meta">
                        <span><FaCalendarAlt aria-hidden="true" />{eventDateLabel}</span>
                        <span><FaMapMarkerAlt aria-hidden="true" />{event.location}</span>
                    </div>
                </div>
            </header>

            <div className="eventora-event-details-layout">
                <article className="eventora-event-description">
                    <p className="eventora-event-kicker">MAKE A DAY OF IT</p>
                    <h2>About this event</h2>
                    <p>{event.description}</p>
                </article>
                <aside className="eventora-event-ticket-panel">
                    <div className="eventora-event-panel-heading">
                        <FaTicketAlt aria-hidden="true" />
                        <span>YOUR NEXT PLAN</span>
                    </div>
                    <div className="eventora-event-fact">
                        <span><FaCalendarAlt aria-hidden="true" />{eventSlots.length > 1 ? 'Dates' : 'Date'}</span>
                        <strong>{eventDateLabel}</strong>
                    </div>
                    <div className="eventora-event-fact">
                        <span><FaMapMarkerAlt aria-hidden="true" />Location</span>
                        <strong>{event.location}</strong>
                    </div>
                    <div className="eventora-event-fact">
                        <span><FaChair aria-hidden="true" />Seats left</span>
                        <strong className={isSoldOut ? 'is-sold-out' : ''}>{firstAvailableSlot.availableSeats} <small>/ {event.totalSeats} on next available date</small></strong>
                    </div>
                    {event.seatTypes?.length ? (
                        <div className="eventora-event-fact">
                            <span><FaChair aria-hidden="true" />Seat types</span>
                            <strong className="text-left">
                                <span className="block text-sm font-medium text-slate-700">{event.seatTypes.map((seatType) => `${seatType.name} · ₹${seatType.price}`).join(' | ')}</span>
                            </strong>
                        </div>
                    ) : null}
                    <div className="eventora-event-ticket-price">
                        <span>From</span>
                        <strong>{event.ticketPrice === 0 ? 'Free' : `₹${event.ticketPrice}`}</strong>
                        <small>per ticket</small>
                    </div>
                    <Link to={`/events/${id}/book`} aria-disabled={isSoldOut} className={`eventora-event-book-link${isSoldOut ? ' is-disabled' : ''}`}>
                        {isSoldOut ? 'Sold out' : <>Choose your seats <FaArrowRight aria-hidden="true" /></>}
                    </Link>
                    <p className="eventora-event-panel-note">Secure checkout · Instant confirmation</p>
                </aside>
            </div>
        </div>
    );
};

export default EventDetail;