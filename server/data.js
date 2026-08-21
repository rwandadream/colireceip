import { createHash } from 'node:crypto';
import { prisma } from './prisma.js';

const parcelStatuses = new Set(['received', 'pending', 'in_transit', 'arrived', 'delivered', 'cancelled']);
const tripStatuses = new Set(['planned', 'in_transit', 'arrived', 'closed', 'cancelled']);
const paymentMethods = new Set(['cash', 'orange_money', 'wave', 'bank_transfer']);
const paymentConditions = new Set(['paid_origin', 'paid_destination', 'partial', 'unpaid']);
const vehicleFeeFields = [['roadBamakoFrontier', 'roadBamakoFrontier'], ['customsFee', 'customsFee'], ['frontierFormalities', 'frontierFormalities'], ['roadFrontierBouake', 'roadFrontierBouake'], ['roadBouakeAbidjan', 'roadBouakeAbidjan'], ['roadAbidjan', 'roadAbidjan'], ['loadingFee', 'loadingFee'], ['unloadingFee', 'unloadingFee'], ['truckQuota', 'truckQuota'], ['monthlyFee', 'monthlyFee']];
const clean = (value) => typeof value === 'string' ? value.trim() : value;
const amount = (value, name) => { const number = Number(value); if (!Number.isFinite(number) || number < 0) throw new Error(`Invalid ${name}.`); return number; };
const date = (value, name) => { const parsed = new Date(value); if (Number.isNaN(parsed.valueOf())) throw new Error(`Invalid ${name}.`); return parsed; };
const required = (value, name) => { const result = clean(value); if (!result) throw new Error(`Missing ${name}.`); return result; };
const allowed = (value, set, name) => { if (!set.has(value)) throw new Error(`Invalid ${name}.`); return value; };
const isAdmin = (user) => user.role === 'admin';
const owned = (user, record) => isAdmin(user) || record.createdById === user.id || record.registeredById === user.id || record.agentId === user.id || record.recordedById === user.id;
const publicValue = (value) => {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value.toNumber === 'function') return value.toNumber();
  if (Array.isArray(value)) return value.map(publicValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, publicValue(item)]));
  return value;
};
const vehicleData = (input, vehicleNumber) => ({ vehicleNumber, registration: clean(input.registration) || 'Non immatriculé', ...Object.fromEntries(vehicleFeeFields.map(([inputKey, field]) => [field, amount(input[inputKey] ?? 0, 'fee')])) });
const ownedTrip = async (tripId, user) => { const trip = await prisma.trip.findUnique({ where: { id: required(tripId, 'tripId') } }); if (!trip || !owned(user, trip)) throw new Error('Forbidden.'); return trip; };
const paymentFingerprint = (parcelId, paymentAmount, paymentMethod, paymentDate, note) => createHash('sha256').update(JSON.stringify({ parcelId, amount: paymentAmount, paymentMethod, paymentDate: paymentDate.toISOString().slice(0, 10), note })).digest('hex');
const idempotencyConflict = () => { const error = new Error('Idempotency key conflict.'); error.code = 'IDEMPOTENCY_CONFLICT'; return error; };
const missingIdempotencyKey = () => { const error = new Error('Missing Idempotency-Key.'); error.code = 'MISSING_IDEMPOTENCY_KEY'; return error; };
const resolveExistingPayment = (existing, user, fingerprint) => { if (!owned(user, existing)) throw new Error('Forbidden.'); if (existing.idempotencyFingerprint !== fingerprint) throw idempotencyConflict(); return publicValue(existing); };

export async function list(resource, user, query = {}) {
  switch (resource) {
    case 'products': return publicValue(await prisma.product.findMany({ orderBy: { name: 'asc' } }));
    case 'clients': return publicValue(await prisma.client.findMany({ where: isAdmin(user) ? {} : { createdById: user.id }, orderBy: { createdAt: 'desc' } }));
    case 'trips': return publicValue(await prisma.trip.findMany({ where: isAdmin(user) ? {} : { createdById: user.id }, include: { vehicles: true }, orderBy: { tripDate: 'desc' } }));
    case 'trip-vehicles': { await ownedTrip(query.tripId, user); return publicValue(await prisma.tripVehicle.findMany({ where: { tripId: query.tripId }, orderBy: { vehicleNumber: 'asc' } })); }
    case 'parcels': return publicValue(await prisma.parcel.findMany({ where: isAdmin(user) ? {} : { OR: [{ registeredById: user.id }, { agentId: user.id }] }, include: { items: true }, orderBy: { createdAt: 'desc' } }));
    case 'status-history': { const parcel = await prisma.parcel.findUnique({ where: { id: required(query.parcelId, 'parcelId') } }); if (!parcel || !owned(user, parcel)) throw new Error('Forbidden.'); return publicValue(await prisma.statusHistory.findMany({ where: { parcelId: parcel.id }, orderBy: { createdAt: 'asc' } })); }
    case 'payments': return publicValue(await prisma.payment.findMany({ where: isAdmin(user) ? {} : { recordedById: user.id }, orderBy: { paymentDate: 'desc' } }));
    default: throw new Error('Unknown resource.');
  }
}

export async function create(resource, input, user, options = {}) {
  if (resource === 'products') {
    if (!isAdmin(user)) throw new Error('Forbidden.');
    return publicValue(await prisma.product.create({ data: { name: required(input.name, 'name'), category: required(input.category, 'category'), defaultPrice: amount(input.defaultPrice, 'defaultPrice') } }));
  }
  if (resource === 'clients') return publicValue(await prisma.client.create({ data: { fullName: required(input.fullName, 'fullName'), phone: clean(input.phone) || '', companyName: clean(input.companyName) || null, email: clean(input.email)?.toLowerCase() || null, city: clean(input.city) || '', neighborhood: clean(input.neighborhood) || null, address: clean(input.address) || '', reference: clean(input.reference) || null, notes: clean(input.notes) || '', createdById: user.id, createdByName: user.full_name } }));
  if (resource === 'trips') return publicValue(await prisma.trip.create({ data: { tripNumber: clean(input.tripNumber) || `TRIP-${Date.now()}`, tripDate: date(input.tripDate || new Date(), 'tripDate'), origin: clean(input.origin) || 'Bamako', destination: clean(input.destination) || 'Abidjan', status: allowed(input.status ?? 'planned', tripStatuses, 'status'), createdById: user.id, createdByName: user.full_name, vehicles: input.vehicles?.length ? { create: input.vehicles.map((vehicle, index) => vehicleData(vehicle, index + 1)) } : undefined } , include: { vehicles: true } }));
  if (resource === 'trip-vehicles') { const trip = await ownedTrip(input.tripId, user); const lastVehicle = await prisma.tripVehicle.aggregate({ where: { tripId: trip.id }, _max: { vehicleNumber: true } }); return publicValue(await prisma.tripVehicle.create({ data: { tripId: trip.id, ...vehicleData(input, (lastVehicle._max.vehicleNumber ?? 0) + 1) } })); }
  if (resource === 'parcels') {
    const client = await prisma.client.findUnique({ where: { id: required(input.clientId, 'clientId') } }); if (!client || !owned(user, client)) throw new Error('Forbidden.');
    const items = Array.isArray(input.items) ? input.items : []; if (!items.length) throw new Error('Missing items.');
    const subTotal = items.reduce((sum, item) => sum + amount(item.quantity, 'quantity') * amount(item.unitPrice, 'unitPrice'), 0); const transportPrice = amount(input.transportPrice ?? 0, 'transportPrice'); const additionalFees = amount(input.additionalFees ?? 0, 'additionalFees'); const amountPaid = amount(input.amountPaid ?? 0, 'amountPaid'); const condition = allowed(input.paymentCondition ?? 'unpaid', paymentConditions, 'paymentCondition'); const totalAmount = subTotal + transportPrice + additionalFees;
    const origin = clean(input.origin) || 'Bamako';
    const destination = clean(input.destination) || 'Abidjan';
    return publicValue(await prisma.parcel.create({ data: { trackingNumber: `GG-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`, clientId: client.id, clientName: client.fullName, clientPhone: client.phone, recipientName: clean(input.recipientName) || 'Destinataire', recipientPhone: clean(input.recipientPhone) || '', recipientAddress: clean(input.recipientAddress) || '', merchandiseType: clean(input.merchandiseType) || (items[0] && clean(items[0].designation)) || 'Marchandise', description: clean(input.description) || '', quantity: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0), weight: amount(input.weight ?? 0, 'weight'), vehicle: clean(input.vehicle) || '', origin, destination, departureBranch: clean(input.departureBranch) || origin, arrivalBranch: clean(input.arrivalBranch) || destination, packageType: clean(input.packageType) || 'Petit colis', paymentCondition: condition, subTotal, transportPrice, additionalFees, totalAmount, amountPaid, balance: condition === 'paid_origin' ? 0 : Math.max(totalAmount - amountPaid, 0), registeredById: user.id, registeredByName: user.full_name, agentId: user.id, agentName: user.full_name, status: allowed(input.status ?? 'received', parcelStatuses, 'status'), receivedDate: date(input.receivedDate ?? new Date(), 'receivedDate'), tripId: input.tripId || null, tripVehicleId: input.tripVehicleId || null, items: { create: items.map((item) => ({ productId: item.productId || null, designation: clean(item.designation) || 'Article', quantity: amount(item.quantity ?? 1, 'quantity'), unitPrice: amount(item.unitPrice ?? 0, 'unitPrice'), amount: amount(item.quantity ?? 1, 'quantity') * amount(item.unitPrice ?? 0, 'unitPrice') })) } }, include: { items: true } }));
  }
  if (resource === 'payments') {
    const idempotencyKey = clean(options.idempotencyKey);
    if (!idempotencyKey) throw missingIdempotencyKey();
    const parcel = await prisma.parcel.findUnique({ where: { id: required(input.parcelId, 'parcelId') } });
    if (!parcel || !owned(user, parcel)) throw new Error('Forbidden.');
    const paymentAmount = amount(input.amount, 'amount');
    if (paymentAmount <= 0) throw new Error('Invalid amount.');
    const paymentMethod = allowed(input.paymentMethod ?? 'cash', paymentMethods, 'paymentMethod');
    const paymentDate = date(input.paymentDate || new Date(), 'paymentDate');
    const note = clean(input.note) || '';
    const fingerprint = paymentFingerprint(parcel.id, paymentAmount, paymentMethod, paymentDate, note);
    const existing = await prisma.payment.findUnique({ where: { idempotencyKey } });
    if (existing) return resolveExistingPayment(existing, user, fingerprint);
    try {
      return publicValue(await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.create({ data: { parcelId: parcel.id, parcelTracking: parcel.trackingNumber, clientId: parcel.clientId, clientName: parcel.clientName, amount: paymentAmount, paymentMethod, paymentDate, recordedById: user.id, recordedByName: user.full_name, note, idempotencyKey, idempotencyFingerprint: fingerprint } });
        const nextPaid = Number(parcel.amountPaid) + paymentAmount;
        await tx.parcel.update({ where: { id: parcel.id }, data: { amountPaid: nextPaid, balance: parcel.paymentCondition === 'paid_origin' ? 0 : Math.max(Number(parcel.totalAmount) - nextPaid, 0) } });
        return payment;
      }));
    } catch (error) {
      if (error.code === 'P2002' || error.code === 'P2028') {
        const replay = await prisma.payment.findUnique({ where: { idempotencyKey } });
        if (replay) return resolveExistingPayment(replay, user, fingerprint);
      }
      throw error;
    }
  }
  throw new Error('Unknown resource.');
}

export async function remove(resource, id, user) {
  if (resource === 'products') { if (!isAdmin(user)) throw new Error('Forbidden.'); return prisma.product.delete({ where: { id } }); }
  if (resource === 'trip-vehicles') { const vehicle = await prisma.tripVehicle.findUnique({ where: { id } }); if (!vehicle) throw new Error('Forbidden.'); await ownedTrip(vehicle.tripId, user); return prisma.tripVehicle.delete({ where: { id } }); }
  const model = resource === 'clients' ? prisma.client : resource === 'trips' ? prisma.trip : resource === 'parcels' ? prisma.parcel : resource === 'payments' ? prisma.payment : null; if (!model) throw new Error('Unknown resource.'); const record = await model.findUnique({ where: { id } }); if (!record || !owned(user, record)) throw new Error('Forbidden.'); return model.delete({ where: { id } });
}

export async function update(resource, id, input, user) {
  if (resource === 'products') { if (!isAdmin(user)) throw new Error('Forbidden.'); return publicValue(await prisma.product.update({ where: { id }, data: { ...(input.name !== undefined ? { name: required(input.name, 'name') } : {}), ...(input.category !== undefined ? { category: required(input.category, 'category') } : {}), ...(input.defaultPrice !== undefined ? { defaultPrice: amount(input.defaultPrice, 'defaultPrice') } : {}) } })); }
  if (resource === 'clients') { const record = await prisma.client.findUnique({ where: { id } }); if (!record || !owned(user, record)) throw new Error('Forbidden.'); return publicValue(await prisma.client.update({ where: { id }, data: { ...(input.fullName !== undefined ? { fullName: required(input.fullName, 'fullName') } : {}), ...(input.phone !== undefined ? { phone: clean(input.phone) || '' } : {}), ...(input.city !== undefined ? { city: clean(input.city) || '' } : {}), ...(input.address !== undefined ? { address: clean(input.address) || '' } : {}), ...(input.notes !== undefined ? { notes: clean(input.notes) || '' } : {}) } })); }
  if (resource === 'trips') { const record = await prisma.trip.findUnique({ where: { id } }); if (!record || !owned(user, record)) throw new Error('Forbidden.'); return publicValue(await prisma.trip.update({ where: { id }, data: { ...(input.status !== undefined ? { status: allowed(input.status, tripStatuses, 'status') } : {}), ...(input.origin !== undefined ? { origin: required(input.origin, 'origin') } : {}), ...(input.destination !== undefined ? { destination: required(input.destination, 'destination') } : {}) } })); }
  if (resource === 'parcels') {
    return publicValue(await prisma.$transaction(async (tx) => {
      const record = await tx.parcel.findUnique({ where: { id } });
      if (!record || !owned(user, record)) throw new Error('Forbidden.');
      const status = input.status === undefined ? record.status : allowed(input.status, parcelStatuses, 'status');
      const statusChanged = input.status !== undefined && status !== record.status;
      const now = new Date();
      const parcel = await tx.parcel.update({
        where: { id },
        data: {
          ...(input.description !== undefined ? { description: clean(input.description) || '' } : {}),
          ...(input.status !== undefined ? { status } : {}),
          ...(statusChanged && status === 'in_transit' && !record.departureDate ? { departureDate: now } : {}),
          ...(statusChanged && status === 'arrived' && !record.arrivalDate ? { arrivalDate: now } : {}),
          ...(statusChanged && status === 'delivered' && !record.deliveryDate ? { deliveryDate: now } : {}),
        },
      });
      if (statusChanged) {
        await tx.statusHistory.create({ data: {
          parcelId: record.id,
          parcelTracking: record.trackingNumber,
          previousStatus: record.status,
          newStatus: status,
          changedById: user.id,
          changedByName: user.full_name,
          note: clean(input.note) || '',
        } });
      }
      return parcel;
    }));
  }
  if (resource === 'payments') { const record = await prisma.payment.findUnique({ where: { id } }); if (!record || !owned(user, record)) throw new Error('Forbidden.'); return publicValue(await prisma.payment.update({ where: { id }, data: { ...(input.note !== undefined ? { note: clean(input.note) || '' } : {}), ...(input.paymentMethod !== undefined ? { paymentMethod: allowed(input.paymentMethod, paymentMethods, 'paymentMethod') } : {}) } })); }
  throw new Error('Unknown resource.');
}
