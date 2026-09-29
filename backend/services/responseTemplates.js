/**
 * Response templates for the SheharSetu AI Complaint Assistant.
 * Each key is a conversation event; each value is a function of (params) => string.
 * Only 'en' and 'hi' are filled in today — add another language by adding a
 * new top-level key with the same event functions (see languageService.js
 * for why the architecture already expects more than two).
 */

const CATEGORY_LABELS = {
  en: {
    waste: 'Solid Waste', water: 'Water / Drainage', electricity: 'Electricity / Street Lighting',
    roads: 'Roads', infrastructure: 'Public Infrastructure', public_safety: 'Public Safety',
    parks: 'Parks & Recreation', traffic: 'Traffic', other: 'General Civic Issue',
  },
  hi: {
    waste: 'ठोस कचरा', water: 'पानी / नाली', electricity: 'बिजली / स्ट्रीट लाइट',
    roads: 'सड़क', infrastructure: 'सार्वजनिक अवसंरचना', public_safety: 'सार्वजनिक सुरक्षा',
    parks: 'पार्क', traffic: 'ट्रैफिक', other: 'सामान्य नागरिक समस्या',
  },
};

const TEMPLATES = {
  en: {
    greeting: () =>
      "Namaste! I'm the SheharSetu AI Assistant. You can tell me about a civic problem by text, voice message, or photo — I'll help register it and route it to the right department.",
    help: () =>
      'I can help you:\n• Report civic problems\n• Understand photos\n• Accept voice complaints\n• Collect the problem location\n• Route complaints to the right department\n• Give you a complaint ID\n• Check complaint status',
    categoryDetected: ({ category }) => `Got it — this looks like a ${CATEGORY_LABELS.en[category] || 'civic'} issue.`,
    askLocation: () => 'Could you share the location of the problem? You can send your location, or just type an address or nearby landmark.',
    locationReceived: () => 'Location received.',
    lowConfidenceLocation: () => "I couldn't confidently identify that location. Could you share a location, or try a more specific address or landmark?",
    askPhotoOptional: () => 'Would you like to add a photo? This is optional.',
    photoReceived: () => "Got the photo — I've attached it to your complaint.",
    imageAnalysisFailed: () => "I received the image, but couldn't analyze it reliably. Could you describe the problem in a short message?",
    transcriptionFailed: () => "I couldn't understand the voice message clearly. Could you try again, or type the complaint instead?",
    analyzing: () => 'Understanding your complaint…',
    summary: ({ category, description, locationText, hasPhoto, priority }) =>
      `Complaint summary\n\nIssue: ${description}\nCategory: ${CATEGORY_LABELS.en[category] || category}\nLocation: ${locationText || 'Not yet provided'}\nPhoto: ${hasPhoto ? 'Attached' : 'None'}\nPriority: ${priority || 'medium'}\n\nShould I submit this complaint?`,
    askConfirmation: () => 'Reply YES to submit, EDIT to change something, or CANCEL to discard.',
    askWhatToEdit: () => 'What would you like to change — the description, location, or photo?',
    submitted: ({ ticketId, category, department, locationText }) =>
      `Your complaint has been registered successfully.\n\nComplaint ID: ${ticketId}\nCategory: ${CATEGORY_LABELS.en[category] || category}\nDepartment: ${department}\nLocation: ${locationText || 'Not specified'}\nStatus: Submitted\n\nYou can track it anytime by sending your complaint ID.`,
    cancelled: () => 'No problem — I\'ve discarded this complaint. Let me know if you\'d like to report something else.',
    statusFound: ({ ticketId, status, department, lastUpdate }) =>
      `Complaint ID: ${ticketId}\nStatus: ${status}\nDepartment: ${department}${lastUpdate ? `\nLast update: ${lastUpdate}` : ''}`,
    statusNotFound: () => "I couldn't find a complaint with that ID. Please double-check the complaint ID, or ask me to report a new problem.",
    duplicateFound: () => 'I found a similar complaint reported near this location recently. Would you like to add information to that existing complaint, or submit this as a new one?',
    fallbackError: () => "I'm temporarily unable to understand this message. You can describe the problem in a short text message, or contact municipal support directly.",
    unsupportedMediaType: () => 'I can currently understand text, voice messages, images, and shared locations.',
    whatsappOffer: () => "You can also continue this conversation on WhatsApp if that's easier.",
    nearbyDrainNote: ({ waterStatus }) => `Note: there's a monitored drain near this location — its current sensor status is "${waterStatus}". This is supporting context only, not a confirmation of your complaint.`,
  },

  hi: {
    greeting: () =>
      'नमस्ते! मैं SheharSetu AI Assistant हूँ. आप अपनी civic problem text, voice message या photo के जरिए बता सकते हैं. मैं शिकायत दर्ज करने और सही department तक भेजने में मदद करूँगा.',
    help: () =>
      'मैं आपकी मदद कर सकता हूँ:\n• नागरिक समस्याएं दर्ज करने में\n• फोटो समझने में\n• वॉइस शिकायतें स्वीकार करने में\n• समस्या की location लेने में\n• सही department को route करने में\n• complaint ID देने में\n• complaint status बताने में',
    categoryDetected: ({ category }) => `समझ गया — यह ${CATEGORY_LABELS.hi[category] || 'नागरिक'} से जुड़ी समस्या लग रही है।`,
    askLocation: () => 'कृपया समस्या की location share करें। आप location भेज सकते हैं, या पता/landmark टाइप कर सकते हैं।',
    locationReceived: () => 'Location मिल गई।',
    lowConfidenceLocation: () => 'मैं उस location को ठीक से पहचान नहीं पाया। कृपया location share करें या अधिक स्पष्ट पता/landmark बताएं।',
    askPhotoOptional: () => 'क्या आप एक photo भी भेजना चाहेंगे? यह optional है।',
    photoReceived: () => 'Photo मिल गई — मैंने इसे आपकी शिकायत से जोड़ दिया है।',
    imageAnalysisFailed: () => 'मुझे photo मिली, लेकिन मैं इसे ठीक से समझ नहीं पाया। कृपया समस्या को शब्दों में बताएं।',
    transcriptionFailed: () => 'मैं voice message ठीक से समझ नहीं पाया। कृपया दोबारा कोशिश करें, या टाइप करके बताएं।',
    analyzing: () => 'आपकी शिकायत समझी जा रही है…',
    summary: ({ category, description, locationText, hasPhoto, priority }) =>
      `शिकायत का सारांश\n\nसमस्या: ${description}\nCategory: ${CATEGORY_LABELS.hi[category] || category}\nLocation: ${locationText || 'अभी तक नहीं दी गई'}\nPhoto: ${hasPhoto ? 'जुड़ी हुई' : 'नहीं'}\nPriority: ${priority || 'medium'}\n\nक्या मैं यह शिकायत दर्ज कर दूँ?`,
    askConfirmation: () => 'दर्ज करने के लिए YES भेजें, बदलाव के लिए EDIT, या रद्द करने के लिए CANCEL भेजें।',
    askWhatToEdit: () => 'आप क्या बदलना चाहेंगे — विवरण, location, या photo?',
    submitted: ({ ticketId, category, department, locationText }) =>
      `आपकी शिकायत सफलतापूर्वक दर्ज हो गई है।\n\nComplaint ID: ${ticketId}\nCategory: ${CATEGORY_LABELS.hi[category] || category}\nDepartment: ${department}\nLocation: ${locationText || 'निर्दिष्ट नहीं'}\nStatus: दर्ज (Submitted)\n\nआप कभी भी अपनी complaint ID भेजकर status जान सकते हैं।`,
    cancelled: () => 'ठीक है — मैंने यह शिकायत रद्द कर दी है। अगर कोई और समस्या हो तो बताएं।',
    statusFound: ({ ticketId, status, department, lastUpdate }) =>
      `Complaint ID: ${ticketId}\nStatus: ${status}\nDepartment: ${department}${lastUpdate ? `\nLast update: ${lastUpdate}` : ''}`,
    statusNotFound: () => 'मुझे इस ID से कोई complaint नहीं मिली। कृपया ID दोबारा जांचें, या नई समस्या दर्ज करने को कहें।',
    duplicateFound: () => 'मुझे इस location के पास हाल ही में एक जैसी शिकायत मिली है। क्या आप उसी में जानकारी जोड़ना चाहेंगे, या नई शिकायत दर्ज करना चाहेंगे?',
    fallbackError: () => 'मैं अभी इस संदेश को समझ नहीं पा रहा। कृपया समस्या को छोटे text संदेश में बताएं, या municipal support से संपर्क करें।',
    unsupportedMediaType: () => 'मैं अभी text, voice message, photo और location समझ सकता हूँ।',
    whatsappOffer: () => 'आप चाहें तो यह बातचीत WhatsApp पर भी जारी रख सकते हैं।',
    nearbyDrainNote: ({ waterStatus }) => `सूचना: इस location के पास एक monitored drain है — इसकी वर्तमान sensor स्थिति "${waterStatus}" है। यह केवल सहायक जानकारी है, आपकी शिकायत की पुष्टि नहीं।`,
  },
};

/**
 * @param {string} key    template key, e.g. 'greeting'
 * @param {string} lang   'en' | 'hi' — falls back to 'en' if not covered yet
 * @param {object} params
 */
function t(key, lang, params = {}) {
  const dict = TEMPLATES[lang] || TEMPLATES.en;
  const fn = dict[key] || TEMPLATES.en[key];
  if (!fn) return '';
  return fn(params);
}

module.exports = { t, CATEGORY_LABELS };
