'use strict';

const translations = {
  en: {
    formationCues: [
      { start: 0, end: 0.24, text: 'Every celebration begins\nwith a blessing.' },
      { start: 0.26, end: 0.49, text: 'With every fold,\nBappa takes form.' },
      { start: 0.51, end: 0.74, text: 'May His arrival fill\nour home with joy.' },
      { start: 0.76, end: 1, text: 'Ganpati Bappa Morya!' }
    ],
    journeyCues: [
      { start: 0, end: 0.24, text: 'A little message\nbegins its journey.' },
      { start: 0.26, end: 0.49, text: 'Across every path…' },
      { start: 0.51, end: 0.74, text: 'Carrying love, blessings\nand an invitation.' },
      { start: 0.76, end: 1, text: 'To where Bappa awaits.' }
    ],
    letterArtAlt: 'A letter waiting to begin its journey to Bappa',
    whatsapp: 'Share on WhatsApp', whatsappMessage: 'With love, we invite you to welcome Ganapati Bappa into our home. Join our celebration:',
    venueEyebrow: 'Venue', venueTitle: 'Where we gather, hearts come home.',
    finalBlessing: 'May Bappa bless every home with peace, every heart with hope, and every meeting with love.',
    locale: 'en-IN', title: 'Ganapati Aagman', subtitle: 'A little faith. A home full of love.', invitation: 'An invitation, from our home to yours', welcome: 'Our beloved Bappa is coming home.', enter: 'Enter the celebration', scroll: 'Scroll gently to begin', skip: 'Go to invitation details', sceneOneEyebrow: 'Every beginning holds a blessing', sceneOneTitle: 'From earth, a little wonder.', sceneOneEnd: 'With love, we welcome you.', pauseEyebrow: 'A moment of stillness', pauseTitle: 'Some arrivals fill a home.\nThis one fills the heart.', letterEyebrow: 'For you, with love', letterTitle: 'You are part of our celebration.', letterBody: 'A home is made brighter by the people who gather in it. We have saved a special place for you.', open: 'Open invitation', opened: 'Your invitation is open', journeyEyebrow: 'The wait becomes a welcome', journeyTitle: 'Come home, Bappa.', journeyEnd: 'Let the celebrations begin.', familyDefault: 'Our family', familySuffix: 'warmly invites you', parentsPrefix: 'With love from', familyMembers: 'Together with', messageDefault: 'Join us as we welcome Ganapati Bappa into our home. Let us share the prayers, the laughter, and the joy of being together.', blessing: 'Ganpati Bappa Morya', detailsEyebrow: 'A day to come together', detailsTitle: 'Your presence is our blessing.', when: 'When', datePending: 'Date to be announced', timePending: 'Time to be announced', where: 'Where', venueDefault: 'At our home', addressPending: 'Please contact the family for the address.', directions: 'Find your way', calendar: 'Save the date', share: 'Share invitation', copied: 'Invitation link copied', shareFailed: 'Copy the invitation link from your address bar.', previewNote: 'This is a preview. Generate your invitation to use calendar and sharing.', galleryEyebrow: 'Little moments, lasting memories', galleryTitle: 'From our family album', photoAlt: 'A memory from our family album', closing: 'We look forward to welcoming you.', closingSmall: 'Bring your loved ones. Bring your prayers. Just bring yourself.', madeWith: 'Made with love on', musicOn: 'Pause music', musicOff: 'Play music', musicFailed: 'Music could not start. Tap to try again.', musicLoading: 'Starting music', mediaFallback: 'The film is unavailable. Enjoy the still image or continue to the invitation.', journeyLocked: 'Open the letter above to begin the arrival, or continue to the invitation details.', preview: 'Preview', zone: 'Time zone', and: '&'
  },
  hi: {
    formationCues: [
      { start: 0, end: 0.24, text: 'हर उत्सव की शुरुआत\nएक आशीर्वाद से होती है।' },
      { start: 0.26, end: 0.49, text: 'हर मोड़ के साथ\nबप्पा साकार होते हैं।' },
      { start: 0.51, end: 0.74, text: 'उनका आगमन हमारे घर को\nखुशियों से भर दे।' },
      { start: 0.76, end: 1, text: 'गणपति बप्पा मोरया!' }
    ],
    journeyCues: [
      { start: 0, end: 0.24, text: 'एक छोटा-सा संदेश\nसफ़र पर निकलता है।' },
      { start: 0.26, end: 0.49, text: 'हर राह से गुज़रते हुए…' },
      { start: 0.51, end: 0.74, text: 'प्रेम, आशीर्वाद और\nनिमंत्रण साथ लिए।' },
      { start: 0.76, end: 1, text: 'वहाँ, जहाँ बप्पा\nहमारी राह देखते हैं।' }
    ],
    letterArtAlt: 'बप्पा तक अपना सफ़र शुरू करने की प्रतीक्षा में एक पत्र',
    whatsapp: 'व्हाट्सऐप पर साझा करें', whatsappMessage: 'हमारे घर गणपति बप्पा के स्वागत में आप सप्रेम आमंत्रित हैं। हमारे उत्सव में पधारें:',
    venueEyebrow: 'आयोजन स्थल', venueTitle: 'जहाँ अपने मिलें, वहीं घर है।',
    finalBlessing: 'बप्पा हर घर में शांति, हर मन में आशा और हर मिलन में प्रेम का आशीर्वाद दें।',
    locale: 'hi-IN', title: 'गणपति आगमन', subtitle: 'थोड़ी-सी आस्था। ढेर सारा अपनापन।', invitation: 'हमारे आँगन से आपके लिए एक निमंत्रण', welcome: 'हमारे प्यारे बप्पा घर आ रहे हैं।', enter: 'उत्सव में पधारें', scroll: 'धीरे-धीरे नीचे बढ़ें', skip: 'निमंत्रण का विवरण देखें', sceneOneEyebrow: 'हर शुभारंभ में एक आशीर्वाद', sceneOneTitle: 'माटी से जन्मी एक दिव्य छवि।', sceneOneEnd: 'प्रेम से आपका स्वागत है।', pauseEyebrow: 'सुकून का एक पल', pauseTitle: 'कुछ आगमन घर भर देते हैं।\nयह आगमन मन भर देता है।', letterEyebrow: 'आपके लिए, स्नेह सहित', letterTitle: 'आपसे ही हमारा उत्सव है।', letterBody: 'अपनों के आने से ही घर की रौनक बढ़ती है। आपके लिए हमने एक खास जगह रखी है।', open: 'निमंत्रण खोलें', opened: 'आपका निमंत्रण खुल गया है', journeyEyebrow: 'प्रतीक्षा से स्वागत तक', journeyTitle: 'पधारो बप्पा, हमारे घर।', journeyEnd: 'आइए, मिलकर उत्सव मनाएँ।', familyDefault: 'हमारा परिवार', familySuffix: 'आपको सादर आमंत्रित करता है', parentsPrefix: 'स्नेह सहित', familyMembers: 'साथ में', messageDefault: 'हमारे घर गणपति बप्पा के आगमन पर सपरिवार पधारें। मिलकर प्रार्थना करें, खुशियाँ बाँटें और इन शुभ पलों को यादगार बनाएँ।', blessing: 'गणपति बप्पा मोरया', detailsEyebrow: 'अपनों से मिलने का शुभ दिन', detailsTitle: 'आपकी उपस्थिति ही हमारा आशीर्वाद है।', when: 'कब', datePending: 'तिथि जल्द बताई जाएगी', timePending: 'समय जल्द बताया जाएगा', where: 'कहाँ', venueDefault: 'हमारे घर', addressPending: 'पते के लिए कृपया परिवार से संपर्क करें।', directions: 'रास्ता देखें', calendar: 'कैलेंडर में जोड़ें', share: 'निमंत्रण साझा करें', copied: 'निमंत्रण का लिंक कॉपी हो गया', shareFailed: 'कृपया ब्राउज़र के पता बार से निमंत्रण का लिंक कॉपी करें।', previewNote: 'यह पूर्वावलोकन है। कैलेंडर और साझा करने की सुविधा के लिए अपना निमंत्रण बनाएँ।', galleryEyebrow: 'छोटे-छोटे पल, अनमोल यादें', galleryTitle: 'हमारी पारिवारिक यादें', photoAlt: 'हमारे परिवार की एक प्यारी याद', closing: 'आपके स्वागत की प्रतीक्षा में।', closingSmall: 'अपनों को साथ लाएँ। प्रार्थनाएँ साथ लाएँ। बस, आप ज़रूर आएँ।', madeWith: 'स्नेह से बनाया गया', musicOn: 'संगीत रोकें', musicOff: 'संगीत चलाएँ', musicFailed: 'संगीत नहीं चल सका। फिर से कोशिश करने के लिए दबाएँ।', musicLoading: 'संगीत शुरू हो रहा है', mediaFallback: 'फ़िल्म उपलब्ध नहीं है। स्थिर चित्र देखें या निमंत्रण पर आगे बढ़ें।', journeyLocked: 'आगमन देखने के लिए ऊपर का पत्र खोलें, या निमंत्रण का विवरण देखें।', preview: 'पूर्वावलोकन', zone: 'समय क्षेत्र', and: 'और'
  },
  mr: {
    formationCues: [
      { start: 0, end: 0.24, text: 'प्रत्येक उत्सवाची सुरुवात\nआशीर्वादाने होते.' },
      { start: 0.26, end: 0.49, text: 'प्रत्येक घडीसोबत\nबाप्पा आकार घेतात.' },
      { start: 0.51, end: 0.74, text: 'त्यांच्या आगमनाने\nआपले घर आनंदाने भरून जावो.' },
      { start: 0.76, end: 1, text: 'गणपती बाप्पा मोरया!' }
    ],
    journeyCues: [
      { start: 0, end: 0.24, text: 'एक छोटासा संदेश\nप्रवासाला निघतो.' },
      { start: 0.26, end: 0.49, text: 'प्रत्येक वाटेवरून…' },
      { start: 0.51, end: 0.74, text: 'प्रेम, आशीर्वाद आणि\nनिमंत्रण सोबत घेऊन.' },
      { start: 0.76, end: 1, text: 'जिथे बाप्पा\nआपली वाट पाहत आहेत.' }
    ],
    letterArtAlt: 'बाप्पांपर्यंतचा प्रवास सुरू होण्याची वाट पाहणारे पत्र',
    whatsapp: 'व्हॉट्सॲपवर पाठवा', whatsappMessage: 'आमच्या घरी गणपती बाप्पांच्या स्वागतासाठी आपणांस सप्रेम निमंत्रण. आमच्या उत्सवात सहभागी व्हा:',
    venueEyebrow: 'समारंभाचे ठिकाण', venueTitle: 'आपली माणसे भेटतात, तिथेच घर असते.',
    finalBlessing: 'बाप्पा प्रत्येक घराला शांती, प्रत्येक मनाला आशा आणि प्रत्येक भेटीला प्रेमाचा आशीर्वाद देवोत.',
    locale: 'mr-IN', title: 'गणपती आगमन', subtitle: 'थोडीशी श्रद्धा. भरभरून आपुलकी.', invitation: 'आमच्या घरातून, आपल्यासाठी प्रेमाचे निमंत्रण', welcome: 'आपले लाडके बाप्पा घरी येत आहेत.', enter: 'उत्सवात सहभागी व्हा', scroll: 'हळूहळू खाली सरका', skip: 'निमंत्रणाचा तपशील पाहा', sceneOneEyebrow: 'प्रत्येक शुभारंभाला आशीर्वादाची साथ', sceneOneTitle: 'मातीतून साकारलेले दिव्य रूप.', sceneOneEnd: 'प्रेमाने आपले स्वागत आहे.', pauseEyebrow: 'एक निवांत क्षण', pauseTitle: 'काही आगमनांनी घर भरते.\nया आगमनाने मन भरते.', letterEyebrow: 'आपल्यासाठी, सप्रेम', letterTitle: 'आपल्यामुळेच आमचा उत्सव पूर्ण होतो.', letterBody: 'आपली माणसे एकत्र आली की घर उजळून निघते. आपल्यासाठी एक खास जागा राखून ठेवली आहे.', open: 'निमंत्रण उघडा', opened: 'आपले निमंत्रण उघडले आहे', journeyEyebrow: 'प्रतीक्षेतून स्वागताकडे', journeyTitle: 'या बाप्पा, आमच्या घरी.', journeyEnd: 'चला, आनंदोत्सव साजरा करूया.', familyDefault: 'आमचे कुटुंब', familySuffix: 'आपणांस सस्नेह आमंत्रित करीत आहे', parentsPrefix: 'सप्रेम', familyMembers: 'यांच्यासह', messageDefault: 'आमच्या घरी गणपती बाप्पांच्या आगमनानिमित्त सहकुटुंब अवश्य या. एकत्र प्रार्थना करूया, आनंद वाटूया आणि हे मंगल क्षण अविस्मरणीय बनवूया.', blessing: 'गणपती बाप्पा मोरया', detailsEyebrow: 'आप्तस्वकीयांच्या भेटीचा मंगल दिवस', detailsTitle: 'आपली उपस्थिती हाच आमचा आशीर्वाद.', when: 'कधी', datePending: 'तारीख लवकरच कळवली जाईल', timePending: 'वेळ लवकरच कळवली जाईल', where: 'कुठे', venueDefault: 'आमच्या घरी', addressPending: 'पत्त्यासाठी कृपया कुटुंबाशी संपर्क साधा.', directions: 'मार्ग पाहा', calendar: 'दिनदर्शिकेत नोंदवा', share: 'निमंत्रण पाठवा', copied: 'निमंत्रणाची लिंक कॉपी झाली', shareFailed: 'कृपया ब्राउझरच्या पत्ता पट्टीतून निमंत्रणाची लिंक कॉपी करा.', previewNote: 'हे पूर्वावलोकन आहे. दिनदर्शिका आणि निमंत्रण पाठवण्याची सुविधा वापरण्यासाठी आपले निमंत्रण तयार करा.', galleryEyebrow: 'छोटे क्षण, अनमोल आठवणी', galleryTitle: 'आमच्या कुटुंबाच्या आठवणी', photoAlt: 'आमच्या कुटुंबाची एक गोड आठवण', closing: 'आपल्या स्वागतासाठी आम्ही आतुर आहोत.', closingSmall: 'आपल्या माणसांना सोबत आणा. प्रार्थना सोबत आणा. आपण नक्की या.', madeWith: 'प्रेमाने साकारले', musicOn: 'संगीत थांबवा', musicOff: 'संगीत सुरू करा', musicFailed: 'संगीत सुरू झाले नाही. पुन्हा प्रयत्न करण्यासाठी दाबा.', musicLoading: 'संगीत सुरू होत आहे', mediaFallback: 'चित्रफीत उपलब्ध नाही. स्थिर चित्र पाहा किंवा निमंत्रणाकडे पुढे जा.', journeyLocked: 'आगमन पाहण्यासाठी वरचे पत्र उघडा, किंवा निमंत्रणाचा तपशील पाहा.', preview: 'पूर्वावलोकन', zone: 'वेळ क्षेत्र', and: 'आणि'
  }
};

module.exports = translations;
