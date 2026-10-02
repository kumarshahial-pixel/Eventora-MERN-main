const seatTypePriority = (seatType) => {
    const name = String(seatType.name || '').toLowerCase();
    if (name.includes('premium')) return 0;
    if (name.includes('vip')) return 1;
    return 2;
};

const sortSeatTypes = (seatTypes) => [...seatTypes].sort((firstType, secondType) => seatTypePriority(firstType) - seatTypePriority(secondType));

const buildDefaultSeatTypes = (totalSeats, ticketPrice) => {
    const seats = Math.max(1, Number(totalSeats) || 1);
    const basePrice = Math.max(0, Number(ticketPrice) || 0);
    if (seats === 1) return [{ name: 'Regular', price: basePrice, totalSeats: 1 }];
    if (seats === 2) return [
        { name: 'Regular', price: basePrice, totalSeats: 1 },
        { name: 'VIP', price: Math.round(basePrice * 1.5), totalSeats: 1 }
    ];
    const premiumSeats = Math.max(1, Math.round(seats * 0.2));
    const vipSeats = Math.max(1, Math.round(seats * 0.3));
    const regularSeats = Math.max(1, seats - premiumSeats - vipSeats);
    const assignedSeats = regularSeats + vipSeats + premiumSeats;

    return [
        { name: 'Premium', price: Math.round(basePrice * 2), totalSeats: premiumSeats },
        { name: 'VIP', price: Math.round(basePrice * 1.5), totalSeats: vipSeats },
        { name: 'Regular', price: basePrice, totalSeats: regularSeats + (seats - assignedSeats) }
    ];
};

const ensureSeatTypes = (event) => {
    if (!event.seatTypes?.length) {
        event.seatTypes = buildDefaultSeatTypes(event.totalSeats, event.ticketPrice);
    } else {
        event.seatTypes = sortSeatTypes(event.seatTypes);
    }
    return event;
};

module.exports = { buildDefaultSeatTypes, ensureSeatTypes, sortSeatTypes };