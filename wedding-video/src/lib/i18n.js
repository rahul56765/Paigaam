// Fixed strings and font stacks per language/script. Customers type their own
// names and lines in any script; these cover the words the template supplies.

export const FONT_FILES = [
  ['PG Display', 'fonts/Italiana-Regular.ttf', '400'],
  ['PG Numerals', 'fonts/Bellefair-Regular.ttf', '400'],
  ['PG Sans', 'fonts/JosefinSans-Light.ttf', '300'],
  ['PG Sans', 'fonts/JosefinSans-Regular.ttf', '400'],
  ['PG Sans', 'fonts/JosefinSans-SemiBold.ttf', '600'],
  ['PG Script', 'fonts/PinyonScript-Regular.ttf', '400'],
  ['PG Deva Serif', 'fonts/NotoSerifDevanagari-Regular.ttf', '400'],
  ['PG Deva Sans', 'fonts/NotoSansDevanagari-Regular.ttf', '400'],
  ['PG Guj Serif', 'fonts/NotoSerifGujarati-Regular.ttf', '400'],
  ['PG Guj Sans', 'fonts/NotoSansGujarati-Regular.ttf', '400'],
  ['PG Guru Serif', 'fonts/NotoSerifGurmukhi-Regular.ttf', '400'],
  ['PG Guru Sans', 'fonts/NotoSansGurmukhi-Regular.ttf', '400'],
  ['PG Beng Serif', 'fonts/NotoSerifBengali-Regular.ttf', '400'],
  ['PG Beng Sans', 'fonts/NotoSansBengali-Regular.ttf', '400'],
];

// Latin glyphs always come from the reference-matched faces; script glyphs fall
// through to the Noto companion so mixed text (e.g. Hindi names + English dates) works.
const SCRIPT_FALLBACK = {
  en: { serif: '', sans: '' },
  hi: { serif: ", 'PG Deva Serif'", sans: ", 'PG Deva Sans'" },
  mr: { serif: ", 'PG Deva Serif'", sans: ", 'PG Deva Sans'" },
  gu: { serif: ", 'PG Guj Serif'", sans: ", 'PG Guj Sans'" },
  pa: { serif: ", 'PG Guru Serif'", sans: ", 'PG Guru Sans'" },
  bn: { serif: ", 'PG Beng Serif'", sans: ", 'PG Beng Sans'" },
};

export function fonts(lang = 'en') {
  const f = SCRIPT_FALLBACK[lang] || SCRIPT_FALLBACK.en;
  return {
    display: `'PG Display'${f.serif}, serif`,
    numerals: `'PG Numerals', 'PG Display'${f.serif}, serif`,
    sans: `'PG Sans'${f.sans}, sans-serif`,
    script: `'PG Script'${f.serif}, cursive`,
  };
}

export const LANGUAGES = {
  en: 'English', hi: 'हिन्दी (Hindi)', mr: 'मराठी (Marathi)', gu: 'ગુજરાતી (Gujarati)', pa: 'ਪੰਜਾਬੀ (Punjabi)', bn: 'বাংলা (Bengali)',
};

const STRINGS = {
  en: { with: 'with', rsvp: 'RSVP', sharing: 'Sharing the Joy', onwards: 'onwards', dress: 'Dress code', directions: 'Directions', wishes: 'Send your wishes & RSVP' },
  hi: { with: 'संग', rsvp: 'आर.एस.वी.पी.', sharing: 'खुशियाँ बाँटते हुए', onwards: 'से', dress: 'परिधान', directions: 'रास्ता देखें', wishes: 'शुभकामनाएँ भेजें व पुष्टि करें' },
  mr: { with: 'आणि', rsvp: 'आर.एस.व्ही.पी.', sharing: 'आनंद वाटूया', onwards: 'पासून', dress: 'पेहराव', directions: 'मार्ग पहा', wishes: 'शुभेच्छा पाठवा व उपस्थिती कळवा' },
  gu: { with: 'સંગ', rsvp: 'આર.એસ.વી.પી.', sharing: 'આનંદ વહેંચીએ', onwards: 'થી', dress: 'પહેરવેશ', directions: 'રસ્તો જુઓ', wishes: 'શુભેચ્છા મોકલો અને હાજરી જણાવો' },
  pa: { with: 'ਸੰਗ', rsvp: 'ਆਰ.ਐਸ.ਵੀ.ਪੀ.', sharing: 'ਖੁਸ਼ੀਆਂ ਸਾਂਝੀਆਂ', onwards: 'ਤੋਂ', dress: 'ਪਹਿਰਾਵਾ', directions: 'ਰਸਤਾ ਦੇਖੋ', wishes: 'ਸ਼ੁਭਕਾਮਨਾਵਾਂ ਭੇਜੋ ਤੇ ਹਾਜ਼ਰੀ ਦੱਸੋ' },
  bn: { with: 'ও', rsvp: 'আর.এস.ভি.পি.', sharing: 'আনন্দ ভাগ করে নিই', onwards: 'থেকে', dress: 'পোশাক', directions: 'পথনির্দেশ', wishes: 'শুভেচ্ছা পাঠান ও উপস্থিতি জানান' },
};

export const t = (lang, key) => (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key];

const MONTHS = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  hi: ['जन', 'फ़र', 'मार्च', 'अप्रै', 'मई', 'जून', 'जुला', 'अग', 'सित', 'अक्टू', 'नव', 'दिस'],
  mr: ['जाने', 'फेब्रु', 'मार्च', 'एप्रि', 'मे', 'जून', 'जुलै', 'ऑग', 'सप्टें', 'ऑक्टो', 'नोव्हें', 'डिसें'],
  gu: ['જાન્યુ', 'ફેબ્રુ', 'માર્ચ', 'એપ્રિ', 'મે', 'જૂન', 'જુલા', 'ઑગ', 'સપ્ટે', 'ઑક્ટો', 'નવે', 'ડિસે'],
  pa: ['ਜਨ', 'ਫ਼ਰ', 'ਮਾਰਚ', 'ਅਪ੍ਰੈ', 'ਮਈ', 'ਜੂਨ', 'ਜੁਲਾ', 'ਅਗ', 'ਸਤੰ', 'ਅਕਤੂ', 'ਨਵੰ', 'ਦਸੰ'],
  bn: ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রি', 'মে', 'জুন', 'জুলা', 'আগ', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'],
};

// '2025-11-01' -> ['01', 'Nov', '2025']  (numerals stay Latin to match the stamp style)
export function dateParts(iso, lang = 'en') {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return ['', '', ''];
  const months = MONTHS[lang] || MONTHS.en;
  return [m[3], months[Number(m[2]) - 1] || '', m[1]];
}
