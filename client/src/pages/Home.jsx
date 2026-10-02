import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaCalendarAlt, FaMapMarkerAlt, FaMusic, FaStar } from 'react-icons/fa';
import { FiChevronLeft, FiChevronRight, FiSearch, FiX } from 'react-icons/fi';
import api from '../utils/axios';

const getHeroImageUrl = (image) => {
    try {
        const imageUrl = new URL(image);
        if (imageUrl.hostname.endsWith('images.unsplash.com')) {
            imageUrl.searchParams.set('w', '2200');
            imageUrl.searchParams.set('q', '90');
        }
        return imageUrl.toString();
    } catch {
        return image;
    }
};

const Home = () => {
    const [events, setEvents] = useState([]);
    const [slideIndex, setSlideIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchText, setSearchText] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchEvents = async () => {
            setLoading(true);
            setError('');
            try {
                const { data } = await api.get('/events');
                setEvents(data);
            } catch {
                setError('Events are unavailable because the server cannot connect to the database.');
            } finally {
                setLoading(false);
            }
        };
        fetchEvents();
    }, []);

    const eventsWithImages = events.filter((event) => event.image);
    const featuredEvents = [
        ...eventsWithImages.filter((event) => /music|concert|festival|entertainment|celebration/i.test(event.category || '')),
        ...eventsWithImages.filter((event) => !/music|concert|festival|entertainment|celebration/i.test(event.category || ''))
    ];
    const featuredEvent = featuredEvents.length ? featuredEvents[slideIndex % featuredEvents.length] : null;
    const filteredEvents = events.filter((event) => {
        if (!searchTerm) return true;
        const eventText = [event.title, event.category, event.location, event.description]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
        return eventText.includes(searchTerm);
    });

    useEffect(() => {
        if (featuredEvents.length < 2) return undefined;
        const timer = window.setInterval(() => {
            setSlideIndex((currentIndex) => (currentIndex + 1) % featuredEvents.length);
        }, 6500);
        return () => window.clearInterval(timer);
    }, [featuredEvents.length]);

    const changeSlide = (direction) => {
        if (!featuredEvents.length) return;
        setSlideIndex((currentIndex) => (currentIndex + direction + featuredEvents.length) % featuredEvents.length);
    };

    const handleSearchSubmit = (submitEvent) => {
        submitEvent.preventDefault();
        setSearchTerm(searchText.trim().toLowerCase());
        document.getElementById('event-list')?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="eventora-home">
            <section id="top" className="eventora-home-hero" aria-label="Discover events">
                <div className="eventora-home-copy">
                    <p className="eventora-home-eyebrow"><span aria-hidden="true"></span> It's time to make plans</p>
                    <h1>Better nights<br />start with <span>Eventora.</span></h1>
                    <p className="eventora-home-description">Find live music, local culture, and one-of-a-kind experiences worth sharing.</p>
                    <form role="search" onSubmit={handleSearchSubmit} className="eventora-home-search">
                        <FiSearch className="eventora-home-search-icon" aria-hidden="true" />
                        <label htmlFor="event-search" className="sr-only">Search events, categories, or venues</label>
                        <input
                            id="event-search"
                            type="search"
                            value={searchText}
                            onChange={(inputEvent) => setSearchText(inputEvent.target.value)}
                            placeholder="Search events or venues"
                        />
                        {searchText && (
                            <button
                                type="button"
                                onClick={() => { setSearchText(''); setSearchTerm(''); }}
                                aria-label="Clear event search"
                                title="Clear search"
                                className="eventora-home-search-clear"
                            >
                                <FiX aria-hidden="true" />
                            </button>
                        )}
                        <button type="submit" className="eventora-home-search-submit">
                            <FiSearch aria-hidden="true" />
                            <span>Search</span>
                        </button>
                    </form>
                    <div className="eventora-home-buttons">
                        <a href="#event-list" className="eventora-home-primary">Explore events <FiChevronRight aria-hidden="true" /></a>
                        {featuredEvent && <Link to={`/events/${featuredEvent._id}`} className="eventora-home-secondary">Featured event <FiChevronRight aria-hidden="true" /></Link>}
                    </div>
                    <div className="eventora-home-note"><FaMusic aria-hidden="true" /><span>Good plans. Great stories.</span></div>
                    <FaStar className="eventora-home-spark eventora-home-spark-one" aria-hidden="true" />
                    <FaStar className="eventora-home-spark eventora-home-spark-two" aria-hidden="true" />
                    <FaStar className="eventora-home-spark eventora-home-spark-three" aria-hidden="true" />
                </div>

                <div className="eventora-home-visual">
                    <img
                        key={featuredEvent?._id || 'eventora-live-music'}
                        src={featuredEvent ? getHeroImageUrl(featuredEvent.image) : 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=2200&q=90'}
                        alt={featuredEvent?.title || 'Crowd enjoying a live music event'}
                    />
                    <div className="eventora-home-visual-shade" aria-hidden="true"></div>
                    <div className="eventora-home-photo-caption">
                        <p className="eventora-home-photo-kicker">Featured event</p>
                        <h2>{featuredEvent?.title || 'Your next favorite night out'}</h2>
                        <p className="eventora-home-photo-details">
                            {featuredEvent?.category || 'Live experiences'}
                            {featuredEvent?.location && <><span aria-hidden="true"> / </span>{featuredEvent.location}</>}
                        </p>
                    </div>
                    {featuredEvents.length > 1 && (
                        <div className="eventora-home-carousel-controls">
                            <button type="button" onClick={() => changeSlide(-1)} aria-label="Previous featured event"><FiChevronLeft aria-hidden="true" /></button>
                            <span>{(slideIndex % featuredEvents.length) + 1} <span aria-hidden="true">/</span> {featuredEvents.length}</span>
                            <button type="button" onClick={() => changeSlide(1)} aria-label="Next featured event"><FiChevronRight aria-hidden="true" /></button>
                        </div>
                    )}
                </div>
            </section>

            <div className="eventora-home-content">
            <section id="event-list" className="mb-16 scroll-mt-8">
                <div className="mb-6 flex items-end justify-between gap-4 border-b border-gray-200 pb-5">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-teal-800">On the calendar</p>
                        <h2 className="mt-2 text-3xl font-bold text-gray-950 sm:text-4xl">Explore events</h2>
                    </div>
                    <span className="pb-1 text-sm font-semibold text-gray-500">{filteredEvents.length} {filteredEvents.length === 1 ? 'event' : 'events'}</span>
                </div>

                {loading ? (
                    <div className="py-16 text-center text-sm font-semibold text-gray-500">Finding events...</div>
                ) : error ? (
                    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-8 text-center text-sm text-red-700">{error}</div>
                ) : filteredEvents.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-12 text-center">
                        <p className="font-semibold text-gray-800">{searchTerm ? `No events found for "${searchText.trim()}".` : 'No events are available right now.'}</p>
                        {searchTerm && <button type="button" onClick={() => { setSearchText(''); setSearchTerm(''); }} className="mt-3 text-sm font-bold text-rose-600 hover:text-rose-700">Clear search</button>}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {filteredEvents.map((event) => {
                            return (
                                <article key={event._id} className="group flex min-w-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:border-rose-300 hover:shadow-lg">
                                    <Link to={`/events/${event._id}`} className="relative block aspect-[4/3] overflow-hidden bg-gray-100" aria-label={`View ${event.title}`}>
                                        {event.image ? <img src={event.image} alt={event.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="flex h-full w-full items-center justify-center bg-gray-200 text-sm font-bold uppercase tracking-widest text-gray-500">{event.category || 'Event'}</div>}
                                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-gray-950/95 via-gray-950/55 to-transparent px-5 pb-5 pt-16 text-white">
                                            <h3 className="line-clamp-2 text-xl font-bold leading-snug">{event.title}</h3>
                                        </div>
                                    </Link>
                                    <div className="flex min-h-16 items-center gap-2 px-5 py-4 text-base font-medium text-gray-700">
                                        <FaMapMarkerAlt className="shrink-0 text-rose-600" aria-hidden="true" />
                                        <span className="line-clamp-2">{event.location}</span>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>
            <section id="about" className="eventora-home-about">
                <p className="eventora-home-about-label">About Eventora</p>
                <h2>Make the calendar<br />something to look forward to.</h2>
                <p>From the first song to the last encore, find experiences that bring people together.</p>
            </section>
            </div>
        </div>
    );
};

export default Home;
