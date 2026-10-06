import Long from 'long'
import { PSTNodeInputStream, PSTTableBC, PSTUtil, type PSTAttachment, type PSTDescriptorItem, type PSTFile, type PSTMessage } from './pst'

const ATTACH_EMBEDDED_MSG = 5
const PR_ATTACH_METHOD = 0x3705
const PR_ATTACH_DATA_OBJ = 0x3701
const PT_BINARY = 0x0102
const PT_OBJECT = 0x000d

/** Internal fields of pst-extractor objects needed to load embedded messages. */
interface AttachmentInternals {
  pstFile: PSTFile
  pstTableItems: Map<number, { entryValueType: number; isExternalValueReference: boolean; data: Buffer }> | null
  localDescriptorItems: Map<number, PSTDescriptorItem> | null
  getIntItem(id: number): number
}

/**
 * Loads a message that is attached to another message.
 *
 * pst-extractor's own `embeddedPSTMessage` getter returns null for attachments
 * (they carry no descriptor node) and mutates the attachment on access, so the
 * logic is re-implemented here without side effects.
 */
export function loadEmbeddedMessage(attachment: PSTAttachment, parent: PSTMessage): PSTMessage | null {
  const att = attachment as unknown as AttachmentInternals
  if (att.getIntItem(PR_ATTACH_METHOD) !== ATTACH_EMBEDDED_MSG) return null
  const item = att.pstTableItems?.get(PR_ATTACH_DATA_OBJ)
  if (!item) return null

  let stream: PSTNodeInputStream | null = null
  let localItems = att.localDescriptorItems
  if (item.entryValueType === PT_BINARY && !item.isExternalValueReference) {
    stream = new PSTNodeInputStream(att.pstFile, item.data)
  } else if (item.entryValueType === PT_OBJECT) {
    const nested = localItems?.get(item.data.readUInt32LE(0))
    if (nested) {
      stream = new PSTNodeInputStream(att.pstFile, nested)
      if (nested.subNodeOffsetIndexIdentifier > 0) {
        localItems = att.pstFile.getPSTDescriptorItems(Long.fromNumber(nested.subNodeOffsetIndexIdentifier))
      }
    }
  }
  if (!stream || !localItems) return null

  const table = new PSTTableBC(stream)
  const parentNode = (parent as unknown as { descriptorIndexNode: unknown }).descriptorIndexNode
  return PSTUtil.createAppropriatePSTMessageObject(att.pstFile, parentNode as never, table, localItems) as PSTMessage
}
