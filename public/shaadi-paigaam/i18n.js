/* Shaadi Paigaam — built-in interface strings, event names and welcome styles.
 * UMD: window.SPI18N in the browser, module.exports in Node.
 * Customers never edit these; their own words live in data.i18n[lang]. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SPI18N = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const LANGS = {
    en: { name: 'English', native: 'English', locale: 'en-US', dir: 'ltr', script: 'latn' },
    hi: { name: 'Hindi', native: 'हिन्दी', locale: 'hi-IN', dir: 'ltr', script: 'deva' },
    mr: { name: 'Marathi', native: 'मराठी', locale: 'mr-IN', dir: 'ltr', script: 'deva' },
    gu: { name: 'Gujarati', native: 'ગુજરાતી', locale: 'gu-IN', dir: 'ltr', script: 'gujr' },
    ta: { name: 'Tamil', native: 'தமிழ்', locale: 'ta-IN', dir: 'ltr', script: 'taml' },
    te: { name: 'Telugu', native: 'తెలుగు', locale: 'te-IN', dir: 'ltr', script: 'telu' },
    ur: { name: 'Urdu', native: 'اردو', locale: 'ur-IN', dir: 'rtl', script: 'arab-ur' },
    ar: { name: 'Arabic', native: 'العربية', locale: 'ar', dir: 'rtl', script: 'arab' },
  };

  const S = {};
  S.en = {
    tapToOpen: 'Tap to open', gettingMarried: "We're getting married", sonOf: 'Son of', daughterOf: 'Daughter of', amp: '&', and: '&',
    mr_: 'Mr.', mrs_: 'Mrs.', dr_: 'Dr.', late_: 'Late',
    scratchTitle: 'Scratch to Reveal', scratchHint: 'Scratch the heart with your finger', foreverBegins: 'Our forever begins', saveOurDate: 'Save our date', saveTheDate: 'Save the Date',
    countdownTitle: 'Counting Down to Forever', days: 'Days', hours: 'Hours', minutes: 'Minutes', seconds: 'Seconds', todayIsTheDay: 'Today is the day!', married: 'Just married, thank you for your blessings',
    timelineTitle: 'Program Timeline', venueTitle: 'Venue', receptionVenue: 'Reception venue', openInMaps: 'Open in Maps', viewOnGoogleMaps: 'View on Google Maps', mapUnavailable: 'The map could not load. Use the button below for directions.',
    dressTitle: 'Dress Code', women: 'Women', men: 'Men', everyone: 'For everyone', dressFor: 'Dress code',
    preWeddingTitle: 'Pre-Wedding Events', transportTitle: 'Transportation', accommodationTitle: 'Accommodation', bookingCode: 'Booking code', copy: 'Copy', copied: 'Copied',
    giftsTitle: 'Gifts', photosTitle: 'Our Moments', photosSoon: 'Photos coming soon',
    rsvpTitle: 'RSVP', rsvpBy: 'Kindly respond by {date}', yourName: 'Your Name', yourNamePh: 'Your full name', email: 'Email', emailPh: 'you@example.com', phone: 'Phone / WhatsApp', phonePh: '+91 98765 43210', contactHint: 'Email or phone, at least one',
    attending: 'Will you be attending?', select: 'Select…', accept: 'Joyfully accept', decline: 'Regretfully decline', guests: 'Number of guests (including you)', meal: 'Meal preference', message: 'Message', messagePh: 'Your wishes for the couple',
    send: 'Send RSVP', sending: 'Sending…', thanksYes: "Thank you! We can't wait to celebrate with you.", thanksNo: "Thank you for letting us know. You'll be missed!", duplicate: 'We already have a response from this email or phone. Tap again to update it.', update: 'Update my response', rsvpClosed: 'RSVPs are now closed. Please contact the family directly.',
    errRequired: 'Please fill this in', errContact: 'Please add your email or phone', errEmail: 'That email does not look right', errPhone: 'That phone number does not look right', errGeneric: 'Something went wrong. Please try again.', errSlow: 'Too many tries. Please wait a minute and try again.',
    withLove: 'With love', madeWith: 'Made with love on PAIGAAM', language: 'Language', musicOn: 'Play music', musicOff: 'Mute music',
    passTitle: 'This invitation is private', passHint: 'Enter the passcode shared by the family', passBtn: 'Open invitation', passWrong: 'That passcode is not right. Please try again.',
    ended: 'This celebration has ended. Thank you for being part of it.', previewBadge: 'Preview, not yet published',
  };
  S.hi = {
    tapToOpen: 'खोलने के लिए छुएँ', gettingMarried: 'हम विवाह के बंधन में बँधने जा रहे हैं', sonOf: 'सुपुत्र', daughterOf: 'सुपुत्री', amp: 'व', and: 'एवं',
    mr_: 'श्री', mrs_: 'श्रीमती', dr_: 'डॉ.', late_: 'स्व.',
    scratchTitle: 'खुरचकर देखें', scratchHint: 'उँगली से दिल को खुरचें', foreverBegins: 'हमारा हमेशा यहीं से शुरू', saveOurDate: 'हमारी तारीख़', saveTheDate: 'तारीख़ सहेजें',
    countdownTitle: 'शुभ घड़ी की उलटी गिनती', days: 'दिन', hours: 'घंटे', minutes: 'मिनट', seconds: 'सेकंड', todayIsTheDay: 'आज ही वह शुभ दिन है!', married: 'विवाह संपन्न हुआ, आपके आशीर्वाद के लिए धन्यवाद',
    timelineTitle: 'कार्यक्रम', venueTitle: 'स्थल', receptionVenue: 'स्वागत समारोह स्थल', openInMaps: 'मैप में खोलें', viewOnGoogleMaps: 'गूगल मैप्स पर देखें', mapUnavailable: 'मैप लोड नहीं हो सका। रास्ते के लिए नीचे का बटन दबाएँ।',
    dressTitle: 'परिधान', women: 'महिलाएँ', men: 'पुरुष', everyone: 'सभी के लिए', dressFor: 'परिधान',
    preWeddingTitle: 'विवाह-पूर्व समारोह', transportTitle: 'आवागमन', accommodationTitle: 'ठहरने की व्यवस्था', bookingCode: 'बुकिंग कोड', copy: 'कॉपी करें', copied: 'कॉपी हो गया',
    giftsTitle: 'उपहार', photosTitle: 'हमारे पल', photosSoon: 'तस्वीरें जल्द ही',
    rsvpTitle: 'आपकी उपस्थिति', rsvpBy: 'कृपया {date} तक उत्तर दें', yourName: 'आपका नाम', yourNamePh: 'पूरा नाम', email: 'ईमेल', emailPh: 'you@example.com', phone: 'फ़ोन / व्हाट्सऐप', phonePh: '+91 98765 43210', contactHint: 'ईमेल या फ़ोन, कम से कम एक',
    attending: 'क्या आप पधारेंगे?', select: 'चुनें…', accept: 'सहर्ष आऊँगा/आऊँगी', decline: 'खेद है, नहीं आ पाऊँगा/पाऊँगी', guests: 'मेहमानों की संख्या (आप सहित)', meal: 'भोजन की पसंद', message: 'संदेश', messagePh: 'नवदंपति के लिए आपकी शुभकामनाएँ',
    send: 'उत्तर भेजें', sending: 'भेजा जा रहा है…', thanksYes: 'धन्यवाद! आपके साथ उत्सव मनाने की प्रतीक्षा है।', thanksNo: 'बताने के लिए धन्यवाद। आपकी कमी खलेगी!', duplicate: 'इस ईमेल या फ़ोन से उत्तर पहले ही मिल चुका है। बदलने के लिए फिर से दबाएँ।', update: 'मेरा उत्तर बदलें', rsvpClosed: 'उत्तर देने की अवधि समाप्त हो गई है। कृपया परिवार से सीधे संपर्क करें।',
    errRequired: 'कृपया यह भरें', errContact: 'कृपया ईमेल या फ़ोन जोड़ें', errEmail: 'ईमेल सही नहीं लग रहा', errPhone: 'फ़ोन नंबर सही नहीं लग रहा', errGeneric: 'कुछ गड़बड़ हुई। कृपया फिर कोशिश करें।', errSlow: 'बहुत अधिक प्रयास। एक मिनट बाद कोशिश करें।',
    withLove: 'सप्रेम', madeWith: 'PAIGAAM पर प्यार से बनाया गया', language: 'भाषा', musicOn: 'संगीत चलाएँ', musicOff: 'संगीत बंद करें',
    passTitle: 'यह निमंत्रण निजी है', passHint: 'परिवार द्वारा दिया गया पासकोड डालें', passBtn: 'निमंत्रण खोलें', passWrong: 'पासकोड सही नहीं है। फिर कोशिश करें।',
    ended: 'यह उत्सव संपन्न हो चुका है। इसका हिस्सा बनने के लिए धन्यवाद।', previewBadge: 'पूर्वावलोकन, अभी प्रकाशित नहीं',
  };
  S.mr = {
    tapToOpen: 'उघडण्यासाठी स्पर्श करा', gettingMarried: 'आम्ही विवाहबंधनात अडकत आहोत', sonOf: 'सुपुत्र', daughterOf: 'सुकन्या', sonOfSuffix: 'यांचे सुपुत्र', daughterOfSuffix: 'यांची सुकन्या', amp: 'व', and: 'व',
    mr_: 'श्री.', mrs_: 'सौ.', dr_: 'डॉ.', late_: 'कै.',
    scratchTitle: 'खरवडून पाहा', scratchHint: 'बोटाने हृदय खरवडा', foreverBegins: 'आमचे सहजीवन इथून सुरू', saveOurDate: 'आमची तारीख', saveTheDate: 'तारीख जतन करा',
    countdownTitle: 'शुभमुहूर्ताची उलटी गिनती', days: 'दिवस', hours: 'तास', minutes: 'मिनिटे', seconds: 'सेकंद', todayIsTheDay: 'आजच तो शुभ दिवस!', married: 'विवाह संपन्न झाला, आपल्या आशीर्वादाबद्दल धन्यवाद',
    timelineTitle: 'कार्यक्रम', venueTitle: 'स्थळ', receptionVenue: 'स्वागत समारंभ स्थळ', openInMaps: 'नकाशात उघडा', viewOnGoogleMaps: 'गूगल मॅप्सवर पाहा', mapUnavailable: 'नकाशा लोड झाला नाही. मार्गासाठी खालील बटण वापरा.',
    dressTitle: 'पोशाख', women: 'महिला', men: 'पुरुष', everyone: 'सर्वांसाठी', dressFor: 'पोशाख',
    preWeddingTitle: 'विवाहपूर्व समारंभ', transportTitle: 'वाहतूक व्यवस्था', accommodationTitle: 'निवास व्यवस्था', bookingCode: 'बुकिंग कोड', copy: 'कॉपी करा', copied: 'कॉपी झाले',
    giftsTitle: 'आहेर', photosTitle: 'आमचे क्षण', photosSoon: 'फोटो लवकरच',
    rsvpTitle: 'आपली उपस्थिती', rsvpBy: 'कृपया {date} पर्यंत कळवा', yourName: 'आपले नाव', yourNamePh: 'पूर्ण नाव', email: 'ईमेल', emailPh: 'you@example.com', phone: 'फोन / व्हॉट्सॲप', phonePh: '+91 98765 43210', contactHint: 'ईमेल किंवा फोन, किमान एक',
    attending: 'आपण उपस्थित राहणार का?', select: 'निवडा…', accept: 'आनंदाने येईन', decline: 'क्षमस्व, येऊ शकणार नाही', guests: 'पाहुण्यांची संख्या (आपल्यासह)', meal: 'भोजनाची आवड', message: 'संदेश', messagePh: 'वधू-वरांसाठी आपल्या शुभेच्छा',
    send: 'उत्तर पाठवा', sending: 'पाठवत आहे…', thanksYes: 'धन्यवाद! आपल्यासोबत आनंद साजरा करण्याची उत्सुकता आहे.', thanksNo: 'कळवल्याबद्दल धन्यवाद. आपली उणीव भासेल!', duplicate: 'या ईमेल किंवा फोनवरून उत्तर आधीच आले आहे. बदलण्यासाठी पुन्हा दाबा.', update: 'माझे उत्तर बदला', rsvpClosed: 'उत्तर देण्याची मुदत संपली आहे. कृपया कुटुंबाशी थेट संपर्क साधा.',
    errRequired: 'कृपया हे भरा', errContact: 'कृपया ईमेल किंवा फोन द्या', errEmail: 'ईमेल बरोबर वाटत नाही', errPhone: 'फोन नंबर बरोबर वाटत नाही', errGeneric: 'काहीतरी चुकले. कृपया पुन्हा प्रयत्न करा.', errSlow: 'खूप प्रयत्न झाले. एका मिनिटाने प्रयत्न करा.',
    withLove: 'सप्रेम', madeWith: 'PAIGAAM वर प्रेमाने बनवले', language: 'भाषा', musicOn: 'संगीत सुरू करा', musicOff: 'संगीत बंद करा',
    passTitle: 'हे निमंत्रण खाजगी आहे', passHint: 'कुटुंबाने दिलेला पासकोड टाका', passBtn: 'निमंत्रण उघडा', passWrong: 'पासकोड चुकीचा आहे. पुन्हा प्रयत्न करा.',
    ended: 'हा सोहळा संपन्न झाला. त्यात सहभागी झाल्याबद्दल धन्यवाद.', previewBadge: 'पूर्वावलोकन, अद्याप प्रकाशित नाही',
  };
  S.gu = {
    tapToOpen: 'ખોલવા માટે સ્પર્શ કરો', gettingMarried: 'અમે લગ્નબંધનમાં બંધાઈ રહ્યાં છીએ', sonOf: 'સુપુત્ર', daughterOf: 'સુપુત્રી', sonOfSuffix: 'ના સુપુત્ર', daughterOfSuffix: 'ની સુપુત્રી', amp: 'અને', and: 'અને',
    mr_: 'શ્રી', mrs_: 'શ્રીમતી', dr_: 'ડૉ.', late_: 'સ્વ.',
    scratchTitle: 'ખોતરીને જુઓ', scratchHint: 'આંગળીથી હૃદય ખોતરો', foreverBegins: 'અમારો સાથ અહીંથી શરૂ', saveOurDate: 'અમારી તારીખ', saveTheDate: 'તારીખ સાચવો',
    countdownTitle: 'શુભ ઘડીની ગણતરી', days: 'દિવસ', hours: 'કલાક', minutes: 'મિનિટ', seconds: 'સેકન્ડ', todayIsTheDay: 'આજે જ એ શુભ દિવસ છે!', married: 'લગ્ન સંપન્ન થયાં, આપના આશીર્વાદ બદલ આભાર',
    timelineTitle: 'કાર્યક્રમ', venueTitle: 'સ્થળ', receptionVenue: 'સ્વાગત સમારંભ સ્થળ', openInMaps: 'નકશામાં ખોલો', viewOnGoogleMaps: 'ગૂગલ મેપ્સ પર જુઓ', mapUnavailable: 'નકશો લોડ ન થયો. રસ્તા માટે નીચેનું બટન વાપરો.',
    dressTitle: 'પોશાક', women: 'મહિલાઓ', men: 'પુરુષો', everyone: 'સૌ માટે', dressFor: 'પોશાક',
    preWeddingTitle: 'લગ્ન પૂર્વેના પ્રસંગો', transportTitle: 'વાહનવ્યવહાર', accommodationTitle: 'રહેવાની વ્યવસ્થા', bookingCode: 'બુકિંગ કોડ', copy: 'કૉપિ કરો', copied: 'કૉપિ થયું',
    giftsTitle: 'ભેટ', photosTitle: 'અમારી પળો', photosSoon: 'ફોટા ટૂંક સમયમાં',
    rsvpTitle: 'આપની હાજરી', rsvpBy: 'કૃપા કરી {date} સુધીમાં જણાવો', yourName: 'આપનું નામ', yourNamePh: 'પૂરું નામ', email: 'ઈમેલ', emailPh: 'you@example.com', phone: 'ફોન / વૉટ્સઍપ', phonePh: '+91 98765 43210', contactHint: 'ઈમેલ અથવા ફોન, ઓછામાં ઓછું એક',
    attending: 'શું આપ પધારશો?', select: 'પસંદ કરો…', accept: 'આનંદથી આવીશ', decline: 'દિલગીર છું, નહીં આવી શકું', guests: 'મહેમાનોની સંખ્યા (આપ સહિત)', meal: 'ભોજનની પસંદ', message: 'સંદેશ', messagePh: 'નવદંપતી માટે આપની શુભેચ્છા',
    send: 'જવાબ મોકલો', sending: 'મોકલી રહ્યાં છીએ…', thanksYes: 'આભાર! આપની સાથે ઉજવણીની રાહ છે.', thanksNo: 'જણાવવા બદલ આભાર. આપની ખોટ સાલશે!', duplicate: 'આ ઈમેલ કે ફોનથી જવાબ પહેલેથી મળ્યો છે. બદલવા માટે ફરી દબાવો.', update: 'મારો જવાબ બદલો', rsvpClosed: 'જવાબની મુદત પૂરી થઈ છે. કૃપા કરી પરિવારનો સીધો સંપર્ક કરો.',
    errRequired: 'કૃપા કરી આ ભરો', errContact: 'કૃપા કરી ઈમેલ અથવા ફોન ઉમેરો', errEmail: 'ઈમેલ બરાબર લાગતો નથી', errPhone: 'ફોન નંબર બરાબર લાગતો નથી', errGeneric: 'કંઈક ખોટું થયું. ફરી પ્રયત્ન કરો.', errSlow: 'ઘણા પ્રયત્નો થયા. એક મિનિટ પછી પ્રયત્ન કરો.',
    withLove: 'સપ્રેમ', madeWith: 'PAIGAAM પર પ્રેમથી બનાવ્યું', language: 'ભાષા', musicOn: 'સંગીત વગાડો', musicOff: 'સંગીત બંધ કરો',
    passTitle: 'આ આમંત્રણ ખાનગી છે', passHint: 'પરિવારે આપેલો પાસકોડ લખો', passBtn: 'આમંત્રણ ખોલો', passWrong: 'પાસકોડ ખોટો છે. ફરી પ્રયત્ન કરો.',
    ended: 'આ પ્રસંગ સંપન્ન થયો. તેમાં સહભાગી થવા બદલ આભાર.', previewBadge: 'પૂર્વાવલોકન, હજી પ્રકાશિત નથી',
  };
  S.ta = {
    tapToOpen: 'திறக்கத் தொடவும்', gettingMarried: 'நாங்கள் திருமணம் செய்துகொள்கிறோம்', sonOf: 'புதல்வன்', daughterOf: 'புதல்வி', sonOfSuffix: 'அவர்களின் புதல்வன்', daughterOfSuffix: 'அவர்களின் புதல்வி', amp: '&', and: 'மற்றும்',
    mr_: 'திரு.', mrs_: 'திருமதி', dr_: 'டாக்டர்', late_: 'அமரர்',
    scratchTitle: 'சுரண்டிப் பாருங்கள்', scratchHint: 'விரலால் இதயத்தைச் சுரண்டவும்', foreverBegins: 'எங்கள் என்றென்றும் இங்கே தொடங்குகிறது', saveOurDate: 'எங்கள் நாள்', saveTheDate: 'நாளைச் சேமிக்கவும்',
    countdownTitle: 'சுப நாளுக்கான கவுண்ட்டவுன்', days: 'நாட்கள்', hours: 'மணி', minutes: 'நிமிடம்', seconds: 'விநாடி', todayIsTheDay: 'இன்றுதான் அந்த நன்னாள்!', married: 'திருமணம் இனிதே நிறைவுற்றது, உங்கள் ஆசிகளுக்கு நன்றி',
    timelineTitle: 'நிகழ்ச்சி நிரல்', venueTitle: 'இடம்', receptionVenue: 'வரவேற்பு இடம்', openInMaps: 'வரைபடத்தில் திறக்க', viewOnGoogleMaps: 'கூகுள் மேப்ஸில் பார்க்க', mapUnavailable: 'வரைபடம் ஏற்றப்படவில்லை. வழிக்குக் கீழே உள்ள பொத்தானைப் பயன்படுத்தவும்.',
    dressTitle: 'உடை நெறி', women: 'பெண்கள்', men: 'ஆண்கள்', everyone: 'அனைவருக்கும்', dressFor: 'உடை',
    preWeddingTitle: 'திருமணத்துக்கு முந்தைய நிகழ்வுகள்', transportTitle: 'போக்குவரத்து', accommodationTitle: 'தங்குமிடம்', bookingCode: 'முன்பதிவுக் குறியீடு', copy: 'நகலெடு', copied: 'நகலெடுக்கப்பட்டது',
    giftsTitle: 'பரிசுகள்', photosTitle: 'எங்கள் தருணங்கள்', photosSoon: 'புகைப்படங்கள் விரைவில்',
    rsvpTitle: 'உங்கள் வருகை', rsvpBy: 'தயவுசெய்து {date}க்குள் பதிலளிக்கவும்', yourName: 'உங்கள் பெயர்', yourNamePh: 'முழுப் பெயர்', email: 'மின்னஞ்சல்', emailPh: 'you@example.com', phone: 'தொலைபேசி / வாட்ஸ்அப்', phonePh: '+91 98765 43210', contactHint: 'மின்னஞ்சல் அல்லது தொலைபேசி, குறைந்தது ஒன்று',
    attending: 'நீங்கள் வருகிறீர்களா?', select: 'தேர்ந்தெடுக்கவும்…', accept: 'மகிழ்ச்சியுடன் வருவேன்', decline: 'வருந்துகிறேன், வர இயலாது', guests: 'விருந்தினர் எண்ணிக்கை (உங்களுடன்)', meal: 'உணவு விருப்பம்', message: 'செய்தி', messagePh: 'மணமக்களுக்கு உங்கள் வாழ்த்துகள்',
    send: 'பதில் அனுப்பு', sending: 'அனுப்பப்படுகிறது…', thanksYes: 'நன்றி! உங்களுடன் கொண்டாடக் காத்திருக்கிறோம்.', thanksNo: 'தெரிவித்ததற்கு நன்றி. உங்களை மிஸ் செய்வோம்!', duplicate: 'இந்த மின்னஞ்சல் அல்லது தொலைபேசியிலிருந்து ஏற்கனவே பதில் வந்துள்ளது. மாற்ற மீண்டும் அழுத்தவும்.', update: 'என் பதிலை மாற்று', rsvpClosed: 'பதில் அளிக்கும் காலம் முடிந்தது. குடும்பத்தினரை நேரடியாகத் தொடர்பு கொள்ளவும்.',
    errRequired: 'இதை நிரப்பவும்', errContact: 'மின்னஞ்சல் அல்லது தொலைபேசியைச் சேர்க்கவும்', errEmail: 'மின்னஞ்சல் சரியாகத் தெரியவில்லை', errPhone: 'தொலைபேசி எண் சரியாகத் தெரியவில்லை', errGeneric: 'ஏதோ தவறு நடந்தது. மீண்டும் முயலவும்.', errSlow: 'பல முயற்சிகள். ஒரு நிமிடம் கழித்து முயலவும்.',
    withLove: 'அன்புடன்', madeWith: 'PAIGAAM இல் அன்புடன் உருவாக்கப்பட்டது', language: 'மொழி', musicOn: 'இசையை இயக்கு', musicOff: 'இசையை நிறுத்து',
    passTitle: 'இந்த அழைப்பிதழ் தனிப்பட்டது', passHint: 'குடும்பத்தினர் தந்த கடவுக்குறியீட்டை உள்ளிடவும்', passBtn: 'அழைப்பிதழைத் திற', passWrong: 'கடவுக்குறியீடு தவறு. மீண்டும் முயலவும்.',
    ended: 'இந்தக் கொண்டாட்டம் நிறைவுற்றது. பங்கேற்றதற்கு நன்றி.', previewBadge: 'முன்னோட்டம், இன்னும் வெளியிடப்படவில்லை',
  };
  S.te = {
    tapToOpen: 'తెరవడానికి తాకండి', gettingMarried: 'మేము వివాహం చేసుకుంటున్నాము', sonOf: 'కుమారుడు', daughterOf: 'కుమార్తె', sonOfSuffix: 'గారి కుమారుడు', daughterOfSuffix: 'గారి కుమార్తె', amp: '&', and: 'మరియు',
    mr_: 'శ్రీ', mrs_: 'శ్రీమతి', dr_: 'డా.', late_: 'కీ.శే.',
    scratchTitle: 'గీకి చూడండి', scratchHint: 'వేలితో హృదయాన్ని గీకండి', foreverBegins: 'మా జీవితకాల ప్రయాణం ఇక్కడే మొదలు', saveOurDate: 'మా తేదీ', saveTheDate: 'తేదీని సేవ్ చేయండి',
    countdownTitle: 'శుభ ముహూర్తానికి కౌంట్‌డౌన్', days: 'రోజులు', hours: 'గంటలు', minutes: 'నిమిషాలు', seconds: 'సెకన్లు', todayIsTheDay: 'ఈ రోజే ఆ శుభదినం!', married: 'వివాహం జరిగింది, మీ ఆశీస్సులకు ధన్యవాదాలు',
    timelineTitle: 'కార్యక్రమ వివరాలు', venueTitle: 'వేదిక', receptionVenue: 'రిసెప్షన్ వేదిక', openInMaps: 'మ్యాప్స్‌లో తెరవండి', viewOnGoogleMaps: 'గూగుల్ మ్యాప్స్‌లో చూడండి', mapUnavailable: 'మ్యాప్ లోడ్ కాలేదు. దారి కోసం కింది బటన్ వాడండి.',
    dressTitle: 'దుస్తుల నియమం', women: 'మహిళలు', men: 'పురుషులు', everyone: 'అందరికీ', dressFor: 'దుస్తులు',
    preWeddingTitle: 'పెళ్లికి ముందు వేడుకలు', transportTitle: 'రవాణా', accommodationTitle: 'వసతి', bookingCode: 'బుకింగ్ కోడ్', copy: 'కాపీ చేయండి', copied: 'కాపీ అయింది',
    giftsTitle: 'బహుమతులు', photosTitle: 'మా క్షణాలు', photosSoon: 'ఫోటోలు త్వరలో',
    rsvpTitle: 'మీ హాజరు', rsvpBy: 'దయచేసి {date} లోపు తెలియజేయండి', yourName: 'మీ పేరు', yourNamePh: 'పూర్తి పేరు', email: 'ఈమెయిల్', emailPh: 'you@example.com', phone: 'ఫోన్ / వాట్సాప్', phonePh: '+91 98765 43210', contactHint: 'ఈమెయిల్ లేదా ఫోన్, కనీసం ఒకటి',
    attending: 'మీరు హాజరవుతారా?', select: 'ఎంచుకోండి…', accept: 'సంతోషంగా వస్తాను', decline: 'క్షమించండి, రాలేను', guests: 'అతిథుల సంఖ్య (మీతో సహా)', meal: 'భోజన ఎంపిక', message: 'సందేశం', messagePh: 'నూతన దంపతులకు మీ శుభాకాంక్షలు',
    send: 'జవాబు పంపండి', sending: 'పంపుతున్నాం…', thanksYes: 'ధన్యవాదాలు! మీతో కలిసి వేడుక చేసుకోవాలని ఎదురుచూస్తున్నాం.', thanksNo: 'తెలియజేసినందుకు ధన్యవాదాలు. మిమ్మల్ని మిస్ అవుతాం!', duplicate: 'ఈ ఈమెయిల్ లేదా ఫోన్ నుండి ఇప్పటికే జవాబు వచ్చింది. మార్చడానికి మళ్లీ నొక్కండి.', update: 'నా జవాబు మార్చండి', rsvpClosed: 'జవాబు గడువు ముగిసింది. దయచేసి కుటుంబాన్ని నేరుగా సంప్రదించండి.',
    errRequired: 'దయచేసి ఇది నింపండి', errContact: 'దయచేసి ఈమెయిల్ లేదా ఫోన్ ఇవ్వండి', errEmail: 'ఈమెయిల్ సరిగా లేదు', errPhone: 'ఫోన్ నంబర్ సరిగా లేదు', errGeneric: 'ఏదో పొరపాటు జరిగింది. మళ్లీ ప్రయత్నించండి.', errSlow: 'చాలా ప్రయత్నాలు. ఒక నిమిషం తర్వాత ప్రయత్నించండి.',
    withLove: 'ప్రేమతో', madeWith: 'PAIGAAM లో ప్రేమతో రూపొందించబడింది', language: 'భాష', musicOn: 'సంగీతం ప్లే చేయండి', musicOff: 'సంగీతం ఆపండి',
    passTitle: 'ఈ ఆహ్వానం ప్రైవేట్', passHint: 'కుటుంబం ఇచ్చిన పాస్‌కోడ్ నమోదు చేయండి', passBtn: 'ఆహ్వానం తెరవండి', passWrong: 'పాస్‌కోడ్ తప్పు. మళ్లీ ప్రయత్నించండి.',
    ended: 'ఈ వేడుక ముగిసింది. పాల్గొన్నందుకు ధన్యవాదాలు.', previewBadge: 'ప్రివ్యూ, ఇంకా ప్రచురించలేదు',
  };
  S.ur = {
    tapToOpen: 'کھولنے کے لیے چھوئیں', gettingMarried: 'ہم رشتۂ ازدواج میں بندھنے جا رہے ہیں', sonOf: 'فرزند', daughterOf: 'دختر', amp: 'و', and: 'اور',
    mr_: 'جناب', mrs_: 'محترمہ', dr_: 'ڈاکٹر', late_: 'مرحوم',
    scratchTitle: 'کھرچ کر دیکھیں', scratchHint: 'انگلی سے دل کو کھرچیں', foreverBegins: 'ہمارا ہمیشہ یہیں سے شروع', saveOurDate: 'ہماری تاریخ', saveTheDate: 'تاریخ محفوظ کریں',
    countdownTitle: 'مبارک گھڑی کی الٹی گنتی', days: 'دن', hours: 'گھنٹے', minutes: 'منٹ', seconds: 'سیکنڈ', todayIsTheDay: 'آج ہی وہ مبارک دن ہے!', married: 'شادی بخیر و خوبی انجام پائی، آپ کی دعاؤں کا شکریہ',
    timelineTitle: 'پروگرام', venueTitle: 'مقام', receptionVenue: 'ولیمہ کا مقام', openInMaps: 'نقشے میں کھولیں', viewOnGoogleMaps: 'گوگل میپس پر دیکھیں', mapUnavailable: 'نقشہ لوڈ نہیں ہو سکا۔ راستے کے لیے نیچے کا بٹن استعمال کریں۔',
    dressTitle: 'لباس', women: 'خواتین', men: 'حضرات', everyone: 'سب کے لیے', dressFor: 'لباس',
    preWeddingTitle: 'شادی سے پہلے کی تقریبات', transportTitle: 'آمد و رفت', accommodationTitle: 'قیام کا انتظام', bookingCode: 'بکنگ کوڈ', copy: 'کاپی کریں', copied: 'کاپی ہو گیا',
    giftsTitle: 'تحائف', photosTitle: 'ہمارے لمحات', photosSoon: 'تصاویر جلد',
    rsvpTitle: 'آپ کی شرکت', rsvpBy: 'براہ کرم {date} تک جواب دیں', yourName: 'آپ کا نام', yourNamePh: 'پورا نام', email: 'ای میل', emailPh: 'you@example.com', phone: 'فون / واٹس ایپ', phonePh: '+91 98765 43210', contactHint: 'ای میل یا فون، کم از کم ایک',
    attending: 'کیا آپ تشریف لائیں گے؟', select: 'منتخب کریں…', accept: 'خوشی سے آؤں گا/گی', decline: 'معذرت، نہیں آ سکوں گا/گی', guests: 'مہمانوں کی تعداد (آپ سمیت)', meal: 'کھانے کی پسند', message: 'پیغام', messagePh: 'دولہا دلہن کے لیے آپ کی نیک تمنائیں',
    send: 'جواب بھیجیں', sending: 'بھیجا جا رہا ہے…', thanksYes: 'شکریہ! آپ کے ساتھ جشن منانے کا انتظار ہے۔', thanksNo: 'بتانے کا شکریہ۔ آپ کی کمی محسوس ہوگی!', duplicate: 'اس ای میل یا فون سے جواب پہلے ہی آ چکا ہے۔ بدلنے کے لیے دوبارہ دبائیں۔', update: 'میرا جواب بدلیں', rsvpClosed: 'جواب کی مدت ختم ہو گئی ہے۔ براہ کرم خاندان سے براہ راست رابطہ کریں۔',
    errRequired: 'براہ کرم یہ بھریں', errContact: 'براہ کرم ای میل یا فون شامل کریں', errEmail: 'ای میل درست نہیں لگ رہی', errPhone: 'فون نمبر درست نہیں لگ رہا', errGeneric: 'کچھ غلط ہو گیا۔ دوبارہ کوشش کریں۔', errSlow: 'بہت زیادہ کوششیں۔ ایک منٹ بعد کوشش کریں۔',
    withLove: 'محبت کے ساتھ', madeWith: 'PAIGAAM پر محبت سے بنایا گیا', language: 'زبان', musicOn: 'موسیقی چلائیں', musicOff: 'موسیقی بند کریں',
    passTitle: 'یہ دعوت نامہ نجی ہے', passHint: 'خاندان کا دیا ہوا پاس کوڈ درج کریں', passBtn: 'دعوت نامہ کھولیں', passWrong: 'پاس کوڈ درست نہیں۔ دوبارہ کوشش کریں۔',
    ended: 'یہ تقریب اختتام کو پہنچی۔ شرکت کا شکریہ۔', previewBadge: 'پیش نظارہ، ابھی شائع نہیں ہوا',
  };
  S.ar = {
    tapToOpen: 'اضغط للفتح', gettingMarried: 'سنتزوّج', sonOf: 'نجل', daughterOf: 'كريمة', amp: 'و', and: 'و',
    mr_: 'السيد', mrs_: 'السيدة', dr_: 'د.', late_: 'المرحوم',
    scratchTitle: 'اكشط لتكتشف', scratchHint: 'اكشط القلب بإصبعك', foreverBegins: 'هنا يبدأ عمرنا معاً', saveOurDate: 'موعدنا', saveTheDate: 'احفظ الموعد',
    countdownTitle: 'العدّ التنازلي لأجمل يوم', days: 'أيام', hours: 'ساعات', minutes: 'دقائق', seconds: 'ثوانٍ', todayIsTheDay: 'اليوم هو اليوم الموعود!', married: 'تمّ الزفاف، شكراً لدعواتكم',
    timelineTitle: 'برنامج الحفل', venueTitle: 'المكان', receptionVenue: 'مكان الاستقبال', openInMaps: 'افتح في الخرائط', viewOnGoogleMaps: 'اعرض على خرائط جوجل', mapUnavailable: 'تعذّر تحميل الخريطة. استخدم الزر أدناه للاتجاهات.',
    dressTitle: 'قواعد اللباس', women: 'السيدات', men: 'السادة', everyone: 'للجميع', dressFor: 'اللباس',
    preWeddingTitle: 'مناسبات ما قبل الزفاف', transportTitle: 'المواصلات', accommodationTitle: 'الإقامة', bookingCode: 'رمز الحجز', copy: 'نسخ', copied: 'تم النسخ',
    giftsTitle: 'الهدايا', photosTitle: 'لحظاتنا', photosSoon: 'الصور قريباً',
    rsvpTitle: 'تأكيد الحضور', rsvpBy: 'يرجى الرد قبل {date}', yourName: 'اسمك', yourNamePh: 'الاسم الكامل', email: 'البريد الإلكتروني', emailPh: 'you@example.com', phone: 'الهاتف / واتساب', phonePh: '+971 50 123 4567', contactHint: 'البريد أو الهاتف، واحد على الأقل',
    attending: 'هل ستحضر؟', select: 'اختر…', accept: 'سأحضر بكل سرور', decline: 'أعتذر عن الحضور', guests: 'عدد الضيوف (بما فيهم أنت)', meal: 'تفضيل الطعام', message: 'رسالة', messagePh: 'تمنياتك للعروسين',
    send: 'أرسل الرد', sending: 'جارٍ الإرسال…', thanksYes: 'شكراً! نتطلع للاحتفال معك.', thanksNo: 'شكراً لإبلاغنا. سنفتقدك!', duplicate: 'وصلنا رد سابق من هذا البريد أو الهاتف. اضغط مرة أخرى لتحديثه.', update: 'حدّث ردي', rsvpClosed: 'انتهت مهلة الرد. يرجى التواصل مع العائلة مباشرة.',
    errRequired: 'يرجى ملء هذا الحقل', errContact: 'يرجى إضافة البريد أو الهاتف', errEmail: 'البريد الإلكتروني غير صحيح', errPhone: 'رقم الهاتف غير صحيح', errGeneric: 'حدث خطأ ما. حاول مرة أخرى.', errSlow: 'محاولات كثيرة. انتظر دقيقة ثم حاول.',
    withLove: 'مع الحب', madeWith: 'صُنع بحب على PAIGAAM', language: 'اللغة', musicOn: 'شغّل الموسيقى', musicOff: 'أوقف الموسيقى',
    passTitle: 'هذه الدعوة خاصة', passHint: 'أدخل رمز المرور الذي شاركته العائلة', passBtn: 'افتح الدعوة', passWrong: 'رمز المرور غير صحيح. حاول مرة أخرى.',
    ended: 'انتهى هذا الاحتفال. شكراً لكونكم جزءاً منه.', previewBadge: 'معاينة، لم تُنشر بعد',
  };

  /* Event types: default display names per language. */
  const EVENT_TYPES = {
    arrival:    { icon: 'arrival',  en: 'Guest Arrival', hi: 'अतिथि आगमन', mr: 'पाहुण्यांचे आगमन', gu: 'મહેમાનોનું આગમન', ta: 'விருந்தினர் வருகை', te: 'అతిథుల రాక', ur: 'مہمانوں کی آمد', ar: 'وصول الضيوف' },
    engagement: { icon: 'ring',     en: 'Engagement', hi: 'सगाई', mr: 'साखरपुडा', gu: 'સગાઈ', ta: 'நிச்சயதார்த்தம்', te: 'నిశ్చితార్థం', ur: 'منگنی', ar: 'الخطوبة' },
    mehendi:    { icon: 'mehendi',  en: 'Mehendi', hi: 'मेहंदी', mr: 'मेहंदी', gu: 'મહેંદી', ta: 'மெஹந்தி', te: 'మెహందీ', ur: 'مہندی', ar: 'ليلة الحناء' },
    haldi:      { icon: 'haldi',    en: 'Haldi', hi: 'हल्दी', mr: 'हळद', gu: 'પીઠી', ta: 'மஞ்சள் நீராட்டு', te: 'పసుపు', ur: 'ہلدی', ar: 'حفل الهلدي' },
    sangeet:    { icon: 'music',    en: 'Sangeet', hi: 'संगीत', mr: 'संगीत', gu: 'સંગીત સંધ્યા', ta: 'சங்கீத்', te: 'సంగీత్', ur: 'سنگیت', ar: 'السنجيت' },
    baraat:     { icon: 'baraat',   en: 'Baraat', hi: 'बारात', mr: 'वरात', gu: 'જાન', ta: 'மாப்பிள்ளை அழைப்பு', te: 'బారాత్', ur: 'بارات', ar: 'زفّة العريس' },
    varmala:    { icon: 'garland',  en: 'Varmala', hi: 'वरमाला', mr: 'वरमाला', gu: 'વરમાળા', ta: 'மாலை மாற்றுதல்', te: 'వరమాల', ur: 'ورمالا', ar: 'تبادل الأكاليل' },
    pheras:     { icon: 'fire',     en: 'Pheras', hi: 'फेरे', mr: 'सप्तपदी', gu: 'ફેરા', ta: 'சப்தபதி', te: 'సప్తపది', ur: 'پھیرے', ar: 'الطواف السبع' },
    wedding:    { icon: 'rings',    en: 'Wedding Ceremony', hi: 'विवाह समारोह', mr: 'विवाह सोहळा', gu: 'લગ્ન સમારંભ', ta: 'திருமண விழா', te: 'వివాహ వేడుక', ur: 'تقریبِ نکاح', ar: 'حفل الزفاف' },
    reception:  { icon: 'glasses',  en: 'Reception', hi: 'स्वागत समारोह', mr: 'स्वागत समारंभ', gu: 'સ્વાગત સમારંભ', ta: 'வரவேற்பு', te: 'రిసెప్షన్', ur: 'ولیمہ', ar: 'حفل الاستقبال' },
    custom:     { icon: 'sparkle',  en: 'Celebration', hi: 'उत्सव', mr: 'सोहळा', gu: 'ઉજવણી', ta: 'கொண்டாட்டம்', te: 'వేడుక', ur: 'تقریب', ar: 'احتفال' },
  };

  /* Ready-made welcome messages. {groom} and {bride} become first names. */
  const WELCOME = {
    traditional: {
      label: 'Traditional',
      en: 'With the blessings of our elders and the grace of the Almighty, we joyfully invite you to the wedding of {groom} and {bride}. Your presence will make this sacred day complete, as two families come together in love.',
      hi: 'बड़ों के आशीर्वाद और ईश्वर की कृपा से, हम आपको {groom} और {bride} के शुभ विवाह में सादर आमंत्रित करते हैं। जब दो परिवार प्रेम से एक होंगे, उस पावन दिन आपकी उपस्थिति हमारी ख़ुशी को पूर्ण करेगी।',
      mr: 'वडीलधाऱ्यांच्या आशीर्वादाने आणि ईश्वराच्या कृपेने, {groom} आणि {bride} यांच्या शुभविवाहास आपणास सप्रेम निमंत्रण. दोन कुटुंबे प्रेमाने एकत्र येत असताना, आपली उपस्थिती हा मंगल दिवस पूर्ण करेल.',
    },
    modern: {
      label: 'Modern',
      en: "We met, we laughed, and somewhere along the way we found home in each other. Now {groom} and {bride} are saying \"forever\", and we'd love for you to be there when we do.",
      hi: 'हम मिले, हँसे, और न जाने कब एक-दूसरे में अपना घर पा लिया। अब {groom} और {bride} "हमेशा" कहने जा रहे हैं, और हम चाहते हैं कि उस पल आप हमारे साथ हों।',
      mr: 'आम्ही भेटलो, हसलो आणि नकळत एकमेकांत आपले घर सापडले. आता {groom} आणि {bride} "कायमचे" म्हणणार आहेत, आणि त्या क्षणी आपण सोबत असावे अशी आमची इच्छा आहे.',
    },
    short: {
      label: 'Short',
      en: 'Two hearts, one promise. Join us as {groom} and {bride} begin forever.',
      hi: 'दो दिल, एक वादा। {groom} और {bride} के नए सफ़र की शुरुआत में हमारे साथ रहें।',
      mr: 'दोन मने, एक वचन. {groom} आणि {bride} यांच्या नव्या प्रवासाच्या सुरुवातीला आमच्यासोबत असा.',
    },
    religious: {
      label: 'Religious',
      en: 'By the grace of God and with the blessings of our families, {groom} and {bride} will be united in holy matrimony. We humbly request your gracious presence and blessings as they take their sacred vows.',
      hi: 'ईश्वर की असीम कृपा और परिवारों के आशीर्वाद से {groom} और {bride} पवित्र विवाह-बंधन में बँधेंगे। उनके पवित्र वचनों के साक्षी बनने हेतु आपकी उपस्थिति और आशीर्वाद की विनम्र प्रार्थना है।',
      mr: 'ईश्वराच्या अपार कृपेने आणि कुटुंबियांच्या आशीर्वादाने {groom} आणि {bride} पवित्र विवाहबंधनात बद्ध होत आहेत. त्यांच्या पवित्र वचनांचे साक्षी होण्यासाठी आपली उपस्थिती व आशीर्वाद लाभावेत ही नम्र विनंती.',
    },
    funny: {
      label: 'Funny & sweet',
      en: "After years of deciding where to eat, {groom} and {bride} have finally made one decision together: forever! Come for the vows, stay for the food, and please, dance like nobody is filming.",
      hi: 'सालों तक "आज क्या खाएँ" तय करने के बाद, {groom} और {bride} ने आख़िरकार साथ मिलकर एक फ़ैसला कर ही लिया: हमेशा का साथ! वचनों के लिए आइए, दावत के लिए रुकिए, और ऐसे नाचिए जैसे कोई वीडियो नहीं बना रहा।',
      mr: 'वर्षानुवर्षे "आज काय खायचं" ठरवल्यानंतर {groom} आणि {bride} यांनी अखेर एकत्र एक निर्णय घेतला: कायमची साथ! वचनांसाठी या, जेवणासाठी थांबा, आणि कोणी व्हिडिओ काढत नाही अशा थाटात नाचा.',
    },
  };

  function t(lang, key) {
    return (S[lang] && S[lang][key]) || S.en[key] || key;
  }
  function eventTypeName(type, lang) {
    const e = EVENT_TYPES[type] || EVENT_TYPES.custom;
    return e[lang] || e.en;
  }
  function welcomeText(style, lang) {
    const w = WELCOME[style] || WELCOME.traditional;
    return w[lang] || null;
  }
  return { LANGS, STRINGS: S, EVENT_TYPES, WELCOME, t, eventTypeName, welcomeText };
});
