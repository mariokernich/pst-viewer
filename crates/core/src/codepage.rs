//! Windows code pages (as stored in Outlook items and RTF) to text.

use encoding_rs::Encoding;

pub(crate) fn encoding_for_codepage(codepage: u32) -> &'static Encoding {
    use encoding_rs::*;
    match codepage {
        65001 => UTF_8,
        1200 => UTF_16LE,
        1201 => UTF_16BE,
        866 => IBM866,
        874 => WINDOWS_874,
        932 => SHIFT_JIS,
        936 => GBK,
        949 => EUC_KR,
        950 => BIG5,
        1250 => WINDOWS_1250,
        1251 => WINDOWS_1251,
        1253 => WINDOWS_1253,
        1254 => WINDOWS_1254,
        1255 => WINDOWS_1255,
        1256 => WINDOWS_1256,
        1257 => WINDOWS_1257,
        1258 => WINDOWS_1258,
        10000 => MACINTOSH,
        10007 => X_MAC_CYRILLIC,
        20866 => KOI8_R,
        21866 => KOI8_U,
        28592 => ISO_8859_2,
        28593 => ISO_8859_3,
        28594 => ISO_8859_4,
        28595 => ISO_8859_5,
        28596 => ISO_8859_6,
        28597 => ISO_8859_7,
        28598 => ISO_8859_8,
        28599 => WINDOWS_1254,
        28603 => ISO_8859_13,
        28605 => ISO_8859_15,
        50220..=50222 => ISO_2022_JP,
        51932 => EUC_JP,
        54936 => GB18030,
        // ASCII, Latin-1 and unknown code pages: windows-1252 is a superset.
        _ => WINDOWS_1252,
    }
}

pub(crate) fn decode(bytes: &[u8], codepage: Option<u32>) -> String {
    let encoding = codepage.map_or(encoding_rs::WINDOWS_1252, encoding_for_codepage);
    let (text, _, _) = encoding.decode(bytes);
    text.into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_code_pages() {
        assert_eq!(decode(&[0x47, 0x72, 0xFC, 0xDF, 0x65], Some(1252)), "Grüße");
        assert_eq!(decode(&[0xCF, 0xF0, 0xE8], Some(1251)), "При");
        assert_eq!(decode("ü".as_bytes(), Some(65001)), "ü");
    }
}
