// Each card needs `correct` + at least 2 `distractors` (3–4 total options in-game).
// type: 'zh-en'  → show Chinese, pick English
// type: 'en-zh'  → show English, pick Chinese
// type: 'fill'   → show sentence with ___, pick the missing Chinese word

export const DECK = [
  // ── zh → en ──────────────────────────────────────────────────────────────
  { type: 'zh-en', zh: '安静', py: 'ānjìng',    correct: 'quiet',       distractors: ['loud', 'clean', 'dark'] },
  { type: 'zh-en', zh: '帮忙', py: 'bāngmáng',  correct: 'to help',     distractors: ['to stop', 'to find', 'to leave'] },
  { type: 'zh-en', zh: '超市', py: 'chāoshì',   correct: 'supermarket', distractors: ['library', 'school', 'hospital'] },
  { type: 'zh-en', zh: '地图', py: 'dìtú',      correct: 'map',         distractors: ['book', 'picture', 'letter'] },
  { type: 'zh-en', zh: '发现', py: 'fāxiàn',    correct: 'to discover', distractors: ['to forget', 'to lose', 'to teach'] },
  { type: 'zh-en', zh: '健康', py: 'jiànkāng',  correct: 'healthy',     distractors: ['tired', 'hungry', 'busy'] },
  { type: 'zh-en', zh: '礼物', py: 'lǐwù',      correct: 'gift',        distractors: ['money', 'letter', 'ticket'] },
  { type: 'zh-en', zh: '担心', py: 'dānxīn',    correct: 'to worry',    distractors: ['to hurry', 'to rest', 'to wait'] },
  { type: 'zh-en', zh: '聪明', py: 'cōngmíng',  correct: 'smart',       distractors: ['brave', 'kind', 'funny'] },
  { type: 'zh-en', zh: '方便', py: 'fāngbiàn',  correct: 'convenient',  distractors: ['expensive', 'difficult', 'dangerous'] },
  { type: 'zh-en', zh: '故事', py: 'gùshi',     correct: 'story',       distractors: ['song', 'movie', 'game'] },
  { type: 'zh-en', zh: '感冒', py: 'gǎnmào',    correct: 'a cold',      distractors: ['a fever', 'a headache', 'an injury'] },
  { type: 'zh-en', zh: '城市', py: 'chéngshì',  correct: 'city',        distractors: ['village', 'country', 'island'] },
  { type: 'zh-en', zh: '经常', py: 'jīngcháng', correct: 'often',       distractors: ['never', 'sometimes', 'already'] },
  { type: 'zh-en', zh: '马上', py: 'mǎshàng',   correct: 'right away',  distractors: ['later', 'yesterday', 'slowly'] },
  { type: 'zh-en', zh: '练习', py: 'liànxí',    correct: 'to practise', distractors: ['to study', 'to teach', 'to test'] },
  { type: 'zh-en', zh: '离开', py: 'líkāi',     correct: 'to leave',    distractors: ['to arrive', 'to stay', 'to visit'] },
  { type: 'zh-en', zh: '节日', py: 'jiérì',     correct: 'festival',    distractors: ['weather', 'season', 'weekend'] },
  { type: 'zh-en', zh: '冰箱', py: 'bīngxiāng', correct: 'fridge',      distractors: ['oven', 'microwave', 'sink'] },
  { type: 'zh-en', zh: '爱好', py: 'àihào',     correct: 'hobby',       distractors: ['talent', 'habit', 'dream'] },

  // ── en → zh ──────────────────────────────────────────────────────────────
  { type: 'en-zh', en: 'to remember', correct: '记得', distractors: ['忘记', '知道', '认识'] },
  { type: 'en-zh', en: 'suitable',    correct: '合适', distractors: ['方便', '容易', '简单'] },
  { type: 'en-zh', en: 'to compare',  correct: '比较', distractors: ['选择', '决定', '判断'] },
  { type: 'en-zh', en: 'to worry',    correct: '担心', distractors: ['害怕', '生气', '难过'] },
  { type: 'en-zh', en: 'gift',        correct: '礼物', distractors: ['钱包', '信封', '票'] },
  { type: 'en-zh', en: 'city',        correct: '城市', distractors: ['农村', '国家', '地区'] },
  { type: 'en-zh', en: 'often',       correct: '经常', distractors: ['已经', '从来', '马上'] },
  { type: 'en-zh', en: 'healthy',     correct: '健康', distractors: ['安静', '聪明', '方便'] },

  // ── fill in the blank ─────────────────────────────────────────────────────
  {
    type: 'fill',
    sentence: '我在___买东西。',
    hint: 'I buy things at the ___.',
    correct: '超市', distractors: ['学校', '医院', '银行'],
  },
  {
    type: 'fill',
    sentence: '他的身体很___。',
    hint: 'His body is very ___.',
    correct: '健康', distractors: ['聪明', '安静', '方便'],
  },
  {
    type: 'fill',
    sentence: '请你___帮我一下。',
    hint: 'Please ___ help me.',
    correct: '马上', distractors: ['经常', '已经', '从来'],
  },
  {
    type: 'fill',
    sentence: '这个___真好看！',
    hint: 'This ___ is so pretty!',
    correct: '礼物', distractors: ['故事', '地图', '城市'],
  },
]
