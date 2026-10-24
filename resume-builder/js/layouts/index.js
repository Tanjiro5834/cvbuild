/**
 * @file Layout registry.
 */
import { renderLayout as classic } from './classic.js';
import { renderLayout as left } from './left.js';
import { renderLayout as compact } from './compact.js';
import { renderLayout as datesRight } from './dates-right.js';

export const LAYOUTS = {
  classic: { name: 'Classic', render: classic },
  left: { name: 'Left-Aligned', render: left },
  compact: { name: 'Compact', render: compact },
  'dates-right': { name: 'Dates-Right', render: datesRight },
};