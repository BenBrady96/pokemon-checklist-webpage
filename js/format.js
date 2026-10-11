export const count = new Intl.NumberFormat('en-GB');
export const plural = (n, one, many) => `${count.format(n)} ${n === 1 ? one : many}`;

export const DAY_MONTH = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
export const DAY_MONTH_YEAR = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export const shortDate = (t) => {
  const date = new Date(t);
  return (date.getFullYear() === new Date().getFullYear() ? DAY_MONTH : DAY_MONTH_YEAR).format(date);
};

export const formatAgo = (ts) => {
  const days = Math.floor((Date.now() - ts) / 86400000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
};
