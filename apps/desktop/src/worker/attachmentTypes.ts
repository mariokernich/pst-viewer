import type { AttachmentType } from '../shared/types'

export const ATTACHMENT_TYPE_BITS: Record<AttachmentType, number> = {
  pdf: 1,
  image: 2,
  office: 4,
  archive: 8,
  calendar: 16,
  message: 32
}

const OFFICE_EXT = /\.(docx?|docm|dotx?|xlsx?|xlsm|xlsb|xltx?|csv|pptx?|pptm|ppsx?|potx?|odt|ods|odp|rtf|pages|numbers|key|vsdx?|one|pub)$/i
const IMAGE_EXT = /\.(png|jpe?g|gif|bmp|tiff?|webp|heic|heif|svg|ico)$/i
const ARCHIVE_EXT = /\.(zip|rar|7z|gz|tgz|tar|bz2|xz|cab)$/i
const CALENDAR_EXT = /\.(ics|vcs)$/i
const MESSAGE_EXT = /\.(msg|eml)$/i

/** Returns the attachment category bit for a file. */
export function classifyAttachment(name: string, mimeType: string, isMessage: boolean): number {
  const bits = ATTACHMENT_TYPE_BITS
  if (isMessage || MESSAGE_EXT.test(name) || mimeType === 'message/rfc822') return bits.message
  if (/\.pdf$/i.test(name) || mimeType === 'application/pdf') return bits.pdf
  if (IMAGE_EXT.test(name) || mimeType.startsWith('image/')) return bits.image
  if (CALENDAR_EXT.test(name) || mimeType === 'text/calendar' || mimeType === 'application/ics') return bits.calendar
  if (ARCHIVE_EXT.test(name) || /zip|x-rar|x-7z|gzip|x-tar/.test(mimeType)) return bits.archive
  if (OFFICE_EXT.test(name) || /officedocument|msword|ms-excel|ms-powerpoint|opendocument/.test(mimeType)) return bits.office
  return 0
}
