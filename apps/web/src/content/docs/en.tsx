import { Callout, DocLink, DownloadTable, Kbd, LegalLink, ShortcutTable, Steps, SyntaxTable } from '@/components/docs/prose'
import { downloads, github } from '@/lib/site'
import type { DocsContent } from './types'

const locale = 'en'

export const docsEn: DocsContent = {
  overview: {
    title: 'Documentation',
    description:
      'Everything about PST Viewer: opening files, navigating, searching, previewing attachments and exporting – and how your data stays protected.',
    intro:
      'PST Viewer opens Outlook data files and mail archives strictly read-only and entirely on your device. It is free and open source. Learn how to install it, find messages fast, preview attachments safely and export messages.',
    quickStartTitle: 'Quick start',
    quickStart: [
      <>
        Download PST Viewer for free from <a href={github.releases}>GitHub Releases</a> and install it – see{' '}
        <DocLink locale={locale} id="installation">
          Installation
        </DocLink>
        .
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
    { title: 'Basics', ids: ['installation', 'getting-started', 'navigation'] },
    { title: 'Features', ids: ['search', 'attachments', 'export'] },
    { title: 'More', ids: ['privacy', 'mobile', 'troubleshooting'] },
  ],
  pages: {
    installation: {
      title: 'Installation',
      description:
        'Download PST Viewer for free from GitHub, install it on Mac, Windows, Linux or Android and open it for the first time.',
      sections: [
        {
          id: 'download',
          title: 'Download',
          body: (
            <>
              <p>
                PST Viewer is free and open source under the MIT license. Every version is published on{' '}
                <a href={github.releases}>GitHub Releases</a>, together with its changelog. The links below always point
                to the latest release:
              </p>
              <DownloadTable locale={locale} />
              <p>
                No account is needed, and the app does not ask for any personal data. The Mac App Store, Microsoft
                Store, App Store and Google Play will follow as an additional option – free there, too (see{' '}
                <a href="#stores">Stores</a>).
              </p>
            </>
          ),
        },
        {
          id: 'macos',
          title: 'macOS',
          body: (
            <>
              <p>
                Choose the build that matches your Mac. You can check it under <strong>Apple menu → About This Mac</strong>:
                “Chip: Apple M…” means <strong>Apple Silicon</strong>, “Processor: … Intel” means <strong>Intel</strong>.
              </p>
              <Steps>
                <li>
                  Download <a href={downloads.macArm64.url}>{downloads.macArm64.file}</a> (Apple Silicon) or{' '}
                  <a href={downloads.macX64.url}>{downloads.macX64.file}</a> (Intel).
                </li>
                <li>Open the downloaded disk image.</li>
                <li>
                  Drag <strong>PST Viewer</strong> into the <strong>Applications</strong> folder.
                </li>
                <li>
                  Launch PST Viewer from the Applications folder or Launchpad. If macOS asks for confirmation, see{' '}
                  <a href="#first-launch">First launch</a>.
                </li>
              </Steps>
            </>
          ),
        },
        {
          id: 'windows',
          title: 'Windows',
          body: (
            <>
              <p>
                Most PCs need the <strong>x64</strong> installer. Laptops with an ARM processor (for example Snapdragon)
                use the <strong>ARM64</strong> installer. You’ll find your system type under{' '}
                <strong>Settings → System → About</strong>.
              </p>
              <Steps>
                <li>
                  Download <a href={downloads.windowsX64.url}>{downloads.windowsX64.file}</a> or{' '}
                  <a href={downloads.windowsArm64.url}>{downloads.windowsArm64.file}</a>.
                </li>
                <li>
                  Run the installer. If SmartScreen shows a warning, see <a href="#first-launch">First launch</a>.
                </li>
                <li>Follow the steps – you can choose the installation folder. No administrator rights are needed.</li>
                <li>
                  Launch PST Viewer from the <strong>Start menu</strong>.
                </li>
              </Steps>
            </>
          ),
        },
        {
          id: 'linux',
          title: 'Linux',
          body: (
            <>
              <p>
                The <strong>AppImage</strong> runs on most distributions without installation. Make it executable and
                start it:
              </p>
              <pre>
                <code>{`chmod +x ${downloads.linuxAppImage.file}\n./${downloads.linuxAppImage.file}`}</code>
              </pre>
              <p>
                On Debian, Ubuntu and derivatives, you can install the <strong>.deb</strong> package instead. PST Viewer
                then appears in your application menu:
              </p>
              <pre>
                <code>{`sudo apt install ./${downloads.linuxDeb.file}`}</code>
              </pre>
              <Callout title="AppImage won’t start?">
                Some distributions need the FUSE 2 library to run AppImages (on Ubuntu, for example, the{' '}
                <code>libfuse2</code> package). Both builds are for 64-bit x86 systems.
              </Callout>
            </>
          ),
        },
        {
          id: 'first-launch',
          title: 'First launch: confirming the app',
          body: (
            <>
              <p>
                The Mac version is signed with an Apple Developer ID and notarized by Apple, so it opens right away.
                The Windows installer is not code-signed yet: Windows can’t check the publisher and asks for
                confirmation the first time. You only have to do this once. Not sure? The complete{' '}
                <a href={github.repo}>source code</a> is public, so you can check what you install.
              </p>
              <h3>macOS (Gatekeeper, older downloads only)</h3>
              <p>If macOS reports that an older download of PST Viewer can’t be opened or verified:</p>
              <Steps>
                <li>
                  <strong>macOS 14 and earlier:</strong> in the Applications folder, Control-click (or right-click)
                  PST Viewer, choose <strong>Open</strong> and confirm with <strong>Open</strong>.
                </li>
                <li>
                  <strong>macOS 15 and later:</strong> try to open the app once and close the message. Then open{' '}
                  <strong>System Settings → Privacy &amp; Security</strong>, scroll down to <strong>Security</strong>{' '}
                  and click <strong>Open Anyway</strong> next to PST Viewer. Confirm with your password.
                </li>
              </Steps>
              <p>
                If macOS instead says the app is “damaged”, the download’s quarantine flag is blocking it. After making
                sure you downloaded the file from the official release page, you can remove the flag in Terminal:
              </p>
              <pre>
                <code>{`xattr -dr com.apple.quarantine "/Applications/PST Viewer.app"`}</code>
              </pre>
              <h3>Windows (SmartScreen)</h3>
              <p>
                If “Windows protected your PC” appears when you run the installer, click <strong>More info</strong> and
                then <strong>Run anyway</strong>.
              </p>
            </>
          ),
        },
        {
          id: 'android',
          title: 'Android',
          body: (
            <>
              <p>
                The Android app runs on phones and tablets with Android 8.0 or newer. Until it is available on Google
                Play, install the APK from GitHub:
              </p>
              <Steps>
                <li>
                  Open this page on your Android device and download{' '}
                  <a href={downloads.android.url}>{downloads.android.file}</a>.
                </li>
                <li>Open the downloaded file, for example from the notification or the Downloads app.</li>
                <li>
                  If Android asks, allow your browser or file manager to <strong>install unknown apps</strong>, then
                  choose <strong>Install</strong>.
                </li>
              </Steps>
              <p>To update, install the newer APK over the existing app – your settings are kept.</p>
            </>
          ),
        },
        {
          id: 'ios',
          title: 'iPhone & iPad',
          body: (
            <>
              <p>
                The app for iPhone and iPad (iOS and iPadOS 17 or newer) is coming to the <strong>App Store</strong> for
                free. Apple does not allow installing apps from other sources, so until then the only way is to build
                the app yourself.
              </p>
              <p>
                With a Mac and Xcode, you can build PST Viewer from the source code and install it on your own device.
                The <a href={github.iosSource}>instructions in the repository</a> describe the requirements and steps.
              </p>
            </>
          ),
        },
        {
          id: 'updates',
          title: 'Updates',
          body: (
            <p>
              New versions are published on <a href={github.releases}>GitHub Releases</a>, where the changelog lists
              what has changed. Download the new version and install it over the existing one – your archives are not
              affected, as PST Viewer never modifies them.
            </p>
          ),
        },
        {
          id: 'stores',
          title: 'Stores',
          body: (
            <>
              <p>
                In addition to GitHub, PST Viewer is coming to the app stores – as a free app, without in-app purchases.
              </p>
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
                      <td>Mac</td>
                      <td>Mac App Store</td>
                      <td>Coming soon</td>
                    </tr>
                    <tr>
                      <td>Windows</td>
                      <td>Microsoft Store</td>
                      <td>Coming soon</td>
                    </tr>
                    <tr>
                      <td>iPhone &amp; iPad</td>
                      <td>App Store</td>
                      <td>Coming soon</td>
                    </tr>
                    <tr>
                      <td>Android</td>
                      <td>Google Play</td>
                      <td>Coming soon</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          ),
        },
      ],
    },
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
                PST Viewer is free and open source – no subscription, no account, no ads and no in-app purchases.
                Download it from <a href={github.releases}>GitHub Releases</a> for macOS, Windows, Linux or Android.
              </p>
              <p>
                Step-by-step instructions for every platform, including what to do if macOS or Windows asks for
                confirmation on the first launch, are on the{' '}
                <DocLink locale={locale} id="installation">
                  Installation
                </DocLink>{' '}
                page. For iPhone and iPad, see <DocLink locale={locale} id="mobile">Mobile apps</DocLink>.
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
                  Choose <strong>Open File…</strong> or press <Kbd>⌘O</Kbd> (Mac) or <Kbd>Ctrl+O</Kbd> (Windows, Linux).
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
          id: 'open-source',
          title: 'Open source',
          body: (
            <p>
              The complete source code is public on <a href={github.repo}>GitHub</a> under the MIT license. Anyone can
              verify that PST Viewer works locally, sends nothing and opens files read-only – and report security issues.
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
              This website works without cookies and without tracking as well. It is hosted on GitHub Pages; if you
              choose an appearance (light, dark or system), that setting is stored locally in your browser only. See
              the{' '}
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
              PST Viewer for Android is available now as an APK from GitHub; Google Play will follow. The app for iPhone
              and iPad is coming to the App Store – until then, you can build it from source with Xcode. Both offer the
              same features as the desktop app. Installation steps are on the{' '}
              <DocLink locale={locale} id="installation" hash="android">
                Installation
              </DocLink>{' '}
              page.
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
                    <th scope="col">Available now</th>
                    <th scope="col">Store</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>iPhone &amp; iPad (iOS 17+)</td>
                    <td>
                      <a href={github.iosSource}>Build from source</a> with Xcode
                    </td>
                    <td>App Store – coming soon</td>
                  </tr>
                  <tr>
                    <td>Android (8.0+)</td>
                    <td>
                      <a href={downloads.android.url}>APK from GitHub</a>
                    </td>
                    <td>Google Play – coming soon</td>
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
          id: 'free',
          title: 'Free',
          body: (
            <p>
              Just like on the desktop: PST Viewer is free and open source – no subscription, no account, no ads and no
              in-app purchases. That will stay the same in the App Store and on Google Play.
            </p>
          ),
        },
      ],
    },
    troubleshooting: {
      title: 'Troubleshooting & FAQ',
      description: 'Solutions to common questions and problems.',
      sections: [
        {
          id: 'app-blocked',
          title: 'macOS or Windows won’t open the app',
          body: (
            <p>
              The Windows installer is not code-signed yet, so SmartScreen asks for confirmation on the first launch
              (older Mac downloads were not signed either). See{' '}
              <DocLink locale={locale} id="installation" hash="first-launch">
                First launch: confirming the app
              </DocLink>{' '}
              for the steps.
            </p>
          ),
        },
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
        {
          id: 'report-bug',
          title: 'Report a bug or suggest a feature',
          body: (
            <p>
              PST Viewer is developed in public on GitHub. Please report bugs and share ideas as an{' '}
              <a href={github.issues}>issue</a> – and never attach real mailboxes or private messages. Pull requests are
              welcome, too.
            </p>
          ),
        },
      ],
    },
  },
}
