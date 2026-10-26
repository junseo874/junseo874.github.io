/* Web presentation copy only. Does not add or change shared CSV columns.
 * byChoice overrides an existing choice ID; defaults map existing reason text.
 * Keep secret choices vague: never disclose their unlocking answer here. */
window.LUNA_CHOICE_FEEDBACK = {
  fallback: '지금은 선택할 수 없습니다.',
  byChoice: { 'beggar-question': '아직 알 수 없습니다.' },
  defaults: {
    '돈이 부족합니다.': '돈이 부족합니다.',
    '참치캔이 없습니다.': '참치캔이 없습니다.',
    '기어 부품이 없습니다.': '기어 부품이 없습니다.',
    '엘리베이터 수리가 필요합니다.': '엘리베이터 수리가 필요합니다.',
    '이미 받았습니다.': '이미 받았습니다.',
    '거래 중입니다.': '거래 중입니다.'
  }
};
