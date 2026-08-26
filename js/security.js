/* ============================================================
   security.js — simple PIN gate stored (hashed) in localStorage.
   This only hides the UI behind a PIN in this browser profile.
   It does not encrypt IndexedDB on disk — see README for real
   device-encryption recommendations.
   ============================================================ */

const PIN_KEY = 'kontobuch_pin_hash';

const Security = {
  hasPin(){ return !!localStorage.getItem(PIN_KEY); },

  async setPin(pin){
    const hash = await sha256('kb_pin::'+pin);
    localStorage.setItem(PIN_KEY, hash);
  },

  async check(pin){
    const hash = await sha256('kb_pin::'+pin);
    return hash === localStorage.getItem(PIN_KEY);
  },

  lock(){
    sessionStorage.removeItem('kb_unlocked');
    document.getElementById('appShell').classList.add('hidden');
    document.getElementById('lockScreen').classList.remove('hidden');
    document.getElementById('pinInput').value='';
    document.getElementById('pinInput').focus();
  },

  isUnlockedThisSession(){
    return sessionStorage.getItem('kb_unlocked') === '1';
  },

  markUnlocked(){
    sessionStorage.setItem('kb_unlocked','1');
  }
};

function initLockScreen(onUnlock){
  const pinInput = document.getElementById('pinInput');
  const confirmWrap = document.getElementById('pinConfirmWrap');
  const confirmInput = document.getElementById('pinConfirmInput');
  const setupNotice = document.getElementById('lockSetupNotice');
  const errBox = document.getElementById('lockError');
  const submitBtn = document.getElementById('pinSubmit');

  const firstRun = !Security.hasPin();
  if(firstRun){
    setupNotice.classList.remove('hidden');
    confirmWrap.classList.remove('hidden');
    document.getElementById('lockSubtitle').textContent = 'Richte dein persönliches Buchhaltungsbuch ein.';
  }

  function showErr(msg){
    errBox.textContent = msg;
    errBox.classList.remove('hidden');
  }

  async function submit(){
    errBox.classList.add('hidden');
    const pin = pinInput.value.trim();
    if(pin.length < 4){ showErr('PIN muss mindestens 4 Stellen haben.'); return; }

    if(firstRun){
      const confirmPin = confirmInput.value.trim();
      if(pin !== confirmPin){ showErr('PINs stimmen nicht überein.'); return; }
      await Security.setPin(pin);
      Security.markUnlocked();
      onUnlock();
      return;
    }

    const ok = await Security.check(pin);
    if(!ok){ showErr('Falsche PIN.'); pinInput.value=''; pinInput.focus(); return; }
    Security.markUnlocked();
    onUnlock();
  }

  submitBtn.addEventListener('click', submit);
  [pinInput, confirmInput].forEach(inp=>{
    inp.addEventListener('keydown', e=>{ if(e.key==='Enter') submit(); });
  });

  if(Security.isUnlockedThisSession()){
    onUnlock();
  } else {
    document.getElementById('lockScreen').classList.remove('hidden');
    pinInput.focus();
  }
}
