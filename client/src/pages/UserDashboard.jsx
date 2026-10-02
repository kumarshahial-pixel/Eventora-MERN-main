import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/axios';
import { Link, useNavigate } from 'react-router-dom';
import { FaCalendarAlt, FaMapMarkerAlt, FaTicketAlt, FaTimesCircle } from 'react-icons/fa';
import { FiChevronRight, FiSearch } from 'react-icons/fi';

const UserDashboard = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [events, setEvents] = useState([]);
    const [eventsLoading, setEventsLoading] = useState(true);
    const [eventsError, setEventsError] = useState('');
    const [searchText, setSearchText] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All categories');

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }
        fetchEvents();
    }, [user, navigate]);

    const fetchEvents = async () => {
        setEventsLoading(true);
        setEventsError('');
        try {
            const { data } = await api.get('/events');
            setEvents(data);
        } catch {
            setEventsError('Could not load events. Please try again shortly.');
        } finally {
            setEventsLoading(false);
        }
    };

    const categories = [...new Set(events.map((event) => event.category).filter(Boolean))].sort();
    const normalizedSearch = searchText.trim().toLowerCase();
    const filteredEvents = events.filter((event) => {
        const matchesCategory = selectedCategory === 'All categories' || event.category === selectedCategory;
        const searchableText = [event.title, event.category, event.location, event.description]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
        return matchesCategory && searchableText.includes(normalizedSearch);
    });

    return (
        <div className="mx-auto max-w-7xl px-2 py-4">
            <div className="mb-8 flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-black p-6 text-white shadow-[0_25px_60px_rgba(15,23,42,0.22)] sm:p-8 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 text-3xl font-black uppercase tracking-widest text-white shadow-inner">
                        {user?.name?.charAt(0) || 'E'}
                    </div>
                    <div>
                        <p className="text-sm uppercase tracking-[0.2em] text-slate-300">Dashboard</p>
                        <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">Welcome, {user?.name}!</h1>
                    </div>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-400/30">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400"></span>
                    User Active
                </div>
            </div>

            <section id="discover-events" className="mb-14 scroll-mt-24">
                <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-800">Find your next plan</p>
                        <h2 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">Explore events</h2>
                    </div>
                    <p className="text-sm font-semibold text-slate-500">{filteredEvents.length} {filteredEvents.length === 1 ? 'event' : 'events'}</p>
                </div>

                <div className="mb-6 flex flex-col gap-3 sm:flex-row">
                    <form
                        role="search"
                        onSubmit={(submitEvent) => submitEvent.preventDefault()}
                        className="flex min-w-0 flex-1 items-center overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-100"
                    >
                        <FiSearch className="ml-4 shrink-0 text-slate-400" aria-hidden="true" />
                        <label htmlFor="dashboard-event-search" className="sr-only">Search events, categories, or venues</label>
                        <input
                            id="dashboard-event-search"
                            type="search"
                            value={searchText}
                            onChange={(inputEvent) => setSearchText(inputEvent.target.value)}
                            placeholder="Search event, city, or category"
                            className="min-w-0 flex-1 border-0 px-3 py-3 text-sm text-slate-900 outline-none focus:ring-0"
                        />
                        <button type="submit" className="flex items-center gap-2 self-stretch bg-teal-700 px-5 text-sm font-bold text-white transition hover:bg-teal-800">
                            <FiSearch aria-hidden="true" /> Search
                        </button>
                    </form>
                    <label className="sr-only" htmlFor="dashboard-event-category">Filter by category</label>
                    <select
                        id="dashboard-event-category"
                        value={selectedCategory}
                        onChange={(inputEvent) => setSelectedCategory(inputEvent.target.value)}
                        className="min-h-12 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100 sm:w-56"
                    >
                        <option>All categories</option>
                        {categories.map((category) => <option key={category}>{category}</option>)}
                    </select>
                </div>

                {eventsLoading ? (
                    <div className="py-14 text-center text-sm font-semibold text-slate-500">Loading events...</div>
                ) : eventsError ? (
                    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-700">{eventsError}</div>
                ) : filteredEvents.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
                        <p className="font-semibold text-slate-700">No events found. Try a different search or category.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                        {filteredEvents.map((event) => (
                            <article key={event._id} className="group flex min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-teal-300 hover:shadow-lg">
                                <Link to={`/events/${event._id}`} className="relative block aspect-[16/9] overflow-hidden bg-slate-100" aria-label={`View ${event.title}`}>
                                    {event.image ? (
                                        <img src={event.image} alt={event.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                                    ) : (
                                        <div className="flex h-full items-center justify-center bg-slate-200 text-sm font-bold uppercase tracking-wider text-slate-500">{event.category || 'Event'}</div>
                                    )}
                                    <span className="absolute right-3 top-3 rounded-md bg-white px-3 py-1.5 text-sm font-bold text-slate-900 shadow">{event.ticketPrice === 0 ? 'Free' : `₹${event.ticketPrice}`}</span>
                                    <span className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950/85 to-transparent px-4 pb-4 pt-12 text-lg font-bold text-white">{event.title}</span>
                                </Link>
                                <div className="flex flex-1 flex-col p-4">
                                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-teal-800">{event.category || 'Event'}</p>
                                    <div className="space-y-2 text-sm text-slate-600">
                                        <p className="flex items-center gap-2"><FaCalendarAlt className="shrink-0 text-teal-700" aria-hidden="true" />{new Date(event.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                        <p className="flex items-start gap-2"><FaMapMarkerAlt className="mt-0.5 shrink-0 text-teal-700" aria-hidden="true" /><span className="line-clamp-2">{event.location}</span></p>
                                    </div>
                                    <Link to={`/events/${event._id}`} className="mt-4 inline-flex items-center justify-between border-t border-slate-100 pt-3 text-sm font-bold text-slate-900 transition hover:text-teal-800">
                                        Event details & booking <FiChevronRight aria-hidden="true" />
                                    </Link>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>

        </div>
    );
};

export default UserDashboard;
