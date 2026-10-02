import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaFacebookF, FaInstagram, FaTicketAlt, FaYoutube } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';

const Footer = () => {
    const { pathname } = useLocation();
    const isHomePage = pathname === '/';
    const headingColor = isHomePage ? 'text-rose-200' : 'text-teal-200';
    const linkColor = 'text-gray-200 transition hover:text-white';
    const eventCategories = ['Music', 'Technology', 'Art & culture', 'Food & drink', 'Business', 'Fashion'];
    const socialLinks = [
        { label: 'Instagram', href: 'https://www.instagram.com/', Icon: FaInstagram },
        { label: 'X', href: 'https://x.com/', Icon: FaXTwitter },
        { label: 'Facebook', href: 'https://www.facebook.com/', Icon: FaFacebookF },
        { label: 'YouTube', href: 'https://www.youtube.com/', Icon: FaYoutube }
    ];

    return (
        <footer className={`border-t-4 ${isHomePage ? 'border-rose-400 bg-[#190727]' : 'border-teal-500 bg-[#102a2c]'} text-white`}>
            <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
                <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
                    <div>
                        <Link to="/" className="inline-flex items-center gap-2 text-xl font-bold text-white transition hover:text-teal-200">
                            <FaTicketAlt aria-hidden="true" /> Eventora
                        </Link>
                        <p className="mt-3 max-w-sm text-sm leading-6 text-gray-300">
                            Find your people, make a plan, and be there for the moments that matter.
                        </p>
                        <h2 className={`mt-5 text-xs font-bold uppercase tracking-wider ${headingColor}`}>Follow Eventora</h2>
                        <div className="mt-3 flex items-center gap-2">
                            {socialLinks.map(({ label, href, Icon }) => (
                                <a
                                    key={label}
                                    href={href}
                                    target="_blank"
                                    rel="noreferrer"
                                    aria-label={`Open ${label}`}
                                    title={label}
                                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-gray-200 transition hover:border-white/50 hover:bg-white/10 hover:text-white"
                                >
                                    <Icon aria-hidden="true" />
                                </a>
                            ))}
                        </div>
                    </div>
                    <div>
                        <h2 className={`text-sm font-bold uppercase tracking-wider ${headingColor}`}>Explore</h2>
                        <div className="mt-3 flex flex-col items-start gap-2 text-sm">
                            <Link to="/" className={linkColor}>Home</Link>
                            <Link to="/#event-list" className={linkColor}>Browse events</Link>
                            <Link to="/#about" className={linkColor}>About Eventora</Link>
                        </div>
                    </div>
                    <div>
                        <h2 className={`text-sm font-bold uppercase tracking-wider ${headingColor}`}>Event categories</h2>
                        <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-gray-300">
                            {eventCategories.map((category) => <li key={category}>{category}</li>)}
                        </ul>
                    </div>
                    <div>
                        <h2 className={`text-sm font-bold uppercase tracking-wider ${headingColor}`}>Your account</h2>
                        <div className="mt-3 flex flex-col items-start gap-2 text-sm">
                            <Link to="/login" className={linkColor}>Log in</Link>
                            <Link to="/register" className={linkColor}>Create an account</Link>
                        </div>
                    </div>
                </div>
                <div className="mt-8 border-t border-white/15 pt-5 text-xs text-gray-400">
                    © {new Date().getFullYear()} Eventora. All rights reserved.
                </div>
            </div>
        </footer>
    );
};

export default Footer;