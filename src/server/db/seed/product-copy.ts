/**
 * Localized product copy used to seed product_translations / variant_translations.
 * (Moved out of the client i18n bundle — the database is now the source of truth.)
 */
type Copy = Record<string, { short: string; description: string; specs: string[][]; inTheBox: string[]; variants: Record<string, string> }>;

export const productCopyFr: Copy = {
    "reverseview-pro-kit": {
      short: "Caméra de recul HD 1080p avec écran 4,3″ et vision nocturne.",
      description:
        "Le kit ReverseView Pro rend chaque manœuvre simple : caméra étanche IP68, écran couleur 4,3 pouces, lignes de guidage et vision nocturne claire. Installation en moins de 30 minutes, compatible 12/24 V.",
      specs: [
        ["Résolution", "1080p Full HD"],
        ["Écran", "4,3″ couleur"],
        ["Étanchéité", "IP68"],
        ["Angle", "170°"],
        ["Alimentation", "12/24 V"],
      ],
      inTheBox: ["Caméra de recul", "Écran 4,3″", "Câble vidéo 6 m", "Kit de fixation", "Guide d’installation"],
      variants: { standard: "Standard", extended: "Câble rallongé 10 m" },
    },
    "roadeye-dual-dash-cam": {
      short: "Dash cam double avant + intérieur, 2K et vision nocturne.",
      description:
        "RoadEye filme la route et l’habitacle en 2K, avec capteur Sony, vision nocturne et détection de choc. Enregistrement en boucle sur carte 128 Go, parfait pour les trajets quotidiens et les VTC.",
      specs: [
        ["Résolution", "2K + 1080p"],
        ["Capteur", "Sony STARVIS"],
        ["Carte", "jusqu’à 128 Go"],
        ["Angle", "150° + 120°"],
        ["Détection", "choc & mouvement"],
      ],
      inTheBox: ["Dash cam double", "Support ventouse", "Câble allume-cigare", "Carte 64 Go", "Guide"],
      variants: { front: "Caméra avant", dual: "Avant + intérieur" },
    },
    "gripdash-phone-mount": {
      short: "Support téléphone magnétique pour grille d’aération.",
      description:
        "GripDash fixe votre téléphone d’une main grâce aux aimants N52 et à la rotule 360°. Compatible coques et MagSafe, il se clipse sur la grille sans outil et ne bloque jamais la vue.",
      specs: [
        ["Fixation", "grille d’aération"],
        ["Rotation", "360°"],
        ["Aimants", "N52"],
        ["Compatibilité", "MagSafe & coques"],
      ],
      inTheBox: ["Support magnétique", "Plaque métal", "Adaptateur grille"],
      variants: { standard: "Standard", carbon: "Finition carbone" },
    },
    "cargofold-trunk-organizer": {
      short: "Organisateur de coffre pliable, imperméable et antidérapant.",
      description:
        "CargoFold garde votre coffre net : compartiments modulables, fond antidérapant, tissu Oxford 600D imperméable. Se plie à plat en secondes quand vous n’en avez pas besoin.",
      specs: [
        ["Matière", "Oxford 600D"],
        ["Capacité", "60 L"],
        ["Base", "antidérapante"],
        ["Pliable", "oui"],
      ],
      inTheBox: ["Organisateur", "Séparateurs", "Sangles de fixation"],
      variants: { three: "3 compartiments", five: "5 compartiments" },
    },
    "tactical-seatback-panel": {
      short: "Panneau MOLLE de dossier pour ranger l’essentiel.",
      description:
        "Le panneau Tactical transforme le dossier de vos sièges en rangement modulaire : système MOLLE, poches multiples, attaches solides. Idéal pour les outils, câbles et accessoires du quotidien.",
      specs: [
        ["Système", "MOLLE"],
        ["Matière", "nylon 1000D"],
        ["Fixation", "sangles réglables"],
        ["Poches", "4"],
      ],
      inTheBox: ["Panneau MOLLE", "Pochettes", "Sangles"],
      variants: { single: "Panneau seul", bundle: "Panneau + pochettes" },
    },
    "airvac-2in1-cordless": {
      short: "Aspirateur sans fil 2-en-1, 8000 Pa, pour voiture et maison.",
      description:
        "AirVac aspire poussière, sable et débris avec 8000 Pa d’aspiration, sans fil et léger. Filtre HEPA lavable, batterie USB-C, embouts pour les recoins. La voiture propre, sans effort.",
      specs: [
        ["Aspiration", "8000 Pa"],
        ["Batterie", "USB-C"],
        ["Filtre", "HEPA lavable"],
        ["Autonomie", "30 min"],
        ["Poids", "450 g"],
      ],
      inTheBox: ["Aspirateur", "Filtre HEPA", "Suceur plat", "Brosse", "Câble USB-C"],
      variants: { standard: "Standard", pro: "Pro (batterie +)" },
    },
    "snowfoam-cannon-lance": {
      short: "Canon à mousse pour nettoyeur haute pression.",
      description:
        "SnowFoam produit une mousse épaisse qui décolle la saleté sans frotter. Bouteille 1 L graduée, buse réglable, raccords compatibles avec la plupart des nettoyeurs haute pression.",
      specs: [
        ["Bouteille", "1 L graduée"],
        ["Buse", "réglable"],
        ["Raccord", "universel"],
        ["Pression", "jusqu’à 200 bar"],
      ],
      inTheBox: ["Canon à mousse", "Bouteille 1 L", "Raccords", "Buse"],
      variants: { standard: "Standard", foam15: "Bouteille 1,5 L" },
    },
    "lumencore-led-pair": {
      short: "Paire d’ampoules LED H7, 6000 K, faisceau précis.",
      description:
        "LumenCore remplace vos halogènes par des LED 6000 K deux fois plus lumineuses, avec un faisceau net qui n’éblouit pas. Refroidissement ventilé, installation plug & play, canbus anti-erreur.",
      specs: [
        ["Type", "H7"],
        ["Température", "6000 K"],
        ["Luminosité", "2× halogène"],
        ["Refroidissement", "ventilé"],
        ["Canbus", "anti-erreur"],
      ],
      inTheBox: ["2 ampoules LED", "Drivers canbus", "Guide"],
      variants: {},
    },
    "jumpcore-1000-starter": {
      short: "Booster de démarrage 1000 A + batterie USB.",
      description:
        "JumpCore démarre une voiture à plat en secondes, jusqu’à 1000 A, avec protection anti-étincelles. Fait aussi batterie USB pour vos appareils. Compact, il se range dans la boîte à gants.",
      specs: [
        ["Courant", "1000 A"],
        ["Moteurs", "essence ≤ 6 L / diesel ≤ 3 L"],
        ["Sortie", "USB"],
        ["Protection", "anti-étincelles"],
      ],
      inTheBox: ["Booster", "Pinces intelligentes", "Câble USB", "Housse"],
      variants: { j1000: "1000 A", j2000: "2000 A" },
    },
    "precisionfill-inflator": {
      short: "Gonfleur numérique portable avec arrêt automatique.",
      description:
        "PrecisionFill gonfle pneus, vélos et ballons avec une pression préréglée et un arrêt automatique. Écran LED, lampe intégrée, batterie rechargeable. La bonne pression, à chaque fois.",
      specs: [
        ["Pression max", "150 PSI"],
        ["Arrêt", "automatique"],
        ["Écran", "LED"],
        ["Batterie", "rechargeable"],
      ],
      inTheBox: ["Gonfleur", "Embouts", "Câble USB-C", "Housse"],
      variants: { standard: "Standard", case: "Avec mallette" },
    },
    "scanpro-v302-obd2": {
      short: "Scanner OBD2 Bluetooth, diagnostic moteur en direct.",
      description:
        "ScanPro lit et efface les codes défaut, affiche les données moteur en direct et fonctionne avec les apps iOS/Android. Compatible toutes voitures OBD2 depuis 1996. Le diagnostic sans passer au garage.",
      specs: [
        ["Connexion", "Bluetooth"],
        ["Protocoles", "OBD2 / EOBD"],
        ["Apps", "iOS & Android"],
        ["Données", "en direct"],
      ],
      inTheBox: ["Scanner OBD2", "Guide", "Accès app"],
      variants: { standard: "Standard", plus: "Plus (données avancées)" },
    },
    "sportgrip-wheel-cover": {
      short: "Housse de volant cuir microfibre, prise en main sportive.",
      description:
        "SportGrip habille votre volant de microfibre respirante, antidérapante et agréable en toutes saisons. Installation sans outil, coutures renforcées, diamètre universel 38 cm.",
      specs: [
        ["Matière", "microfibre cuir"],
        ["Diamètre", "38 cm"],
        ["Prise", "antidérapante"],
        ["Installation", "sans outil"],
      ],
      inTheBox: ["Housse de volant", "Guide"],
      variants: { black: "Noir", carbon: "Carbone" },
    },
  };

export const productCopyAr: Copy = {
    "reverseview-pro-kit": {
      short: "كاميرا رجوع HD 1080p بشاشة 4.3 بوصة ورؤية ليلية.",
      description:
        "طقم ReverseView Pro يجعل كل مناورة سهلة: كاميرا مقاومة للماء IP68، شاشة ملونة 4.3 بوصة، خطوط إرشاد ورؤية ليلية واضحة. التركيب في أقل من 30 دقيقة، متوافق مع 12/24 فولت.",
      specs: [
        ["الدقة", "1080p Full HD"],
        ["الشاشة", "4.3 بوصة ملونة"],
        ["مقاومة الماء", "IP68"],
        ["الزاوية", "170°"],
        ["التغذية", "12/24 فولت"],
      ],
      inTheBox: ["كاميرا رجوع", "شاشة 4.3 بوصة", "كابل فيديو 6 م", "طقم تثبيت", "دليل التركيب"],
      variants: { standard: "قياسي", extended: "كابل ممدود 10 م" },
    },
    "roadeye-dual-dash-cam": {
      short: "كاميرا سيارة مزدوجة أمامية + داخلية، 2K ورؤية ليلية.",
      description:
        "تصوّر RoadEye الطريق والمقصورة بدقة 2K، بمستشعر Sony ورؤية ليلية وكشف الصدمات. تسجيل متواصل على بطاقة 128 جيجا، مثالية للتنقلات اليومية وسيارات الأجرة.",
      specs: [
        ["الدقة", "2K + 1080p"],
        ["المستشعر", "Sony STARVIS"],
        ["البطاقة", "حتى 128 جيجا"],
        ["الزاوية", "150° + 120°"],
        ["الكشف", "صدمات وحركة"],
      ],
      inTheBox: ["كاميرا مزدوجة", "حامل بمصاصة", "كابل ولاعة", "بطاقة 64 جيجا", "دليل"],
      variants: { front: "كاميرا أمامية", dual: "أمامية + داخلية" },
    },
    "gripdash-phone-mount": {
      short: "حامل هاتف مغناطيسي لفتحة التكييف.",
      description:
        "يثبّت GripDash هاتفك بيد واحدة بفضل مغناطيسات N52 ومفصل دوار 360°. متوافق مع الأغطية وMagSafe، يُثبَّت على الفتحة بدون أدوات ولا يحجب الرؤية أبدًا.",
      specs: [
        ["التثبيت", "فتحة التكييف"],
        ["الدوران", "360°"],
        ["المغناطيس", "N52"],
        ["التوافق", "MagSafe والأغطية"],
      ],
      inTheBox: ["حامل مغناطيسي", "لوح معدني", "محول فتحة"],
      variants: { standard: "قياسي", carbon: "لمسة كربون" },
    },
    "cargofold-trunk-organizer": {
      short: "منظم صندوق سيارة قابل للطي، مقاوم للماء وانزلاق.",
      description:
        "يحافظ CargoFold على صندوق سيارته منظمًا: مداخل قابلة للتعديل، قاعدة مانعة للانزلاق، قماش أكسفورد 600D مقاوم للماء. يُطوى بشكل مسطح في ثوانٍ عند عدم الاستخدام.",
      specs: [
        ["المادة", "أكسفورد 600D"],
        ["السعة", "60 لتر"],
        ["القاعدة", "مانعة للانزلاق"],
        ["قابل للطي", "نعم"],
      ],
      inTheBox: ["منظم", "فواصل", "أحزمة تثبيت"],
      variants: { three: "3 مداخل", five: "5 مداخل" },
    },
    "tactical-seatback-panel": {
      short: "لوح MOLLE لظهر الكرسي لترتيب الأساسيات.",
      description:
        "يحوّل لوح Tactical ظهر مقاعدك إلى تخزين modular: نظام MOLLE، جيوب متعددة، روابط متينة. مثالي للأدوات والكابلات وملحقات الاستخدام اليومي.",
      specs: [
        ["النظام", "MOLLE"],
        ["المادة", "نايلون 1000D"],
        ["التثبيت", "أحزمة قابلة للتعديل"],
        ["الجيوب", "4"],
      ],
      inTheBox: ["لوح MOLLE", "جيوب", "أحزمة"],
      variants: { single: "لوح فقط", bundle: "لوح + جيوب" },
    },
    "airvac-2in1-cordless": {
      short: "مكنسة لاسلكية 2 في 1، 8000 باسكال، للسيارة والمنزل.",
      description:
        "تشفط AirVac الغبار والرمال والحطام بقدرة 8000 باسكال، لاسلكية وخفيفة. فلتر HEPA قابل للغسل، بطارية USB-C، فوهات للأركان. سيارة نظيفة، بدون مجهود.",
      specs: [
        ["الشفط", "8000 باسكال"],
        ["البطارية", "USB-C"],
        ["الفلتر", "HEPA قابل للغسل"],
        ["الاستقلالية", "30 دقيقة"],
        ["الوزن", "450 غ"],
      ],
      inTheBox: ["مكنسة", "فلتر HEPA", "فوهة مسطحة", "فرشاة", "كابل USB-C"],
      variants: { standard: "قياسي", pro: "برو (بطارية +)" },
    },
    "snowfoam-cannon-lance": {
      short: "مدفع رغوة لمنظف الضغط العالي.",
      description:
        "ينتج SnowFoam رغوة كثيفة ترفع الأوساخ بدون فرك. قارورة 1 لتر مدرجة، فوهة قابلة للتعديل، وصلات متوافقة مع معظم منظفات الضغط العالي.",
      specs: [
        ["القارورة", "1 لتر مدرجة"],
        ["الفوهة", "قابلة للتعديل"],
        ["الوصلة", "عالمية"],
        ["الضغط", "حتى 200 بار"],
      ],
      inTheBox: ["مدفع رغوة", "قارورة 1 لتر", "وصلات", "فوهة"],
      variants: { standard: "قياسي", foam15: "قارورة 1.5 لتر" },
    },
    "lumencore-led-pair": {
      short: "زوج مصابيح LED H7، 6000 كلفن، حزمة ضوء دقيقة.",
      description:
        "يستبدل LumenCore مصابيح الهالوجين القديمة بتقنية LED أكثر إضاءة مرتين بحزمة ضوء واضحة. تبريد بالهواء، تركيب مباشر، كان بس مضاد للأخطاء.",
      specs: [
        ["النوع", "H7"],
        ["الحرارة", "6000 كلفن"],
        ["الإضاءة", "2× الهالوجين"],
        ["التبريد", "بالهواء"],
        ["Canbus", "مضاد للأخطاء"],
      ],
      inTheBox: ["2 لمبات LED", "محركات canbus", "دليل"],
      variants: {},
    },
    "jumpcore-1000-starter": {
      short: "مبدأ تشغيل 1000 أمبير + باور بانك USB.",
      description:
        "يشغّل JumpCore سيارة ببطارية فارغة خلال ثوانٍ حتى 1000 أمبير، مع حماية من الشرر والعكس. يعمل كباور بانك لأجهزتك. بحجم كتاب الجيب يوضع في درج الأدوات.",
      specs: [
        ["التيار", "1000 أمبير"],
        ["المحركات", "بنزين ≤ 6 لتر / ديزل ≤ 3 لتر"],
        ["الخرج", "USB"],
        ["الحماية", "مضاد للشرر"],
      ],
      inTheBox: ["مبدأ تشغيل", "كلابات ذكية", "كابل USB", "حافظة"],
      variants: { j1000: "1000 أمبير", j2000: "2000 أمبير" },
    },
    "precisionfill-inflator": {
      short: "منفاخ هواء رقمي محمول بإيقاف تلقائي.",
      description:
        "ينفخ PrecisionFill الإطارات والدراجات والكرات بضغط مسبق الإعداد مع إيقاف تلقائي. شاشة LED، مصباح مدمج، بطارية قابلة للشحن. الضغط الصحيح، في كل مرة.",
      specs: [
        ["أقصى ضغط", "150 PSI"],
        ["الإيقاف", "تلقائي"],
        ["الشاشة", "LED"],
        ["البطارية", "قابلة للشحن"],
      ],
      inTheBox: ["منفاخ", "فوهات", "كابل USB-C", "حافظة"],
      variants: { standard: "قياسي", case: "مع حقيبة" },
    },
    "scanpro-v302-obd2": {
      short: "ماسح OBD2 بلوتوث، تشخيص المحرك مباشرة.",
      description:
        "يقرأ ScanPro أخطاء المحرك ويمسحها، ويعرض البيانات المباشرة ويعمل مع تطبيقات iOS/Android. متوافق مع كل سيارات OBD2 منذ 1996. التشخيص دون الذهاب إلى الورشة.",
      specs: [
        ["الاتصال", "بلوتوث"],
        ["البروتوكولات", "OBD2 / EOBD"],
        ["التطبيقات", "iOS و Android"],
        ["البيانات", "مباشرة"],
      ],
      inTheBox: ["ماسح OBD2", "دليل", "وصول للتطبيق"],
      variants: { standard: "قياسي", plus: "بلس (بيانات متقدمة)" },
    },
    "sportgrip-wheel-cover": {
      short: "كسوة عجلة قيادة جلد مايكروفايبر بمسكة رياضية.",
      description:
        "يكسو SportGrip عجلة قيادتك بمايكروفايبر يسمح بالتهواء، مضاد للانزلاق ومريح في كل الفصول. التركيب بدون أدوات، خياطة معززة، قطر عالمي 38 سم.",
      specs: [
        ["المادة", "مايكروفايبر جلد"],
        ["القطر", "38 سم"],
        ["المسكة", "مضادة للانزلاق"],
        ["التركيب", "بدون أدوات"],
      ],
      inTheBox: ["كسوة عجلة", "دليل"],
      variants: { black: "أسود", carbon: "كربون" },
    },
  };
