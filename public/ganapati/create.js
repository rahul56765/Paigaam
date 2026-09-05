/* Customer-only Ganapati wizard. Draft ownership is authenticated by same-origin cookies. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const I18N = {
    en: {
      title:'Ganapati Aagman · Paigaam', language:'Language', eyebrow:'A welcome, made personal', heading:'Bring Bappa home.', intro:'An invitation full of devotion, a little joy, and the people you love.', yourInvitation:'Your invitation', asideNote:'Thoughtfully made for your family. Your invitation comes to life in the final preview.', design:'Design', family:'Family', event:'Celebration', photos:'Photographs', preview:'Preview & create', designTitle:'A beautiful beginning.', designBody:'Welcome loved ones to your Ganapati Aagman with a celebration that feels like you.', templateName:'Ganapati Aagman', designHint:'Add your words and photographs. You can open the real, interactive invitation before creating its shareable link.', artCaption:'A glimpse of your invitation design', imageAlt:'Ganapati Aagman invitation design', languageTitle:'In words close to home.', languageBody:'Choose the language for your invitation and this form.', languageHint:'Switch languages at any time. Your names, message and event details stay exactly as you entered them.', familyTitle:'From your family, with love.', familyBody:'The names and words that make this welcome yours.', requiredHint:'Fields marked * are required. Everything else is optional.', familyName:'Family name', fatherName:'Father’s name (optional)', motherName:'Mother’s name (optional)', familyMembers:'Family members (optional)', customMessage:'Your message (optional)', messageHint:'Names: up to 120 characters each. Family members: 600. Your message: 2,000.', eventTitle:'Make room for a celebration.', eventBody:'Let your guests know when and where to join you.', year:'Celebration year', eventDate:'Event date', eventTime:'Event time', venueName:'Venue name', address:'Full address', source:'Check festival dates · Drik Panchang ↗', knownDate:'A verified Ganesh Chaturthi date is suggested for this year. Your event date is editable. Changing the year resets the suggestion.', unknownDate:'No verified festival date is stored for this year. Please enter your event date manually. Changing the year resets the date.', timezone:'All times are India Standard Time (Asia/Kolkata). 11:00 is an editable starting time, not a muhurat recommendation.', photosTitle:'Little glimpses of your world.', photosBody:'Add your family, Bappa, or a cherished moment. Photographs are optional.', choosePhotos:'Choose photographs', photoHint:'JPEG, PNG or WebP · up to 8 MB each · maximum 10 photographs', uploadNote:'Images are resized on your device. Uploads begin only when you save a valid draft in the final step.', photoCount:'{n} of 10 photographs', alt:'Description for photograph {n}', remove:'Remove', retry:'Retry upload', pending:'Ready to upload', uploaded:'Uploaded', uploadingPhoto:'Uploading photograph {n} of {total}…', photoFailed:'Upload failed. Your photograph is still here; retry when ready.', photoAlt:'Selected photograph {n}', previewTitle:'One last look. Then, invite.', previewBody:'Save your details and open your actual invitation. Explore it just as your guests will.', previewHint:'This is the real invitation, not a mockup. Tap through its moments, try the sound, and check your details.', savePreview:'Save & open invitation preview', previewUnsaved:'Save and open your preview before generating a link.', previewReady:'Preview viewed. Your saved invitation is ready to generate.', previewChanged:'Details changed. Save and open a fresh preview before generating.', generate:'Generate invitation link', publishHint:'A shareable link is created only after you have opened the saved preview.', back:'Back', continue:'Continue', step:'Step {n} of 6', saving:'Saving your invitation…', processing:'Preparing your photographs…', publishing:'Creating your invitation link…', readyEyebrow:'Let the celebrations begin', readyTitle:'Your invitation is ready.', readyBody:'A little piece of your celebration, ready to send to everyone you love.', invitationLink:'Your invitation link', openInvitation:'Open invitation', copyLink:'Copy link', whatsapp:'Share on WhatsApp', shareMessage:'Please join us for our Ganapati Aagman celebration.', copied:'Invitation link copied.', copyFailed:'Copy is unavailable. Select and copy the link above.', footer:'Made with care. Sent with Paigaam.', yourPreview:'Your invitation preview', fullscreen:'Full screen', exitFullscreen:'Exit full screen', closePreview:'Close preview', previewInteraction:'Tap inside to explore. Sound, if enabled, stops when this preview closes.', loadingPreview:'Opening your saved invitation…', previewLoadFailed:'The preview could not open. Close it and try again.', validation:'Please check the required fields and their limits.', required:'Please fill in “{field}”.', invalid:'Please enter a valid value for “{field}”.', tooLong:'“{field}” is too long. Please shorten it.', invalidYear:'Choose a whole year from 2026 to 2100.', yearDate:'Choose an event date within the selected year.', too_large:'This image is too large. Choose an original under 8 MB; prepared uploads must be under 2 MB.', invalid_image:'Choose a readable JPEG, PNG or WebP image.', limit:'You can add up to 10 photographs. Remove one to add another.', forbidden:'This draft is not accessible in this browser. Keep your details here and try again in the browser that created it.', not_found:'This draft could not be found. Your details are still in this form.', storage_unavailable:'Photo storage is temporarily unavailable. Your details are safe in this form; try again shortly.', network:'Could not connect. Your details are still here. Please try again.', generic:'Something went wrong. Your details are still here. Please try again.', previewFirst:'Please save and open your current invitation preview first.', noPhotos:'No photographs', countSummary:'{n} photographs', saved:'Your details are saved.', optionalEmpty:'Not added', selectedLanguage:'Invitation language', progressLabel:'Invitation creation progress'
    },
    hi: {
      title:'गणपति आगमन · पैगाम', language:'भाषा', eyebrow:'अपनों के लिए, प्यार भरा बुलावा', heading:'बप्पा का स्वागत करें।', intro:'भक्ति, खुशियों और अपनों के साथ का एक सुंदर निमंत्रण।', yourInvitation:'आपका निमंत्रण', asideNote:'आपके परिवार के लिए प्यार से बनाया गया। अंतिम पूर्वावलोकन में अपना पूरा निमंत्रण देखें।', design:'डिज़ाइन', family:'परिवार', event:'समारोह', photos:'तस्वीरें', preview:'देखें और बनाएँ', designTitle:'एक सुंदर शुरुआत।', designBody:'गणपति आगमन पर अपनों को बुलाएँ, अपने अंदाज़ में।', templateName:'गणपति आगमन', designHint:'अपने शब्द और तस्वीरें जोड़ें। साझा करने का लिंक बनाने से पहले असली निमंत्रण खोलकर देख सकते हैं।', artCaption:'आपके निमंत्रण के डिज़ाइन की एक झलक', imageAlt:'गणपति आगमन निमंत्रण का डिज़ाइन', languageTitle:'अपनी भाषा में, दिल से।', languageBody:'अपने निमंत्रण और इस फ़ॉर्म की भाषा चुनें।', languageHint:'भाषा कभी भी बदलें। नाम, संदेश और समारोह की जानकारी वैसे ही रहेंगे जैसे आपने लिखे हैं।', familyTitle:'आपके परिवार की ओर से, सप्रेम।', familyBody:'वे नाम और शब्द जो इस बुलावे को आपका बनाते हैं।', requiredHint:'* वाले खाने भरना ज़रूरी है। बाकी जानकारी वैकल्पिक है।', familyName:'परिवार का नाम', fatherName:'पिता का नाम (वैकल्पिक)', motherName:'माता का नाम (वैकल्पिक)', familyMembers:'परिवार के सदस्य (वैकल्पिक)', customMessage:'आपका संदेश (वैकल्पिक)', messageHint:'हर नाम: अधिकतम 120 अक्षर। परिवार के सदस्य: 600। संदेश: 2,000।', eventTitle:'उत्सव की तैयारी करें।', eventBody:'मेहमानों को बताएँ कि कब और कहाँ आना है।', year:'समारोह का वर्ष', eventDate:'समारोह की तारीख', eventTime:'समारोह का समय', venueName:'स्थान का नाम', address:'पूरा पता', source:'त्योहार की तारीख देखें · दृक पंचांग ↗', knownDate:'इस वर्ष की सत्यापित गणेश चतुर्थी की तारीख सुझाई गई है। आप इसे बदल सकते हैं। वर्ष बदलने पर तारीख फिर से सुझाई जाएगी।', unknownDate:'इस वर्ष की सत्यापित त्योहार तिथि उपलब्ध नहीं है। कृपया अपने समारोह की तारीख भरें। वर्ष बदलने पर तारीख रीसेट होगी।', timezone:'सभी समय भारतीय मानक समय (Asia/Kolkata) में हैं। 11:00 केवल बदलने योग्य शुरुआती समय है, शुभ मुहूर्त का सुझाव नहीं।', photosTitle:'आपकी दुनिया की छोटी झलकियाँ।', photosBody:'परिवार, बप्पा या किसी प्यारी याद की तस्वीर जोड़ें। तस्वीरें वैकल्पिक हैं।', choosePhotos:'तस्वीरें चुनें', photoHint:'JPEG, PNG या WebP · हर तस्वीर अधिकतम 8 MB · कुल 10 तस्वीरें', uploadNote:'तस्वीरों का आकार आपके डिवाइस पर घटाया जाता है। अंतिम चरण में सही जानकारी वाला ड्राफ़्ट सहेजने के बाद ही अपलोड होगा।', photoCount:'10 में से {n} तस्वीरें', alt:'तस्वीर {n} का विवरण', remove:'हटाएँ', retry:'फिर अपलोड करें', pending:'अपलोड के लिए तैयार', uploaded:'अपलोड हो गया', uploadingPhoto:'{total} में से तस्वीर {n} अपलोड हो रही है…', photoFailed:'अपलोड नहीं हुआ। तस्वीर यहीं है; तैयार होने पर फिर कोशिश करें।', photoAlt:'चुनी गई तस्वीर {n}', previewTitle:'एक बार देखें, फिर बुलावा भेजें।', previewBody:'जानकारी सहेजें और अपना असली निमंत्रण खोलें। इसे मेहमानों की तरह पूरा देखें।', previewHint:'यह असली निमंत्रण है, नमूना नहीं। इसके हिस्सों पर टैप करें, आवाज़ आज़माएँ और अपनी जानकारी जाँचें।', savePreview:'सहेजें और निमंत्रण का पूर्वावलोकन खोलें', previewUnsaved:'लिंक बनाने से पहले सहेजें और पूर्वावलोकन खोलें।', previewReady:'पूर्वावलोकन देख लिया। सहेजा हुआ निमंत्रण लिंक बनाने के लिए तैयार है।', previewChanged:'जानकारी बदली है। लिंक बनाने से पहले सहेजें और नया पूर्वावलोकन खोलें।', generate:'निमंत्रण का लिंक बनाएँ', publishHint:'सहेजा हुआ पूर्वावलोकन खोलने के बाद ही साझा करने का लिंक बनेगा।', back:'पीछे', continue:'आगे बढ़ें', step:'6 में से चरण {n}', saving:'आपका निमंत्रण सहेज रहे हैं…', processing:'आपकी तस्वीरें तैयार कर रहे हैं…', publishing:'निमंत्रण का लिंक बना रहे हैं…', readyEyebrow:'खुशियों की शुरुआत', readyTitle:'आपका निमंत्रण तैयार है।', readyBody:'आपके उत्सव का एक प्यारा हिस्सा, अब अपनों को भेजने के लिए तैयार।', invitationLink:'आपके निमंत्रण का लिंक', openInvitation:'निमंत्रण खोलें', copyLink:'लिंक कॉपी करें', whatsapp:'व्हाट्सऐप पर भेजें', shareMessage:'हमारे गणपति आगमन समारोह में सादर आमंत्रित हैं।', copied:'निमंत्रण का लिंक कॉपी हो गया।', copyFailed:'कॉपी नहीं हो सका। ऊपर का लिंक चुनकर कॉपी करें।', footer:'प्यार से बनाया। पैगाम के साथ भेजा।', yourPreview:'आपके निमंत्रण का पूर्वावलोकन', fullscreen:'पूरा पर्दा', exitFullscreen:'सामान्य आकार', closePreview:'पूर्वावलोकन बंद करें', previewInteraction:'निमंत्रण देखने के लिए अंदर टैप करें। बंद करने पर आवाज़ भी बंद हो जाएगी।', loadingPreview:'सहेजा हुआ निमंत्रण खोल रहे हैं…', previewLoadFailed:'पूर्वावलोकन नहीं खुला। इसे बंद करके फिर कोशिश करें।', validation:'कृपया ज़रूरी जानकारी और अक्षर सीमाएँ जाँचें।', required:'कृपया “{field}” भरें।', invalid:'कृपया “{field}” में सही जानकारी भरें।', tooLong:'“{field}” बहुत लंबा है। कृपया छोटा करें।', invalidYear:'2026 से 2100 के बीच पूरा वर्ष चुनें।', yearDate:'चुने हुए वर्ष के भीतर समारोह की तारीख चुनें।', too_large:'तस्वीर बहुत बड़ी है। मूल तस्वीर 8 MB से कम और तैयार अपलोड 2 MB से कम होना चाहिए।', invalid_image:'खुल सकने वाली JPEG, PNG या WebP तस्वीर चुनें।', limit:'अधिकतम 10 तस्वीरें जोड़ सकते हैं। नई तस्वीर के लिए एक हटाएँ।', forbidden:'यह ड्राफ़्ट इस ब्राउज़र में उपलब्ध नहीं है। जानकारी यहीं रखें और इसे बनाने वाले ब्राउज़र में कोशिश करें।', not_found:'यह ड्राफ़्ट नहीं मिला। आपकी जानकारी अभी भी इस फ़ॉर्म में है।', storage_unavailable:'तस्वीरें सहेजने की सुविधा अभी उपलब्ध नहीं है। जानकारी फ़ॉर्म में सुरक्षित है; थोड़ी देर बाद कोशिश करें।', network:'कनेक्शन नहीं हुआ। आपकी जानकारी यहीं है। फिर कोशिश करें।', generic:'कुछ गड़बड़ हुई। आपकी जानकारी यहीं है। फिर कोशिश करें।', previewFirst:'पहले मौजूदा जानकारी सहेजें और निमंत्रण का पूर्वावलोकन खोलें।', noPhotos:'कोई तस्वीर नहीं', countSummary:'{n} तस्वीरें', saved:'आपकी जानकारी सहेज ली गई है।', optionalEmpty:'नहीं जोड़ा', selectedLanguage:'निमंत्रण की भाषा', progressLabel:'निमंत्रण बनाने की प्रगति'
    },
    mr: {
      title:'गणपती आगमन · पैगाम', language:'भाषा', eyebrow:'आपुलकीचे, आपल्या माणसांना आमंत्रण', heading:'बाप्पांचे स्वागत करूया.', intro:'भक्ती, आनंद आणि आपल्या माणसांच्या सोबतीने सजलेले सुंदर निमंत्रण.', yourInvitation:'तुमचे निमंत्रण', asideNote:'तुमच्या कुटुंबासाठी प्रेमाने तयार केलेले. शेवटच्या पूर्वावलोकनात संपूर्ण निमंत्रण पाहा.', design:'रचना', family:'कुटुंब', event:'सोहळा', photos:'छायाचित्रे', preview:'पाहा व तयार करा', designTitle:'एक सुंदर सुरुवात.', designBody:'गणपती आगमनासाठी आपल्या माणसांना आपल्या पद्धतीने निमंत्रित करा.', templateName:'गणपती आगमन', designHint:'तुमचे शब्द आणि छायाचित्रे जोडा. शेअर करण्याची लिंक तयार करण्यापूर्वी प्रत्यक्ष निमंत्रण उघडून पाहता येईल.', artCaption:'तुमच्या निमंत्रणाच्या रचनेची एक झलक', imageAlt:'गणपती आगमन निमंत्रणाची रचना', languageTitle:'आपल्या भाषेत, मनापासून.', languageBody:'निमंत्रण आणि या फॉर्मसाठी भाषा निवडा.', languageHint:'भाषा कधीही बदला. नावे, संदेश आणि सोहळ्याचा तपशील तुम्ही लिहिल्याप्रमाणेच राहतील.', familyTitle:'तुमच्या कुटुंबाकडून, सप्रेम.', familyBody:'या आमंत्रणाला आपलेपणा देणारी नावे आणि शब्द.', requiredHint:'* असलेले तपशील आवश्यक आहेत. बाकीचे तपशील ऐच्छिक आहेत.', familyName:'कुटुंबाचे नाव', fatherName:'वडिलांचे नाव (ऐच्छिक)', motherName:'आईचे नाव (ऐच्छिक)', familyMembers:'कुटुंबातील सदस्य (ऐच्छिक)', customMessage:'तुमचा संदेश (ऐच्छिक)', messageHint:'प्रत्येक नाव: कमाल 120 अक्षरे. कुटुंबातील सदस्य: 600. संदेश: 2,000.', eventTitle:'सोहळ्याची तयारी करूया.', eventBody:'पाहुण्यांना कधी आणि कुठे यायचे ते सांगा.', year:'सोहळ्याचे वर्ष', eventDate:'सोहळ्याची तारीख', eventTime:'सोहळ्याची वेळ', venueName:'स्थळाचे नाव', address:'संपूर्ण पत्ता', source:'सणाच्या तारखा पाहा · दृक पंचांग ↗', knownDate:'या वर्षाची पडताळलेली गणेश चतुर्थीची तारीख सुचवली आहे. ती बदलता येते. वर्ष बदलल्यावर तारीख पुन्हा सुचवली जाईल.', unknownDate:'या वर्षाची पडताळलेली सणाची तारीख उपलब्ध नाही. कृपया सोहळ्याची तारीख स्वतः भरा. वर्ष बदलल्यावर तारीख रीसेट होईल.', timezone:'सर्व वेळा भारतीय प्रमाणवेळेनुसार (Asia/Kolkata) आहेत. 11:00 ही बदलता येणारी सुरुवातीची वेळ आहे, शुभ मुहूर्ताची शिफारस नाही.', photosTitle:'तुमच्या जगाची छोटीशी झलक.', photosBody:'कुटुंबाचे, बाप्पांचे किंवा एखाद्या गोड आठवणीचे छायाचित्र जोडा. छायाचित्रे ऐच्छिक आहेत.', choosePhotos:'छायाचित्रे निवडा', photoHint:'JPEG, PNG किंवा WebP · प्रत्येकी कमाल 8 MB · एकूण 10 छायाचित्रे', uploadNote:'छायाचित्रांचा आकार तुमच्या डिव्हाइसवर कमी केला जातो. शेवटच्या टप्प्यात योग्य तपशीलांचा मसुदा जतन केल्यानंतरच अपलोड होईल.', photoCount:'10 पैकी {n} छायाचित्रे', alt:'छायाचित्र {n} चे वर्णन', remove:'काढा', retry:'पुन्हा अपलोड करा', pending:'अपलोडसाठी तयार', uploaded:'अपलोड झाले', uploadingPhoto:'{total} पैकी छायाचित्र {n} अपलोड होत आहे…', photoFailed:'अपलोड झाले नाही. छायाचित्र इथेच आहे; तयार झाल्यावर पुन्हा प्रयत्न करा.', photoAlt:'निवडलेले छायाचित्र {n}', previewTitle:'एकदा पाहा. मग आमंत्रण पाठवा.', previewBody:'तपशील जतन करा आणि प्रत्यक्ष निमंत्रण उघडा. पाहुण्यांसारखे त्याचा संपूर्ण अनुभव घ्या.', previewHint:'हे प्रत्यक्ष निमंत्रण आहे, नमुना नाही. त्यातील भागांवर टॅप करा, आवाज ऐकून पाहा आणि तपशील तपासा.', savePreview:'जतन करा व निमंत्रणाचे पूर्वावलोकन उघडा', previewUnsaved:'लिंक तयार करण्यापूर्वी जतन करा व पूर्वावलोकन उघडा.', previewReady:'पूर्वावलोकन पाहिले. जतन केलेल्या निमंत्रणाची लिंक तयार करता येईल.', previewChanged:'तपशील बदलले आहेत. लिंक तयार करण्यापूर्वी जतन करा व नवीन पूर्वावलोकन उघडा.', generate:'निमंत्रणाची लिंक तयार करा', publishHint:'जतन केलेले पूर्वावलोकन उघडल्यानंतरच शेअर करण्याची लिंक तयार होईल.', back:'मागे', continue:'पुढे', step:'6 पैकी टप्पा {n}', saving:'तुमचे निमंत्रण जतन करत आहोत…', processing:'तुमची छायाचित्रे तयार करत आहोत…', publishing:'निमंत्रणाची लिंक तयार करत आहोत…', readyEyebrow:'आनंदाची सुरुवात होऊ द्या', readyTitle:'तुमचे निमंत्रण तयार आहे.', readyBody:'तुमच्या सोहळ्याचा एक सुंदर भाग, आता आपल्या माणसांना पाठवण्यासाठी तयार.', invitationLink:'तुमच्या निमंत्रणाची लिंक', openInvitation:'निमंत्रण उघडा', copyLink:'लिंक कॉपी करा', whatsapp:'व्हॉट्सॲपवर पाठवा', shareMessage:'आमच्या गणपती आगमन सोहळ्यासाठी आपण सस्नेह आमंत्रित आहात.', copied:'निमंत्रणाची लिंक कॉपी झाली.', copyFailed:'कॉपी करता आले नाही. वरील लिंक निवडून कॉपी करा.', footer:'प्रेमाने तयार केलेले. पैगामसोबत पाठवलेले.', yourPreview:'तुमच्या निमंत्रणाचे पूर्वावलोकन', fullscreen:'पूर्ण स्क्रीन', exitFullscreen:'नेहमीचा आकार', closePreview:'पूर्वावलोकन बंद करा', previewInteraction:'निमंत्रण पाहण्यासाठी आत टॅप करा. पूर्वावलोकन बंद केल्यावर आवाजही थांबेल.', loadingPreview:'जतन केलेले निमंत्रण उघडत आहोत…', previewLoadFailed:'पूर्वावलोकन उघडले नाही. बंद करून पुन्हा प्रयत्न करा.', validation:'कृपया आवश्यक तपशील आणि अक्षरमर्यादा तपासा.', required:'कृपया “{field}” भरा.', invalid:'कृपया “{field}” योग्य प्रकारे भरा.', tooLong:'“{field}” खूप मोठे आहे. कृपया थोडक्यात लिहा.', invalidYear:'2026 ते 2100 दरम्यानचे पूर्ण वर्ष निवडा.', yearDate:'निवडलेल्या वर्षातील सोहळ्याची तारीख निवडा.', too_large:'छायाचित्र खूप मोठे आहे. मूळ छायाचित्र 8 MB पेक्षा कमी आणि तयार अपलोड 2 MB पेक्षा कमी असावा.', invalid_image:'वाचता येणारे JPEG, PNG किंवा WebP छायाचित्र निवडा.', limit:'कमाल 10 छायाचित्रे जोडता येतील. नवीन जोडण्यासाठी एक काढा.', forbidden:'हा मसुदा या ब्राउझरमध्ये उपलब्ध नाही. तपशील इथेच ठेवा आणि मसुदा तयार केलेल्या ब्राउझरमध्ये प्रयत्न करा.', not_found:'हा मसुदा सापडला नाही. तुमचे तपशील अजूनही या फॉर्ममध्ये आहेत.', storage_unavailable:'छायाचित्रे जतन करण्याची सुविधा सध्या उपलब्ध नाही. तपशील फॉर्ममध्ये सुरक्षित आहेत; थोड्या वेळाने प्रयत्न करा.', network:'संपर्क होऊ शकला नाही. तुमचे तपशील इथेच आहेत. पुन्हा प्रयत्न करा.', generic:'काहीतरी चुकले. तुमचे तपशील इथेच आहेत. पुन्हा प्रयत्न करा.', previewFirst:'आधी सध्याचे तपशील जतन करा आणि निमंत्रणाचे पूर्वावलोकन उघडा.', noPhotos:'छायाचित्रे नाहीत', countSummary:'{n} छायाचित्रे', saved:'तुमचे तपशील जतन झाले.', optionalEmpty:'जोडले नाही', selectedLanguage:'निमंत्रणाची भाषा', progressLabel:'निमंत्रण तयार करण्याची प्रगती'
    }
  };
  const defaults = {2026:'2026-09-14',2027:'2027-09-04',2028:'2028-08-23'};
  const fieldNames = ['familyName','fatherName','motherName','familyMembers','customMessage','eventDate','eventTime','venueName','address'];
  const state = {language:'en',step:0,id:null,previewUrl:null,photos:[],revision:0,savedRevision:-1,viewedRevision:-1,busy:false,published:false,resultUrl:null,error:null,status:null,shareStatus:null,modalStatus:null,year:'2026',expanded:false};
  let photoSequence = 0, previewTimer = null, returnFocus = null;
  const t = (key, vars = {}) => (I18N[state.language][key] || I18N[state.language].generic).replace(/\{(\w+)\}/g, (_, name) => name==='field' && vars.fieldKey ? I18N[state.language][vars.fieldKey] : vars[name] == null ? '' : String(vars[name]));
  const message = (target, value) => { $(target).textContent = value ? t(value.key, value.vars) : ''; };
  function error(key, vars) { state.error = {key:I18N.en[key] ? key : 'generic',vars}; message('formError',state.error); $('formError').hidden=false; }
  function clearError() { state.error=null; $('formError').hidden=true; $('formError').textContent=''; }
  function status(key,vars) { state.status=key?{key,vars}:null; message('status',state.status); }
  function modalStatus(key) { state.modalStatus=key?{key}:null; message('modalStatus',state.modalStatus); }
  function markDirty() { state.revision++; state.viewedRevision=-1; updatePreviewState(); }
  function canPublish() { return !!state.id && state.savedRevision===state.revision && state.viewedRevision===state.revision && !state.busy && !state.published; }
  function updatePreviewState() {
    $('previewState').textContent=t(state.viewedRevision===state.revision?'previewReady':state.savedRevision<0?'previewUnsaved':'previewChanged');
    $('publish').disabled=!canPublish();
  }
  function updateControls() {
    document.querySelectorAll('#ganapatiForm input,#ganapatiForm textarea,#ganapatiForm button,#language,[data-language]').forEach(el => { el.disabled=state.busy||state.published; });
    $('back').hidden=state.step===0; $('next').hidden=state.step===5;
    $('photoFiles').disabled=state.busy||state.photos.length>=10||state.published;
    const choose=$('choosePhotos'); if(choose) choose.disabled=$('photoFiles').disabled;
    $('ganapatiForm').setAttribute('aria-busy',String(state.busy));
    updatePreviewState();
  }
  function setBusy(value) { state.busy=value; updateControls(); }
  function showStep(index, focus=true) {
    state.step=index;
    document.querySelectorAll('[data-step]').forEach(el=>{ el.hidden=Number(el.dataset.step)!==index; });
    document.querySelectorAll('[data-progress]').forEach(el=>{ const n=Number(el.dataset.progress); el.classList.toggle('done',n<index); if(n===index) el.setAttribute('aria-current','step'); else el.removeAttribute('aria-current'); });
    $('stepCounter').textContent=t('step',{n:index+1}); updateControls(); if(index===5) renderReview();
    if(focus) { const h=document.querySelector(`[data-step="${index}"] h2`); h.focus({preventScroll:true}); h.scrollIntoView({block:'start',behavior:'instant'}); }
  }
  function localize() {
    document.documentElement.lang=state.language; document.title=t('title');
    document.querySelectorAll('[data-i18n]').forEach(el=>{ el.textContent=t(el.dataset.i18n); });
    $('language').value=state.language; $('languageCards').setAttribute('aria-label',t('selectedLanguage')); $('progress').setAttribute('aria-label',t('progressLabel'));
    document.querySelectorAll('[data-language]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.language===state.language)));
    $('templateImage').alt=t('imageAlt'); $('photoFiles').setAttribute('aria-label',t('choosePhotos'));
    $('dateHint').textContent=t(defaults[state.year]?'knownDate':'unknownDate');
    $('fullscreen').textContent=t(state.expanded?'exitFullscreen':'fullscreen');
    const iframe=$('frameHost').querySelector('iframe'); if(iframe) iframe.title=t('yourPreview');
    message('formError',state.error); message('status',state.status); message('modalStatus',state.modalStatus); message('shareStatus',state.shareStatus);
    renderPhotos(); showStep(state.step,false); if(state.resultUrl) updateShareLinks();
  }
  function setLanguage(language) { if(state.busy||!I18N[language]) return; if(language!==state.language){state.language=language;if(!state.published)markDirty();}localize(); }
  function renderReview() {
    const items=[['familyName',$('familyName').value],['eventDate',$('eventDate').value],['eventTime',`${$('eventTime').value} · Asia/Kolkata`],['venueName',$('venueName').value],['address',$('address').value],['photos',t(state.photos.length?'countSummary':'noPhotos',{n:state.photos.length})]];
    $('review').replaceChildren(); items.forEach(([key,value])=>{const dl=document.createElement('dl'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=t(key);dd.textContent=value||t('optionalEmpty');dl.append(dt,dd);$('review').append(dl);});
  }
  function validateStep(index) {
    const fields=[...document.querySelectorAll(`[data-step="${index}"] input:not([type=file]),[data-step="${index}"] textarea`)];
    for(const field of fields){
      field.removeAttribute('aria-invalid'); field.removeAttribute('aria-describedby');
      let key=null; const label=field.id==='festivalYear'?'year':fieldNames.includes(field.id)?field.id:'photos';
      if(field.id==='festivalYear' && (!field.checkValidity()||!Number.isInteger(Number(field.value)))) key='invalidYear';
      else if(field.required && !field.value.trim()) key='required';
      else if(field.maxLength>0 && field.value.length>field.maxLength) key='tooLong';
      else if(!field.checkValidity()) key=field.id==='eventDate'?'yearDate':'invalid';
      if(key){showStep(index,false);error(key,{fieldKey:label});field.setAttribute('aria-invalid','true');field.setAttribute('aria-describedby','formError');field.focus();return false;}
    }
    return true;
  }
  function validateAll() { for(const i of [2,3,4]) if(!validateStep(i)) return false; return true; }
  function safeUrl(value, expectedPath) {
    const url=new URL(value,location.origin);
    if(url.origin!==location.origin||!['http:','https:'].includes(url.protocol)|| (expectedPath && url.pathname!==expectedPath)) throw {code:'generic'};
    return url.href;
  }
  async function api(path, body, contentType='application/json') {
    const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),45000);
    try {
      const response=await fetch(path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':contentType},body:contentType==='application/json'?JSON.stringify(body):body,signal:controller.signal});
      let result;try{result=await response.json();}catch(_){throw {code:response.status===413?'too_large':'generic'};}
      if(!response.ok||result.error)throw {code:result.error||'generic'};
      return result;
    } catch(err) { if(err.code)throw err; throw {code:'network'}; } finally {clearTimeout(timeout);}
  }
  function customerData() {
    const data={language:state.language,timezone:'Asia/Kolkata',photos:state.photos.filter(p=>p.url).map(p=>({url:p.url,alt:p.alt.trim()}))};
    fieldNames.forEach(name=>{data[name]=$(name).value.trim();});return data;
  }
  async function saveDraft() {
    status('saving');
    const payload={customer_data:customerData()}; if(state.id)payload.id=state.id;
    const result=await api('/api/ganapati/draft',payload);
    if(typeof result.id!=='string'||!result.id||typeof result.previewUrl!=='string')throw {code:'generic'};
    const previewUrl=safeUrl(result.previewUrl,`/ganapati/preview/${result.id}`);
    if(state.id && state.id!==result.id)throw {code:'generic'};
    state.id=result.id;state.previewUrl=previewUrl;
  }
  function renderPhotos() {
    $('photoList').replaceChildren();$('photoCount').textContent=t('photoCount',{n:state.photos.length});
    state.photos.forEach((photo,index)=>{
      const card=document.createElement('div');card.className='photo-card';
      const image=document.createElement('img');image.src=photo.localUrl||photo.url;image.alt=photo.alt||t('photoAlt',{n:index+1});
      const content=document.createElement('div'),label=document.createElement('label'),input=document.createElement('input');
      label.htmlFor=`photoAlt${photo.key}`;label.textContent=t('alt',{n:index+1});input.id=label.htmlFor;input.maxLength=200;input.value=photo.alt;input.disabled=state.busy;input.addEventListener('input',()=>{photo.alt=input.value;image.alt=input.value||t('photoAlt',{n:index+1});markDirty();});
      const actions=document.createElement('div');actions.className='photo-actions';
      const remove=document.createElement('button');remove.type='button';remove.className='button secondary';remove.textContent=t('remove');remove.disabled=state.busy;remove.setAttribute('aria-label',`${t('remove')} · ${t('photoAlt',{n:index+1})}`);
      remove.addEventListener('click',()=>{if(state.busy)return;if(photo.localUrl)URL.revokeObjectURL(photo.localUrl);photo.blob=null;state.photos=state.photos.filter(p=>p!==photo);markDirty();renderPhotos();updateControls();});actions.append(remove);
      if(photo.error){const retry=document.createElement('button');retry.type='button';retry.className='button secondary';retry.textContent=t('retry');retry.disabled=state.busy;retry.addEventListener('click',()=>saveAndPreview(false));actions.append(retry);}
      const note=document.createElement('span');note.className='photo-status';note.textContent=photo.error?`${t('photoFailed')} ${t(photo.error)}`:t(photo.url?'uploaded':'pending');actions.append(note);
      content.append(label,input,actions);card.append(image,content);$('photoList').append(card);
    });
  }
  async function prepareImage(file) {
    if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw {code:'invalid_image'};
    if(file.size>8*1024*1024)throw {code:'too_large'};
    const source=URL.createObjectURL(file);let image;
    try {
      image=new Image();
      await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject({code:'invalid_image'});image.src=source;});
      if(!image.naturalWidth||!image.naturalHeight)throw {code:'invalid_image'};
      const canvas=document.createElement('canvas');const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));
      canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
      const ctx=canvas.getContext('2d');if(!ctx)throw {code:'invalid_image'};
      ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.82));
      canvas.width=canvas.height=1;
      if(!blob)throw {code:'invalid_image'};if(blob.size>2*1024*1024)throw {code:'too_large'};
      return blob;
    } catch(err){throw {code:err.code||'invalid_image'};} finally {if(image){image.onload=null;image.onerror=null;image.src='';}URL.revokeObjectURL(source);}
  }
  async function addPhotos(files) {
    if(state.busy)return;clearError();setBusy(true);status('processing');
    const errors=[];
    try {
      for(const file of files){if(state.photos.length>=10){errors.push('limit');break;}try{const blob=await prepareImage(file);state.photos.push({key:++photoSequence,blob,localUrl:URL.createObjectURL(blob),url:null,alt:'',error:null});markDirty();}catch(err){errors.push(err.code||'invalid_image');}}
      renderPhotos();if(errors.length)error(errors[0]);
    } finally {$('photoFiles').value='';status(null);setBusy(false);}
  }
  async function saveAndPreview(open=true) {
    if(state.busy||state.published)return;clearError();if(!validateAll())return;
    setBusy(true);let failures=[];
    try {
      // Create an authenticated text draft before sending any image bytes. Existing references survive retries.
      await saveDraft();
      const pending=state.photos.filter(photo=>!photo.url);
      for(let index=0;index<pending.length;index++){
        const photo=pending[index];status('uploadingPhoto',{n:index+1,total:pending.length});
        try {const result=await api(`/api/ganapati/upload?id=${encodeURIComponent(state.id)}`,photo.blob,'image/jpeg');if(typeof result.url!=='string')throw {code:'generic'};const parsed=new URL(result.url,location.origin);if(!['http:','https:'].includes(parsed.protocol))throw {code:'generic'};photo.url=result.url;photo.error=null;photo.blob=null;}
        catch(err){photo.error=I18N.en[err.code]?err.code:'generic';failures.push(photo.error);}
        renderPhotos();
      }
      // Persist successful references even when a later upload fails. Retries never re-upload successful images.
      if(pending.length)await saveDraft();
      if(failures.length){state.viewedRevision=-1;error(failures[0]);status(null);return;}
      state.savedRevision=state.revision;status('saved');
      if(open) {showStep(5,false);openPreview();}
    } catch(err){error(err.code||'generic');status(null);} finally {setBusy(false);renderPhotos();}
  }
  function openPreview() {
    if(!state.previewUrl||state.savedRevision!==state.revision)return;
    returnFocus=$('savePreview');const revision=state.revision;
    const dialog=$('previewDialog');$('frameHost').replaceChildren();state.expanded=false;dialog.classList.remove('preview-expanded');$('fullscreen').textContent=t('fullscreen');
    const iframe=document.createElement('iframe');iframe.title=t('yourPreview');iframe.allow='autoplay; fullscreen';iframe.setAttribute('allowfullscreen','');
    iframe.addEventListener('load',()=>{
      clearTimeout(previewTimer);
      try {const doc=iframe.contentDocument;const body=doc&&doc.body;const errorContent=body?body.innerText.trim():'';if(!body||body.dataset.preview!=='true'||iframe.contentWindow.location.pathname!==new URL(state.previewUrl).pathname||!doc.querySelector('main')||/^\s*\{"error"/.test(errorContent))throw new Error('Preview failed');
        if(revision===state.revision&&dialog.open){state.viewedRevision=revision;modalStatus(null);updatePreviewState();}
      }catch(_){modalStatus('previewLoadFailed');}
    });
    iframe.addEventListener('error',()=>modalStatus('previewLoadFailed'));
    modalStatus('loadingPreview');previewTimer=setTimeout(()=>modalStatus('previewLoadFailed'),30000);
    const freshPreview=new URL(state.previewUrl);freshPreview.searchParams.set('v',String(Date.now()));
    iframe.src=freshPreview.href;$('frameHost').append(iframe);dialog.showModal();document.body.classList.add('modal-open');$('closePreview').focus();
  }
  function closePreview() {
    clearTimeout(previewTimer);$('frameHost').replaceChildren();modalStatus(null);document.body.classList.remove('modal-open');
    if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});
    if($('previewDialog').open)$('previewDialog').close();
    if(returnFocus&&document.contains(returnFocus))returnFocus.focus();
  }
  function updateShareLinks(){
    $('publishedUrl').value=state.resultUrl;$('openPublished').href=state.resultUrl;
    $('whatsapp').href=`https://wa.me/?text=${encodeURIComponent(`${t('shareMessage')}\n${state.resultUrl}`)}`;
  }
  async function publish() {
    if(!canPublish()){if(!state.busy)error('previewFirst');return;}
    clearError();setBusy(true);status('publishing');
    try {
      const result=await api('/api/ganapati/publish',{id:state.id});
      if(typeof result.url!=='string'||typeof result.slug!=='string')throw {code:'generic'};
      state.resultUrl=safeUrl(result.url);state.published=true;updateShareLinks();
      $('wizard').hidden=true;$('publishedResult').hidden=false;status(null);$('resultTitle').focus();$('publishedResult').scrollIntoView({block:'start'});
      state.photos.forEach(photo=>{if(photo.localUrl){URL.revokeObjectURL(photo.localUrl);photo.localUrl=null;}photo.blob=null;});
    }catch(err){error(err.code||'generic');status(null);}finally{setBusy(false);}
  }
  $('eventDate').value=defaults[2026];$('eventDate').min='2026-01-01';$('eventDate').max='2026-12-31';$('eventTime').value='11:00';
  $('language').addEventListener('change',event=>setLanguage(event.target.value));
  document.querySelectorAll('[data-language]').forEach(el=>el.addEventListener('click',()=>setLanguage(el.dataset.language)));
  fieldNames.forEach(name=>$(name).addEventListener('input',()=>{$(name).removeAttribute('aria-invalid');markDirty();}));
  $('festivalYear').addEventListener('input',()=>markDirty());
  $('festivalYear').addEventListener('change',()=>{const year=$('festivalYear').value;if(year===state.year)return;state.year=year;const valid=$('festivalYear').checkValidity()&&Number.isInteger(Number(year));$('eventDate').value=valid?(defaults[year]||''):'';$('eventDate').min=valid?`${year}-01-01`:'2026-01-01';$('eventDate').max=valid?`${year}-12-31`:'2100-12-31';$('dateHint').textContent=t(defaults[year]?'knownDate':'unknownDate');markDirty();});
  $('photoFiles').addEventListener('change',event=>addPhotos([...event.target.files]));
  if($('choosePhotos'))$('choosePhotos').addEventListener('click',()=>$('photoFiles').click());
  $('ganapatiForm').addEventListener('submit',event=>{event.preventDefault();if(state.busy||state.step===5)return;clearError();if(validateStep(state.step))showStep(Math.min(5,state.step+1));});
  $('back').addEventListener('click',()=>{if(!state.busy){clearError();showStep(Math.max(0,state.step-1));}});
  $('savePreview').addEventListener('click',()=>saveAndPreview(true));$('publish').addEventListener('click',publish);
  $('closePreview').addEventListener('click',closePreview);
  $('previewDialog').addEventListener('cancel',event=>{event.preventDefault();closePreview();});
  $('previewDialog').addEventListener('close',()=>{clearTimeout(previewTimer);$('frameHost').replaceChildren();document.body.classList.remove('modal-open');});
  $('fullscreen').addEventListener('click',async()=>{state.expanded=!state.expanded;$('previewDialog').classList.toggle('preview-expanded',state.expanded);$('fullscreen').textContent=t(state.expanded?'exitFullscreen':'fullscreen');try{if(state.expanded&&$('previewDialog').requestFullscreen)await $('previewDialog').requestFullscreen();else if(document.fullscreenElement)await document.exitFullscreen();}catch(_){/* CSS expansion remains usable when browser fullscreen is unavailable. */}});
  $('copyLink').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(state.resultUrl);state.shareStatus={key:'copied'};}catch(_){$('publishedUrl').focus();$('publishedUrl').select();state.shareStatus={key:'copyFailed'};}message('shareStatus',state.shareStatus);});
  window.addEventListener('beforeunload',event=>{if(!state.published&&(state.revision>0||state.busy)){event.preventDefault();event.returnValue='';}});
  window.addEventListener('pagehide',event=>{if(!event.persisted){state.photos.forEach(photo=>{if(photo.localUrl)URL.revokeObjectURL(photo.localUrl);});$('frameHost').replaceChildren();}});
  localize();
})();
