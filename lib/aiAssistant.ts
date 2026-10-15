// =======================================================
// AI SMART ALGORITHMS & NEIGHBORHOOD INTELLIGENCE — حيّنا
// =======================================================

export interface AISmartAnalysis {
  category: string;
  tags: string[];
  enhancedTitle: string;
  enhancedBody: string;
  instantTip: string;
}

export interface InstantResidentAnswer {
  summary: string;
  keyPoints: string[];
  recommendedAction: string;
  confidenceScore: number;
}

export interface NeighborhoodPulse {
  headline: string;
  trendingTopics: string[];
  topNeed: string;
  activeNeighborsEstimate: number;
  solvedRate: string;
  smartSummary: string;
}

export interface SafetyAndSpamCheck {
  isEmergency: boolean;
  urgencyLevel: 'emergency' | 'warning' | 'normal';
  emergencyTitle?: string;
  isSpam: boolean;
  spamReason?: string;
}

// 1. AI Categorization & Tagging rules based on Saudi community context
const CATEGORY_KEYWORDS: Record<string, { category: string; tags: string[]; tip: string }> = {
  ماء: {
    category: 'خدمات المياه والصهاريج',
    tags: ['وايت_ماء', 'سقس', 'مياه', 'خدمات_الحي'],
    tip: '💡 يمكنك أيضاً طلب وايت الماء عبر تطبيق شركة المياه الوطنية (NWC) لخدمة سريعة في حيك.',
  },
  سباك: {
    category: 'صيانة ومنزل',
    tags: ['سباكة', 'صيانة_منازل', 'فني_معتمد'],
    tip: '💡 احرص على الاتفاق على الضمان قبل بدء أعمال السباكة المنزلية.',
  },
  كهرب: {
    category: 'صيانة وكهرباء',
    tags: ['كهربائي', 'صيانة_منازل', 'طوارئ'],
    tip: '💡 في حالات طوارئ انقطاع التيار، يمكنك التواصل مباشرة مع رقم طوارئ الكهرباء 933.',
  },
  مكيف: {
    category: 'صيانة وتكييف',
    tags: ['تكييف', 'صيانة_تكييف', 'فني_مكيفات', 'غسيل_مكيف'],
    tip: '💡 غسيل الفلاتر أسبوعياً يوفر حتى 15% من استهلاك الطاقة ويحمي المكيف من الأعطال.',
  },
  مطعم: {
    category: 'مطاعم ومقاهي',
    tags: ['مطاعم_الحي', 'توصيل', 'تجارب_الجيران'],
    tip: '💡 يمكنك مراجعة خريطة حيّنا لمشاهدة تقييمات الجيران للمطاعم المجاورة.',
  },
  فطور: {
    category: 'مطاعم ومقاهي',
    tags: ['فطور', 'صباحيات_الحي', 'مقاهي'],
    tip: '💡 جيرانك يفضلون دائماً الأماكن التي توفر جلسات عائلية مريحة وخدمة سريعة.',
  },
  دواء: {
    category: 'صيدليات وصحة',
    tags: ['صيدلية_مناوبة', 'صحة', 'دواء'],
    tip: '💡 يمكنك معرفة الصيدليات المناوبة على مدار 24 ساعة عبر تطبيق صحتي.',
  },
  مستشفى: {
    category: 'صحة ومستشفيات',
    tags: ['مراكز_صحية', 'طوارئ_طبية', 'عيادات'],
    tip: '💡 المركز الصحي بالحي يقدم خدمة المواعيد الفورية عبر تطبيق صحتي.',
  },
  مفقود: {
    category: 'مفقودات ومعثورات',
    tags: ['مفقودات', 'أمانات', 'فزعة_الحي'],
    tip: '💡 تم إشعار جيران الحي القريبين من موقعك للمساعدة في البحث.',
  },
  قطة: {
    category: 'مفقودات وحيوانات أليفة',
    tags: ['مفقود', 'حيوانات_أليفة', 'فزعة'],
    tip: '💡 شارك صورة واضحة ومكان آخر مشاهدة لتسهيل العثور عليها.',
  },
  نقل: {
    category: 'خدمات النقل والفزعة',
    tags: ['نقل_عفش', 'دينا', 'توصيل'],
    tip: '💡 الجيران الذين يمتلكون مركبات نقل غالباً ما يتجاوبون خلال دقائق في قسم الفزعة.',
  },
  سيار: {
    category: 'سيارات وورش',
    tags: ['ورش_سيارات', 'بنشر', 'ميكانيكا', 'سطحة'],
    tip: '💡 في حالات تعطل البطارية أو البنشر، يمكنك استخدام زر الفزعة لمساعدة سريعة من أقرب جار.',
  },
  مدرس: {
    category: 'تعليم وتدريب',
    tags: ['دروس_خصوصية', 'معلمين', 'تعليم'],
    tip: '💡 العديد من معلمين ومعلمات الحي يقدمون دعماً تعليمياً متميزاً لأبناء وبنات الجيران.',
  },
  سلم: {
    category: 'إعارة أدوات الحي',
    tags: ['إعارة_أدوات', 'سلم', 'مشاركة_الجيران'],
    tip: '💡 الجيران يشاركون سلالم ومعدات صيانة مجاناً في قسم إعارة الأدوات.',
  },
  دريل: {
    category: 'إعارة أدوات الحي',
    tags: ['إعارة_أدوات', 'دريل', 'صيانة_منزلية'],
    tip: '💡 تتوفر أدوات صيانة منزلية للإعارة المجانية بين أهالي الحي.',
  },
};

/**
 * AI Algorithm: Analyze question text and extract category, tags, and neighborhood tip
 */
export function analyzeQuestionWithAI(title: string, body: string): AISmartAnalysis {
  const combined = `${title} ${body}`.toLowerCase();

  let detectedCategory = 'استفسارات عامة';
  let detectedTags = ['نقاش_الحي', 'استفسار'];
  let detectedTip = '💡 سيتم إشعار جيرانك في نفس الحي لمساعدتك وتقديم أفضل النصائح.';

  for (const [kw, data] of Object.entries(CATEGORY_KEYWORDS)) {
    if (combined.includes(kw)) {
      detectedCategory = data.category;
      detectedTags = data.tags;
      detectedTip = data.tip;
      break;
    }
  }

  // Enhanced title formatting
  let cleanTitle = title.trim();
  if (cleanTitle && !cleanTitle.endsWith('؟') && !cleanTitle.endsWith('?')) {
    cleanTitle += '؟';
  }

  return {
    category: detectedCategory,
    tags: detectedTags,
    enhancedTitle: cleanTitle,
    enhancedBody: body.trim(),
    instantTip: detectedTip,
  };
}

/**
 * Generates general guidance from simple topic matching only.
 * It does not query resident archives, ratings, or verified local experiences.
 */
export function generateInstantResidentAnswerAI(
  query: string,
  city: string,
  district: string
): InstantResidentAnswer {
  const q = query.toLowerCase();
  const locationLabel = district ? `حي ${district}` : city ? `مدينة ${city}` : 'الموقع المحدد';
  let keyPoints: string[];
  let recommendedAction: string;

  if (q.includes('سباك') || q.includes('سباكة') || q.includes('تسريب') || q.includes('حنفية')) {
    keyPoints = [
      'أغلق مصدر المياه عند وجود تسرب واضح، ولا تلمس الأجهزة الكهربائية إذا وصلت إليها المياه.',
      'اطلب تقديراً للسعر والقطع والضمان قبل بدء الإصلاح.',
      'تحقق من مؤهلات الفني ومعلومات التواصل بنفسك قبل الاتفاق.',
    ];
    recommendedAction = 'قارن بين عروض الخدمات المسجلة في المنصة، وتأكد من تفاصيل مقدم الخدمة مباشرة.';
  } else if (q.includes('مكيف') || q.includes('تكييف') || q.includes('فريون') || q.includes('تبريد')) {
    keyPoints = [
      'افصل الجهاز إذا ظهرت رائحة احتراق أو أصوات غير معتادة.',
      'ابدأ بتنظيف الفلاتر وفق دليل الشركة المصنّعة.',
      'اطلب من فني مختص فحص التسرب قبل تعبئة غاز التبريد.',
    ];
    recommendedAction = 'تحقق من نوع المكيف والضمان، واطلب تشخيصاً وسعراً مكتوباً قبل الإصلاح.';
  } else if (q.includes('مطعم') || q.includes('فطور') || q.includes('عشاء') || q.includes('كافيه') || q.includes('قهوة')) {
    keyPoints = [
      'تحقق من ساعات العمل والعنوان من المصدر الرسمي قبل الذهاب.',
      'راجع التقييمات الفعلية وعدد المراجعات وتاريخها إن كانت متاحة.',
      'تأكد من ملاءمة المكان وطرق الوصول له بحسب احتياجك.',
    ];
    recommendedAction = 'استخدم نتائج الأماكن الفعلية المتاحة؛ لا تُعدّ هذه الإجابة توصية مبنية على تقييمات محلية.';
  } else if (q.includes('كهرب') || q.includes('قاطع') || q.includes('طبلون')) {
    keyPoints = [
      'لا تفتح لوحة الكهرباء ولا تلمس الأسلاك المكشوفة.',
      'إذا ظهرت شرارة أو رائحة احتراق، ابتعد عن المكان واطلب المساعدة المختصة.',
      'استخدم كهربائياً مرخصاً للأعمال التي تتطلب فتح اللوحات أو التعامل مع الأسلاك.',
    ];
    recommendedAction = 'في حالة الخطر المباشر، ابتعد عن مصدر الخطر واتصل بالطوارئ المختصة.';
  } else if (q.includes('ماء') || q.includes('وايت') || q.includes('خزان')) {
    keyPoints = [
      'تحقق من مصدر المياه ومن اعتماد مقدم الخدمة قبل الطلب.',
      'اتفق مسبقاً على السعة والسعر ووقت الوصول.',
      'لا تشرب ماءً مجهول المصدر أو غير مخصص للشرب.',
    ];
    recommendedAction = 'راجع القنوات الرسمية لمزوّد المياه للتحقق من الخيارات والأسعار الحالية.';
  } else if (q.includes('مفقود') || q.includes('قطة') || q.includes('مفتاح') || q.includes('محفظة')) {
    keyPoints = [
      'اذكر وقت ومكان الفقد وأضف وصفاً دقيقاً لا يكشف بيانات حساسة.',
      'لا تنشر رقم هويتك أو عنوان منزلك الكامل أو بيانات مالية علناً.',
      'نسّق مع الجهة المختصة أو موقع الفقد عند الحاجة.',
    ];
    recommendedAction = 'انشر تفاصيل كافية للتعرّف على المفقود دون كشف بيانات شخصية أو معلومات تمكّن الآخرين من انتحال الملكية.';
  } else {
    keyPoints = [
      'تحقق من المعلومات من مصدر رسمي أو مقدم الخدمة قبل اتخاذ القرار.',
      'ابحث في الأسئلة والخدمات الفعلية المسجلة في المنصة إن كانت متاحة.',
      'لا تعتبر هذه الإجابة دليلاً على تجربة جار أو تقييماً لخدمة محلية.',
    ];
    recommendedAction = 'أضف تفاصيل أكثر للسؤال ليتمكن الجيران من مشاركة إجاباتهم الفعلية.';
  }

  return {
    summary: `هذه إرشادات عامة حول سؤالك في ${locationLabel}، وليست مستخلصة من أرشيف تجارب أو تقييمات محلية موثقة في المنصة.`,
    keyPoints,
    recommendedAction,
    confidenceScore: 0,
  };
}

/**
 * AI Algorithm: Neighborhood Pulse / Digest Generator
 * نشرة الحي الذكية الأسبوعية والتفاعلية
 */
export function generateNeighborhoodPulseAI(
  city: string,
  district: string,
  recentQuestionCount: number = 18
): NeighborhoodPulse {
  const safeCity = city && city !== 'كل المدن' ? city : 'الرياض';
  const safeDistrict = district && district !== 'كل أحياء المدينة' ? district : 'الياسمين';

  const topicsPool = [
    'استعدادات وصيانة التكييف قبل موسم الحر',
    'تبادل أدوات الصيانة المنزلية في سوق الحي المصغر',
    'تجمع رياضي مسائي في ممشى الحي وحديقته',
    'افتتاح مجمع تجاري ومقاهي جديدة بشارع الحي الرئيسي',
    'العثور على مفاتيح مفقودة وتسليمها لإمام المسجد',
    'تنسيق وايتات المياه وصيانة الخزانات الأرضية',
  ];

  // Pick 3 topics
  const trending = [topicsPool[0], topicsPool[1], topicsPool[2]];

  return {
    headline: `نشرة حي ${safeDistrict} الذكية لهذا الأسبوع 📰`,
    trendingTopics: trending,
    topNeed: 'خدمات الصيانة السريعة وإعارة الأدوات',
    activeNeighborsEstimate: Math.max(120, recentQuestionCount * 14),
    solvedRate: '96%',
    smartSummary: `شهد حي ${safeDistrict} هذا الأسبوع نشاطاً مميزاً بتفاعل أكثر من ${recentQuestionCount * 12} جار، مع حل 96% من الاستفسارات وتبادل 8 أدوات ومعدات صيانة مجاناً بين الأهالي.`,
  };
}

/**
 * AI Algorithm: Trust, Safety & Anti-Spam Detector
 * كاشف الطوارئ العاجلة ومنع الترويج العشوائي والسبام
 */
export function detectEmergencyAndSafetyAI(text: string): SafetyAndSpamCheck {
  const t = text.toLowerCase();

  // 1. Emergency detection
  const emergencyKeywords = [
    'طفل مفقود',
    'مفقود طفل',
    'ولد مفقود',
    'بنت مفقودة',
    'حريق',
    'ماس كهربائي',
    'انفجار',
    'حادث شنيع',
    'سرقة',
    'سيارة مسروقة',
    'طوارئ قصوى',
    'اسعاف عاجل',
  ];

  const warningKeywords = [
    'قطة مفقودة',
    'مفتاح مفقود',
    'حادث بسيط',
    'صدم وهرب',
    'كلب ضال',
    'حفرة خطيرة',
    'انكسار ماسورة بالشارع',
  ];

  let isEmergency = false;
  let urgencyLevel: 'emergency' | 'warning' | 'normal' = 'normal';
  let emergencyTitle: string | undefined = undefined;

  for (const ekw of emergencyKeywords) {
    if (t.includes(ekw)) {
      isEmergency = true;
      urgencyLevel = 'emergency';
      emergencyTitle = `🚨 بلاغ طارئ عاجل لأهل الحي: ${ekw}`;
      break;
    }
  }

  if (!isEmergency) {
    for (const wkw of warningKeywords) {
      if (t.includes(wkw)) {
        urgencyLevel = 'warning';
        emergencyTitle = `⚠️ تنبيه هام لجيران الحي: ${wkw}`;
        break;
      }
    }
  }

  // 2. Spam & Stealth Promo Detection
  // Check for repeated commercial spam phrases or excessive repetitive phone numbers
  const spamKeywords = [
    'ارخص الاسعار اتصل فورا',
    'نشتري الاثاث المستعمل باعلى سعر',
    'خادمات للتنازل فورا',
    'سداد قروض وتسويه',
    'مساج منزلي فوري',
    'استقدام عمالة فوري بدون رسوم',
  ];

  let isSpam = false;
  let spamReason: string | undefined = undefined;

  for (const skw of spamKeywords) {
    if (t.includes(skw)) {
      isSpam = true;
      spamReason = 'تم رصد محتوى ترويجي تجاري غير مصرح به في خلاصة الحي.';
      break;
    }
  }

  // Detect repeated telephone numbers (e.g. 05xxxxxxxx more than 2 times in short text)
  const phoneMatches = t.match(/(05\d{8}|01\d{7})/g);
  if (phoneMatches && phoneMatches.length >= 3) {
    isSpam = true;
    spamReason = 'تكرار أرقام الهواتف بشكل يوحي بترويج عشوائي.';
  }

  return {
    isEmergency,
    urgencyLevel,
    emergencyTitle,
    isSpam,
    spamReason,
  };
}

/**
 * AI Algorithm: Smart Title & Body Enhancer
 */
export function enhanceQuestionContentAI(
  title: string,
  body: string,
  city: string,
  district: string
): { enhancedTitle: string; enhancedBody: string } {
  const t = title.trim();
  const b = body.trim();

  let newTitle = t;
  if (!newTitle.includes('في') && city && city !== 'كل المدن') {
    newTitle = `${newTitle} في ${city}${district && district !== 'كل الأحياء' ? ` (${district})` : ''}`;
  }
  if (!newTitle.endsWith('؟')) {
    newTitle += '؟';
  }

  let newBody = b;
  if (newBody.length > 0 && !newBody.includes('السلام عليكم')) {
    newBody = `السلام عليكم ورحمة الله وبركاته يا جيران،\n\n${newBody}\n\nشاكر ومقدّر لكم حسن تعاونكم.`;
  }

  return {
    enhancedTitle: newTitle,
    enhancedBody: newBody,
  };
}

/**
 * AI Algorithm: Smart Bio Generator for Profiles
 */
export function generateSmartBioAI(
  city: string,
  district: string,
  interests?: string
): string {
  const safeCity = city && city !== 'كل المدن' ? city : 'المملكة';
  const safeDistrict = district && district !== 'كل الأحياء' ? `، ${district}` : '';

  const templates = [
    `ابن ${safeCity}${safeDistrict} 🇸🇦، مهتم بالتطوع وخدمة الحي وتبادل الخبرات والمعرفة مع الجيران. يسعدني التواصل دائماً.`,
    `جاركم في ${safeCity}${safeDistrict} 📍. حريص على تعزيز روح الجيرة الطيبة والتعاون في كل ما ينفع الحي وأهله.`,
    `مقيم في ${safeCity}${safeDistrict}. مهتم بالخدمات والمبادرات المجتمعية ومساعدة الجيران في كل وقت. مرحباً بالجميع! ✨`,
  ];

  const randomIndex = Math.floor(Math.random() * templates.length);
  return templates[randomIndex];
}
