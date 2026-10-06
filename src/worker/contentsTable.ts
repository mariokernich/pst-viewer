import Long from 'long'
import { PSTNodeInputStream, PSTTable7C, type PSTFile, type PSTFolder, type PSTTableItem } from './pst'

/** A row of a folder's contents table: the columns Outlook uses for its list views. */
export interface ContentsRow {
  nid: number
  subject: string | null
  messageClass: string | null
  senderName: string | null
  displayTo: string | null
  deliveryTime: number | null
  submitTime: number | null
  modificationTime: number | null
  size: number | null
  messageFlags: number | null
  importance: number | null
  flagStatus: number | null
}

const PID = {
  rowId: 0x67f2,
  subject: 0x0037,
  messageClass: 0x001a,
  sentRepresentingName: 0x0042,
  senderName: 0x0c1a,
  displayTo: 0x0e04,
  deliveryTime: 0x0e06,
  submitTime: 0x0039,
  modificationTime: 0x3008,
  size: 0x0e08,
  messageFlags: 0x0e07,
  importance: 0x0017,
  flagStatus: 0x1090
}

const PT_LONG = 0x0003
const PT_BOOLEAN = 0x000b
const PT_STRING8 = 0x001e
const PT_UNICODE = 0x001f
const PT_SYSTIME = 0x0040
const FILETIME_UNIX_EPOCH_MS = 11_644_473_600_000

function str(item: PSTTableItem | undefined): string | null {
  if (!item || (item.entryValueType !== PT_UNICODE && item.entryValueType !== PT_STRING8)) return null
  try {
    return item.getStringValue()
  } catch {
    return null
  }
}

function int(item: PSTTableItem | undefined): number | null {
  if (!item || (item.entryValueType !== PT_LONG && item.entryValueType !== PT_BOOLEAN)) return null
  return item.entryValueReference
}

function time(item: PSTTableItem | undefined): number | null {
  if (!item || item.entryValueType !== PT_SYSTIME || !item.data || item.data.length < 8) return null
  const ms = Number(item.data.readBigUInt64LE(0) / 10_000n) - FILETIME_UNIX_EPOCH_MS
  // Ignore unset (zero) and obviously invalid timestamps.
  return ms > 0 && ms < 8_000_000_000_000 ? ms : null
}

/** Strips the "normalized subject" prefix marker that PST files may store. */
export function cleanSubject(subject: string): string {
  if (subject.length >= 2 && subject.charCodeAt(0) === 0x01) return subject.length === 2 ? '' : subject.slice(2)
  return subject
}

/**
 * Reads all rows of a folder's contents table in one go. This is an order of
 * magnitude faster than opening every message, so the message list can be
 * shown before the full content is indexed. Returns null if the table cannot
 * be read (the caller then falls back to opening each message).
 */
export function readContentsTable(pst: PSTFile, folder: PSTFolder, expected: number): ContentsRow[] | null {
  try {
    const node = pst.getDescriptorIndexNode(Long.fromNumber(folder.descriptorNodeId.toNumber() + 12))
    const subnodes = node.localDescriptorsOffsetIndexIdentifier.greaterThan(0) ? pst.getPSTDescriptorItems(node.localDescriptorsOffsetIndexIdentifier) : undefined
    const stream = new PSTNodeInputStream(pst, pst.getOffsetIndexNode(node.dataOffsetIndexIdentifier))
    const table = new PSTTable7C(stream, subnodes)
    const rows = table.getItems(0, Math.max(expected, table.rowCount))
    const result: ContentsRow[] = []
    for (const row of rows) {
      const nid = int(row.get(PID.rowId)) ?? row.get(PID.rowId)?.entryValueReference
      if (!nid) continue
      const subject = str(row.get(PID.subject))
      result.push({
        nid,
        subject: subject === null ? null : cleanSubject(subject),
        messageClass: str(row.get(PID.messageClass)),
        senderName: str(row.get(PID.sentRepresentingName)) ?? str(row.get(PID.senderName)),
        displayTo: str(row.get(PID.displayTo)),
        deliveryTime: time(row.get(PID.deliveryTime)),
        submitTime: time(row.get(PID.submitTime)),
        modificationTime: time(row.get(PID.modificationTime)),
        size: int(row.get(PID.size)),
        messageFlags: int(row.get(PID.messageFlags)),
        importance: int(row.get(PID.importance)),
        flagStatus: int(row.get(PID.flagStatus))
      })
    }
    // Tables without the basic list columns are not useful for the fast path.
    if (result.length === 0 || result.every((r) => r.subject === null && r.messageClass === null)) return null
    return result
  } catch {
    return null
  }
}
