// Local visual QA with synthetic data. All Supabase HTTP requests are mocked.
const { chromium } = require('C:/Users/Go/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const viewer = '41000000-0000-4000-8000-000000000001';
const author = '41000000-0000-4000-8000-000000000002';
const questionId = '34e78e30-8b8d-4ae3-bc53-374338ea4abe';
const profile = { id: author, display_name: 'عبدالله من أهل الرياض', username: 'abdullah', city: 'الرياض', district: 'النرجس', role: 'user', account_type: 'individual', profile_privacy: 'public', allow_dms: 'everyone', bio: 'سعيد بمشاركة تجاربي ومساعدة الجيران في مدينتنا.', created_at: '2026-06-01T12:00:00Z' };
const question = { id: questionId, author_id: author, title: 'من يعرف مكانًا مناسبًا للمشي مع العائلة في الرياض؟', body: 'نبحث عن مكان هادئ ومناسب للأطفال. يسعدني سماع تجاربكم واقتراحاتكم، وشكرًا لكل من يشارك بمعلومة مفيدة.', city: 'الرياض', district: 'النرجس', created_at: '2026-10-29T02:00:00Z', status: 'open' };
const answers = [{ id: 'answer-1', author_id: viewer, question_id: questionId, body: 'أنصحك بالحديقة القريبة من الحي، فيها ممرات واسعة وأماكن جلوس للعائلة.', created_at: '2026-10-29T03:00:00Z' }, { id: 'answer-2', parent_answer_id: 'answer-1', author_id: author, question_id: questionId, body: 'شكرًا على الاقتراح، هل المكان مناسب في المساء؟', created_at: '2026-10-29T04:00:00Z' }];
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext();
    await context.addInitScript(({ viewer }) => {
      localStorage.setItem('sb-vkeuyompnddqfvulalkk-auth-token', JSON.stringify({ access_token: 'local-visual-qa', refresh_token: 'local-visual-qa', token_type: 'bearer', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: viewer, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} } }));
      localStorage.setItem('@hayna_location_last_auto_check_v1', String(Date.now()));
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
      } else if (url.pathname.endsWith('/home_announcements')) value = [{id:'notice',title:'أهلًا بجيراننا',message:'شارك سؤالًا أو قدّم مساعدة، وكل مساهمة تصنع فرقًا في الحي.',expires_at:new Date(Date.now()+3600000).toISOString(),action_type:'none'}];
      else if (url.pathname.endsWith('/requests')) value = [{ id:'request-home',requester_id:author,title:'من يستطيع المساعدة في نقل أغراض خفيفة؟',description:'نرتب الوقت المناسب في المحادثة الخاصة.',city:'الرياض',district:'النرجس',status:'open',created_at:question.created_at }];
      else if (url.pathname.endsWith('/stories')) value = [{ id:'story',author_id:author,type:'text',content:'صباح الخير',created_at:new Date().toISOString(),expires_at:new Date(Date.now()+3600000).toISOString(),profiles:profile }];
      else if (url.pathname.endsWith('/questions')) value = request.headers().accept?.includes('object') ? question : [question];
      else if (url.pathname.endsWith('/answers')) value = answers;
      else if (url.pathname.endsWith('/profile_customizations')) value = null;
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/1' }, body: JSON.stringify(value) });
    });
    await context.route('**/*open-meteo.com/**', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({results:[],current:{temperature_2m:28,apparent_temperature:29,relative_humidity_2m:30,wind_speed_10m:8,weather_code:0,is_day:1,precipitation:0,time:new Date().toISOString()}})}));
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    for (const size of (process.env.QA_QUICK ? [{width:320,height:740},{width:375,height:812}] : [{width:320,height:740},{width:375,height:812},{width:412,height:915},{width:768,height:1024},{width:1440,height:1000},{width:844,height:390}])) {
      await page.setViewportSize(size);
      await page.goto('http://localhost:8088/home', {waitUntil:'domcontentloaded',timeout:120000});
      await page.getByText(question.title,{exact:true}).waitFor({timeout:90000});
      for (const title of ['يوميات الجيران','منشورات الحي','اسأل، ساعد، وتابع جديد جيرانك']) {
        if (await page.getByText(title,{exact:true}).count()) throw new Error('Removed heading is still visible');
      }
      const controls = [page.getByRole('button',{name:'تصفية المنشورات',exact:true}), ...['الأحدث','الأكثر تفاعلاً','من حيّنا'].map(name=>page.getByRole('button',{name,exact:true}))];
      const boxes = await Promise.all(controls.map(control=>control.boundingBox()));
      if (boxes.some(box=>box.height>36 || Math.abs(box.y-boxes[0].y)>1)) throw new Error('Controls are not compact and aligned');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      if (overflow) throw new Error('Home page overflows at ' + size.width);
      if ([320,375].includes(size.width)) await page.screenshot({path:`artifacts/home-compact-${size.width}.png`,fullPage:true});
      await page.getByRole('button',{name:'تصفية المنشورات',exact:true}).click();
      await page.getByRole('button',{name:'أسئلة واستفسارات',exact:true}).waitFor({state:'visible'});
      await page.waitForTimeout(350);
      const questionFilter = page.getByRole('button',{name:'أسئلة واستفسارات',exact:true});
      if ((await questionFilter.boundingBox()).height < 44) throw new Error('Filter touch target too small: ' + JSON.stringify(await questionFilter.boundingBox()));
      await questionFilter.click();
      const apply = page.getByText('اعتماد التصفية',{exact:true});
      await apply.scrollIntoViewIfNeeded();
      if ([375,844].includes(size.width)) await page.screenshot({path:`artifacts/home-filters-${size.width}.png`});
      await apply.click();
      const clear = page.getByRole('button',{name:'إزالة تصفية أسئلة واستفسارات',exact:true});
      await clear.waitFor();
      if (await page.getByText('من يستطيع المساعدة في نقل أغراض خفيفة؟',{exact:true}).count()) throw new Error('Request remained after question filter');
      await clear.click();
      await page.getByText('من يستطيع المساعدة في نقل أغراض خفيفة؟',{exact:true}).waitFor();
      await page.getByText('الأكثر تفاعلاً',{exact:true}).click();
      console.log(`Home ${size.width}x${size.height}: no overflow; filters apply and clear; sort works`);
    }
    await page.setViewportSize({width:375,height:812});
    await page.evaluate(()=>localStorage.setItem('@hayna_theme_mode','dark'));
    await page.reload({waitUntil:'domcontentloaded'});
    await page.getByText(question.title,{exact:true}).waitFor();
    await page.screenshot({path:'artifacts/home-refined-dark-375.png'});
    await page.getByRole('button',{name:'تصفية المنشورات',exact:true}).click();
    await page.screenshot({path:'artifacts/home-filters-dark-375.png'});
    if (errors.length) throw new Error(errors.join('\n'));
    console.log('Home page light and dark layouts passed with synthetic local data.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
