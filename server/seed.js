const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Event = require('./models/Event');
const Booking = require('./models/Booking');

dotenv.config();

const users = [
    { name: 'Admin User', email: 'admin@eventora.com', password: 'password123', role: 'admin' },
    { name: 'Demo User', email: 'user@eventora.com', password: 'password123', role: 'user' },
    { name: 'Alice Smith', email: 'alice@eventora.com', password: 'password123', role: 'user' },
    { name: 'Bob Johnson', email: 'bob@eventora.com', password: 'password123', role: 'user' },
    { name: 'Charlie Dave', email: 'charlie@eventora.com', password: 'password123', role: 'user' },
    { name: 'Diana Prince', email: 'diana@eventora.com', password: 'password123', role: 'user' },
    { name: 'Ethan Hunt', email: 'ethan@eventora.com', password: 'password123', role: 'user' },
    { name: 'Fiona Gallagher', email: 'fiona@eventora.com', password: 'password123', role: 'user' },
    { name: 'George Miller', email: 'george@eventora.com', password: 'password123', role: 'user' },
    { name: 'Hannah Montana', email: 'hannah@eventora.com', password: 'password123', role: 'user' }
];

const events = [
    {
        title: 'React & Node.js Developer Retreat',
        description: 'Join us for a 3-day deep dive into modern full-stack web development. Perfect for developers looking to take their skills to the next level.',
        date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
        location: 'Silicon Valley Innovation Center, CA',
        category: 'Technology',
        totalSeats: 200,
        ticketPrice: 0,
        image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&q=80&w=800'
    },
    {
        title: 'Neon Nights EDM Festival',
        description: 'Experience an unforgettable night of EDM, techno, and dazzling light shows with top DJs from around the globe.',
        date: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), // 20 days from now
        location: 'Grand Arena, New York',
        category: 'Music',
        totalSeats: 500,
        ticketPrice: 1500,
        image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=800'
    },
    {
        title: 'Global Leaders Business Summit',
        description: 'A premium gathering of CEOs, founders, and investors discussing the future of global commerce and AI integration.',
        date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
        location: 'The Ritz-Carlton, London',
        category: 'Business',
        totalSeats: 150,
        ticketPrice: 5000,
        image: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&q=80&w=800'
    },
    {
        title: 'Modern Art Expo 2024',
        description: 'Discover breathtaking contemporary and modern arts from underground and trending artists this season.',
        date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
        location: 'Downtown Art Museum',
        category: 'Art',
        totalSeats: 300,
        ticketPrice: 200,
        image: 'https://images.unsplash.com/photo-1536924940846-227afb31e2a5?auto=format&fit=crop&q=80&w=800'
    },
    {
        title: 'Startup Pitch & Pitch Competition',
        description: 'Watch 25 startups pitch for 1 million dollars in seed funding. Great networking for entrepreneurs and angel investors.',
        date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        location: 'Convention Center, Miami',
        category: 'Business',
        totalSeats: 250,
        ticketPrice: 100,
        image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80&w=800'
    },
    {
        title: 'Cloud Computing Architecture Seminar',
        description: 'A purely technical breakdown of scalable cloud solutions, multi-region routing, and serverless compute processing.',
        date: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000), // 12 days from now
        location: 'Tech Hub, Seattle',
        category: 'Technology',
        totalSeats: 100,
        ticketPrice: 600,
        image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=800'
    },
    {
        title: 'Chhata Puja Celebration',
        description: 'A vibrant cultural evening filled with tradition, devotional music, local artistry, and community celebration under the city lights.',
        date: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000),
        location: 'Riverside Cultural Ground, Kolkata',
        category: 'Culture',
        totalSeats: 220,
        ticketPrice: 0,
        image: 'https://images.unsplash.com/photo-1547586696-ea22b4d4235d?auto=format&fit=crop&q=80&w=1200'
    },
    {
        title: 'Celebrity Concert',
        description: 'An unforgettable live concert featuring your favorite superstar with mesmerizing stage effects, lights, and crowd energy.',
        date: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
        location: 'Kingdom Arena, Mumbai',
        category: 'Concert',
        totalSeats: 600,
        ticketPrice: 2500,
        image: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&q=80&w=800'
    },
    {
        title: 'Bollywood Night',
        description: 'A glamorous musical celebration featuring iconic songs, dance performances, and a cinematic atmosphere for all movie lovers.',
        date: new Date(Date.now() + 22 * 24 * 60 * 60 * 1000),
        location: 'Sunset Grand Theatre, Delhi',
        category: 'Entertainment',
        totalSeats: 420,
        ticketPrice: 1800,
        image: 'https://images.unsplash.com/photo-1503095396549-807759245b35?auto=format&fit=crop&q=80&w=800'
    },
    {
        title: 'EDM / DJ Night',
        description: 'Dance the night away with the most electrifying DJ sets, premium lights, and a high-energy crowd in an open-air arena.',
        date: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
        location: 'Skyline Terrace, Bengaluru',
        category: 'Music',
        totalSeats: 520,
        ticketPrice: 2200,
        image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80&w=800'
    },
    {
        title: 'Premium Food Festival',
        description: 'Enjoy signature dishes, chef pop-ups, tasting stations, and indulgent culinary experiences from top local and global brands.',
        date: new Date(Date.now() + 34 * 24 * 60 * 60 * 1000),
        location: 'Urban Harvest Park, Pune',
        category: 'Food',
        totalSeats: 360,
        ticketPrice: 1200,
        image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&q=80&w=800'
    },
    {
        title: 'Business Networking Gala',
        description: 'Meet founders, investors, and industry leaders in a refined evening of relationship-building, strategy, and inspiration.',
        date: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000),
        location: 'Bharat Executive Club, Hyderabad',
        category: 'Business',
        totalSeats: 180,
        ticketPrice: 3200,
        image: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&q=80&w=800'
    },
    {
        title: 'Fashion Show',
        description: 'Step into a showcase of contemporary style, runway couture, designer labels, and premium fashion storytelling.',
        date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
        location: 'Grand Fashion Avenue, Jaipur',
        category: 'Fashion',
        totalSeats: 280,
        ticketPrice: 1500,
        image: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&q=80&w=800'
    },
    {
        title: 'Luxury Car Show',
        description: 'Witness the finest exotic and luxury vehicles, interactive displays, and remarkable automotive craftsmanship in one premium event.',
        date: new Date(Date.now() + 48 * 24 * 60 * 60 * 1000),
        location: 'Automotive Dome, Gurugram',
        category: 'Automotive',
        totalSeats: 260,
        ticketPrice: 2000,
        image: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&q=80&w=800'
    },
    {
        title: 'Premium Cultural Night',
        description: 'A refined fusion of dance, folklore, music, and heritage performances that brings the region’s culture to life.',
        date: new Date(Date.now() + 52 * 24 * 60 * 60 * 1000),
        location: 'Heritage Hall, Ahmedabad',
        category: 'Culture',
        totalSeats: 310,
        ticketPrice: 900,
        image: 'https://images.unsplash.com/photo-1507874457470-272b3c8d8ee2?auto=format&fit=crop&q=80&w=800'
    },
    {
        title: 'New Year Gala',
        description: 'Celebrate the arrival of the new year with a spectacular gala featuring live music, gourmet dining, and unforgettable midnight energy.',
        date: new Date(Date.now() + 70 * 24 * 60 * 60 * 1000),
        location: 'Skyline Palace, Goa',
        category: 'Celebration',
        totalSeats: 450,
        ticketPrice: 4999,
        image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&q=80&w=800'
    },
    {
        title: 'Live Music Festival',
        description: 'Celebrate music across genres with live performances, food stalls, and an immersive festival atmosphere under the open sky.',
        date: new Date(Date.now() + 63 * 24 * 60 * 60 * 1000),
        location: 'Greenfield Amphitheatre, Chandigarh',
        category: 'Music',
        totalSeats: 700,
        ticketPrice: 1600,
        image: 'https://images.unsplash.com/photo-1501612780327-45045538702b?auto=format&fit=crop&q=80&w=800'
    }
];

const seedDatabase = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/eventora');
        console.log('\n✅ MongoDB connection open...');

        await User.deleteMany();
        await Event.deleteMany();
        await Booking.deleteMany();
        console.log('🗑️  Cleared existing data.');

        // Hash user passwords
        const salt = await bcrypt.genSalt(10);
        const hashedUsers = users.map(u => ({
            ...u,
            password: bcrypt.hashSync(u.password, salt),
            isVerified: true
        }));

        const createdUsers = await User.insertMany(hashedUsers);
        const adminUser = createdUsers.find(u => u.role === 'admin');
        const normalUsers = createdUsers.filter(u => u.role === 'user');
        console.log(`👤 Created ${createdUsers.length} total dummy users.`);

        // Link events to admin
        const eventsWithAdmin = events.map(e => ({
            ...e,
            availableSeats: e.totalSeats,
            createdBy: adminUser._id
        }));

        const createdEvents = await Event.insertMany(eventsWithAdmin);
        console.log(`🎉 Created ${createdEvents.length} distinct events with Unsplash images.`);

        // Generate Bookings Data
        const bookingsData = [];

        for (const event of createdEvents) {
            // Assign 3-6 random users to each event
            const randomCount = Math.floor(Math.random() * 4) + 3;
            // Shuffle and pick random users
            const shuffledUsers = [...normalUsers].sort(() => 0.5 - Math.random());
            const selectedUsers = shuffledUsers.slice(0, randomCount);

            for (const user of selectedUsers) {
                // Randomize statuses
                const statuses = ['pending', 'confirmed', 'cancelled'];
                const status = statuses[Math.floor(Math.random() * statuses.length)];

                let paymentStatus = 'not_paid';
                if (status === 'confirmed' && event.ticketPrice > 0) {
                    // Usually confirmed tickets are marked paid (90% of the time)
                    paymentStatus = Math.random() > 0.1 ? 'paid' : 'not_paid';
                } else if (event.ticketPrice === 0) {
                    paymentStatus = 'paid';
                }

                bookingsData.push({
                    userId: user._id,
                    eventId: event._id,
                    status: status,
                    paymentStatus: paymentStatus,
                    amount: event.ticketPrice
                });

                // Deduct available seats specifically for confirmed tickets!
                if (status === 'confirmed') {
                    event.availableSeats -= 1;
                    await event.save();
                }
            }
        }

        await Booking.insertMany(bookingsData);
        console.log(`🎫 Inserted ${bookingsData.length} randomized dummy bookings (confirmed, pending, cancelled, paid, not_paid).`);

        console.log('\n🚀 Database seeded successfully!');
        console.log('-------------------------------------------');
        console.log('Admin Email: admin@eventora.com');
        console.log('User Email:  user@eventora.com');
        console.log('Password for all users: password123');
        console.log('-------------------------------------------\n');

        process.exit();
    } catch (error) {
        console.error('❌ Error seeding data:', error);
        process.exit(1);
    }
};

seedDatabase();
