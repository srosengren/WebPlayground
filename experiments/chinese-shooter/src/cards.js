// Six HSK3 cards. Card 4 deliberately re-uses 超市 from card 3
// to show the spaced-repetition reinforcement concept.
export const DECK = [
  {
    type: 'vocab',
    zh: '安静',
    py: 'ānjìng',
    correct: 'quiet',
    wrong: 'loud',
  },
  {
    type: 'vocab',
    zh: '帮忙',
    py: 'bāngmáng',
    correct: 'to help',
    wrong: 'to stop',
  },
  {
    type: 'vocab',
    zh: '超市',
    py: 'chāoshì',
    correct: 'supermarket',
    wrong: 'library',
  },
  {
    type: 'fill',
    sentence: '我在___买东西。',
    hint: '(I buy things at the ___)',
    correct: '超市',
    wrong: '学校',
  },
  {
    type: 'vocab',
    zh: '地图',
    py: 'dìtú',
    correct: 'map',
    wrong: 'picture',
  },
  {
    type: 'vocab',
    zh: '发现',
    py: 'fāxiàn',
    correct: 'to discover',
    wrong: 'to forget',
  },
]
