// The list of tools (functions) the AI is allowed to call, in the OpenAI "tools" format.
// The AI never touches the database directly: it can only ask for one of these, and our code runs it
// for the logged-in user only. Descriptions are short on purpose, to stay inside free-tier token limits.

const tool = (name, description, properties = {}, required = []) => ({
  type: 'function',
  function: { name, description, parameters: { type: 'object', properties, required } },
});

const str = (description) => ({ type: 'string', description });
const num = (description) => ({ type: 'number', description });
const items = {
  type: 'array',
  description: 'Products and quantities',
  items: {
    type: 'object',
    properties: {
      product: str('Product name, e.g. "steel rod"'),
      qty: num('Quantity'),
      rate: num('Price per unit before GST (only if different from the usual price)'),
      discount_pct: num('Discount %'),
    },
    required: ['product', 'qty'],
  },
};

// ---------------- Read: look things up (allowed in both modes)
export const READ_TOOLS = [
  tool('list_customers', 'Customers with state, GST type, invoice count, total billed and amount they owe, sorted by amount owed (highest first). Use for "who owes me the most", "top customer by dues", "which customer has the highest balance".', { search: str('Part of a name (optional)') }),
  tool('list_products', 'Products/services with HSN, unit, price before GST and GST rate.', { search: str('Part of a name (optional)') }),
  tool('search_invoices', 'Find invoices. Returns number, customer, dates, status, totals and balance due.', {
    customer: str('Customer name (optional)'),
    status: { type: 'string', enum: ['any', 'unpaid', 'overdue', 'paid', 'partially_paid', 'draft', 'sent', 'cancelled'] },
    from: str('Start date YYYY-MM-DD (optional)'),
    to: str('End date YYYY-MM-DD (optional)'),
  }),
  tool('get_invoice', 'Full details of one invoice: items, CGST/SGST/IGST, payments, credit notes.', { invoice_no: str('e.g. INV-0007') }, ['invoice_no']),
  tool('sales_report', 'Sales ranked by customer or by product (excludes drafts and cancelled). Use for top customers, best-selling products, or what a customer bought. Covers ALL TIME unless the user names a period.', {
    group_by: { type: 'string', enum: ['customer', 'product'] },
    customer: str('Only this customer (optional)'),
    month: str('YYYY-MM. Only if the user names a month; otherwise leave empty for all time'),
    from: str('Start date YYYY-MM-DD. Only if the user gives a date range'),
    to: str('End date YYYY-MM-DD. Only if the user gives a date range'),
  }, ['group_by']),
  tool('list_quotations', 'Quotations with customer, validity, status and total.', {
    status: { type: 'string', enum: ['any', 'open', 'draft', 'sent', 'accepted', 'converted', 'expired'] },
  }),
  tool('get_financial_summary', 'Sales, GST (CGST/SGST/IGST, input credit, net payable), expenses and profit for a month or all months, plus total outstanding.', {
    month: str('YYYY-MM (optional, default: current month)'),
    all_months: { type: 'boolean', description: 'true for every month with a breakdown' },
  }),
  tool('list_expenses', 'Expenses with id, date, category, vendor, amount and GST paid.', {
    month: str('YYYY-MM (optional)'), category: str('optional'),
  }),
  tool('get_invoice_template', 'The invoice template settings: brand colour, layout, HSN column, default terms, note and bank details.'),
  tool('list_credit_notes', 'Credit notes (returns / overcharges) with number, invoice, item, quantity, reason and amount.', {
    invoice_no: str('optional, only credit notes for this invoice'),
  }),
];

// ---------------- Write: change data (Write mode only; the user confirms every change)
export const WRITE_TOOLS = [
  tool('create_invoice', 'Create an invoice. GST type is worked out automatically.', {
    customer: str('Customer name'), items, due_date: str('YYYY-MM-DD (optional, default 15 days)'),
    status: { type: 'string', enum: ['draft', 'sent'] }, notes: str('optional'),
  }, ['customer', 'items']),
  tool('create_quotation', 'Create a quotation (price offer).', {
    customer: str('Customer name'), items, valid_until: str('YYYY-MM-DD (optional, default 30 days)'),
  }, ['customer', 'items']),
  tool('update_invoice', 'Change an invoice: due date, status (draft/sent/cancelled), notes or item quantities. Only the given fields change. To mark paid use record_payment; to mark unpaid use mark_invoice_unpaid.', {
    invoice_no: str('e.g. INV-0009'), due_date: str('YYYY-MM-DD'),
    status: { type: 'string', enum: ['draft', 'sent', 'cancelled'] }, notes: str('New note'),
    set_quantities: { type: 'array', description: 'Change quantity of existing items', items: { type: 'object', properties: { product: str('Product name'), qty: num('New quantity') }, required: ['product', 'qty'] } },
    add_items: items,
    remove_products: { type: 'array', items: { type: 'string' }, description: 'Product names to remove' },
  }, ['invoice_no']),
  tool('record_payment', 'Record money received for an invoice. Leave amount empty for the full balance.', {
    invoice_no: str('e.g. INV-0005'), amount: num('Amount in rupees (optional)'),
    method: { type: 'string', enum: ['upi', 'bank', 'cash', 'cheque', 'card'] }, date: str('YYYY-MM-DD (optional, default today)'),
  }, ['invoice_no']),
  tool('mark_invoice_unpaid', 'Mark a paid or part-paid invoice as unpaid again. Removes all its recorded payments (e.g. a payment entered by mistake or a bounced cheque).', { invoice_no: str('e.g. INV-0006') }, ['invoice_no']),
  tool('delete_invoice', 'Delete an invoice permanently.', { invoice_no: str('e.g. INV-0011') }, ['invoice_no']),
  tool('update_quotation', 'Change a quotation: valid-until date, status, notes or item quantities. Only the given fields change.', {
    quote_no: str('e.g. QT-0003'), valid_until: str('YYYY-MM-DD'),
    status: { type: 'string', enum: ['draft', 'sent', 'accepted'] }, notes: str('New note'),
    set_quantities: { type: 'array', description: 'Change quantity of existing items', items: { type: 'object', properties: { product: str('Product name'), qty: num('New quantity') }, required: ['product', 'qty'] } },
    add_items: items,
    remove_products: { type: 'array', items: { type: 'string' }, description: 'Product names to remove' },
  }, ['quote_no']),
  tool('delete_quotation', 'Delete a quotation.', { quote_no: str('e.g. QT-0005') }, ['quote_no']),
  tool('create_credit_note', 'Issue a credit note against an invoice (goods returned, short supply, overcharged). Reduces the balance and GST.', {
    invoice_no: str('e.g. INV-0007'), product: str('Which item on that invoice'), qty: num('How many units to credit'),
    reason: { type: 'string', enum: ['Damaged goods', 'Short supply', 'Goods returned', 'Price overcharged', 'Other'] },
  }, ['invoice_no', 'product', 'qty']),
  tool('update_credit_note', 'Change a credit note: quantity credited and/or reason.', {
    credit_note_no: str('e.g. CN-0002'), qty: num('New quantity'),
    reason: { type: 'string', enum: ['Damaged goods', 'Short supply', 'Goods returned', 'Price overcharged', 'Other'] },
  }, ['credit_note_no']),
  tool('delete_credit_note', 'Delete a credit note (the invoice balance goes back up).', { credit_note_no: str('e.g. CN-0002') }, ['credit_note_no']),
  tool('convert_quotation', 'Turn a quotation into an invoice.', { quote_no: str('e.g. QT-0003') }, ['quote_no']),
  tool('send_payment_reminders', 'Send payment reminders. Leave invoice_nos empty for all overdue invoices.', {
    invoice_nos: { type: 'array', items: { type: 'string' } },
  }),
  tool('share_invoice_whatsapp', 'Send an invoice to its customer on WhatsApp (message with the amount, due date and a link to view and download the PDF). If the user names only the customer, find their invoice with search_invoices first (usually the latest unpaid one). Pass phone only if the user gives a number. If the customer has no number saved, it still works: WhatsApp opens and the user picks the chat.', {
    invoice_no: str('e.g. INV-0010'), phone: str('WhatsApp number, only if given by the user (optional)'),
  }, ['invoice_no']),
  tool('create_customer', 'Add a customer. Always ask for their mobile (WhatsApp) number if the user did not give it, because invoices are sent to it on WhatsApp. If the user says they have no number or want to skip it, call with no_phone true.', {
    name: str('Business name'), state: str('Indian state name or 2-digit code'), gstin: str('optional'),
    city: str('optional'), email: str('optional'), phone: str('Mobile / WhatsApp number'),
    no_phone: { type: 'boolean', description: 'true only if the user said there is no number or to skip it' },
  }, ['name', 'state']),
  tool('update_customer', 'Change a customer. Only the given fields change.', {
    customer: str('Current customer name'), name: str('New name'), state: str('New state'), gstin: str('New GSTIN'),
    city: str('New city'), email: str('New email'), phone: str('New phone'),
  }, ['customer']),
  tool('delete_customer', 'Delete a customer who has no invoices.', { customer: str('Customer name') }, ['customer']),
  tool('create_product', 'Add a product or service.', {
    name: str('Name'), price: num('Price per unit before GST'), gst_rate: num('0, 5, 12, 18 or 28'),
    hsn: str('HSN/SAC code (optional)'), unit: str('e.g. Nos, Bag, Kg, Hrs (optional)'),
  }, ['name', 'price', 'gst_rate']),
  tool('update_product', 'Change a product. Only the given fields change.', {
    product: str('Current product name'), name: str('New name'), price: num('New price'), gst_rate: num('New GST rate'),
    hsn: str('New HSN/SAC'), unit: str('New unit'),
  }, ['product']),
  tool('delete_product', 'Delete a product.', { product: str('Product name') }, ['product']),
  tool('add_expense', 'Record a business expense.', {
    vendor: str('Who was paid'), amount: num('Amount before GST'),
    category: { type: 'string', enum: ['Stock purchase', 'Rent', 'Salaries', 'Electricity', 'Transport', 'Internet & phone', 'Other'] },
    gst_rate: num('GST % paid (optional)'), date: str('YYYY-MM-DD (optional, default today)'),
  }, ['vendor', 'amount', 'category']),
  tool('update_invoice_template', 'Change the invoice template used on all invoices and PDFs. Only the given fields change.', {
    colour: { type: 'string', enum: ['Emerald', 'Indigo', 'Maroon', 'Slate', 'Saffron'] }, layout: { type: 'string', enum: ['modern', 'classic'] },
    show_hsn: { type: 'boolean', description: 'Show the HSN/SAC column' }, terms: str('Payment terms text'), note: str('Default note at the bottom'), bank: str('Bank details text'),
  }),
  tool('update_expense', 'Change an existing expense (amount, vendor, category, GST %, date). Identify it by who was paid, e.g. expense: "BSNL". Only the given fields change.', {
    expense: str('Who was paid, as the user said it, e.g. "BSNL"'), on_date: str('Date of the expense to change, YYYY-MM-DD (only if the user gave one)'),
    expense_id: num('optional: id from list_expenses'), vendor: str('New vendor name'), amount: num('New amount before GST'),
    category: { type: 'string', enum: ['Stock purchase', 'Rent', 'Salaries', 'Electricity', 'Transport', 'Internet & phone', 'Other'] },
    gst_rate: num('New GST %'), date: str('New date YYYY-MM-DD'),
  }, ['expense']),
  tool('delete_expense', 'Delete an expense. Identify it by who was paid, e.g. expense: "KPN Logistics", and the date if the user gave one.', {
    expense: str('Who was paid'), on_date: str('Date of the expense, YYYY-MM-DD (optional)'), amount: num('Amount, if the user gave it (optional)'), expense_id: num('optional: id from list_expenses'),
  }, ['expense']),
];

export const WRITE_TOOL_NAMES = new Set(WRITE_TOOLS.map((t) => t.function.name));
