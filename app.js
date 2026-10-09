/* ============================================================
   PREBYTE — CAMPUS FOOD OS (FIXED & HARDENED)
   
   FIXES APPLIED:
   1. Firebase Authentication:
      - Graceful local fallback for Student Login & Registration.
      - Dummy/placeholder Firebase keys are automatically cleaned up
        so they do not cause "auth/invalid-credential" or "auth/invalid-api-key"
        errors on student login.
      - 1-Click Demo Login buttons for instant access to Student, Vendor & Admin.
   2. EmailJS Free Tokens / Quota Protection:
      - Prevents burning monthly EmailJS tokens on fake demo domains (@prebyte.demo).
      - Added "Token Saver Mode" toggle in Admin -> Integrations.
      - Pass all common template parameter aliases (to_email, email, user_email,
        student_name, to_name, order_number, order_id, canteen, pickup_slot,
        total, message, summary) so any EmailJS template works.
      - Clear diagnostics when monthly quota (200 emails) is reached,
        switching automatically to in-app alerts without breaking orders.
      - Added real email input during checkout so students can choose
        to receive real emails or save tokens.
   ============================================================ */

const CANTEENS=[
  {id:'uni-centre',name:'Uni-Centre Food Court',short:'Uni-Centre'},
  {id:'arch-block-6',name:'Architecture Block 6 Food Court',short:'Block 6'},
  {id:'blocks-25-26',name:'Blocks 25–26 Canteen',short:'Blocks 25–26'},
  {id:'joy-court',name:'Joy-Court',short:'Joy-Court'},
  {id:'buzzz',name:'Buzzz Food Court',short:'Buzzz'},
  {id:'residential',name:'Residential 24/7 Cafeteria',short:'Residential'}
];

const MENU=[
  ['p1','uni-centre','🍛','Paneer Tikka Rice Bowl','Smoky paneer, rice & mint chutney',149,'Meals'],
  ['p2','uni-centre','🍜','Veg Hakka Noodles','Wok-tossed noodles & vegetables',119,'Meals'],
  ['p3','uni-centre','🥞','Masala Dosa','Crispy dosa, potato masala & sambar',79,'Meals'],
  ['p4','uni-centre','🥤','Cold Coffee','Chilled creamy coffee',69,'Drinks'],
  ['p5','arch-block-6','🌯','Chicken Wrap','Grilled chicken, salad & house sauce',159,'Meals'],
  ['p6','arch-block-6','🥪','Paneer Grill Sandwich','Toasted bread, paneer & vegetables',109,'Meals'],
  ['p7','arch-block-6','🍟','French Fries','Crispy salted fries',69,'Snacks'],
  ['p8','arch-block-6','☕','Masala Chai','Hot tea with cardamom',35,'Drinks'],
  ['p9','blocks-25-26','🍲','Rajma Rice','Punjabi-style rajma with steamed rice',99,'Meals'],
  ['p10','blocks-25-26','🥟','Samosa Duo','Two golden potato samosas',45,'Snacks'],
  ['p11','blocks-25-26','🍋','Fresh Lime Soda','Citrus, mint & fizz',49,'Drinks'],
  ['p12','joy-court','🍕','Veg Cheese Pizza','Personal pizza with vegetables and cheese',139,'Meals'],
  ['p13','joy-court','🍔','Aloo Tikki Burger','Crispy aloo patty, salad & sauce',89,'Meals'],
  ['p14','joy-court','🥤','Cold Coffee','Chilled creamy coffee',69,'Drinks'],
  ['p15','buzzz','🍛','Veg Biryani Bowl','Aromatic biryani with raita',129,'Meals'],
  ['p16','buzzz','🌮','Masala Wrap','Spiced vegetables with fresh salad',89,'Meals'],
  ['p17','buzzz','🧃','Mango Cooler','Chilled mango refresher',59,'Drinks'],
  ['p18','residential','🍜','Noodles Bowl','Quick noodles with vegetables',99,'Meals'],
  ['p19','residential','🥪','Cheese Sandwich','Toasted sandwich with cheese',79,'Snacks'],
  ['p20','residential','☕','Coffee','Fresh brewed hot coffee',45,'Drinks']
].map(x=>({id:x[0],canteenId:x[1],emoji:x[2],name:x[3],desc:x[4],price:x[5],category:x[6],available:true}));

const SLOTS=['12:40 – 12:55','12:55 – 13:10','13:10 – 13:25','13:25 – 13:40','13:40 – 13:55'];

const VENDOR_ACCOUNTS={
  vendor01:{id:'vendor01',email:'vendor01',password:'prebyte123',name:'Uni-Centre Vendor',canteenId:'uni-centre'},
  vendor02:{id:'vendor02',email:'vendor02',password:'prebyte123',name:'Block 6 Vendor',canteenId:'arch-block-6'},
  vendor03:{id:'vendor03',email:'vendor03',password:'prebyte123',name:'Blocks 25–26 Vendor',canteenId:'blocks-25-26'},
  vendor04:{id:'vendor04',email:'vendor04',password:'prebyte123',name:'Joy-Court Vendor',canteenId:'joy-court'},
  vendor05:{id:'vendor05',email:'vendor05',password:'prebyte123',name:'Buzzz Vendor',canteenId:'buzzz'},
  vendor06:{id:'vendor06',email:'vendor06',password:'prebyte123',name:'Residential Vendor',canteenId:'residential'}
};

const DEMO={
  student:{email:'student@prebyte.demo',password:'prebyte123',name:'Demo Student'},
  vendor:VENDOR_ACCOUNTS.vendor01,
  admin:{email:'admin@prebyte.demo',password:'prebyteadmin',name:'PREBYTE Admin'}
};

const KEYS={
  menu:'prebyte_menu_v4',
  orders:'prebyte_orders_v4',
  feedback:'prebyte_feedback_v4',
  settings:'prebyte_settings_v4',
  credentials:'prebyte_credentials_v1'
};

const DUMMY_API_KEY = 'AIzaSyAvNgU6o6hH2DgAZ8AQ1Jx3z6R26iSQj-0';

const defaultSettings={
  firebase:{
    apiKey:'',
    authDomain:'',
    databaseURL:'',
    projectId:'',
    storageBucket:'',
    messagingSenderId:'',
    appId:'',
    measurementId:''
  },
  paypalClientId:'',
  emailjs:{
    publicKey:'vNDHj5ZS7axHnTMCx',
    serviceId:'service_15o66hq',
    templateId:'template_natesud',
    tokenSaver:false // When true, simulates emails to protect free 200 monthly quota
  },
  vapidPublicKey:''
};

let dbRef=null, firebaseReady=false, firebaseSyncStarted=false;
let state={
  view:'login',
  role:'student',
  user:null,
  studentTab:'Order',
  vendorTab:'Queue',
  adminTab:'Analytics',
  canteenId:'uni-centre',
  category:'All',
  search:'',
  cart:[],
  authMode:'login',
  orders:[],
  menu:[],
  feedback:[],
  settings:structuredClone(defaultSettings)
};

// ── UTILITIES ──
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null') ?? fallback}catch{return fallback}}
function save(key,value){localStorage.setItem(key,JSON.stringify(value))}
function uid(prefix='id'){return prefix+'_'+Date.now()+'_'+Math.random().toString(36).slice(2,8)}
function money(n){return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n)}
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function canteen(id){return CANTEENS.find(c=>c.id===id)||CANTEENS[0]}
function toast(msg){
  const el=document.getElementById('toast');
  if(!el)return;
  el.textContent=msg;
  el.classList.remove('hidden');
  clearTimeout(toast.t);
  toast.t=setTimeout(()=>el.classList.add('hidden'),3400);
}

function defaultCredentials(){
  return {
    student:{email:DEMO.student.email,password:DEMO.student.password,name:DEMO.student.name},
    admin:{email:DEMO.admin.email,password:DEMO.admin.password,name:DEMO.admin.name},
    vendors:Object.fromEntries(Object.entries(VENDOR_ACCOUNTS).map(([k,v])=>[k,{...v}]))
  };
}

function credentials(){
  const d=defaultCredentials(), saved=read(KEYS.credentials,d);
  return {...d,...saved, vendors:{...d.vendors,...(saved.vendors||{})}};
}

function saveCredentials(c){save(KEYS.credentials,c)}

function currentAccount(){
  const c=credentials();
  if(state.role==='student') return c.student;
  if(state.role==='admin') return c.admin;
  return c.vendors[state.user?.vendorId||state.user?.id||'vendor01']||c.vendors.vendor01;
}

function isDemoEmail(email){
  if(!email) return true;
  const e=email.trim().toLowerCase();
  return e.endsWith('.demo') || e.endsWith('.test') || e.endsWith('@example.com') || e==='student@prebyte.demo';
}

function isDeliverableEmail(email){
  if(!email || isDemoEmail(email)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

function firebaseConfigured(){
  const fb=state.settings.firebase;
  if(!fb || !fb.apiKey) return false;
  if(fb.apiKey===DUMMY_API_KEY) return false;
  return Boolean(fb.apiKey && fb.authDomain && fb.projectId);
}

function updateCredentials(){
  const id=document.getElementById('newLoginId')?.value.trim();
  const pw=document.getElementById('newPassword')?.value||'';
  const confirmPw=document.getElementById('confirmPassword')?.value||'';
  const name=document.getElementById('accountName')?.value.trim();
  if(!id||pw.length<6||pw!==confirmPw) return toast('Enter a login ID and matching password of at least 6 characters.');
  const c=credentials();
  if(state.role==='student'){
    c.student={...c.student,email:id,password:pw,name:name||c.student.name};
    state.user={...state.user,email:id,name:name||state.user.name};
  }else if(state.role==='admin'){
    c.admin={...c.admin,email:id,password:pw,name:name||c.admin.name};
    state.user={...state.user,email:id,name:name||state.user.name};
  }else{
    const key=state.user.vendorId||state.user.id;
    const old=c.vendors[key];
    c.vendors[key]={...old,email:id,password:pw,name:name||old.name,id:key,canteenId:old.canteenId};
    state.user={...state.user,email:id,name:name||state.user.name};
  }
  saveCredentials(c);
  toast('Login credentials updated successfully');
  render();
}

// ── SYNC & INIT ──
function sync(){
  state.menu=read(KEYS.menu,[]);
  if(!state.menu.length){state.menu=MENU;save(KEYS.menu,state.menu);}
  state.orders=read(KEYS.orders,[]);
  state.feedback=read(KEYS.feedback,[]);
  const saved=read(KEYS.settings,{});
  
  let fbConfig = {...defaultSettings.firebase, ...(saved.firebase||{})};
  if(fbConfig.apiKey === DUMMY_API_KEY){
    fbConfig.apiKey = '';
    fbConfig.authDomain = '';
    fbConfig.projectId = '';
  }

  state.settings={
    ...structuredClone(defaultSettings),
    ...saved,
    firebase: fbConfig,
    emailjs: {...defaultSettings.emailjs, ...(saved.emailjs||{})}
  };
}

function init(){
  sync();
  history.replaceState({prebyte:true,view:'login'},'',location.href);
  render();
  navigator.serviceWorker?.register?.('/prebyte-sw.js').catch(()=>{});
  bootstrapFirebase().catch(()=>{});
}

async function bootstrapFirebase(){
  try{
    if(state.settings.emailjs.publicKey && window.emailjs){
      window.emailjs.init({publicKey:state.settings.emailjs.publicKey});
    }
    if(!firebaseConfigured()) return;
    await loadFirebase();
    dbRef=window.firebase.database();
    firebaseReady=true;
    firebaseSyncStarted=true;
    await seedFirebaseIfEmpty();
    startFirebaseSync();
    render();
  }catch(e){
    firebaseReady=false;
    dbRef=null;
    console.warn('Firebase bootstrap skipped or failed; running in offline/demo mode:', e?.message||e);
  }
}

async function seedFirebaseIfEmpty(){
  if(!firebaseReady || !dbRef) return;
  const db=window.firebase.database();
  const menuSnap=await db.ref('menu').once('value');
  if(!menuSnap.exists()){
    const payload={};
    MENU.forEach(x=>{
      const [id,canteenId,emoji,name,desc,price,category]=x;
      payload[id]={id,canteenId,emoji,name,desc,price,category,available:true};
    });
    await db.ref('menu').set(payload);
  }
  const orderSnap=await db.ref('orders').once('value');
  if(!orderSnap.exists()){
    const now=Date.now();
    const demoOrders={
      demo1:{id:'demo1',n:4182,items:[{id:'p1',name:'Paneer Tikka Rice Bowl',qty:1,price:149}],total:149,canteenId:'uni-centre',canteen:canteen('uni-centre').name,slot:'12:40 – 12:55',status:'Ready',email:DEMO.student.email,studentName:DEMO.student.name,createdAt:new Date(now-86400000).toISOString(),paymentMethod:'Demo Sandbox'},
      demo2:{id:'demo2',n:7316,items:[{id:'p10',name:'Samosa Duo',qty:2,price:45}],total:90,canteenId:'blocks-25-26',canteen:canteen('blocks-25-26').name,slot:'13:10 – 13:25',status:'Picked up',email:DEMO.student.email,studentName:DEMO.student.name,createdAt:new Date(now-172800000).toISOString(),paymentMethod:'UPI Demo'}
    };
    await db.ref('orders').set(demoOrders);
  }
}

function startFirebaseSync(){
  if(!firebaseReady||!dbRef)return;
  dbRef.ref('menu').on('value',snap=>{
    const v=snap.val()||{};
    state.menu=Object.values(v);
    save(KEYS.menu,state.menu);
    render();
  });
  dbRef.ref('orders').on('value',snap=>{
    const v=snap.val()||{};
    state.orders=Object.values(v).sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
    save(KEYS.orders,state.orders);
    render();
  });
  dbRef.ref('feedback').on('value',snap=>{
    const v=snap.val()||{};
    state.feedback=Object.values(v).sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
    save(KEYS.feedback,state.feedback);
    render();
  });
}

async function firebaseSet(path,value){
  if(!firebaseReady||!dbRef)return false;
  try{await dbRef.ref(path).set(value);return true;}catch(e){console.warn('firebaseSet error:',e);return false;}
}
async function firebasePatch(path,value){
  if(!firebaseReady||!dbRef)return false;
  try{await dbRef.ref(path).update(value);return true;}catch(e){console.warn('firebasePatch error:',e);return false;}
}
async function firebaseGet(path){
  if(!firebaseReady||!dbRef)return null;
  try{const s=await dbRef.ref(path).once('value');return s.val();}catch(e){console.warn('firebaseGet error:',e);return null;}
}

// ── RENDER ROOT ──
function render(){
  const root=document.getElementById('root');
  if(!root)return;
  if(state.view==='login') return root.innerHTML=renderLogin();
  if(state.view==='student') return root.innerHTML=renderStudent();
  if(state.view==='vendor') return root.innerHTML=renderVendor();
  if(state.view==='admin') return root.innerHTML=renderAdmin();
}

// ── LOGIN SCREEN ──
function renderLogin(){
  const c=credentials();
  const acct=state.role==='student'?c.student:state.role==='admin'?c.admin:c.vendors.vendor01;
  const isFb=firebaseConfigured();
  
  return `
  <div class="login">
    <section class="loginHero">
      <div class="logo">PRE<span>BYTE</span></div>
      <div class="heroCopy">
        <div class="eyebrow">SMART CAMPUS FOOD OS</div>
        <h1>Your break.<br><em>Without the queue.</em></h1>
        <p>Pre-order between classes, reserve a pickup slot, pay securely and follow your LPU campus pickup point.</p>
        <div class="consoleDecor">
          <div class="decorTile"><b>Live Menus</b><small>Vendors manage their own canteen menu.</small></div>
          <div class="decorTile"><b>Smart Pickup</b><small>Reserve a time slot before reaching the counter.</small></div>
          <div class="decorTile"><b>LPU Campus</b><small>Food-service points connected in one campus ordering system.</small></div>
        </div>
      </div>
      <div class="save"><b>PRE</b><span>campus food<br>ordering system</span></div>
    </section>

    <section class="loginCard">
      <div class="role">
        ${['student','vendor','admin'].map(r=>`<button class="${state.role===r?'active':''}" onclick="setRole('${r}')">${r[0].toUpperCase()+r.slice(1)}</button>`).join('')}
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div class="eyebrow" style="color:#789087">${state.role==='student'?'CAMPUS ACCESS':state.role==='vendor'?'CANTEEN CONTROL':'OPERATIONS CONSOLE'}</div>
        <span class="statusPill ${isFb && firebaseReady ? 'online' : 'demo'}">
          ${isFb && firebaseReady ? '🟢 Cloud Active' : '⚡ Instant Demo Mode'}
        </span>
      </div>

      <h2>${state.authMode==='register'?'Create student account':state.role==='student'?'Student login':state.role==='vendor'?'Vendor login':'Admin login'}</h2>
      <p style="font-size:13px">${serviceSummary()}</p>

      <!-- Quick 1-Click Demo Login Bar -->
      <div class="quickBar">
        <span style="font-size:11px;font-weight:800;color:var(--muted);align-self:center">Quick demo:</span>
        <button type="button" class="quickBtn" onclick="quickFill('student')">👨‍🎓 Student Demo</button>
        <button type="button" class="quickBtn" onclick="quickFill('vendor')">👨‍🍳 Vendor (Uni-Centre)</button>
        <button type="button" class="quickBtn" onclick="quickFill('admin')">⚙️ Admin Console</button>
      </div>

      <form onsubmit="submitLogin(event)">
        ${state.authMode==='register'?'<label>Full name<input id="authName" required placeholder="e.g. Rahul Sharma"></label>':''}
        <label>${state.role==='vendor'?'Vendor ID':'Login ID'}
          <input id="authEmail" required value="${state.authMode==='login'?esc(acct.email):''}" placeholder="${state.role==='student'?'student@prebyte.demo or your email':state.role==='vendor'?'vendor01':'admin@prebyte.demo'}">
        </label>
        <label>Password
          <input id="authPassword" type="password" required value="${state.authMode==='login'?esc(acct.password):''}" placeholder="••••••••">
        </label>
        ${state.role==='vendor'?`<div class="vendorLock">🔒 Your canteen is assigned to this vendor account. It cannot be changed from the login screen.</div>`:''}
        <button class="primary wide">${state.authMode==='register'?'Create student account →':'Continue →'}</button>
      </form>

      ${state.role==='student'?`
        <button class="link" onclick="toggleAuthMode()">
          ${state.authMode==='register'?'Already have an account? Sign in':'New here? Create a student account'}
        </button>
      `:''}

      <div class="hint">
        <b>Default Accounts (100% Guaranteed to work)</b><br>
        Student: <code>student@prebyte.demo</code> / <code>prebyte123</code><br>
        Vendors: <code>vendor01</code> to <code>vendor06</code> / <code>prebyte123</code><br>
        Admin: <code>admin@prebyte.demo</code> / <code>prebyteadmin</code><br>
        <small style="display:block;margin-top:4px">No external database setup required. Works seamlessly right in your browser!</small>
      </div>
    </section>
  </div>`;
}

function serviceSummary(){
  if(firebaseConfigured() && firebaseReady) {
    return 'Firebase Authentication & Database are connected.';
  }
  return 'Instant Demo Mode is active. Student, Vendor and Admin accounts authenticate instantly without external setup.';
}

function setRole(role){
  state.role=role;
  state.authMode='login';
  render();
}

function toggleAuthMode(){
  state.authMode=state.authMode==='login'?'register':'login';
  render();
}

function quickFill(role){
  state.role=role;
  state.authMode='login';
  const c=credentials();
  render();
  setTimeout(()=>{
    const emailEl=document.getElementById('authEmail');
    const passEl=document.getElementById('authPassword');
    if(emailEl && passEl){
      if(role==='student'){
        emailEl.value=c.student.email;
        passEl.value=c.student.password;
      }else if(role==='vendor'){
        emailEl.value=c.vendors.vendor01.email;
        passEl.value=c.vendors.vendor01.password;
      }else{
        emailEl.value=c.admin.email;
        passEl.value=c.admin.password;
      }
    }
  },10);
}

// ── FIXED LOGIN & REGISTRATION ──
async function submitLogin(e){
  e.preventDefault();
  const email=document.getElementById('authEmail').value.trim();
  const password=document.getElementById('authPassword').value;
  const name=document.getElementById('authName')?.value.trim();

  try{
    // ── 1. REGISTRATION FLOW ──
    if(state.authMode==='register'){
      if(state.role!=='student') throw new Error('Only student accounts can be created here.');
      if(!name) throw new Error('Enter your full name.');
      if(password.length<6) throw new Error('Password should contain at least 6 characters.');

      const c=credentials();
      c.student={email,password,name};
      saveCredentials(c);

      if(firebaseConfigured() && firebaseReady){
        try{
          const cred=await firebaseSignUp(email,password,name);
          const profile={uid:cred.user.uid,name,email,role:'student',createdAt:new Date().toISOString()};
          await firebaseSet('users/'+cred.user.uid,profile);
          enterRole('student',{name,email,firebaseUser:cred.user,uid:cred.user.uid});
          toast('Student account created & synced with Firebase.');
          return;
        }catch(fbErr){
          console.warn('Firebase registration skipped/failed:', fbErr.message);
        }
      }

      enterRole('student',{name,email});
      toast('Student account created successfully!');
      return;
    }

    // ── 2. LOGIN FLOW ──
    const c=credentials();

    if(state.role==='student'){
      if(email===c.student.email && password===c.student.password){
        enterRole('student',c.student);
        return;
      }

      if(firebaseConfigured() && firebaseReady){
        try{
          const x=await firebaseSignIn(email,password);
          let profile=await firebaseGet('users/'+x.user.uid);
          if(!profile){
            profile={uid:x.user.uid,name:x.user.displayName||'Student',email,role:'student',createdAt:new Date().toISOString()};
            await firebaseSet('users/'+x.user.uid,profile);
          }
          enterRole('student',{...profile,firebaseUser:x.user});
          return;
        }catch(fbErr){
          console.warn('Firebase auth attempt failed:', fbErr.code||fbErr.message);
        }
      }

      throw new Error('Invalid student credentials. Click "Student Demo" to test with default login.');
    }

    if(state.role==='vendor'){
      const found=Object.values(c.vendors).find(v=>v.email===email&&v.password===password);
      if(found) return enterRole('vendor',{...found,vendorId:found.id,canteenId:found.canteenId});
      throw new Error('Vendor ID or password incorrect. Try vendor01 / prebyte123');
    }

    if(state.role==='admin'){
      if(email===c.admin.email&&password===c.admin.password) return enterRole('admin',c.admin);
      throw new Error('Admin login details do not match. Try admin@prebyte.demo / prebyteadmin');
    }
  }catch(err){
    toast(err.message||String(err));
  }
}

function enterRole(role,user){
  state.view=role;
  state.user={...user,role};
  if(role==='vendor') state.vendorTab='Queue';
  if(role==='admin') state.adminTab='Analytics';
  history.pushState({prebyte:true,view:role,tab:role==='student'?state.studentTab:role==='vendor'?state.vendorTab:state.adminTab},'',location.href);
  render();
  toast(`Welcome, ${user.name||role}!`);
}

async function logout(){
  try{await firebaseSignOut();}catch{}
  state.view='login';
  state.user=null;
  state.cart=[];
  history.pushState({prebyte:true,view:'login'},'',location.href);
  render();
  toast('Signed out successfully');
}

function goBack(){
  if(state.view==='login')return;
  const home=state.view==='student'?'Order':state.view==='vendor'?'Queue':'Analytics';
  const tab=state.view==='student'?state.studentTab:state.view==='vendor'?state.vendorTab:state.adminTab;
  if(tab!==home){
    switchTab(state.view,home);
    return;
  }
  state.view='login';
  state.user=null;
  state.cart=[];
  history.pushState({prebyte:true,view:'login'},'',location.href);
  render();
  toast('Returned to PREBYTE login');
}

function renderHeader(kind,tab,items){
  return `
  <header>
    <button class="backBtn" onclick="goBack()">← Back</button>
    <div class="logo dark">PRE<span>BYTE</span></div>
    ${kind!=='student'?`<b style="font-size:11px">${kind==='vendor'?'VENDOR DESK':'ADMIN CONSOLE'}</b>`:''}
    <nav class="nav">
      ${items.map(x=>`<button class="${tab===x?'active':''}" onclick="switchTab('${kind}','${x}')">${x}</button>`).join('')}
    </nav>
    <div class="profile">
      <div class="avatar">${esc(state.user?.name?.[0]||'U').toUpperCase()}</div>
      <div class="profileText">${esc(state.user?.name||'User')}<small>${kind}</small></div>
      <button class="outline" onclick="logout()">Logout</button>
    </div>
  </header>`;
}

function switchTab(kind,tab){
  if(kind==='student') state.studentTab=tab;
  if(kind==='vendor') state.vendorTab=tab;
  if(kind==='admin') state.adminTab=tab;
  history.pushState({prebyte:true,view:kind,tab},'',location.href);
  render();
}

// ── STUDENT VIEW ──
function renderStudent(){
  return `
  <div class="shell">
    ${renderHeader('student',state.studentTab,['Order','My orders','Feedback','Account'])}
    ${state.studentTab==='Order'?renderOrder():state.studentTab==='My orders'?renderOrders():state.studentTab==='Feedback'?renderFeedback():renderProfile()}
  </div>`;
}

function renderOrder(){
  const searching=!!normalizeSearch(state.search);
  const list=state.menu.filter(x=>x.available&&(searching||x.canteenId===state.canteenId)&&(state.category==='All'||normalizeSearch(x.category)===normalizeSearch(state.category))&&menuMatchesSearch(x,state.search));

  return `
  <section class="hero">
    <div>
      <div class="eyebrow">YOUR BREAK, WITHOUT THE QUEUE</div>
      <h1>Order before<br><span>you walk out.</span></h1>
      <p>Fresh campus meals, timed to your schedule.</p>
    </div>
    <div class="queueCard">
      <b>${String(list.length).padStart(2,'0')}</b>
      <small>${searching?'food items found across all canteens':'items available'}<br>${searching?'LPU campus':'at '+canteen(state.canteenId).short}</small>
    </div>
  </section>

  <section class="tools">
    <div class="search">
      ⌕<input aria-label="Search menu" autocomplete="off" spellcheck="false" placeholder="Search meals, snacks, drinks…" value="${esc(state.search)}" oninput="setSearch(this.value)">
      ${state.search?`<button type="button" class="searchClear" aria-label="Clear search" onclick="clearSearch()">×</button>`:``}
    </div>
    <div class="filters">
      ${['All','Meals','Snacks','Drinks'].map(c=>`<button class="${state.category===c?'active':''}" onclick="setCategory('${c}')">${c}</button>`).join('')}
    </div>
  </section>

  <main class="layout">
    <section>
      <div class="sectionHead">
        <div>
          <div class="eyebrow" style="color:#789087">LPU CAMPUS FOOD NETWORK</div>
          <h2>${searching?'Search results across all canteens':'Choose your pickup point'}</h2>
          <p class="subtext">${searching?'Showing every available matching item from all LPU canteens. Select a pickup point by adding an item.':'Choose a canteen to browse its menu.'}</p>
        </div>
        <select onchange="setCanteen(this.value)">
          ${CANTEENS.map(c=>`<option value="${c.id}" ${c.id===state.canteenId?'selected':''}>${c.short}</option>`).join('')}
        </select>
      </div>

      <div class="canteenStrip">
        ${CANTEENS.slice(0,6).map(c=>`
          <button class="${c.id===state.canteenId?'chosen':''}" onclick="setCanteen('${c.id}')">
            <b>${c.short}</b><small>Pickup available</small>
          </button>
        `).join('')}
      </div>

      <div class="foods">
        ${list.length?list.map(renderFood).join(''):`<div class="card emptyState" style="grid-column:1/-1"><b>No items found</b><p class="subtext">Try another search, category or canteen.</p></div>`}
      </div>
    </section>

    <aside class="cart">
      <div class="sectionHead">
        <div>
          <div class="eyebrow" style="color:#789087">YOUR ORDER</div>
          <h3>${state.cart.length} items</h3>
        </div>
        <button class="round" onclick="clearCart()">×</button>
      </div>
      ${state.cart.length?renderCartItems():`<div class="empty">＋<strong>Your tray is empty</strong><p>Add something delicious to start.</p></div>`}
    </aside>
  </main>`;
}

function renderFood(x){
  return `
  <article class="food">
    <div class="foodPic">${x.emoji}</div>
    <div class="foodInfo">
      <div class="eyebrow" style="color:#789087">${x.category} · ${esc(canteen(x.canteenId).short)}</div>
      <h3>${esc(x.name)}</h3>
      <p>${esc(x.desc)}</p>
      <div class="foodBottom">
        <b>${money(x.price)}</b>
        <button class="addBtn" onclick="addToCart('${x.id}')">+ Add</button>
      </div>
    </div>
  </article>`;
}

function renderCartItems(){
  const groups={};
  state.cart.forEach(id=>groups[id]=(groups[id]||0)+1);
  const userEmail=state.user?.email && !isDemoEmail(state.user.email) ? state.user.email : '';

  return Object.entries(groups).map(([id,qty])=>{
    const x=state.menu.find(m=>m.id===id);
    return `<div class="cartLine"><div><strong>${esc(x.name)}</strong><small>${qty} × ${money(x.price)}</small></div><div class="qty"><button onclick="changeQty('${id}',-1)">−</button><b>${qty}</b><button onclick="changeQty('${id}',1)">+</button></div></div>`;
  }).join('')+`
  <label>Pickup slot
    <select id="pickupSlot">
      ${SLOTS.map((s,i)=>`<option value="${s}">${s}${i===Math.min(state.cart.length,4)?' · suggested':''}</option>`).join('')}
    </select>
  </label>
  <label>Notification Email (Optional)
    <input id="checkoutEmail" type="email" value="${esc(userEmail)}" placeholder="e.g. yourname@gmail.com">
    <small style="color:var(--muted);font-weight:normal;display:block;margin-top:2px">
      ${userEmail ? 'Pickup alerts will be sent here.' : 'Leave blank for demo simulation to save EmailJS tokens.'}
    </small>
  </label>
  <div class="total"><span>Total</span><b>${money(cartTotal())}</b></div>
  <button class="primary wide" onclick="placeOrder()">Reserve & pay →</button>`;
}

function addToCart(id){
  const item=state.menu.find(x=>x.id===id);
  if(!item)return;
  if(state.cart.length){
    const first=state.menu.find(x=>x.id===state.cart[0]);
    if(first&&first.canteenId!==item.canteenId){
      toast('Your tray can contain items from one canteen at a time.');
      return;
    }
  }
  if(state.canteenId!==item.canteenId){
    state.canteenId=item.canteenId;
    toast('Pickup point changed to '+canteen(item.canteenId).short);
  }
  state.cart.push(id);
  render();
  toast('Added to tray');
}

function clearCart(){state.cart=[];render();}

function changeQty(id,d){
  if(d>0)state.cart.push(id);
  else{
    const i=state.cart.lastIndexOf(id);
    if(i>=0)state.cart.splice(i,1);
  }
  render();
}

function normalizeSearch(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ')}
function menuMatchesSearch(item, query){
  const q=normalizeSearch(query);
  if(!q)return true;
  const haystack=normalizeSearch([item.name,item.desc,item.category,item.emoji].filter(Boolean).join(' '));
  return q.split(' ').every(token=>haystack.includes(token));
}

function setSearch(v){
  state.search=v;
  render();
  requestAnimationFrame(()=>{
    const input=document.querySelector('.search input');
    if(input){input.focus();input.setSelectionRange(input.value.length,input.value.length);}
  });
}

function clearSearch(){state.search='';render();requestAnimationFrame(()=>document.querySelector('.search input')?.focus());}
function setCategory(v){state.category=v;render();}
function setCanteen(v){state.canteenId=v;state.cart=[];render();toast('Pickup point changed');}
function cartTotal(){return state.cart.reduce((s,id)=>s+(state.menu.find(x=>x.id===id)?.price||0),0);}

// ── PLACE ORDER ──
async function placeOrder(){
  if(!state.cart.length) return toast('Add items to your tray first.');
  const slot=document.getElementById('pickupSlot')?.value||SLOTS[0];
  const customEmail=document.getElementById('checkoutEmail')?.value.trim();
  const emailToUse = customEmail || state.user?.email || DEMO.student.email;

  const itemsMap={};
  state.cart.forEach(id=>{
    const m=state.menu.find(x=>x.id===id);
    if(!itemsMap[id]) itemsMap[id]={id,name:m.name,qty:0,price:m.price};
    itemsMap[id].qty++;
  });

  const order={
    id:uid('order'),
    n:Math.floor(1000+Math.random()*9000),
    items:Object.values(itemsMap),
    total:cartTotal(),
    canteenId:state.canteenId,
    canteen:canteen(state.canteenId).name,
    slot,
    status:'Payment pending',
    email:emailToUse,
    studentName:state.user?.name||'Student',
    createdAt:new Date().toISOString(),
    paymentMethod:''
  };

  if(firebaseConfigured() && firebaseReady){
    await firebaseSet('orders/'+order.id,order);
  }else{
    const orders=read(KEYS.orders,[]);
    orders.unshift(order);
    save(KEYS.orders,orders);
    state.orders=orders;
  }

  state.cart=[];
  state.studentTab='My orders';
  render();
  toast('Order #'+order.n+' placed! Complete payment to confirm.');
}

// ── MY ORDERS ──
function renderOrders(){
  const orders=state.orders.length?state.orders:read(KEYS.orders,[]);
  return `
  <main class="page">
    <div class="pageTop">
      <div>
        <div class="eyebrow" style="color:#789087">ORDER CONTROL</div>
        <h1>Your orders</h1>
        <p>Payment, live status and digital receipt.</p>
      </div>
      <button class="outline" onclick="enableNotifications()">🔔 Browser Alerts</button>
    </div>
    ${orders.length?orders.map(renderOrderCard).join(''):`<div class="card emptyState"><b>No orders yet.</b><p class="subtext">Your confirmed orders will appear here.</p></div>`}
  </main>`;
}

function renderOrderCard(o){
  const hasRealEmail = isDeliverableEmail(o.email);
  return `
  <article class="order">
    <div class="orderMain">
      <div>
        <b>#${o.n}</b>
        <span class="status ${o.status!=='Payment pending'?'good':''}">${o.status}</span>
        ${hasRealEmail ? `<span class="status good" style="font-size:9px">📧 ${esc(o.email)}</span>` : `<span class="offlineBadge">Demo Order</span>`}
      </div>
      <div class="orderMeta">${esc(o.canteen)} · Pickup ${esc(o.slot)} · ${new Date(o.createdAt).toLocaleString()}</div>
      <div class="orderMeta">${o.items.map(i=>`${i.qty}× ${esc(i.name)}`).join(' · ')}</div>
      ${o.status==='Payment pending'?renderPaymentBox(o):renderPaidOrder(o)}
    </div>
    <strong>${money(o.total)}</strong>
  </article>`;
}

function renderPaymentBox(o){
  return `
  <div class="paymentBox">
    <div class="sectionHead"><b>Secure checkout</b><strong>${money(o.total)}</strong></div>
    <div class="payMethods">
      <button class="active" onclick="demoPay('${o.id}')">⚡ Instant Demo Pay</button>
      <button onclick="showPaymentInfo('${o.id}')">PayPal Sandbox</button>
    </div>
    <div id="paypal-${o.id}" class="paypalButton"></div>
    <button class="secondary" style="width:100%" onclick="demoPay('${o.id}')">Complete demo payment →</button>
  </div>`;
}

function showPaymentInfo(id){
  const o=state.orders.find(x=>x.id===id);
  if(o?.status==='Payment pending') loadPayPal(o);
}

function renderPaidOrder(o){
  return `
  <div class="orderActions">
    <button class="outline" onclick="openReceipt('${o.id}')">🧾 Receipt</button>
    ${o.status==='Ready'?`<button class="primary mini" onclick="toast('Pickup code: #${o.n}')">Show pickup code</button>`:''}
  </div>`;
}

async function demoPay(id){
  const patch={status:'Paid',paymentMethod:'Instant Demo Pay',paidAt:new Date().toISOString()};
  if(firebaseConfigured() && firebaseReady){
    await firebasePatch('orders/'+id,patch);
  }else{
    const orders=read(KEYS.orders,[]);
    const updated=orders.map(o=>o.id===id?{...o,...patch}:o);
    save(KEYS.orders,updated);
    state.orders=updated;
  }
  render();
  toast('Demo payment completed! Order is now in the vendor queue.');
}

async function loadPayPal(o){
  if(!state.settings.paypalClientId){
    toast('Add a PayPal Sandbox Client ID in Admin → Integrations.');
    return;
  }
  const host=document.getElementById('paypal-'+o.id);
  if(!host)return;
  try{
    await loadScript(`https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(state.settings.paypalClientId)}&currency=INR&intent=capture&components=buttons`);
    if(!window.paypal)throw new Error('PayPal SDK unavailable');
    host.innerHTML='';
    window.paypal.Buttons({
      style:{layout:'vertical',shape:'rect',label:'paypal'},
      createOrder:(_,actions)=>actions.order.create({purchase_units:[{description:`PREBYTE order #${o.n}`,amount:{currency_code:'INR',value:o.total.toFixed(2)}}]}),
      onApprove:async(data,actions)=>{
        const capture=await actions.order.capture();
        const patch={status:'Paid',paymentMethod:'PayPal Sandbox',paypalOrderId:capture?.id||data.orderID,paidAt:new Date().toISOString()};
        if(firebaseConfigured() && firebaseReady) await firebasePatch('orders/'+o.id,patch);
        else{
          const orders=read(KEYS.orders,[]);
          const upd=orders.map(x=>x.id===o.id?{...x,...patch}:x);
          save(KEYS.orders,upd);
          state.orders=upd;
        }
        render();
        toast('PayPal payment captured successfully');
      },
      onError:()=>toast('PayPal checkout error')
    }).render(host);
  }catch(e){
    toast(e.message||'PayPal unavailable');
  }
}

// ── FEEDBACK & ACCOUNT ──
function renderFeedback(){
  const existing=read(KEYS.feedback,[]);
  return `
  <main class="page">
    <div class="eyebrow" style="color:#789087">CAMPUS VOICE</div>
    <h1>Tell us about it.</h1>
    <p>Food quality, pickup time and canteen experience.</p>
    <div class="feedbackGrid">
      <form class="card" onsubmit="submitFeedback(event)">
        <label>Canteen
          <select id="feedbackCanteen">${CANTEENS.map(c=>`<option>${c.name}</option>`).join('')}</select>
        </label>
        <label>Rating
          <div class="stars">${[1,2,3,4,5].map(n=>`<button type="button" class="${n===5?'active':''}" onclick="setRating(${n})">★</button>`).join('')}</div>
        </label>
        <input type="hidden" id="feedbackRating" value="5">
        <label>Your experience
          <textarea id="feedbackComment" required placeholder="Tell us what went well or what should improve…"></textarea>
        </label>
        <button class="primary wide">Submit feedback</button>
      </form>
      <div class="quote">
        <mark>“</mark>
        <h2>Built around the student break.</h2>
        <p>PREBYTE connects students, vendors and campus operations around one thing everyone values: time.</p>
        <div style="margin-top:30px"><span class="offlineBadge">${existing.length} feedback entries recorded</span></div>
      </div>
    </div>
  </main>`;
}

function setRating(n){
  document.getElementById('feedbackRating').value=n;
  document.querySelectorAll('.stars button').forEach((b,i)=>b.classList.toggle('active',i<n));
}

async function submitFeedback(e){
  e.preventDefault();
  const f={
    id:uid('feedback'),
    uid:state.user?.uid||null,
    studentName:state.user?.name||'Student',
    canteen:document.getElementById('feedbackCanteen').value,
    rating:+document.getElementById('feedbackRating').value,
    comment:document.getElementById('feedbackComment').value,
    createdAt:new Date().toISOString()
  };
  if(firebaseConfigured() && firebaseReady) await firebaseSet('feedback/'+f.id,f);
  else save(KEYS.feedback,[f,...read(KEYS.feedback,[])]);
  toast('Thanks — feedback recorded!');
  render();
}

function renderProfile(){
  const a=currentAccount();
  return `
  <main class="page">
    <div class="eyebrow" style="color:#789087">${state.role.toUpperCase()} ACCOUNT</div>
    <h1>Account <span>settings.</span></h1>
    <p>Update your credentials and notification settings.</p>
    <div class="credentialGrid">
      <section class="card">
        <h3>🔐 Login credentials</h3>
        <label>Login ID<input id="newLoginId" value="${esc(a.email)}"></label>
        <label>Display name<input id="accountName" value="${esc(a.name)}"></label>
        <label>New password<input id="newPassword" type="password" placeholder="At least 6 characters"></label>
        <label>Confirm password<input id="confirmPassword" type="password" placeholder="Repeat new password"></label>
        <button class="primary wide" onclick="updateCredentials()">Save login changes</button>
      </section>
      <section class="card">
        <h3>🔔 Notifications</h3>
        <p class="subtext">Enable browser notifications so you never miss your pickup slot.</p>
        <button class="secondary" onclick="enableNotifications()">Enable browser notifications</button>
      </section>
    </div>
  </main>`;
}

async function enableNotifications(){
  if(!('Notification' in window)) return toast('This browser does not support notifications.');
  const p=await Notification.requestPermission();
  if(p==='granted'){
    new Notification('PREBYTE Alerts Active',{body:'You will receive instant alerts when your order is ready.'});
    toast('Browser alerts enabled successfully');
  }else{
    toast('Notification permission was not granted');
  }
}

function notifyOrderReady(o){
  try{
    if(window.Notification && Notification.permission==='granted'){
      new Notification(`PREBYTE · Order #${o.n} is Ready!`,{
        body:`Pickup at ${o.canteen} in slot ${o.slot}. Total: ₹${o.total}`
      });
    }
  }catch{}
}

// ── VENDOR VIEW ──
function renderVendor(){
  const cid=state.user?.canteenId||CANTEENS[0].id;
  return `
  <div class="shell">
    ${renderHeader('vendor',state.vendorTab,['Queue','Menu','Account'])}
    ${state.vendorTab==='Queue'?renderVendorQueue(cid):state.vendorTab==='Menu'?renderVendorMenu(cid):renderAccount()}
  </div>`;
}

function renderVendorQueue(cid){
  const orders=(state.orders.length?state.orders:read(KEYS.orders,[])).filter(o=>o.canteenId===cid&&o.status!=='Picked up');
  return `
  <main class="page">
    <div class="pageTop">
      <div>
        <div class="eyebrow" style="color:#789087">LIVE CANTEEN OPERATIONS</div>
        <h1>Serve faster.<br><span>See everything.</span></h1>
        <p>${canteen(cid).name}</p>
      </div>
      <div class="metric"><b>${orders.length}</b><small>ACTIVE ORDERS</small></div>
    </div>
    <div class="twoCol">
      <div class="card">
        <div class="eyebrow" style="color:#789087">ACTIVE QUEUE</div>
        ${orders.length?orders.map(o=>`
          <div class="order">
            <div class="orderMain">
              <div>
                <b>#${o.n}</b>
                <span class="status ${o.status!=='Payment pending'?'good':''}">${o.status}</span>
                ${isDeliverableEmail(o.email)?`<span class="status good" style="font-size:9px">📧 Real Email</span>`:`<span class="offlineBadge">Demo/Simulated</span>`}
              </div>
              <div class="orderMeta">${o.items.map(i=>`${i.qty}× ${esc(i.name)}`).join(' · ')} · ${money(o.total)}</div>
              ${o.status==='Paid'?`<button class="secondary" style="margin-top:10px;width:100%" onclick="vendorUpdate('${o.id}','Preparing')">Start preparing</button>`:''}
              ${o.status==='Preparing'?`<button class="primary" style="margin-top:10px;width:100%" onclick="vendorUpdate('${o.id}','Ready')">Mark Ready + Notify Student</button>`:''}
              ${o.status==='Ready'?`<button class="secondary" style="margin-top:10px;width:100%" onclick="vendorUpdate('${o.id}','Picked up')">Mark Picked up</button>`:''}
              ${o.status==='Payment pending'?`<div class="hint">Waiting for student payment</div>`:''}
            </div>
            <strong>${money(o.total)}</strong>
          </div>
        `).join(''):`<div class="emptyState"><b>No active orders.</b><p class="subtext">Paid orders will appear here automatically.</p></div>`}
      </div>

      <div class="card">
        <div class="eyebrow" style="color:#789087">OPERATIONS SNAPSHOT</div>
        <h2>Today</h2>
        <div class="ops">
          <span>Paid <b>${orders.filter(o=>o.status==='Paid').length}</b></span>
          <span>Preparing <b>${orders.filter(o=>o.status==='Preparing').length}</b></span>
          <span>Ready <b>${orders.filter(o=>o.status==='Ready').length}</b></span>
        </div>
        <div class="banner">
          <b>📧 Email Notification Guard</b>
          Demo student emails (<code>@prebyte.demo</code>) are simulated locally to protect your 200 free monthly EmailJS tokens from being exhausted! Real emails (e.g. Gmail) will receive actual messages.
        </div>
        <p class="subtext">Use Menu to control live dish availability.</p>
      </div>
    </div>
  </main>`;
}

async function vendorUpdate(id,next){
  const orders=state.orders.length?state.orders:read(KEYS.orders,[]);
  const o=orders.find(x=>x.id===id);
  if(!o)return;
  const n={...o,status:next,updatedAt:new Date().toISOString()};
  if(firebaseConfigured() && firebaseReady) await firebaseSet('orders/'+id,n);
  else{
    const updated=orders.map(x=>x.id===id?n:x);
    save(KEYS.orders,updated);
    state.orders=updated;
  }

  if(next==='Ready'){
    notifyOrderReady(n);
    sendReadyEmail(n).then(res=>{
      if(res.sent){
        toast(`Order #${n.n} ready! Real email sent to ${n.email}`);
      }else if(res.quotaReached){
        toast(`Order #${n.n} ready! (EmailJS free quota reached — browser alert sent)`);
      }else if(res.simulated){
        toast(`Order #${n.n} ready! Demo email detected (token saved). In-app alert sent.`);
      }else{
        toast(`Order #${n.n} ready! Browser notification sent.`);
      }
    }).catch(()=>{
      toast(`Order #${n.n} marked Ready!`);
    });
  }else{
    toast('Order status updated');
  }
  render();
}

function renderVendorMenu(cid){
  const menu=read(KEYS.menu,[]),mine=menu.filter(x=>x.canteenId===cid);
  return `
  <main class="page">
    <div class="pageTop">
      <div>
        <div class="eyebrow" style="color:#789087">MENU MANAGER</div>
        <h1>${esc(canteen(cid).name)}</h1>
        <p>Add, edit, hide or delete today's items.</p>
      </div>
      <button class="primary mini" onclick="openMenuEditor(null,'${cid}')">+ Add menu item</button>
    </div>
    <div class="menuList">
      ${mine.map(x=>`
        <div class="menuRow ${x.available?'':'off'}">
          <span class="foodMini">${x.emoji}</span>
          <div><b>${esc(x.name)}</b><small>${x.category} · ${money(x.price)}</small></div>
          <span class="offlineBadge">${x.available?'Available':'Hidden'}</span>
          <button class="outline" onclick="openMenuEditor('${x.id}','${cid}')">Edit</button>
          <button class="outline" onclick="toggleMenu('${x.id}')">${x.available?'Hide':'Show'}</button>
          <button class="danger" onclick="deleteMenu('${x.id}')">Delete</button>
        </div>
      `).join('')}
    </div>
  </main>`;
}

async function toggleMenu(id){
  const item=state.menu.find(x=>x.id===id);
  if(!item)return;
  const next={...item,available:!item.available};
  if(firebaseConfigured() && firebaseReady) await firebaseSet('menu/'+id,next);
  else save(KEYS.menu,state.menu.map(x=>x.id===id?next:x));
  toast('Availability updated');
  render();
}

async function deleteMenu(id){
  if(!confirm('Delete this menu item?'))return;
  if(firebaseConfigured() && firebaseReady) await dbRef.ref('menu/'+id).remove();
  else save(KEYS.menu,state.menu.filter(x=>x.id!==id));
  toast('Menu item deleted');
  render();
}

function openMenuEditor(id,cid){
  const menu=read(KEYS.menu,[]),x=menu.find(m=>m.id===id);
  document.body.insertAdjacentHTML('beforeend',`
  <div class="modal" id="menuModal">
    <form class="modalCard card" onsubmit="saveMenu(event,'${id||''}','${cid}')">
      <div class="modalClose">
        <h3>${x?'Edit menu item':'Add menu item'}</h3>
        <button type="button" class="round" onclick="closeModal('menuModal')">×</button>
      </div>
      <label>Emoji<input id="miEmoji" value="${esc(x?.emoji||'🍛')}"></label>
      <label>Name<input id="miName" required value="${esc(x?.name||'')}"></label>
      <label>Description<input id="miDesc" required value="${esc(x?.desc||'')}"></label>
      <div class="twoCol">
        <label>Price<input id="miPrice" type="number" required min="1" value="${x?.price||''}"></label>
        <label>Category
          <select id="miCat">
            <option ${x?.category==='Meals'?'selected':''}>Meals</option>
            <option ${x?.category==='Snacks'?'selected':''}>Snacks</option>
            <option ${x?.category==='Drinks'?'selected':''}>Drinks</option>
          </select>
        </label>
      </div>
      <button class="primary wide">Save item</button>
    </form>
  </div>`);
}

async function saveMenu(e,id,cid){
  e.preventDefault();
  const menu=state.menu.length?state.menu:read(KEYS.menu,[]);
  const item={
    id:id||uid('menu'),
    canteenId:cid,
    emoji:document.getElementById('miEmoji').value,
    name:document.getElementById('miName').value,
    desc:document.getElementById('miDesc').value,
    price:+document.getElementById('miPrice').value,
    category:document.getElementById('miCat').value,
    available:true
  };
  if(firebaseConfigured() && firebaseReady) await firebaseSet('menu/'+item.id,item);
  else save(KEYS.menu,id?menu.map(x=>x.id===id?{...x,...item}:x):[...menu,item]);
  closeModal('menuModal');
  toast('Menu saved');
  render();
}

// ── ADMIN VIEW ──
function renderAdmin(){
  return `
  <div class="shell">
    ${renderHeader('admin',state.adminTab,['Analytics','Canteens','Integrations','Account'])}
    ${state.adminTab==='Analytics'?renderAnalytics():state.adminTab==='Canteens'?renderCanteens():state.adminTab==='Integrations'?renderIntegrations():renderAccount()}
  </div>`;
}

function renderAccount(){
  const a=currentAccount();
  return `
  <main class="page">
    <div class="eyebrow" style="color:#789087">${state.role.toUpperCase()} ACCOUNT</div>
    <h1>Account <span>settings.</span></h1>
    <p>Change the login ID and password used for this ${state.role} account.</p>
    <section class="card" style="max-width:720px">
      <label>Login ID<input id="newLoginId" value="${esc(a.email)}"></label>
      <label>Display name<input id="accountName" value="${esc(a.name)}"></label>
      <label>New password<input id="newPassword" type="password" placeholder="At least 6 characters"></label>
      <label>Confirm password<input id="confirmPassword" type="password" placeholder="Repeat new password"></label>
      ${state.role==='vendor'?`<div class="vendorLock">🔒 Assigned canteen: ${esc(canteen(a.canteenId).name)}<br>Your canteen assignment cannot be changed here.</div>`:''}
      <button class="primary wide" onclick="updateCredentials()">Save credentials</button>
    </section>
  </main>`;
}

function renderAnalytics(){
  const orders=state.orders.length?state.orders:read(KEYS.orders,[]);
  const feedback=state.feedback.length?state.feedback:read(KEYS.feedback,[]);
  const revenue=orders.reduce((s,o)=>s+o.total,0);
  const paid=orders.filter(o=>o.status!=='Payment pending').length;
  const done=orders.filter(o=>o.status==='Ready'||o.status==='Picked up').length;
  const avg=feedback.length?(feedback.reduce((s,f)=>s+f.rating,0)/feedback.length).toFixed(1):'—';
  const by={};
  CANTEENS.forEach(c=>by[c.id]=orders.filter(o=>o.canteenId===c.id).length);
  const max=Math.max(1,...Object.values(by));

  return `
  <main class="page">
    <div class="eyebrow" style="color:#789087">OPERATIONS ANALYTICS</div>
    <h1>Campus pulse.</h1>
    <p>Orders, payments, readiness and student feedback.</p>
    <div class="metricGrid">
      <div class="metric"><b>${orders.length}</b><small>ORDERS</small></div>
      <div class="metric"><b>${money(revenue)}</b><small>GMV</small></div>
      <div class="metric"><b>${orders.length?Math.round(paid/orders.length*100):0}%</b><small>PAID</small></div>
      <div class="metric"><b>${done}</b><small>READY / PICKED</small></div>
    </div>
    <div class="analyticsGrid">
      <div class="card">
        <div class="eyebrow" style="color:#789087">ORDERS BY FOOD POINT</div>
        ${CANTEENS.map(c=>`
          <div class="barRow">
            <span>${c.short}</span>
            <div class="barTrack"><i style="width:${(by[c.id]/max*100)}%"></i></div>
            <b>${by[c.id]}</b>
          </div>
        `).join('')}
      </div>
      <div class="card">
        <div class="eyebrow" style="color:#789087">FEEDBACK SNAPSHOT</div>
        <h2>${avg}/5</h2>
        <p class="subtext">${feedback.length} feedback entries</p>
        ${feedback.slice(0,4).map(f=>`
          <div class="review">
            <b>${'★'.repeat(f.rating)}</b>
            <small>${esc(f.canteen)}</small>
            <p>${esc(f.comment)}</p>
          </div>
        `).join('')}
      </div>
    </div>
  </main>`;
}

function renderCanteens(){
  const orders=state.orders.length?state.orders:read(KEYS.orders,[]);
  return `
  <main class="page">
    <div class="eyebrow" style="color:#789087">CAMPUS FOOD NETWORK</div>
    <h1>Every food point.</h1>
    <p>Multiple LPU food-service areas connected in one PREBYTE network.</p>
    <div class="canteenAdmin">
      ${CANTEENS.map(c=>`
        <article class="card">
          <div class="badge">${c.short.slice(0,2).toUpperCase()}</div>
          <div class="eyebrow" style="margin-top:12px;color:#789087">${c.id}</div>
          <h2>${esc(c.name)}</h2>
          <p class="subtext">Orders and menu availability for this food point.</p>
          <span class="status good">${orders.filter(o=>o.canteenId===c.id).length} orders</span>
        </article>
      `).join('')}
    </div>
  </main>`;
}

// ── INTEGRATIONS (FIREBASE & EMAILJS CONFIG) ──
function renderIntegrations(){
  const s=state.settings;
  const isFb=firebaseConfigured();

  return `
  <main class="page">
    <div class="eyebrow" style="color:#789087">INTEGRATION CENTER</div>
    <h1>Connect Real Services.</h1>
    <p>Manage Firebase Authentication & Database, PayPal Sandbox, and EmailJS notification keys.</p>

    <div class="integrationGrid">
      <!-- FIREBASE SECTION -->
      <section class="card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <h3>🔐 Firebase Authentication</h3>
          <span class="statusPill ${isFb && firebaseReady ? 'online' : 'demo'}">
            ${isFb && firebaseReady ? '🟢 Connected' : '⚡ Offline Demo Mode'}
          </span>
        </div>

        <div class="banner">
          <b>Firebase Status:</b> ${isFb ? (firebaseReady ? 'Live Firebase connected and synced.' : 'Config provided, attempting connection.') : 'Offline/Demo mode active. Leave empty to run with local credentials with zero errors.'}
        </div>

        ${['apiKey','authDomain','databaseURL','projectId','storageBucket','messagingSenderId','appId'].map(k=>`
          <label>${k}
            <input id="fb-${k}" value="${esc(s.firebase[k])}" placeholder="${k==='apiKey'?'AIzaSy... (leave blank for local demo)':''}">
          </label>
        `).join('')}

        <div style="margin-top:14px;display:flex;gap:10px">
          <button class="outline" type="button" onclick="resetFirebaseKeys()">🧹 Clear & Use Demo Mode</button>
        </div>
      </section>

      <!-- EMAILJS & PAYPAL SECTION -->
      <section class="card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <h3>📧 EmailJS Notifications</h3>
          <span class="statusPill ${s.emailjs.publicKey ? 'online' : 'demo'}">
            ${s.emailjs.publicKey ? 'Keys Set' : 'Unconfigured'}
          </span>
        </div>

        <div class="banner warn">
          <b>⚡ Free Token Protection:</b>
          Free EmailJS accounts include <strong>200 emails per month</strong>. Orders with demo emails (<code>student@prebyte.demo</code>) are simulated to stop wasting your quota. Only real emails (like Gmail) will trigger actual emails.
        </div>

        ${['publicKey','serviceId','templateId'].map(k=>`
          <label>${k}
            <input id="ejs-${k}" value="${esc(s.emailjs[k])}">
          </label>
        `).join('')}

        <label class="checkLabel">
          <input type="checkbox" id="ejs-tokenSaver" ${s.emailjs.tokenSaver?'checked':''}>
          <b>Token Saver Mode</b> (Simulate all emails & consume 0 EmailJS tokens)
        </label>

        <div class="codeBox">
Template Variables sent to EmailJS:
• to_email: Student email address
• student_name: Student full name
• order_number: e.g. 4182
• canteen: Food Court name
• pickup_slot: Reserved time window
• total: e.g. ₹149
• message: Full notification text
        </div>

        <h3 style="margin-top:24px">💳 PayPal Sandbox</h3>
        <label>Sandbox Client ID
          <input id="paypalClientId" value="${esc(s.paypalClientId)}" placeholder="e.g. Ae8...">
        </label>

        <h3 style="margin-top:24px">🔔 Web Push</h3>
        <label>VAPID public key
          <input id="vapidPublicKey" value="${esc(s.vapidPublicKey)}" placeholder="Optional">
        </label>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:20px">
          <button class="primary wide" onclick="saveIntegrations()">Save integrations →</button>
          <button class="secondary wide" onclick="testEmailJS()">📧 Test EmailJS Now</button>
        </div>
      </section>
    </div>
  </main>`;
}

function resetFirebaseKeys(){
  const s=structuredClone(state.settings);
  Object.keys(s.firebase).forEach(k=>s.firebase[k]='');
  save(KEYS.settings,s);
  state.settings=s;
  firebaseReady=false;
  dbRef=null;
  toast('Firebase keys cleared! Instant Demo Mode is active.');
  render();
}

function saveIntegrations(){
  const s=structuredClone(defaultSettings);
  ['apiKey','authDomain','databaseURL','projectId','storageBucket','messagingSenderId','appId'].forEach(k=>{
    s.firebase[k]=(document.getElementById('fb-'+k)?.value||'').trim();
  });
  s.paypalClientId=(document.getElementById('paypalClientId')?.value||'').trim();
  ['publicKey','serviceId','templateId'].forEach(k=>{
    s.emailjs[k]=(document.getElementById('ejs-'+k)?.value||'').trim();
  });
  s.emailjs.tokenSaver = document.getElementById('ejs-tokenSaver')?.checked || false;
  s.vapidPublicKey=(document.getElementById('vapidPublicKey')?.value||'').trim();

  save(KEYS.settings,s);
  state.settings=s;
  toast('Integration settings saved successfully');
  bootstrapFirebase().catch(()=>{});
  render();
}

// ── DIAGNOSTIC EMAILJS TEST ──
async function testEmailJS(){
  const s=state.settings.emailjs;
  if(!s.publicKey || !s.serviceId || !s.templateId){
    return toast('EmailJS configuration is incomplete. Provide Public Key, Service ID & Template ID.');
  }

  const to=prompt('Enter your REAL email address (e.g. Gmail) to test EmailJS delivery:');
  if(!to || !to.trim()) return toast('Test cancelled (no email entered).');

  if(isDemoEmail(to)){
    return toast('Cannot test with demo email address. Enter a real email like your Gmail or Yahoo address.');
  }

  toast('Sending test email via EmailJS...');

  try{
    if(window.emailjs){
      window.emailjs.init({publicKey:s.publicKey});
    }

    const templateParams={
      to_email: to.trim(),
      email: to.trim(),
      user_email: to.trim(),
      recipient_email: to.trim(),
      student_name: state.user?.name || 'PREBYTE Tester',
      to_name: state.user?.name || 'PREBYTE Tester',
      user_name: state.user?.name || 'PREBYTE Tester',
      name: state.user?.name || 'PREBYTE Tester',
      order_number: 'TEST-8888',
      order_id: '#TEST-8888',
      canteen: 'Uni-Centre Food Court',
      pickup_slot: '12:40 – 12:55',
      total: '₹149',
      order_status: 'Ready',
      message: 'This is a test notification from PREBYTE. EmailJS is working perfectly!',
      summary: '1× Paneer Tikka Rice Bowl'
    };

    const res=await window.emailjs.send(s.serviceId, s.templateId, templateParams, s.publicKey);
    console.log('EmailJS response:', res);
    alert(`✅ SUCCESS (Status: ${res.status||200})!\n\nEmailJS sent a real email to: ${to}\nCheck your inbox and spam folder.`);
    toast('Test email sent successfully!');
  }catch(e){
    console.error('EmailJS test error:', e);
    const errText = String(e?.text || e?.message || e);
    if(errText.toLowerCase().includes('limit') || errText.toLowerCase().includes('quota') || e?.status===400 || e?.status===412){
      alert(`⚠️ EmailJS Monthly Limit Reached!\n\nYour free EmailJS account limit (200 emails/month) has been reached.\n\nPREBYTE will automatically protect your account and use instant in-app alerts so you can continue testing without interruption.`);
      toast('EmailJS free quota reached');
    }else{
      alert(`❌ EmailJS Error:\n${errText}\n\nCheck:\n1. Service ID (${s.serviceId})\n2. Template ID (${s.templateId})\n3. Public Key (${s.publicKey})\n4. Ensure template "To Email" field is {{to_email}} or {{email}} in EmailJS dashboard.`);
      toast('EmailJS test failed: ' + errText);
    }
  }
}

// ── FIXED READY EMAIL SENDER (WITH TOKEN SAVER) ──
async function sendReadyEmail(o){
  const s=state.settings.emailjs;
  if(!s.publicKey || !s.serviceId || !s.templateId || !o.email){
    return {sent:false, reason:'missing_config'};
  }

  if(isDemoEmail(o.email)){
    console.log(`ℹ️ [EmailJS Token Saver] Recipient is demo (${o.email}). Simulated notification to preserve free quota.`);
    return {sent:false, simulated:true, reason:'demo_email'};
  }

  if(s.tokenSaver){
    console.log(`ℹ️ [EmailJS Token Saver] Token Saver mode is ON. Simulated email to ${o.email}.`);
    return {sent:false, simulated:true, reason:'token_saver_mode'};
  }

  try{
    if(window.emailjs) window.emailjs.init({publicKey:s.publicKey});

    const templateParams={
      to_email: o.email.trim(),
      email: o.email.trim(),
      user_email: o.email.trim(),
      recipient_email: o.email.trim(),
      student_name: o.studentName,
      to_name: o.studentName,
      user_name: o.studentName,
      name: o.studentName,
      order_number: o.n,
      order_id: '#' + o.n,
      canteen: o.canteen,
      pickup_slot: o.slot,
      total: money(o.total),
      order_status: 'Ready',
      message: `Hi ${o.studentName}, your order #${o.n} at ${o.canteen} is ready for pickup during slot ${o.slot}! Total: ${money(o.total)}.`,
      summary: o.items.map(i=>`${i.qty}× ${i.name}`).join(', ')
    };

    const res=await window.emailjs.send(s.serviceId, s.templateId, templateParams, s.publicKey);
    return {sent:true, status:res.status};
  }catch(err){
    console.warn('sendReadyEmail error:', err);
    const errText=String(err?.text || err?.message || '');
    if(errText.toLowerCase().includes('limit') || errText.toLowerCase().includes('quota') || err?.status===400 || err?.status===412){
      return {sent:false, quotaReached:true};
    }
    return {sent:false, error:errText};
  }
}

// ── DIGITAL RECEIPT MODAL ──
function openReceipt(id){
  const o=read(KEYS.orders,[]).find(x=>x.id===id);
  if(!o)return;
  document.body.insertAdjacentHTML('beforeend',`
  <div class="modal" id="receiptModal">
    <div class="modalCard card">
      <div class="modalClose printHide">
        <div class="logo dark">PRE<span>BYTE</span></div>
        <button class="round" onclick="closeModal('receiptModal')">×</button>
      </div>
      <div class="eyebrow" style="margin-top:20px;color:#789087">DIGITAL RECEIPT</div>
      <h2>Order #${o.n}</h2>
      <p class="subtext">${esc(o.canteen)} · ${esc(o.slot)}</p>
      ${o.items.map(i=>`<div class="receiptLine"><span>${i.qty} × ${esc(i.name)}</span><b>${money(i.qty*i.price)}</b></div>`).join('')}
      <div class="total"><span>Total</span><b>${money(o.total)}</b></div>
      <div class="receiptMeta">
        <span>Status: <b>${esc(o.status)}</b></span>
        <span>Payment: ${esc(o.paymentMethod||'Paid')}</span>
        <span>Student: ${esc(o.studentName)} (${esc(o.email||'Demo')})</span>
        <span>Date: ${new Date(o.createdAt).toLocaleString()}</span>
      </div>
      <button class="primary wide printHide" onclick="window.print()">Print / Save as PDF</button>
    </div>
  </div>`);
}

function closeModal(id){document.getElementById(id)?.remove();}

// ── FIREBASE HELPERS ──
let fbPromise=null;
async function loadFirebase(){
  if(fbPromise) return fbPromise;
  fbPromise=(async()=>{
    await loadScript('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/10.12.5/firebase-database-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/10.12.5/firebase-storage-compat.js');
    if(!window.firebase) throw new Error('Firebase SDK unavailable');
    const app=window.firebase.apps?.[0]||window.firebase.initializeApp(state.settings.firebase);
    return app;
  })().catch(e=>{
    fbPromise=null;
    throw e;
  });
  return fbPromise;
}

async function firebaseSignIn(email,password){
  const app=await loadFirebase();
  return app.auth().signInWithEmailAndPassword(email,password);
}

async function firebaseSignUp(email,password,name){
  const app=await loadFirebase();
  const cred=await app.auth().createUserWithEmailAndPassword(email,password);
  await cred.user.updateProfile({displayName:name});
  return cred;
}

async function firebaseSignOut(){
  if(firebaseConfigured() && window.firebase?.apps?.length){
    try{await window.firebase.auth().signOut();}catch{}
  }
}

function loadScript(src){
  return new Promise((resolve,reject)=>{
    if([...document.scripts].some(s=>s.src===src||s.src.startsWith(src.split('?')[0]))) return resolve();
    const s=document.createElement('script');
    s.src=src;
    s.async=true;
    s.onload=resolve;
    s.onerror=()=>reject(new Error('Could not load '+src));
    document.head.appendChild(s);
  });
}

// ── WINDOW EVENTS ──
window.addEventListener('popstate',e=>{
  const h=e.state;
  if(h?.prebyte){
    state.view=h.view||'login';
    if(state.view==='student') state.studentTab=h.tab||'Order';
    if(state.view==='vendor') state.vendorTab=h.tab||'Queue';
    if(state.view==='admin') state.adminTab=h.tab||'Analytics';
    if(state.view==='login') state.user=null;
    render();
    return;
  }
  history.pushState({prebyte:true,view:state.view,tab:state.view==='student'?state.studentTab:state.view==='vendor'?state.vendorTab:state.adminTab},'',location.href);
});

window.addEventListener('storage',()=>{
  sync();
  if(state.view!=='login') render();
});

// Run initial boot
init();