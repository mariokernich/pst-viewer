# Security policy

PST Viewer opens untrusted files (mail archives and the HTML, attachments and links inside them), so security reports are very welcome.

## Reporting a vulnerability

Please **do not open a public issue**. Report it privately through [GitHub's private vulnerability reporting](https://github.com/mariokernich/pst-viewer/security/advisories/new) with a description, the affected version and platform, and steps to reproduce. Use a crafted sample file, never a real mailbox.

You will get an answer within a few days. Fixes are released as soon as possible, and you are credited in the release notes unless you prefer otherwise.

## Supported versions

Only the latest release receives security fixes.

## Scope

Examples of what matters most: script execution or network requests from mail content without the user's consent, writes to opened archives, crashes or hangs caused by crafted files, and attachments that are opened although they could run code.
