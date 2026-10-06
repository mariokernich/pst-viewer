# Local patches

This is `outlook-pst` 1.2.0 from crates.io ([microsoft/outlook-pst-rs](https://github.com/microsoft/outlook-pst-rs), MIT).
The unmodified sources are in the commit "Vendor outlook-pst 1.2.0"; all changes are marked with `PATCH(pst-viewer)`.

1. **Messages without a sub-node tree** (`messaging/message.rs`): messages that have neither
   recipients nor attachments may lack a sub-node tree. Upstream fails with
   `MessageSubNodeTreeNotFound`; the patch reads them with empty recipient and attachment tables.
2. **Attachments without data** (`messaging/attachment.rs`): `UnicodeAttachment::read_metadata` /
   `AnsiAttachment::read_metadata` read an attachment's properties except
   `PidTagAttachDataBinary`/`PidTagAttachDataObject`, so that attachment lists can be built
   without loading the content.
3. **Attached messages with their concrete type** (`messaging/attachment.rs`):
   `embedded_message()` returns the attached message as `Rc<UnicodeMessage>`/`Rc<AnsiMessage>`
   (upstream only exposes `Rc<dyn Message>`), which is needed to read the attachments of
   attached messages.

The viewer opens PST files exclusively through `UnicodePstFile::read_from`/`AnsiPstFile::read_from`
with a file opened read-only; no write path of the crate is used.
