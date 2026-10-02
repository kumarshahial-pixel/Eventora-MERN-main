import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaCheckCircle } from 'react-icons/fa';
import api from '../utils/axios';

const PaymentSuccess = () => {
    const { state } = useLocation();
    const [ticketUrl, setTicketUrl] = useState('');
    const [ticketLoading, setTicketLoading] = useState(false);
    const [ticketError, setTicketError] = useState('');

    useEffect(() => () => {
        if (ticketUrl) URL.revokeObjectURL(ticketUrl);
    }, [ticketUrl]);

    const handleViewTicket = async () => {
        if (!state?.bookingId) return;
        setTicketLoading(true);
        setTicketError('');
        try {
            const { data } = await api.get(`/bookings/${state.bookingId}/ticket`, { responseType: 'blob' });
            setTicketUrl(URL.createObjectURL(new Blob([data], { type: 'application/pdf' })));
        } catch {
            setTicketError('Could not load the ticket PDF. You can try again from My Bookings.');
        } finally {
            setTicketLoading(false);
        }
    };

    return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center p-4">
            <div className="bg-white p-8 sm:p-10 rounded-3xl shadow-2xl max-w-3xl w-full text-center border-t-8 border-green-500">
                <FaCheckCircle className="text-green-500 text-7xl mx-auto mb-6 drop-shadow-sm" />
                <h1 className="text-4xl font-black text-gray-900 mb-4">Booking Confirmed!</h1>
                <p className="text-gray-500 mb-8 text-lg">Your ticket has been booked successfully. You can view it from your dashboard.</p>
                <div className="space-y-4">
                    {state?.bookingId ? (
                        <button type="button" onClick={handleViewTicket} disabled={ticketLoading} className="block w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-6 rounded-xl transition shadow-lg hover:shadow-xl disabled:cursor-wait disabled:opacity-70">
                            {ticketLoading ? 'Loading ticket...' : ticketUrl ? 'Refresh Ticket PDF' : 'View Ticket PDF'}
                        </button>
                    ) : (
                        <Link to="/my-bookings" className="block w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-6 rounded-xl transition shadow-lg hover:shadow-xl">
                            View My Tickets
                        </Link>
                    )}
                    {ticketError && <p role="alert" className="text-sm text-red-600">{ticketError}</p>}
                    {ticketUrl && <iframe src={ticketUrl} title="Event ticket PDF" className="mt-4 h-[70vh] min-h-96 w-full rounded-lg border border-gray-200" />}
                    <Link to="/" className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-4 px-6 rounded-xl transition">
                        Discover More Events
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default PaymentSuccess;
