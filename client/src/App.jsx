import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import EventDetail from './pages/EventDetail';
import BookingPage from './pages/BookingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import UserDashboard from './pages/UserDashboard';
import MyBookings from './pages/MyBookings';
import Profile from './pages/Profile';
import AdminDashboard from './pages/AdminDashboard';
import PaymentSuccess from './pages/PaymentSuccess';
import PaymentFailed from './pages/PaymentFailed';

function AppContent() {
    const { pathname } = useLocation();
    const isAuthPage = pathname === '/login' || pathname === '/register';
    const isHomePage = pathname === '/';

    return (
        <div className="eventora-shell min-h-screen flex flex-col">
            {!isAuthPage && <Navbar />}
            <main className={`eventora-main flex-grow ${isAuthPage ? 'eventora-main-auth' : isHomePage ? 'eventora-main-home' : 'container mx-auto px-4 sm:px-6 lg:px-8 py-8'}`}>
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/events/:id" element={<EventDetail />} />
                        <Route path="/events/:id/book" element={<BookingPage />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />
                        <Route path="/dashboard" element={<UserDashboard />} />
                        <Route path="/my-bookings" element={<MyBookings />} />
                        <Route path="/profile" element={<Profile />} />
                        <Route path="/admin" element={<AdminDashboard />} />
                        <Route path="/payment-success" element={<PaymentSuccess />} />
                        <Route path="/payment-failed" element={<PaymentFailed />} />
                        <Route path="*" element={<h1 className="text-3xl font-bold text-center mt-20">404 - Page Not Found</h1>} />
                    </Routes>
            </main>
            {!isAuthPage && <Footer />}
        </div>
    );
}

function App() {
    return (
        <Router>
            <AppContent />
        </Router>
    );
}

export default App;
