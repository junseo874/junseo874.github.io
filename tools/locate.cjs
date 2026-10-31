const {features, find} = require('./lib/source-index.cjs');
const args = process.argv.slice(2), query = args.find(a => !a.startsWith('--'));
if (!query) {
  console.log('Usage: node tools/locate.cjs <feature | 파일명 | 함수명> [--symbols] [--all] [--json]');
  for (const [key, value] of Object.entries(features)) console.log(`${key}: ${value.summary}`);
} else {
  const result = find(query, args.includes('--symbols'));
  const limit = args.includes('--all') ? Infinity : 40;
  if (args.includes('--json')) {
    let budget = args.includes('--all') ? Infinity : 80;
    let truncated = result.files.length > limit;
    const files = result.files.slice(0,limit).map(row => {
      const symbols = row.symbols.slice(0,budget);
      budget -= symbols.length;
      truncated ||= symbols.length < row.symbols.length;
      return {...row, symbols};
    });
    console.log(JSON.stringify({...result, files, total:result.files.length, truncated},null,2));
  } else {
    if (result.info) console.log(`${result.info.summary}\n안내: ${result.info.docs}\n엔진 대응: ${result.info.engine}`);
    let budget = args.includes('--all') ? Infinity : 80;
    for (const row of result.files.slice(0,limit)) {
      console.log(`${row.file} (${row.lines} lines)`);
      for (const symbol of row.symbols) if (budget-- > 0) console.log(`  ${symbol.line}: ${symbol.name}`);
    }
    if (!result.files.length) console.log('일치하는 소스가 없습니다. 기능명 목록: node tools/locate.cjs');
    if (result.files.length > limit || budget < 0) console.log('출력을 제한했습니다. 더 좁은 검색어나 --all을 사용하세요.');
  }
}
