import type { IconName } from '../components/icons';
import type { Route } from '../hooks/useHashRoute';
import type { Hue } from '../components/blocks';

/* All site copy lives here so content edits never touch component code. */

export const NAV: ReadonlyArray<readonly [Route, string]> = [
  ['home', 'Home'],
  ['services', 'Services'],
  ['gallery', 'Gallery'],
  ['about', 'About'],
  ['contact', 'Contact'],
];

export const SERVICES: ReadonlyArray<{
  key: string;
  icon: IconName;
  hue: string;
  title: string;
  desc: string;
}> = [
  {
    key: 'embroidery',
    icon: 'needle',
    hue: 'var(--teal)',
    title: 'Machine Embroidery',
    desc: 'Crisp, durable stitching for caps, polos, jackets, bags and more — our specialty since day one.',
  },
  {
    key: 'screen',
    icon: 'print',
    hue: 'var(--purple)',
    title: 'Screen Printing',
    desc: 'Bold, vibrant prints for tees and team gear, priced right for runs big and small.',
  },
  {
    key: 'digitizing',
    icon: 'cpu',
    hue: 'var(--lime-deep)',
    title: 'Digitizing',
    desc: 'We turn your logo or artwork into clean, production-ready embroidery files.',
  },
  {
    key: 'heat',
    icon: 'heat',
    hue: 'var(--brown)',
    title: 'Heat Transfers',
    desc: 'Great for names, numbers and full-color designs on performance fabrics.',
  },
];

export const TESTIMONIALS = [
  {
    q: 'Our company polos came out perfect — the logo is so crisp. Turnaround was faster than promised.',
    n: 'Marcus D.',
    r: 'Operations Mgr, Florissant',
    hue: 'var(--teal)',
    i: 'MD',
  },
  {
    q: "They digitized our nonprofit's logo and now everything matches. True craftspeople who care.",
    n: 'Renee P.',
    r: 'Community Org, St. Louis',
    hue: 'var(--purple)',
    i: 'RP',
  },
  {
    q: "No job too small — they embroidered 6 hats for my dad's birthday and treated me like a big client.",
    n: 'Tyler W.',
    r: 'Local Customer',
    hue: 'var(--lime-deep)',
    i: 'TW',
  },
] as const;

export const SVC_DETAIL: ReadonlyArray<{
  key: string;
  icon: IconName;
  hue: string;
  title: string;
  tag: string;
  desc: string;
  points: string[];
}> = [
  {
    key: 'embroidery',
    icon: 'needle',
    hue: 'var(--teal)',
    title: 'Machine Embroidery',
    tag: 'Our specialty',
    desc: 'Precision stitching that holds up wash after wash. Perfect for a polished, professional look on almost any fabric.',
    points: [
      'Caps, polos, jackets, bags & uniforms',
      'Left-chest logos to large back designs',
      'Color-matched threads',
      'Small runs to bulk corporate orders',
    ],
  },
  {
    key: 'screen',
    icon: 'print',
    hue: 'var(--purple)',
    title: 'Screen Printing',
    tag: 'Bold & vibrant',
    desc: 'The go-to for tees and casual gear. Rich, opaque color that pops — and gets more affordable the more you order.',
    points: [
      'T-shirts, hoodies & team apparel',
      'Spot colors & multi-color designs',
      'Soft-hand prints available',
      'Great for events & fundraisers',
    ],
  },
  {
    key: 'digitizing',
    icon: 'cpu',
    hue: 'var(--lime-deep)',
    title: 'Digitizing',
    tag: 'Where it starts',
    desc: 'Before a logo can be embroidered, it has to be digitized. We translate your artwork into a clean stitch file that runs beautifully.',
    points: [
      'Logos, monograms & custom artwork',
      'Optimized stitch counts',
      'Test sews before production',
      'You keep the file for future orders',
    ],
  },
  {
    key: 'heat',
    icon: 'heat',
    hue: 'var(--brown)',
    title: 'Heat Transfers',
    tag: 'Names & numbers',
    desc: 'Ideal for full-color graphics, player names and numbers, or performance fabrics that are tricky to stitch or print.',
    points: [
      'Jersey names & numbers',
      'Full-color photographic designs',
      'Performance & athletic wear',
      'Quick turnaround on small jobs',
    ],
  },
];

export const STEPS: ReadonlyArray<[string, string]> = [
  ['Say hello', 'Tell us your idea, garment and quantity — call, email, or send the quote form.'],
  [
    'We quote & digitize',
    'You get a friendly quote. Once approved, we prep and digitize your design.',
  ],
  ['Sew-out approval', 'We run a test so you can see the real thing before the full order.'],
  [
    'Pick up & show off',
    'We finish, inspect every piece, and you walk out with gear you’re proud of.',
  ],
];

export type GalleryFilter = 'all' | 'embroidery' | 'screen' | 'heat' | 'digitizing';

export const GAL: ReadonlyArray<[string, Hue, Exclude<GalleryFilter, 'all'>, boolean]> = [
  ['Embroidered corporate polos', 'teal', 'embroidery', false],
  ['Color-matched logo caps', 'purple', 'embroidery', true],
  ['Screen-printed team tees', 'lime', 'screen', false],
  ['Custom canvas totes', 'brown', 'embroidery', false],
  ['Player names & numbers', 'teal', 'heat', false],
  ['Embroidered work jackets', 'purple', 'embroidery', true],
  ['Nonprofit event hoodies', 'lime', 'screen', false],
  ['Digitized logo file', 'brown', 'digitizing', false],
  ['Monogrammed aprons', 'teal', 'embroidery', false],
  ['Performance heat transfer', 'purple', 'heat', true],
  ['Beanies & winter caps', 'lime', 'embroidery', false],
  ['Full back screen print', 'brown', 'screen', false],
];

export const FILTERS: ReadonlyArray<[GalleryFilter, string]> = [
  ['all', 'All work'],
  ['embroidery', 'Embroidery'],
  ['screen', 'Screen Printing'],
  ['heat', 'Heat Transfers'],
  ['digitizing', 'Digitizing'],
];

export const FAQS: ReadonlyArray<[string, string]> = [
  [
    'Is there a minimum order?',
    'Nope! No job is too big or too small. Whether you need one embroidered cap or hundreds of corporate polos, we’re happy to help.',
  ],
  [
    'Can you use my own garments?',
    'In most cases, yes. Bring in your blanks and we’ll let you know if they’re a good fit for embroidery, printing or transfers.',
  ],
  [
    'What’s the difference between embroidery and screen printing?',
    'Embroidery stitches your design in thread for a premium, durable look (great for logos and polos). Screen printing lays ink on the fabric for bold, full-color graphics (great for tees). Not sure? We’ll recommend the best fit.',
  ],
  [
    'Do I need my logo "digitized"?',
    'For embroidery, yes — your artwork has to be converted into a stitch file. We do this in-house, and you keep the file for future orders.',
  ],
  [
    'How long does an order take?',
    'It depends on the size and service, but most orders are ready within 1–2 weeks. Need it sooner? Ask us about your timeline and we’ll do our best.',
  ],
];
