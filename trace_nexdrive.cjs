const cheerio = require('d:/Exotic Clean/node_modules/cheerio');

async function traceNexDrive(url) {
  console.log('Tracing NexDrive:', url);
  let curr = url;
  for (let step = 0; step < 8; step++) {
    console.log(`\nStep ${step}: ${curr}`);
    const res = await fetch(curr, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': curr
      },
      redirect: 'manual'
    });
    console.log('  Status:', res.status);
    if ([301, 302, 307, 308].includes(res.status)) {
      const loc = res.headers.get('location');
      console.log('  Redirect:', loc);
      if (!loc) break;
      curr = loc.startsWith('http') ? loc : new URL(loc, curr).href;
    } else if (res.status === 200) {
      const html = await res.text();
      const $ = cheerio.load(html);
      console.log('  Page Title:', $('title').text().trim());

      console.log('  Forms:', $('form').length);
      $('form').each((i, el) => {
        console.log(`  Form [${i}]: action="${$(el).attr('action')}" method="${$(el).attr('method')}"`);
        $(el).find('input').each((_, inp) => {
          console.log(`    Input: name="${$(inp).attr('name')}" type="${$(inp).attr('type')}" value="${$(inp).attr('value')}"`);
        });
      });

      console.log('  Links:');
      $('a').each((i, el) => {
        const h = $(el).attr('href');
        const t = $(el).text().trim();
        if (h && (h.includes('drive') || h.includes('download') || h.includes('file') || h.includes('fast') || h.includes('cloud') || h.includes('link') || t.toLowerCase().includes('download'))) {
          console.log(`    Link [${i}]: "${t}" -> "${h}"`);
        }
      });
      break;
    } else {
      break;
    }
  }
}

traceNexDrive('https://nexdrive.help/genxfm241450119815828/').catch(console.error);
