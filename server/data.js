import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma.js';
import { publicUser } from './auth.js';

const userRoles = new Set(['admin', 'agent']);
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
const canAccessParcel = (user, parcel) => isAdmin(user) || parcel.registeredById === user.id || parcel.agentId === user.id;
const canEditPayment = (user, payment, parcel) => isAdmin(user) || payment.recordedById === user.id || canAccessParcel(user, parcel);
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
const statusConflict = () => { const error = new Error('Le colis a été modifié sur le serveur.'); error.code = 'STATUS_CONFLICT'; return error; };
const missingIdempotencyKey = () => { const error = new Error('Missing Idempotency-Key.'); error.code = 'MISSING_IDEMPOTENCY_KEY'; return error; };
const resolveExistingPayment = (existing, user, fingerprint) => { if (existing.idempotencyFingerprint !== fingerprint) throw idempotencyConflict(); return publicValue(existing); };

export async function list(resource, user, query = {}) {
  switch (resource) {
    case 'users': {
      if (!isAdmin(user)) throw new Error('Forbidden.');
      const users = await prisma.user.findMany({ orderBy: { fullName: 'asc' } });
      return users.map(publicUser);
    }
    case 'products': return publicValue(await prisma.product.findMany({ orderBy: { name: 'asc' } }));
    case 'clients': return publicValue(await prisma.client.findMany({ orderBy: { createdAt: 'desc' } }));
    case 'trips': {
      const where = isAdmin(user) ? {} : { createdById: user.id };
      return publicValue(await prisma.trip.findMany({ where, include: { vehicles: true }, orderBy: { tripDate: 'desc' } }));
    }
    case 'trip-vehicles': { await ownedTrip(query.tripId, user); return publicValue(await prisma.tripVehicle.findMany({ where: { tripId: query.tripId }, orderBy: { vehicleNumber: 'asc' } })); }
    case 'parcels': return publicValue(await prisma.parcel.findMany({ include: { items: true }, orderBy: { createdAt: 'desc' } }));
    case 'status-history': { const parcel = await prisma.parcel.findUnique({ where: { id: required(query.parcelId, 'parcelId') } }); if (!parcel) throw new Error('Colis introuvable.'); return publicValue(await prisma.statusHistory.findMany({ where: { parcelId: parcel.id }, orderBy: { createdAt: 'asc' } })); }
    case 'payments': return publicValue(await prisma.payment.findMany({ orderBy: { paymentDate: 'desc' } }));
    case 'settings': {
      const settingsRow = await prisma.appSettings.findFirst();
      return settingsRow ? [publicValue(settingsRow)] : [];
    }
    default: throw new Error('Unknown resource.');
  }
}

export async function create(resource, input, user, options = {}) {
  if (resource === 'users') {
    if (!isAdmin(user)) throw new Error('Forbidden.');
    const fullName = required(input.fullName || input.full_name, 'fullName');
    const phone = required(input.phone, 'phone');
    const password = required(input.password, 'password');
    if (password.length < 8) throw new Error('Le mot de passe doit contenir au moins 8 caractères.');
    const role = allowed(input.role, userRoles, 'role');
    const active = input.active !== undefined ? Boolean(input.active) : true;
    const email = clean(input.email)?.toLowerCase() || null;
    const passwordHash = await bcrypt.hash(password, 12);
    const newUser = await prisma.user.create({
      data: { fullName, phone, role, active, email, passwordHash },
    });
    return publicUser(newUser);
  }
  if (resource === 'products') {
    if (!isAdmin(user)) throw new Error('Forbidden.');
    if (input.id) { const existing = await prisma.product.findUnique({ where: { id: clean(input.id) } }); if (existing) return publicValue(existing); }
    return publicValue(await prisma.product.create({ data: { ...(input.id ? { id: clean(input.id) } : {}), name: required(input.name, 'name'), category: required(input.category, 'category'), defaultPrice: amount(input.defaultPrice, 'defaultPrice') } }));
  }
  if (resource === 'clients') { if (input.id) { const existing = await prisma.client.findUnique({ where: { id: clean(input.id) } }); if (existing) return publicValue(existing); } return publicValue(await prisma.client.create({ data: { ...(input.id ? { id: clean(input.id) } : {}), fullName: required(input.fullName, 'fullName'), phone: clean(input.phone) || '', companyName: clean(input.companyName) || null, email: clean(input.email)?.toLowerCase() || null, city: clean(input.city) || '', neighborhood: clean(input.neighborhood) || null, address: clean(input.address) || '', reference: clean(input.reference) || null, notes: clean(input.notes) || '', createdById: user.id, createdByName: user.full_name } })); }
  if (resource === 'trips') { const tripCount = await prisma.trip.count(); return publicValue(await prisma.trip.create({ data: { ...(input.id ? { id: clean(input.id) } : {}), tripNumber: clean(input.tripNumber) || `TRIP-${101 + tripCount}`, tripDate: date(input.tripDate || new Date(), 'tripDate'), origin: clean(input.origin) || 'Bamako', destination: clean(input.destination) || 'Abidjan', status: allowed(input.status ?? 'planned', tripStatuses, 'status'), createdById: user.id, createdByName: user.full_name, vehicles: input.vehicles?.length ? { create: input.vehicles.map((vehicle, index) => vehicleData(vehicle, index + 1)) } : undefined } , include: { vehicles: true } })); }
  if (resource === 'trip-vehicles') { const trip = await ownedTrip(input.tripId, user); const lastVehicle = await prisma.tripVehicle.aggregate({ where: { tripId: trip.id }, _max: { vehicleNumber: true } }); if (input.id) { const existing = await prisma.tripVehicle.findUnique({ where: { id: clean(input.id) } }); if (existing) return publicValue(existing); } return publicValue(await prisma.tripVehicle.create({ data: { ...(input.id ? { id: clean(input.id) } : {}), tripId: trip.id, ...vehicleData(input, (lastVehicle._max.vehicleNumber ?? 0) + 1) } })); }
  if (resource === 'parcels') {
    const client = await prisma.client.findUnique({ where: { id: required(input.clientId, 'clientId') } }); if (!client) throw new Error('Client introuvable.');
    const items = Array.isArray(input.items) ? input.items : []; if (!items.length) throw new Error('Missing items.');
    if (input.id) { const existing = await prisma.parcel.findUnique({ where: { id: clean(input.id) }, include: { items: true } }); if (existing) return publicValue(existing); }
    const subTotal = items.reduce((sum, item) => sum + amount(item.quantity, 'quantity') * amount(item.unitPrice, 'unitPrice'), 0); const transportPrice = amount(input.transportPrice ?? 0, 'transportPrice'); const additionalFees = amount(input.additionalFees ?? 0, 'additionalFees'); const amountPaid = amount(input.amountPaid ?? 0, 'amountPaid'); const condition = allowed(input.paymentCondition ?? 'unpaid', paymentConditions, 'paymentCondition'); const totalAmount = subTotal + transportPrice + additionalFees;
    const origin = clean(input.origin) || 'Bamako';
    const destination = clean(input.destination) || 'Abidjan';
    const count = await prisma.parcel.count();
    const trackingNumber = clean(input.trackingNumber) || `GG-COL-${1001 + count}`;
    const createParcel = async (trackingCandidate) => publicValue(await prisma.parcel.create({ data: { ...(input.id ? { id: clean(input.id) } : {}), trackingNumber: trackingCandidate, clientId: client.id, clientName: client.fullName, clientPhone: client.phone, recipientName: clean(input.recipientName) || 'Destinataire', recipientPhone: clean(input.recipientPhone) || '', recipientAddress: clean(input.recipientAddress) || '', merchandiseType: clean(input.merchandiseType) || (items[0] && clean(items[0].designation)) || 'Marchandise', description: clean(input.description) || '', quantity: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0), weight: amount(input.weight ?? 0, 'weight'), vehicle: clean(input.vehicle) || '', origin, destination, departureBranch: clean(input.departureBranch) || origin, arrivalBranch: clean(input.arrivalBranch) || destination, packageType: clean(input.packageType) || 'Petit colis', paymentCondition: condition, subTotal, transportPrice, additionalFees, totalAmount, amountPaid, balance: condition === 'paid_origin' ? 0 : Math.max(totalAmount - amountPaid, 0), registeredById: user.id, registeredByName: user.full_name, agentId: user.id, agentName: user.full_name, status: allowed(input.status ?? 'received', parcelStatuses, 'status'), receivedDate: date(input.receivedDate ?? new Date(), 'receivedDate'), tripId: input.tripId || null, tripVehicleId: input.tripVehicleId || null, items: { create: items.map((item) => ({ productId: item.productId || null, designation: clean(item.designation) || 'Article', quantity: amount(item.quantity ?? 1, 'quantity'), unitPrice: amount(item.unitPrice ?? 0, 'unitPrice'), amount: amount(item.quantity ?? 1, 'quantity') * amount(item.unitPrice ?? 0, 'unitPrice') })) } }, include: { items: true } }));
    try {
      return await createParcel(trackingNumber);
    } catch (error) {
      if (error.code !== 'P2002') throw error;
      const regenerated = `GG-COL-${10000 + Math.floor(Math.random() * 90000)}`;
      if (regenerated === trackingNumber) throw error;
      return await createParcel(regenerated);
    }
  }
  if (resource === 'payments') {
    const idempotencyKey = clean(options.idempotencyKey);
    if (!idempotencyKey) throw missingIdempotencyKey();
    const parcel = await prisma.parcel.findUnique({ where: { id: required(input.parcelId, 'parcelId') } });
    if (!parcel) throw new Error('Colis introuvable.');
    if (!canAccessParcel(user, parcel)) throw new Error('Forbidden.');
    const paymentAmount = amount(input.amount, 'amount');
    if (paymentAmount <= 0) throw new Error('Invalid amount.');
    const paymentMethod = allowed(input.paymentMethod ?? 'cash', paymentMethods, 'paymentMethod');
    const paymentDate = date(input.paymentDate || new Date(), 'paymentDate');
    const note = clean(input.note) || '';
    const fingerprint = paymentFingerprint(parcel.id, paymentAmount, paymentMethod, paymentDate, note);
    const existing = await prisma.payment.findUnique({ where: { idempotencyKey } });
    if (existing) return resolveExistingPayment(existing, user, fingerprint);
    if (input.id) { const byId = await prisma.payment.findUnique({ where: { id: clean(input.id) } }); if (byId) return publicValue(byId); }
    try {
      return publicValue(await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.create({ data: { ...(input.id ? { id: clean(input.id) } : {}), parcelId: parcel.id, parcelTracking: parcel.trackingNumber, clientId: parcel.clientId, clientName: parcel.clientName, amount: paymentAmount, paymentMethod, paymentDate, recordedById: user.id, recordedByName: user.full_name, note, idempotencyKey, idempotencyFingerprint: fingerprint } });
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
  if (resource === 'users') {
    if (!isAdmin(user)) throw new Error('Forbidden.');
    if (id === user.id) throw new Error('Impossible de supprimer votre propre compte.');
    return publicUser(await prisma.user.delete({ where: { id } }));
  }
  if (resource === 'products') { if (!isAdmin(user)) throw new Error('Forbidden.'); const existing = await prisma.product.findUnique({ where: { id } }); if (!existing) return null; return prisma.product.delete({ where: { id } }); }
  if (resource === 'trip-vehicles') { const vehicle = await prisma.tripVehicle.findUnique({ where: { id } }); if (!vehicle) return null; await ownedTrip(vehicle.tripId, user); return prisma.tripVehicle.delete({ where: { id } }); }
  if (resource === 'payments') {
    const record = await prisma.payment.findUnique({ where: { id } });
    if (!record) return null;
    const parcel = await prisma.parcel.findUnique({ where: { id: record.parcelId } });
    if (!parcel || !canEditPayment(user, record, parcel)) throw new Error('Forbidden.');
    return publicValue(await prisma.$transaction(async (tx) => {
      const deleted = await tx.payment.delete({ where: { id } });
      const remaining = await tx.payment.aggregate({ where: { parcelId: parcel.id }, _sum: { amount: true } });
      const remainingPaid = Number(remaining._sum.amount ?? 0);
      await tx.parcel.update({
        where: { id: parcel.id },
        data: {
          amountPaid: remainingPaid,
          balance: parcel.paymentCondition === 'paid_origin' ? 0 : Math.max(Number(parcel.totalAmount) - remainingPaid, 0),
        },
      });
      return deleted;
    }));
  }
  const model = resource === 'clients' ? prisma.client : resource === 'trips' ? prisma.trip : resource === 'parcels' ? prisma.parcel : null; if (!model) throw new Error('Unknown resource.'); const record = await model.findUnique({ where: { id } }); if (!record) return null; if (!owned(user, record)) throw new Error('Forbidden.');
  if (resource === 'trips') {
    return publicValue(await prisma.$transaction(async (tx) => {
      await tx.tripVehicle.deleteMany({ where: { tripId: record.id } });
      return tx.trip.delete({ where: { id: record.id } });
    }));
  }
  if (resource === 'parcels') {
    return publicValue(await prisma.$transaction(async (tx) => {
      await tx.statusHistory.deleteMany({ where: { parcelId: record.id } });
      await tx.parcelItem.deleteMany({ where: { parcelId: record.id } });
      await tx.payment.deleteMany({ where: { parcelId: record.id } });
      return tx.parcel.delete({ where: { id: record.id } });
    }));
  }
  return model.delete({ where: { id: record.id } });
}

export async function update(resource, id, input, user) {
  if (resource === 'users') {
    if (!isAdmin(user)) throw new Error('Forbidden.');
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new Error('Utilisateur introuvable.');
    const updateData = {};
    if (input.fullName !== undefined || input.full_name !== undefined) {
      updateData.fullName = required(input.fullName || input.full_name, 'fullName');
    }
    if (input.phone !== undefined) updateData.phone = required(input.phone, 'phone');
    if (input.email !== undefined) updateData.email = clean(input.email)?.toLowerCase() || null;
    if (input.role !== undefined) updateData.role = allowed(input.role, userRoles, 'role');
    if (input.active !== undefined) updateData.active = Boolean(input.active);
    if (input.password && typeof input.password === 'string' && input.password.trim()) {
      const passwordValue = input.password.trim();
      if (passwordValue.length < 8) throw new Error('Le mot de passe doit contenir au moins 8 caractères.');
      updateData.passwordHash = await bcrypt.hash(passwordValue, 12);
    }
    const updatedUser = await prisma.user.update({ where: { id }, data: updateData });
    return publicUser(updatedUser);
  }
  if (resource === 'settings') {
    if (!isAdmin(user)) throw new Error('Forbidden.');
    const settingsFields = {
      ...(input.companyName !== undefined ? { companyName: clean(input.companyName) || 'Groupe-Gaff' } : {}),
      ...(input.companyPhone !== undefined ? { companyPhone: clean(input.companyPhone) || '' } : {}),
      ...(input.companyEmail !== undefined ? { companyEmail: clean(input.companyEmail)?.toLowerCase() || '' } : {}),
      ...(input.bamakoAddress !== undefined ? { bamakoAddress: clean(input.bamakoAddress) || '' } : {}),
      ...(input.abidjanAddress !== undefined ? { abidjanAddress: clean(input.abidjanAddress) || '' } : {}),
      ...(input.defaultTransportPrice !== undefined ? { defaultTransportPrice: amount(input.defaultTransportPrice, 'defaultTransportPrice') } : {}),
      ...(input.currency !== undefined ? { currency: clean(input.currency) || 'FCFA' } : {}),
      ...(input.defaultOrigin !== undefined ? { defaultOrigin: clean(input.defaultOrigin) || null } : {}),
      ...(input.defaultDestination !== undefined ? { defaultDestination: clean(input.defaultDestination) || null } : {}),
    };
    const existing = await prisma.appSettings.findFirst();
    const settingsRecord = existing
      ? await prisma.appSettings.update({ where: { id: existing.id }, data: { ...settingsFields, updatedById: user.id } })
      : await prisma.appSettings.create({
          data: {
            id: '1',
            companyName: clean(input.companyName) || 'Groupe-Gaff',
            companyPhone: clean(input.companyPhone) || '',
            companyEmail: clean(input.companyEmail)?.toLowerCase() || '',
            bamakoAddress: clean(input.bamakoAddress) || '',
            abidjanAddress: clean(input.abidjanAddress) || '',
            defaultTransportPrice: amount(input.defaultTransportPrice ?? 0, 'defaultTransportPrice'),
            currency: clean(input.currency) || 'FCFA',
            defaultOrigin: clean(input.defaultOrigin) || null,
            defaultDestination: clean(input.defaultDestination) || null,
            updatedById: user.id,
          },
        });
    return publicValue(settingsRecord);
  }
  if (resource === 'products') { if (!isAdmin(user)) throw new Error('Forbidden.'); return publicValue(await prisma.product.update({ where: { id }, data: { ...(input.name !== undefined ? { name: required(input.name, 'name') } : {}), ...(input.category !== undefined ? { category: required(input.category, 'category') } : {}), ...(input.defaultPrice !== undefined ? { defaultPrice: amount(input.defaultPrice, 'defaultPrice') } : {}) } })); }
  if (resource === 'clients') { const record = await prisma.client.findUnique({ where: { id } }); if (!record) throw new Error('Client introuvable.'); if (!owned(user, record)) throw new Error('Forbidden.'); return publicValue(await prisma.client.update({ where: { id }, data: { ...(input.fullName !== undefined ? { fullName: required(input.fullName, 'fullName') } : {}), ...(input.phone !== undefined ? { phone: clean(input.phone) || '' } : {}), ...(input.companyName !== undefined ? { companyName: clean(input.companyName) || null } : {}), ...(input.email !== undefined ? { email: clean(input.email)?.toLowerCase() || null } : {}), ...(input.city !== undefined ? { city: clean(input.city) || '' } : {}), ...(input.neighborhood !== undefined ? { neighborhood: clean(input.neighborhood) || null } : {}), ...(input.address !== undefined ? { address: clean(input.address) || '' } : {}), ...(input.reference !== undefined ? { reference: clean(input.reference) || null } : {}), ...(input.notes !== undefined ? { notes: clean(input.notes) || '' } : {}) } })); }
  if (resource === 'trips') { const record = await prisma.trip.findUnique({ where: { id } }); if (!record || !owned(user, record)) throw new Error('Forbidden.'); return publicValue(await prisma.trip.update({ where: { id }, data: { ...(input.status !== undefined ? { status: allowed(input.status, tripStatuses, 'status') } : {}), ...(input.tripNumber !== undefined ? { tripNumber: clean(input.tripNumber) || record.tripNumber } : {}), ...(input.tripDate !== undefined ? { tripDate: date(input.tripDate, 'tripDate') } : {}), ...(input.origin !== undefined ? { origin: required(input.origin, 'origin') } : {}), ...(input.destination !== undefined ? { destination: required(input.destination, 'destination') } : {}) } })); }
  if (resource === 'parcels') {
    return publicValue(await prisma.$transaction(async (tx) => {
      const record = await tx.parcel.findUnique({ where: { id } });
      if (!record) throw new Error('Colis introuvable.');
if (!owned(user, record)) throw new Error('Forbidden.');
      if (input.expectedStatus && record.status !== input.expectedStatus) throw statusConflict();
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
  if (resource === 'payments') { const record = await prisma.payment.findUnique({ where: { id } }); if (!record) throw new Error('Paiement introuvable.'); const parcel = await prisma.parcel.findUnique({ where: { id: record.parcelId } }); if (!parcel || !canEditPayment(user, record, parcel)) throw new Error('Forbidden.'); return publicValue(await prisma.payment.update({ where: { id }, data: { ...(input.note !== undefined ? { note: clean(input.note) || '' } : {}), ...(input.paymentMethod !== undefined ? { paymentMethod: allowed(input.paymentMethod, paymentMethods, 'paymentMethod') } : {}) } })); }
  throw new Error('Unknown resource.');
}

