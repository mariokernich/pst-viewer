import { Callout, DocLink, Kbd, LegalLink, ShortcutTable, Steps, SyntaxTable } from '@/components/docs/prose'
import type { DocsContent } from './types'

const locale = 'en'

export const docsEn: DocsContent = {
  overview: {
    title: 'Documentation',
    description:
      'Everything about PST Viewer: opening files, navigating, searching, previewing attachments and exporting – and how your data stays protected.',
    intro:
      'PST Viewer opens Outlook data files and mail archives strictly read-only and entirely on your device. Learn how to find messages fast, preview attachments safely and export messages.',
    quickStartTitle: 'Quick start',
    quickStart: [
      <>
        Buy and install PST Viewer from the <strong>Mac App Store</strong> or the <strong>Microsoft Store</strong>.
      </>,
      <>
        Launch the app and choose <strong>Open File…</strong> or press <Kbd>⌘O</Kbd> / <Kbd>Ctrl+O</Kbd>.
      </>,
      <>Pick a PST, MSG, EML or MBOX file – the message list appears in about a second.</>,
      <>
        Search with <Kbd>⌘F</Kbd> / <Kbd>Ctrl+F</Kbd>, read messages and preview attachments.
      </>,
    ],
    pagesTitle: 'All topics',
  },
  ui: {
    navLabel: 'Documentation',
    overview: 'Overview',
    mobileNavToggle: 'Documentation topics',
    tocTitle: 'On this page',
    previous: 'Previous',
    next: 'Next',
    pagerLabel: 'Previous and next page',
  },
  groups: [
    { title: 'Basics', ids: ['getting-started', 'navigation'] },
    { title: 'Features', ids: ['search', 'attachments', 'export'] },
    { title: 'More', ids: ['privacy', 'mobile', 'troubleshooting'] },
  ],
  pages: {
    'getting-started': {
      title: 'Getting started',
      description: 'Install PST Viewer, open your first file and learn what “read-only” means.',
      sections: [
        {
          id: 'install',
          title: 'Install PST Viewer',
          body: (
            <>
              <p>
                PST Viewer is available for the Mac in the <strong>Mac App Store</strong> and for Windows in the{' '}
                <strong>Microsoft Store</strong>. It costs a one-time €4.99 per store – no subscription, no account, no
                ads and no in-app purchases.
              </p>
              <p>
                The apps for iPhone and iPad (App Store) and for Android (Google Play) are in development. See{' '}
                <DocLink locale={locale} id="mobile">Mobile apps</DocLink> for details.
              </p>
            </>
          ),
        },
        {
          id: 'open-a-file',
          title: 'Open a file',
          body: (
            <>
              <Steps>
                <li>Launch PST Viewer.</li>
                <li>
                  Choose <strong>Open File…</strong> or press <Kbd>⌘O</Kbd> (Mac) or <Kbd>Ctrl+O</Kbd> (Windows).
                </li>
                <li>Select a PST, MSG, EML or MBOX file.</li>
              </Steps>
              <p>
                You can also drag a file onto the window. Recently opened files appear on the start screen so you can
                reopen them with a single click.
              </p>
              <p>
                Even large PST files open quickly: the message list appears in about a second. PST Viewer then builds
                the full-text index in the background and shows its progress in the app.
              </p>
              <Callout title="While indexing">
                As long as the full-text index is being built, matches in message bodies may still be missing. You can
                read, navigate and search right away.
              </Callout>
            </>
          ),
        },
        {
          id: 'formats',
          title: 'Supported formats',
          body: (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Format</th>
                      <th scope="col">What it is</th>
                      <th scope="col">Typical source</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <strong>PST</strong>
                      </td>
                      <td>Outlook data file with folders, emails, calendar items, contacts and tasks</td>
                      <td>Archives and exports from Outlook</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>MSG</strong>
                      </td>
                      <td>Single Outlook item</td>
                      <td>Messages saved from Outlook</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>EML</strong>
                      </td>
                      <td>Standard email file</td>
                      <td>Single emails saved from many mail clients</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>MBOX</strong>
                      </td>
                      <td>Mailbox with many emails in one file</td>
                      <td>Gmail/Google Takeout, Apple Mail, Thunderbird</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <Callout tone="warning" title="OST files">
                OST files (Outlook offline data files) are not supported yet.
              </Callout>
            </>
          ),
        },
        {
          id: 'read-only',
          title: 'Read-only – a promise',
          body: (
            <>
              <p>
                PST Viewer opens every file strictly read-only. Your PST, MSG, EML and MBOX files are never modified –
                not while searching, filtering or displaying them.
              </p>
              <p>New files are only created in two cases:</p>
              <ul>
                <li>You export a message or save an attachment – always to a location you choose.</li>
                <li>
                  You open an attachment in another app. For this, PST Viewer creates a read-only temporary copy that is
                  deleted when you quit.
                </li>
              </ul>
            </>
          ),
        },
      ],
    },
    navigation: {
      title: 'Navigation',
      description: 'Work with folders, the message list and the reading pane – by mouse or keyboard.',
      sections: [
        {
          id: 'folders',
          title: 'Folders',
          body: (
            <>
              <p>
                The sidebar shows the folder tree of the open file. Click a folder to show its items in the message
                list.
              </p>
              <p>
                Press <Kbd>⌃⌘S</Kbd> or <Kbd>Ctrl+Shift+S</Kbd> to hide and show the sidebar – handy on small screens.
              </p>
            </>
          ),
        },
        {
          id: 'message-list',
          title: 'Message list',
          body: (
            <>
              <p>
                The message list is grouped by date: <strong>Today</strong>, <strong>Yesterday</strong>,{' '}
                <strong>This Week</strong> and older messages by month. That keeps even large folders easy to scan.
              </p>
              <p>
                Use <Kbd>↑</Kbd> <Kbd>↓</Kbd> or <Kbd>j</Kbd> <Kbd>k</Kbd> to move to the previous or next message,{' '}
                <Kbd>Page Up</Kbd> <Kbd>Page Down</Kbd> to move by one page and <Kbd>Home</Kbd> or <Kbd>End</Kbd> to
                jump to the first or last message.
              </p>
            </>
          ),
        },
        {
          id: 'reading-pane',
          title: 'Reading pane',
          body: (
            <>
              <p>
                The reading pane shows the selected message with sender, recipients, date and attachments. HTML mail is
                sanitised and rendered in a sandbox without scripts.
              </p>
              <ul>
                <li>
                  <strong>Remote images</strong> are blocked to protect your privacy. Choose{' '}
                  <strong>Load Images</strong> to allow them for that message.
                </li>
                <li>
                  Press <Kbd>⌥⌘U</Kbd> or <Kbd>Ctrl+Alt+U</Kbd> to show the <strong>internet headers</strong> of a
                  message.
                </li>
                <li>
                  <strong>Attached messages</strong> open directly in PST Viewer.
                </li>
                <li>
                  <strong>Calendar items, contacts and tasks</strong> are shown with their details – for appointments,
                  for example, when and where they take place.
                </li>
                <li>
                  <strong>S/MIME signed messages</strong> are marked as digitally signed.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: 'shortcuts',
          title: 'Keyboard shortcuts',
          body: (
            <>
              <p>All keyboard shortcuts of the desktop app at a glance:</p>
              <ShortcutTable locale={locale} />
            </>
          ),
        },
      ],
    },
    search: {
      title: 'Search',
      description: 'Search scope, suggestions, filters and the complete query syntax.',
      sections: [
        {
          id: 'basics',
          title: 'Search as you type',
          body: (
            <>
              <p>
                Press <Kbd>⌘F</Kbd> or <Kbd>Ctrl+F</Kbd> – or simply <Kbd>/</Kbd> – and start typing. The results update
                with every keystroke; matches are highlighted in the list and in the open message.
              </p>
              <p>
                Case and accents don’t matter: “muller” also finds “Müller”. Press <Kbd>Esc</Kbd> to clear the search.
              </p>
              <Callout>
                Right after opening a large file, the full-text index is still being built. Until it is complete,
                matches in message bodies may be missing.
              </Callout>
            </>
          ),
        },
        {
          id: 'scope',
          title: 'Search scope',
          body: (
            <>
              <p>You decide where to search:</p>
              <ul>
                <li>
                  <strong>All Folders</strong> – searches the entire file.
                </li>
                <li>
                  <strong>Current Folder</strong> – searches only the folder that is open.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: 'suggestions',
          title: 'Suggestions',
          body: (
            <>
              <p>While you type, PST Viewer suggests matching searches:</p>
              <ul>
                <li>
                  search the term only in the <strong>subject</strong>, the <strong>sender</strong> or the{' '}
                  <strong>body</strong>,
                </li>
                <li>
                  matching <strong>senders</strong> – one click searches for messages from that person,
                </li>
                <li>
                  matching <strong>folders</strong> – one click opens the folder,
                </li>
                <li>
                  your <strong>recent searches</strong>.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: 'filters',
          title: 'Filters',
          body: (
            <>
              <p>
                Open the filter panel with the <strong>Filters</strong> button or with <Kbd>⌥⌘F</Kbd> /{' '}
                <Kbd>Ctrl+Alt+F</Kbd>. It lets you narrow the search by:
              </p>
              <ul>
                <li>
                  <strong>Search in:</strong> subject, sender, recipients, body or attachment names
                </li>
                <li>
                  <strong>Date:</strong> today, 7 days, 30 days, 12 months or a custom range
                </li>
                <li>
                  <strong>People:</strong> sender and recipient (name or address)
                </li>
                <li>
                  <strong>Status:</strong> read or unread, with attachments, important, flagged
                </li>
                <li>
                  <strong>Attachment type:</strong> PDF, images, Office, archives, calendar or emails
                </li>
                <li>
                  <strong>Item type:</strong> emails, meetings, appointments, contacts, tasks or notes
                </li>
                <li>
                  <strong>Minimum size</strong>
                </li>
              </ul>
              <p>
                Active filters appear as <strong>chips</strong> below the search field, for example “Date: 12 months” or
                “Attachment: PDF”. Click the × to remove a single filter or <strong>Reset all</strong> to remove them
                all at once.
              </p>
            </>
          ),
        },
        {
          id: 'query-syntax',
          title: 'Query syntax',
          body: (
            <>
              <p>
                For targeted searches, combine terms and operators right in the search field. All terms must match.
                English and German operators work in both languages – <code>from:anna</code> and <code>von:anna</code>{' '}
                mean the same.
              </p>
              <SyntaxTable locale={locale} />
            </>
          ),
        },
        {
          id: 'tips',
          title: 'Tips',
          body: (
            <ul>
              <li>
                Operators can be combined: <code>from:anna has:attachment after:2024-01-01</code> finds messages from
                Anna with attachments since January 1, 2024.
              </li>
              <li>
                Write the value directly after the colon, without a space. Put values containing spaces in quotes:{' '}
                <code>from:&quot;anna müller&quot;</code>.
              </li>
              <li>
                Dates can be written in international or German notation: <code>2024-03-01</code>,{' '}
                <code>1.3.2024</code>, whole months (<code>2024-06</code>) or years (<code>2023</code>).
              </li>
              <li>
                Use <code>-newsletter</code> to hide unwanted matches.
              </li>
            </ul>
          ),
        },
      ],
    },
    attachments: {
      title: 'Attachments',
      description: 'Preview attachments, open them safely and save them.',
      sections: [
        {
          id: 'preview',
          title: 'Preview without saving',
          body: (
            <>
              <p>
                Click an attachment – or select it and press <Kbd>Space</Kbd> or <Kbd>Enter</Kbd>. The preview opens
                right inside PST Viewer; there is no need to save the attachment first. Use <Kbd>←</Kbd> <Kbd>→</Kbd> to
                step through all attachments of the message.
              </p>
              <p>Previews are available for:</p>
              <ul>
                <li>PDF documents</li>
                <li>Images</li>
                <li>Text files</li>
                <li>CSV files – as a table</li>
                <li>HTML files – sanitised and without scripts</li>
                <li>Calendar invitations (.ics) – as an event card</li>
                <li>Contacts (.vcf) – as a contact card</li>
                <li>Audio and video</li>
              </ul>
            </>
          ),
        },
        {
          id: 'open-in-app',
          title: 'Open in the default app',
          body: (
            <p>
              Open any other file – a Word or Excel document, for example – with <strong>Open in Default App</strong>.
              PST Viewer hands over a <strong>read-only temporary copy</strong>; the file in your archive stays
              untouched. The copy is deleted when you quit PST Viewer.
            </p>
          ),
        },
        {
          id: 'blocked-types',
          title: 'Blocked file types',
          body: (
            <>
              <p>
                File types that can run code – such as programs and scripts – are never opened directly by PST Viewer.
                You can only save such attachments.
              </p>
              <Callout tone="warning">Only save such files if you trust the sender.</Callout>
            </>
          ),
        },
        {
          id: 'save',
          title: 'Save attachments',
          body: (
            <>
              <ul>
                <li>
                  <strong>Save As…</strong> saves a single attachment.
                </li>
                <li>
                  <strong>Save All</strong> saves all attachments of a message to a folder of your choice. Existing files
                  are never overwritten.
                </li>
              </ul>
              <p>Attached messages – forwarded emails, for example – open directly in PST Viewer.</p>
            </>
          ),
        },
      ],
    },
    export: {
      title: 'Export & print',
      description: 'Export single messages as PDF, EML or text and print them.',
      sections: [
        {
          id: 'how-to',
          title: 'How to export a message',
          body: (
            <>
              <Steps>
                <li>Select the message in the list.</li>
                <li>
                  Open the <strong>Export</strong> menu.
                </li>
                <li>Choose the format and then the location.</li>
              </Steps>
              <p>The selected message is exported; the original file stays unchanged.</p>
            </>
          ),
        },
        {
          id: 'pdf',
          title: 'As PDF',
          body: (
            <p>
              The PDF contains the message header such as sender, recipients, date and subject, a list of attachments,
              inline images and page numbers – ideal for filing or sharing.
            </p>
          ),
        },
        {
          id: 'eml',
          title: 'As EML',
          body: (
            <p>
              An EML file is a standard email file that opens in any mail client – including all attachments.
            </p>
          ),
        },
        {
          id: 'text',
          title: 'As text',
          body: <p>The plain text of the message – handy for further processing.</p>,
        },
        {
          id: 'print',
          title: 'Print',
          body: (
            <p>
              Press <Kbd>⌘P</Kbd> or <Kbd>Ctrl+P</Kbd> to print the selected message.
            </p>
          ),
        },
      ],
    },
    privacy: {
      title: 'Privacy & security',
      description: 'How PST Viewer protects your data and your device.',
      sections: [
        {
          id: 'local',
          title: 'Everything stays local',
          body: (
            <p>
              PST Viewer processes your files exclusively on your device. There is no upload, no cloud, no tracking and
              no telemetry. You don’t need an account and never have to sign in.
            </p>
          ),
        },
        {
          id: 'read-only',
          title: 'Your files stay unchanged',
          body: (
            <p>
              Files are opened read-only and never modified. New files are only created when you export a message or
              save an attachment yourself – or as a read-only temporary copy when you open an attachment in another app.
              These copies are deleted when you quit.
            </p>
          ),
        },
        {
          id: 'remote-images',
          title: 'Remote images',
          body: (
            <p>
              Many newsletters and marketing emails contain invisible images that tell the sender when and where a
              message was opened. That is why PST Viewer blocks remote images by default. Choose{' '}
              <strong>Load Images</strong> to allow them for a single message.
            </p>
          ),
        },
        {
          id: 'html',
          title: 'Safe rendering of HTML mail',
          body: (
            <p>
              HTML mail is sanitised before it is displayed and rendered in an isolated sandbox. Scripts in emails never
              run.
            </p>
          ),
        },
        {
          id: 'attachments',
          title: 'Attachments',
          body: (
            <p>
              Attachments are shown in the preview or opened as a read-only temporary copy in the matching app. File
              types that can run code are never opened directly – they can only be saved.
            </p>
          ),
        },
        {
          id: 'website',
          title: 'This website',
          body: (
            <p>
              This website works without cookies and without tracking as well. If you choose an appearance (light, dark
              or system), that setting is stored locally in your browser only. See the{' '}
              <LegalLink locale={locale} id="privacy">
                privacy policy
              </LegalLink>{' '}
              for details.
            </p>
          ),
        },
      ],
    },
    mobile: {
      title: 'Mobile apps',
      description: 'PST Viewer for iPhone, iPad and Android.',
      sections: [
        {
          id: 'status',
          title: 'Current status',
          body: (
            <p>
              The apps for iPhone, iPad and Android are in development. They will offer the same features as the desktop
              app for Mac and Windows.
            </p>
          ),
        },
        {
          id: 'availability',
          title: 'Availability',
          body: (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Device</th>
                    <th scope="col">Store</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>iPhone &amp; iPad</td>
                    <td>App Store</td>
                    <td>In development</td>
                  </tr>
                  <tr>
                    <td>Android</td>
                    <td>Google Play</td>
                    <td>In development</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ),
        },
        {
          id: 'features',
          title: 'Features',
          body: (
            <>
              <p>What makes PST Viewer on the desktop applies on the go, too:</p>
              <ul>
                <li>Open PST, MSG, EML and MBOX files</li>
                <li>Search with suggestions, filters and query syntax</li>
                <li>Attachment previews</li>
                <li>Export as PDF, EML or text</li>
                <li>Strictly read-only and entirely local</li>
              </ul>
            </>
          ),
        },
        {
          id: 'pricing',
          title: 'Price',
          body: (
            <p>Just like on the desktop: a one-time €4.99 per store – no subscription, no account, no ads and no in-app purchases.</p>
          ),
        },
      ],
    },
    troubleshooting: {
      title: 'Troubleshooting & FAQ',
      description: 'Solutions to common questions and problems.',
      sections: [
        {
          id: 'cannot-open',
          title: 'A file won’t open',
          body: (
            <ul>
              <li>Check that it is a supported file: PST, MSG, EML or MBOX.</li>
              <li>OST files (Outlook offline data files) are not supported yet.</li>
              <li>If the file is in a cloud folder, make sure it has been fully downloaded to your device.</li>
            </ul>
          ),
        },
        {
          id: 'search-misses',
          title: 'Search doesn’t find a message',
          body: (
            <ul>
              <li>
                Right after opening, the full-text index is still being built – matches in message bodies may be missing
                until it is complete.
              </li>
              <li>
                Check the search scope: is <strong>Current Folder</strong> selected instead of{' '}
                <strong>All Folders</strong>?
              </li>
              <li>Check the filter chips below the search field and reset them if necessary.</li>
              <li>
                Write operators without a space after the colon: <code>from:anna</code>. See{' '}
                <DocLink locale={locale} id="search" hash="query-syntax">
                  query syntax
                </DocLink>
                .
              </li>
            </ul>
          ),
        },
        {
          id: 'missing-images',
          title: 'Images are missing in an email',
          body: (
            <p>
              Remote images are blocked to protect your privacy. Choose <strong>Load Images</strong> to show them for
              that message.
            </p>
          ),
        },
        {
          id: 'attachment-blocked',
          title: 'An attachment won’t open',
          body: (
            <p>
              For security reasons, PST Viewer never opens file types that can run code directly. Only save such a file
              if you trust the sender. For other files without a preview, choose <strong>Open in Default App</strong>.
            </p>
          ),
        },
        {
          id: 'encrypted',
          title: 'A message is encrypted',
          body: (
            <p>
              PST Viewer cannot decrypt encrypted S/MIME messages because the private key is not part of the file.
              Digitally signed messages, on the other hand, are displayed.
            </p>
          ),
        },
        {
          id: 'file-changed',
          title: 'Does PST Viewer change my file?',
          body: (
            <p>
              No. All files are opened strictly read-only. See{' '}
              <DocLink locale={locale} id="getting-started" hash="read-only">
                Read-only – a promise
              </DocLink>
              .
            </p>
          ),
        },
      ],
    },
  },
}
