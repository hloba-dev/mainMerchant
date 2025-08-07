import validator from 'validator';

const { isEmail } = validator;

function isTronAddress(addr) {
  return /^T[a-zA-Z0-9]{33}$/.test(addr);
}

function startOfTodayUTC() {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

function startOfYesterdayUTC() {
  const d = startOfTodayUTC();
  d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

function generateOrderNumber() {
  return `ORD-${Date.now()}-${Math.floor(Math.random() * 1e6)
    .toString(36)
    .toUpperCase()}`;
}

export {
  isEmail,
  isTronAddress,
  startOfTodayUTC,
  startOfYesterdayUTC,
  generateOrderNumber,
};
