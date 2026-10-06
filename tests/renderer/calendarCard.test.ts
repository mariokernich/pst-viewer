import { describe, expect, it } from 'vitest'
import { parseCalendar, parseContacts } from '../../src/renderer/src/lib/calendarCard'

const ICS = [
  'BEGIN:VCALENDAR',
  'METHOD:REQUEST',
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Berlin',
  'BEGIN:STANDARD',
  'DTSTART:19701025T030000',
  'END:STANDARD',
  'END:VTIMEZONE',
  'BEGIN:VEVENT',
  'SUMMARY:Elternabend\\, Gruppe 2',
  'DTSTART;TZID=Europe/Berlin:20260212T190000',
  'DTEND;TZID=Europe/Berlin:20260212T203000',
  'LOCATION:Kindergarten',
  'DESCRIPTION:Bitte pünktlich sein.\\nDanke!',
  'ORGANIZER;CN="Müller, Anna":mailto:anna@example.com',
  'ATTENDEE;CN=Bob;PARTSTAT=ACCEPTED:mailto:bob@example.com',
  'RRULE:FREQ=WEEKLY',
  'END:VEVENT',
  'END:VCALENDAR'
].join('\r\n')

describe('parseCalendar', () => {
  it('reads events with folded and escaped values', () => {
    const cal = parseCalendar(ICS.replace('Bitte pünktlich', 'Bitte pünkt\r\n lich'))
    expect(cal.method).toBe('REQUEST')
    expect(cal.events).toHaveLength(1)
    const e = cal.events[0]
    expect(e.summary).toBe('Elternabend, Gruppe 2')
    expect(e.description).toBe('Bitte pünktlich sein.\nDanke!')
    expect(e.start).toEqual({ time: new Date(2026, 1, 12, 19, 0, 0).getTime(), allDay: false, zone: 'Europe/Berlin' })
    expect(e.organizer).toEqual({ name: 'Müller, Anna', email: 'anna@example.com', status: undefined })
    expect(e.attendees[0].status).toBe('ACCEPTED')
    expect(e.recurring).toBe(true)
  })

  it('handles all-day and UTC times', () => {
    const cal = parseCalendar('BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:20260101\nDTEND:20260102T120000Z\nEND:VEVENT\nEND:VCALENDAR')
    expect(cal.events[0].start).toEqual({ time: new Date(2026, 0, 1).getTime(), allDay: true })
    expect(cal.events[0].end?.time).toBe(Date.UTC(2026, 0, 2, 12, 0, 0))
  })
})

describe('parseContacts', () => {
  it('reads names, addresses and typed fields', () => {
    const vcf = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'N:Müller;Anna;;Dr.;',
      'ORG:Example GmbH;Vertrieb',
      'TITLE:Leitung',
      'EMAIL;TYPE=INTERNET,WORK:anna@example.com',
      'TEL;TYPE=CELL:+49 170 1234567',
      'item1.ADR;TYPE=WORK:;;Hauptstr. 1;Würzburg;;97070;Deutschland',
      'PHOTO;VALUE=URI:https://example.com/photo.jpg',
      'END:VCARD'
    ].join('\n')
    const [card] = parseContacts(vcf)
    expect(card.name).toBe('Dr. Anna Müller')
    expect(card.organization).toBe('Example GmbH, Vertrieb')
    expect(card.photo).toBeNull()
    expect(card.fields).toEqual([
      { kind: 'email', label: 'work', value: 'anna@example.com' },
      { kind: 'phone', label: 'cell', value: '+49 170 1234567' },
      { kind: 'address', label: 'work', value: 'Hauptstr. 1\n97070 Würzburg\nDeutschland' }
    ])
  })
})
