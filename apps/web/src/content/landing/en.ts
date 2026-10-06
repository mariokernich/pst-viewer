import type { LandingContent } from './types'

export const landingEn: LandingContent = {
  meta: {
    title: 'PST Viewer – Open PST, MSG, EML and MBOX files without Outlook',
    description:
      'Open and search Outlook archives without Outlook. PST Viewer reads PST, MSG, EML and MBOX strictly read-only and entirely on your device. One-time €4.99, no subscription.',
  },
  hero: {
    eyebrow: 'For Mac and Windows · iPhone, iPad and Android in development',
    titleLead: 'Open Outlook archives.',
    titleAccent: 'No Outlook required.',
    subtitle:
      'PST Viewer opens PST, MSG, EML and MBOX files in seconds, finds any message with full-text search and previews attachments right in the app – strictly read-only and entirely on your device.',
    primaryCta: 'Buy for €4.99',
    secondaryCta: 'Read the docs',
    trust: [
      'Read-only – your files stay untouched',
      '100% local – no upload',
      'One-time €4.99 per store',
      'No subscription, no account, no ads',
    ],
  },
  formats: {
    label: 'Opens the common mail archives',
    items: [
      { ext: 'PST', title: 'Outlook data files', text: 'Archives and exports from Outlook' },
      { ext: 'MSG', title: 'Outlook items', text: 'Individually saved messages' },
      { ext: 'EML', title: 'Email files', text: 'The standard format for single emails' },
      { ext: 'MBOX', title: 'Mailboxes', text: 'Gmail/Google Takeout, Apple Mail, Thunderbird' },
    ],
  },
  features: {
    eyebrow: 'Features',
    title: 'Everything a mail archive needs.',
    subtitle: 'Opens fast, searches deep, displays safely – and your files never change.',
    speed: {
      title: 'Large files in seconds',
      text: 'Even large PST files open quickly: the message list is ready in about a second while the full-text index builds in the background.',
      stat: '≈ 1 s',
      statLabel: 'to the message list',
      indexLabel: 'Full-text index',
    },
    search: {
      title: 'Search as you type',
      text: 'Across all folders or just the current one – with suggestions, filters and highlighted matches. “muller” also finds “Müller”.',
      query: 'muller offer',
      highlights: ['Müller', 'Offer'],
      results: [
        { from: 'Anna Müller', subject: 'Offer for office furniture' },
        { from: 'Jonas Müller', subject: 'Re: Offer for maintenance' },
        { from: 'Müller & Partners', subject: 'Your offer from May 3' },
      ],
    },
    layout: {
      title: 'A familiar layout',
      text: 'A folder tree, a message list grouped by date and a reading pane with safely sanitised HTML.',
      groups: ['Today', 'Yesterday', 'This Week', 'February'],
    },
    attachments: {
      title: 'Attachments, no detours',
      text: 'Preview attachments right in the app without saving them first. Everything else opens as a read-only copy in the matching app.',
      types: ['PDF', 'Images', 'Text', 'CSV as table', 'HTML', 'Events (.ics)', 'Contacts (.vcf)', 'Audio', 'Video'],
    },
    export: {
      title: 'Export & print',
      text: 'Single messages as PDF with header, attachment list, inline images and page numbers, as EML for any mail client or as plain text.',
      formats: ['PDF', 'EML', 'Text', 'Print'],
    },
    items: {
      title: 'More than email',
      text: 'Calendar items, contacts and tasks are displayed clearly – and so are digitally signed S/MIME messages.',
      kinds: ['Appointments', 'Contacts', 'Tasks', 'S/MIME signed'],
    },
    appearance: {
      title: 'Light, dark, bilingual',
      text: 'Light and dark appearance, with the interface in English or German.',
      languages: 'EN · DE',
    },
  },
  search: {
    eyebrow: 'Search',
    title: 'Found while you type.',
    subtitle:
      'Just start with a word – and refine with filters or a query syntax that understands both English and German when you need to.',
    points: [
      { title: 'All folders or just one', text: 'Search the whole archive or only the folder that is open.' },
      {
        title: 'Suggestions as you type',
        text: 'Search only the subject, sender or body, jump to matching senders and folders or repeat recent searches.',
      },
      {
        title: 'Filters and chips',
        text: 'Date range, sender, recipient, read or unread, attachments and attachment type, important, flagged, item type and minimum size. Active filters appear as chips you can remove one by one.',
      },
      {
        title: 'Forgiving and precise',
        text: 'Case and accents don’t matter: “muller” finds “Müller”. Matches are highlighted in the list and in the message.',
      },
    ],
    syntaxTitle: 'Query syntax – a selection',
    syntaxRows: [
      ['from:anna', 'Sender (name or address)'],
      ['has:attachment', 'Only messages with attachments'],
      ['"kind regards"', 'Exact phrase'],
      ['-newsletter', 'Exclude a term'],
      ['after:2024-03-01 before:2024-06', 'Date range'],
      ['larger:5mb', 'Minimum size'],
    ],
    syntaxLink: 'See the full query syntax',
    mock: {
      label: 'Example: searching for offers from Anna with active filters',
      query: 'offer from:anna',
      scopeAll: 'All Folders',
      scopeFolder: 'Current Folder',
      chips: ['Date: 12 months', 'Attachment: PDF', 'Unread'],
      resetAll: 'Reset all',
      results: [
        {
          from: 'Anna Müller',
          subject: 'Offer for office furniture – revised version',
          snippet: '… please find the revised offer attached as a PDF. Delivery would be …',
          highlight: 'offer',
          date: 'Mar 12',
          attachment: true,
        },
        {
          from: 'Anna Becker',
          subject: 'Re: Offer for the maintenance contract',
          snippet: '… thanks for the offer. Could we move the appointment …',
          highlight: 'offer',
          date: 'Feb 28',
          attachment: true,
        },
        {
          from: 'Anna Müller',
          subject: 'Offer for the trade fair stand',
          snippet: '… as discussed, here is the offer for the trade fair stand …',
          highlight: 'offer',
          date: 'Jan 9',
          attachment: true,
        },
      ],
    },
  },
  privacy: {
    eyebrow: 'Privacy & security',
    title: 'Your mail stays with you.',
    subtitle:
      'PST Viewer works entirely on your device. No upload, no cloud, no tracking – and your files are never modified.',
    items: [
      {
        title: '100% local',
        text: 'Everything happens on your device. There is no upload, no cloud and no telemetry.',
      },
      {
        title: 'Strictly read-only',
        text: 'Files are only read, never modified. New files are created only when you export or save something yourself.',
      },
      {
        title: 'Tracking protection',
        text: 'Remote images in emails stay blocked until you explicitly allow them for a message.',
      },
      {
        title: 'Safe rendering',
        text: 'HTML mail is sanitised and rendered in a sandbox – scripts never run.',
      },
      {
        title: 'Careful with attachments',
        text: 'Attachments open as a read-only temporary copy that is deleted when you quit. File types that can run code are never opened directly.',
      },
      {
        title: 'No account needed',
        text: 'No sign-up, no login, no ads. Open a file and read.',
      },
    ],
    docsLink: 'More about privacy & security',
  },
  platforms: {
    eyebrow: 'Platforms',
    title: 'One viewer for all your devices.',
    subtitle:
      'PST Viewer is available for Mac and Windows. Apps for iPhone, iPad and Android with the same features are in development.',
    badgeDesktop: 'Desktop app',
    badgeInDevelopment: 'In development',
    items: {
      mac: { title: 'Mac', text: 'The desktop app for macOS – via the Mac App Store.' },
      windows: { title: 'Windows', text: 'The desktop app for Windows – via the Microsoft Store.' },
      ios: { title: 'iPhone & iPad', text: 'With the same features – via the App Store.' },
      android: { title: 'Android', text: 'With the same features – via Google Play.' },
    },
  },
  useCases: {
    eyebrow: 'Use cases',
    title: 'When old mail suddenly matters.',
    subtitle: 'Switching platforms, accounting or IT support – PST Viewer makes old archives accessible again, fast.',
    items: [
      {
        title: 'Switched from Outlook',
        text: 'Now on a Mac, Apple Mail or Gmail but still holding old PST archives? Open them any time – without Outlook.',
      },
      {
        title: 'Retention & accounting',
        text: 'Find old invoices, contracts and receipts quickly – for legal retention requirements such as Germany’s GoBD or for your accounting.',
        note: 'PST Viewer helps you look things up, but it does not replace an audit-proof archive.',
      },
      {
        title: 'IT administration',
        text: 'Help colleagues fast: open a PST or MSG file, find the message they need and hand it over as PDF or EML.',
      },
      {
        title: 'Google Takeout export',
        text: 'Your Gmail export is an MBOX file? PST Viewer makes it searchable – just like mailboxes from Apple Mail and Thunderbird.',
      },
    ],
  },
  pricing: {
    eyebrow: 'Pricing',
    title: 'Buy once. No subscription.',
    subtitle: 'One clear price, no small print – and no recurring costs.',
    planName: 'PST Viewer',
    planText: 'Every feature, paid for once.',
    includedTitle: 'Included',
    included: [
      'Open PST, MSG, EML and MBOX',
      'Full-text search with filters and query syntax',
      'Attachment previews',
      'Export as PDF, EML and text, printing',
      'Calendar items, contacts and tasks',
      'Light & dark, English & German',
    ],
    excluded: ['No subscription', 'No account', 'No ads', 'No in-app purchases'],
    storesTitle: 'Stores & availability',
    footnote:
      'The price is a one-time purchase per store (Mac App Store, Microsoft Store, App Store, Google Play). The price shown in the respective store applies.',
  },
  faq: {
    eyebrow: 'FAQ',
    title: 'Frequently asked questions',
    subtitle: 'Short answers to what most people want to know.',
    items: [
      {
        question: 'Is my email uploaded anywhere?',
        answer:
          'No. PST Viewer works entirely on your device. There is no upload, no cloud and neither tracking nor telemetry.',
      },
      {
        question: 'Does PST Viewer change my PST file?',
        answer:
          'No. All files are opened strictly read-only and are never modified. New files are only created when you export a message or save an attachment yourself.',
      },
      {
        question: 'Which file formats are supported?',
        answer:
          'PST (Outlook data files), MSG (single Outlook items), EML (email files) and MBOX – for example from Gmail/Google Takeout, Apple Mail or Thunderbird.',
      },
      {
        question: 'Do I need Outlook?',
        answer: 'No. PST Viewer reads the files itself. Outlook does not need to be installed.',
      },
      {
        question: 'Does it work with very large files?',
        answer:
          'Yes. Even large PST files open quickly: the message list appears in about a second and the full-text index builds in the background. While it does, matches in message bodies may still be missing.',
      },
      {
        question: 'Can I open OST files?',
        answer: 'Not yet. OST files (Outlook offline data files) are currently not supported.',
      },
      {
        question: 'Can PST Viewer show encrypted S/MIME messages?',
        answer:
          'No. Encrypted S/MIME messages cannot be decrypted because the private key is not part of the file. Digitally signed messages, on the other hand, are displayed.',
      },
      {
        question: 'Is PST Viewer a subscription?',
        answer: 'No. You pay a one-time €4.99 per store – no subscription, no account, no ads and no in-app purchases.',
      },
      {
        question: 'Which languages does PST Viewer support?',
        answer:
          'The interface is available in English and German. The query syntax understands English and German operators in both languages.',
      },
      {
        question: 'Is PST Viewer available for iPhone, iPad and Android?',
        answer:
          'The apps for iPhone, iPad and Android are in development and will offer the same features as the desktop app.',
      },
    ],
    more: 'You’ll find more answers in the documentation.',
  },
  finalCta: {
    title: 'Your mail archive is waiting.',
    text: 'PST Viewer for a one-time €4.99 – no subscription, no account. Your data stays on your device.',
    primaryCta: 'Buy for €4.99',
    secondaryCta: 'Read the docs',
  },
}
