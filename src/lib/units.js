// Unit of Measure (UoM) conversion.
// A product has a main unit (e.g. Box, ₹310) and can have one smaller unit with a conversion factor
// (e.g. 1 Box = 10 Piece). The smaller unit's price is main price ÷ factor (₹31), unless the user set their own.
// Used by the product form, the invoice form and the backend checks, so they always agree.
import { r2 } from './format.js';

/** True if the product can also be sold in a smaller unit. */
export const hasAltUnit = (p) => !!(p && p.altUnit && Number(p.altPer) > 1);

/** Price of one smaller unit: the user's own price if set, otherwise main price ÷ conversion factor. */
export const autoAltRate = (p) => r2(Number(p.rate) / Number(p.altPer));
export const altRateOf = (p) => (p.altRate != null && p.altRate !== '' ? Number(p.altRate) : autoAltRate(p));

/** Units this product can be billed in: [main] or [main, smaller]. */
export const unitsOf = (p) => (hasAltUnit(p) ? [p.unit, p.altUnit] : [p.unit]);

/** Rate for one item in the chosen unit. */
export const rateFor = (p, unit) => (hasAltUnit(p) && unit === p.altUnit ? altRateOf(p) : Number(p.rate));

/** "1 Box = 10 Piece" */
export const conversionLabel = (p) => (hasAltUnit(p) ? `1 ${p.unit} = ${Number(p.altPer)} ${p.altUnit}` : '');
