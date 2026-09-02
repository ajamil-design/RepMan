const db = require('./db');

const existing = db.getAll();

if (existing.length === 0) {
  const sample = [
    { source: 'Google', author: 'Maria T.', rating: 1, sentiment: 'negative', content: 'Waited 40 minutes and staff was rude. Will not return.', status: 'needs_response', response: null, date: '2026-08-28' },
    { source: 'Yelp', author: 'James K.', rating: 5, sentiment: 'positive', content: 'Best experience ever, the team went above and beyond!', status: 'resolved', response: 'Thank you so much James!', date: '2026-08-27' },
    { source: 'Trustpilot', author: 'Anonymous', rating: 2, sentiment: 'negative', content: 'Product broke after two days, support was slow to respond.', status: 'responded', response: "We've sent a replacement and refund, sorry for the trouble.", date: '2026-08-26' },
    { source: 'Google', author: 'Priya S.', rating: 4, sentiment: 'positive', content: 'Good service overall, small delay in delivery.', status: 'resolved', response: 'Glad you enjoyed it, we are working on delivery times.', date: '2026-08-25' },
    { source: 'Facebook', author: 'Tom H.', rating: 1, sentiment: 'negative', content: 'Charged twice for the same order, no one is answering support emails.', status: 'needs_response', response: null, date: '2026-08-30' },
    { source: 'App Store', author: 'devUser22', rating: 3, sentiment: 'neutral', content: 'App is fine but crashes occasionally on Android.', status: 'needs_response', response: null, date: '2026-08-29' },
    { source: 'Yelp', author: 'Linda R.', rating: 5, sentiment: 'positive', content: 'Absolutely wonderful, highly recommend to everyone!', status: 'resolved', response: 'Thank you Linda, means a lot!', date: '2026-08-22' },
    { source: 'Google', author: 'Carlos M.', rating: 2, sentiment: 'negative', content: 'Product quality has gone down compared to last year.', status: 'needs_response', response: null, date: '2026-09-01' },
    { source: 'Trustpilot', author: 'Sam W.', rating: 4, sentiment: 'positive', content: 'Great value for the price, would buy again.', status: 'resolved', response: 'Appreciate the kind words!', date: '2026-08-20' },
    { source: 'Facebook', author: 'Nina P.', rating: 1, sentiment: 'negative', content: 'Customer service hung up on me twice.', status: 'responded', response: 'We escalated this to our support lead, please check your inbox.', date: '2026-08-31' },
    { source: 'App Store', author: 'quickfix99', rating: 5, sentiment: 'positive', content: 'Update fixed all my issues, works perfectly now.', status: 'resolved', response: null, date: '2026-08-18' },
    { source: 'Google', author: 'Elena V.', rating: 3, sentiment: 'neutral', content: 'Average experience, nothing special but nothing terrible.', status: 'resolved', response: null, date: '2026-08-15' },
  ];

  for (const row of sample) db.insert(row);
  console.log(`Seeded ${sample.length} reviews.`);
} else {
  console.log(`Database already has ${existing.length} reviews, skipping seed.`);
}