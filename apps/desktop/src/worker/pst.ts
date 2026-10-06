/**
 * Single entry point for pst-extractor. The package has circular imports
 * between its classes, so its main module must always be loaded before any
 * deep import - importing everything through this file guarantees that.
 */
import { PSTFile, PSTMessage } from 'pst-extractor'
import { PSTAppointment } from 'pst-extractor/dist/PSTAppointment.class'
import { PSTContact } from 'pst-extractor/dist/PSTContact.class'
import { PSTNodeInputStream } from 'pst-extractor/dist/PSTNodeInputStream.class'
import { PSTTable7C } from 'pst-extractor/dist/PSTTable7C.class'
import { PSTTableBC } from 'pst-extractor/dist/PSTTableBC.class'
import { PSTTask } from 'pst-extractor/dist/PSTTask.class'
import { PSTUtil } from 'pst-extractor/dist/PSTUtil.class'

export type { PSTAttachment, PSTFolder } from 'pst-extractor'
export type { PSTDescriptorItem } from 'pst-extractor/dist/PSTDescriptorItem.class'
export type { PSTTableItem } from 'pst-extractor/dist/PSTTableItem.class'
export { PSTAppointment, PSTContact, PSTFile, PSTMessage, PSTNodeInputStream, PSTTable7C, PSTTableBC, PSTTask, PSTUtil }
