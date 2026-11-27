'use strict';
const fs = require('node:fs');
const path = require('node:path');
const page = fs.readFileSync(path.join(__dirname, 'page.html'), 'utf8');

function render(mode, customer) {
  const data = customer && {
    partner: customer.recipientName,
    sender: customer.senderName,
    message: customer.letter,
    note: customer.finaleLine,
    photos: (customer.photos || []).map(photo => photo.url),
  };
  const json = JSON.stringify({ mode, data }).replace(/</g, '\\u003c');
  return page.replace('__SCRAPBOOK_DATA__', () => json);
}

module.exports = { render };
