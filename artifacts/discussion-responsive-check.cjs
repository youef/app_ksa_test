// Local visual QA with synthetic data. All Supabase HTTP requests are mocked.
const baseUrl = process.env.QA_BASE_URL || 'http://localhost:8085';
const { chromium } = require('C:/Users/Go/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
let ownerMode = false;
const requestId = '79ded39f-66d7-4cda-861b-32e1be915740';
const viewer = '41000000-0000-4000-8000-000000000001';
const author = '41000000-0000-4000-8000-000000000002';
const questionId = '34e78e30-8b8d-4ae3-bc53-374338ea4abe';
const profile = { id: author, display_name: 'عبدالله من أهل الرياض', username: 'abdullah', city: 'الرياض', district: 'الملقا', role: 'user', account_type: 'individual', profile_privacy: 'public', allow_dms: 'everyone', bio: 'سعيد بمشاركة تجاربي ومساعدة الجيران في مدينتنا.', created_at: '2026-06-01T12:00:00Z' };
const question = { id: questionId, author_id: author, title: 'من يعرف مكانًا مناسبًا للمشي مع العائلة في الرياض؟', body: 'نبحث عن مكان هادئ ومناسب للأطفال. يسعدني سماع تجاربكم واقتراحاتكم، وشكرًا لكل من يشارك بمعلومة مفيدة.', city: 'الرياض', district: 'الملقا', created_at: '2026-10-29T02:00:00Z', status: 'open' };
const answers = [{ id: 'answer-1', author_id: viewer, question_id: questionId, body: 'أنصحك بالحديقة القريبة من الحي، فيها ممرات واسعة وأماكن جلوس للعائلة.', created_at: '2026-10-29T03:00:00Z' }, { id: 'answer-2', parent_answer_id: 'answer-1', author_id: author, question_id: questionId, body: 'شكرًا على الاقتراح، هل المكان مناسب في المساء؟', created_at: '2026-10-29T04:00:00Z' }];
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext();
    await context.addInitScript(({ viewer }) => {
      localStorage.setItem('sb-vkeuyompnddqfvulalkk-auth-token', JSON.stringify({ access_token: 'local-visual-qa', refresh_token: 'local-visual-qa', token_type: 'bearer', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: viewer, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} } }));
      localStorage.setItem('@hayna_active_location_v2', JSON.stringify({ region: 'الرياض', city: 'الرياض', district: 'النرجس' }));
    }, { viewer });
    const scopes = [];
    await context.route('**/*.supabase.co/**', async route => {
      const request = route.request(), url = new URL(request.url());
      let value = [];
      if (url.pathname.includes('/auth/')) value = { id: viewer, role: 'authenticated' };
      else if (url.pathname.includes('/storage/')) return route.fulfill({ status: 404, body: '' });
      else if (url.pathname.endsWith('/rpc/hayna_neighbor_access')) {
        const args = request.postDataJSON(); scopes.push(args.p_scope);
        value = { can_view: args.p_scope === 'city', can_message: false, target_id: author };
      } else if (url.pathname.endsWith('/profiles')) {
        const own = url.searchParams.get('id') === 'eq.' + viewer;
        const row = own ? { ...profile, id: viewer, username: 'viewer', district: 'النرجس' } : profile;
        value = request.headers().accept?.includes('object') ? row : [row];
      } else if (url.pathname.endsWith('/requests')) {
        const row = { id: requestId, requester_id: ownerMode ? viewer : author, title: 'أحتاج مساعدة في نقل بعض الأغراض الخفيفة داخل الحي', description: 'أبحث عن جار يستطيع المساعدة في نقل بعض الأغراض. الوقت مرن ويمكننا الاتفاق على التفاصيل بالخاص.', notes: 'يفضل مساء اليوم، والأغراض جاهزة للنقل.', budget: 100, city: 'الرياض', district: 'الملقا', request_type: 'home', status: 'open', created_at: question.created_at };
        value = request.headers().accept?.includes('object') ? row : [row];
      } else if (url.pathname.endsWith('/help_matches')) value = [{ id: 'match-1', helper_id: author, message: 'أقدر أساعدك مساء اليوم، خلنا نتفق على الوقت المناسب بالخاص.', status: ownerMode ? 'accepted' : 'proposed', created_at: question.created_at, profiles: { ...profile, display_name: 'جار متعاون من أهل المدينة باسم طويل لاختبار الالتفاف' } }];
      else if (url.pathname.endsWith('/questions')) value = request.headers().accept?.includes('object') ? question : [question];
      else if (url.pathname.endsWith('/answers')) value = answers;
      else if (url.pathname.endsWith('/profile_customizations')) value = null;
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/1' }, body: JSON.stringify(value) });
    });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    for (const size of (process.env.QA_QUICK ? [{width:375,height:812},{width:844,height:390}] : [{width:320,height:740},{width:375,height:812},{width:390,height:844},{width:412,height:915},{width:768,height:1024},{width:1440,height:1000},{width:844,height:390}])) {
      await page.setViewportSize(size);
      for (const route of ['question', 'request']) {
        await page.goto(baseUrl + '/' + route + '?id=' + (route === 'question' ? questionId : requestId), { waitUntil: 'domcontentloaded', timeout: 120000 });
        await page.getByText(route === 'question' ? 'إجابات وردود الجيران' : 'عروض المساعدة من الجيران', { exact: true }).waitFor({ timeout: 90000 });
        const input = page.getByTestId('discussion-composer-input');
        await input.scrollIntoViewIfNeeded();
        const empty = await input.boundingBox();
        if (empty.height > 60) throw new Error('Empty composer too tall: ' + empty.height);
        const send = page.getByTestId('discussion-composer-send');
        if (!await send.isDisabled()) throw new Error('Empty composer allows sending');
        await input.fill('هذه رسالة اختبار طويلة لتجربة تمدد حقل الكتابة\nسطر ثانٍ يوضح تفاصيل الرد\nسطر ثالث\nسطر رابع\nسطر خامس\nسطر سادس');
        await page.waitForTimeout(150);
        const grown = await input.boundingBox();
        if (grown.height < empty.height || grown.height > 130) throw new Error('Invalid composer height: ' + grown.height);
        if (await send.isDisabled()) throw new Error('Written reply cannot be sent');
        await input.fill('');
        await input.blur();
        await page.waitForTimeout(150);
        const reset = await input.boundingBox();
        if (reset.height > 60) throw new Error('Composer did not shrink after clearing');
        const overflow = await page.evaluate(() => [...document.querySelectorAll('body *')].some(el => {
          const style = getComputedStyle(el), r = el.getBoundingClientRect();
          return style.position !== 'absolute' && style.display !== 'none' && r.width > 0 && (r.left < -2 || r.right > innerWidth + 2) && !el.closest('[role="tablist"]');
        }));
        if (overflow) throw new Error('Horizontal element overflow at ' + route + ' ' + size.width);
        if ([375,1440].includes(size.width)) await page.screenshot({ path: `artifacts/${route}-unified-${size.width}.png`, fullPage: true });
        console.log(`${route}: ${size.width}x${size.height}, compact composer, disabled empty send, bounded growth, reset, no overflow`);
      }
    }
    await page.goto(baseUrl + '/question?id=' + questionId, { waitUntil:'domcontentloaded' });
    const edit = page.getByText('تعديل', {exact:true});
    await edit.waitFor(); await edit.click();
    await page.getByText('تعديل الرد', {exact:true}).waitFor();
    await page.getByPlaceholder('اكتب الرد بعد التعديل...').fill('رد معدل للاختبار فقط');
    await page.getByText('حفظ الرد', {exact:true}).scrollIntoViewIfNeeded();
    await page.screenshot({path:'artifacts/question-edit-landscape.png'});
    console.log('Question edit modal scrolls in landscape; no save performed.');
    ownerMode = true;
    await page.setViewportSize({width:844,height:390});
    await page.goto(baseUrl + '/request?id=' + requestId, { waitUntil:'domcontentloaded' });
    const finish = page.getByText('إتمام الطلب وشكر الفازع ☕ (+15 نقطة سمعة)', { exact:true });
    await finish.waitFor(); await finish.click();
    await page.getByText('اختر عبارة شكر وتقدير لجارك:', {exact:true}).waitFor();
    const modal = page.getByText('إتمام الطلب وشكر الفازع ☕', {exact:true});
    if (!await modal.isVisible()) throw new Error('Completion modal is not visible');
    await page.getByPlaceholder('اكتب رسالة شكر خاصة لجارك...').fill('شكراً على المساعدة');
    await page.getByText('اعتماد الإتمام وإهداء القهوة والسمعة (+15 نقطة) ☕', {exact:true}).scrollIntoViewIfNeeded();
    await page.screenshot({path:'artifacts/request-completion-landscape.png'});
    console.log('Completion modal scrolls in landscape; no submission performed.');
    if (errors.length) throw new Error(errors.join('\n'));
    console.log('Both discussion pages passed responsive browser checks with synthetic data.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
