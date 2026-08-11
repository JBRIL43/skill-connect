// Not a "use server" file — safe to export plain objects and types from here.

export type ReadinessQuestion = {
  id: string;
  label: string;
  labelAm: string;
  placeholder: string;
  placeholderAm: string;
};

export const READINESS_QUESTIONS: ReadinessQuestion[] = [
  {
    id: "sector",
    label: "What kind of business do you run or manage?",
    labelAm: "ምን ዓይነት ንግድ ያካሂዳሉ?",
    placeholder:
      "e.g. retail shop in Bole, textile import, vegetable distribution…",
    placeholderAm: "ለምሳሌ፦ በቦሌ የሚገኝ ችርቻሮ ሱቅ፣ ጨርቃ ጨርቅ ወደ ሀገር ማምጣት…",
  },
  {
    id: "team_size",
    label: "How many people are on your team?",
    labelAm: "ቡድንዎ ስንት ሰዎች ናቸው?",
    placeholder: "e.g. 3 full-time, 5 part-time…",
    placeholderAm: "ለምሳሌ፦ 3 ቋሚ፣ 5 ጊዜያዊ…",
  },
  {
    id: "repetitive_task",
    label: "What task takes the most time and still has to be done manually?",
    labelAm: "ብዛት ጊዜ የሚወስደው እና አሁንም በእጅ መሠራት ያለበት ሥራ ምንድን ነው?",
    placeholder:
      "e.g. reconciling daily sales, replying to WhatsApp inquiries…",
    placeholderAm: "ለምሳሌ፦ ዕለታዊ ሽያጭ ማስተካከል፣ ለWhatsApp ጥያቄዎች መልስ መስጠት…",
  },
  {
    id: "ai_familiarity",
    label:
      "Has anyone on your team used an AI tool yet — ChatGPT, Google Gemini, or similar?",
    labelAm:
      "ቡድንዎ ውስጥ አንድ ሰው ቀደም ብሎ AI መሣሪያ ተጠቅሟል — ChatGPT፣ Google Gemini ወይም ሌሎች?",
    placeholder: "e.g. Yes, a few of us use ChatGPT for writing…",
    placeholderAm: "ለምሳሌ፦ አዎ፣ ከእኛ ጥቂቶቻችን ለጽሑፍ ChatGPT እንጠቀማለን…",
  },
  {
    id: "biggest_challenge",
    label:
      "What is the one thing that, if fixed, would make the biggest difference in your business this month?",
    labelAm: "ከተፈቱ ይህ ወር ለንግዱ ትልቁን ለውጥ የሚያመጡ ቁልፍ ጉዳዮች ምንድን ናቸው?",
    placeholder:
      "e.g. faster inventory updates, better customer follow-ups, smoother handover when staff leave…",
    placeholderAm:
      "ለምሳሌ፦ ፈጣን የክምችት ዝመናዎች፣ የተሻለ የደንበኛ ክትትል፣ ሠራተኛ ሲለቀቅ ጥሩ ሽግግር…",
  },
];

export type ReadinessReport = {
  readiness_level: "emerging" | "developing" | "ready";
  readiness_score: number;
  summary: string;
  opportunities: { task: string; impact: string }[];
  next_step: string;
};
