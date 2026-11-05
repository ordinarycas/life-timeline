// 區塊 2：設定表單。每個欄位即時驗證；不合法的值只顯示錯誤、不寫入偏好設定。
import { validateField, DEFAULTS, HAVE_IDS } from '../data/prefs.js';
import { WAGE } from '../data/wage.js';
import { money } from '../core/format.js';

const $ = (id) => document.getElementById(id);
const FIELDS = [
  ['birth', 'f-birth', 'err-birth'], ['sex', 'f-sex', 'err-sex'], ['monthly', 'f-monthly', 'err-monthly'], ['retire', 'f-retire', 'err-retire'],
  ['start', 'f-start', 'err-start'], ['assetCash', 'f-asset-cash', 'err-asset-cash'], ['assetInvest', 'f-asset-invest', 'err-asset-invest'],
  ['assetOther', 'f-asset-other', 'err-asset-other'], ['debt', 'f-debt', 'err-debt'], ['debtInterest', 'f-debt-interest', 'err-debt-interest'], ['expense', 'f-expense', 'err-expense'], ['kidAge', 'f-kid-age', 'err-kid-age'], ['serviceAge', 'f-service-age', 'err-service-age'],
];
const SELECTS = [['wage', 'f-wage'], ['service', 'f-service'], ['serviceType', 'f-service-type']];

export function initSettings({ prefs, getToday, onChange, onClear }) {
  const state = { prefs };
  const ctx = () => ({ todayIso: getToday() });

  function fill() {
    const p = state.prefs;
    $('f-birth').max = getToday();
    $('f-birth').value = p.birth;
    $('f-sex').value = p.sex;
    $('f-wage').value = p.wage;
    $('f-monthly').value = p.wage === 'custom' && p.monthly ? String(p.monthly) : '';
    $('f-retire').value = String(p.retire);
    $('f-start').value = p.start ? String(p.start) : '';
    for (const k of ['assetCash', 'assetInvest', 'assetOther', 'debt', 'debtInterest', 'expense']) {
      const f = FIELDS.find((x) => x[0] === k);
      $(f[1]).value = p[k] ? String(p[k]) : '';
    }
    for (const id of HAVE_IDS) $(`f-have-${id}`).checked = p.have.includes(id);
    $('f-kid').checked = p.kid;
    $('f-kid-age').value = String(p.kidAge);
    $('f-service').value = p.service;
    $('f-service-type').value = p.serviceType;
    $('f-service-age').value = String(p.serviceAge);
    visibility();
  }

  function visibility() {
    const p = state.prefs;
    $('grp-service').hidden = p.sex !== 'male';
    $('fld-service-type').hidden = p.service !== 'auto';
    $('fld-service-age').hidden = p.service !== 'auto';
    $('service-school-note').hidden = !(p.service === 'auto' && p.serviceAge < 22);
    $('f-monthly').closest('.field').hidden = p.wage !== 'custom';
    $('f-kid-age').disabled = !p.kid;
    const w = WAGE[p.wage];
    $('wage-note').textContent = w ? `稅前月薪 ${money(w.monthly)}（時薪 ${w.hourly} 元）；${w.status === 'proposed' ? '尚待行政院核定，可能調整。' : '以今天的新台幣計。'}` : '稅前月薪，以今天的新台幣計。';
  }

  function setError(errId, inputId, msg) {
    const e = $(errId); const i = $(inputId);
    e.hidden = !msg; e.textContent = msg ?? '';
    if (msg) i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid');
  }

  function commit(key, value) {
    state.prefs = { ...state.prefs, [key]: value };
    visibility();
    onChange(state.prefs);
  }

  for (const [key, id, errId] of FIELDS) {
    const handler = () => {
      const raw = $(id).value;
      const r = validateField(key, raw, ctx());
      // 自訂月薪留空＝0；其他欄位不合法就只顯示錯誤
      if (!r.ok) { setError(errId, id, r.error); return; }
      setError(errId, id, null);
      if (state.prefs[key] !== r.value) commit(key, r.value);
    };
    $(id).addEventListener('input', handler);
    $(id).addEventListener('change', handler);
  }
  for (const [key, id] of SELECTS) {
    $(id).addEventListener('change', () => {
      const r = validateField(key, $(id).value, ctx());
      if (!r.ok) return;
      // 切到「自訂」時，把目前的基本工資帶進來當起點
      if (key === 'wage' && r.value === 'custom' && !state.prefs.monthly) {
        const base = WAGE[state.prefs.wage]?.monthly ?? WAGE.current.monthly;
        state.prefs = { ...state.prefs, monthly: base };
        $('f-monthly').value = String(base);
      }
      commit(key, r.value);
    });
  }
  for (const id of HAVE_IDS) {
    $(`f-have-${id}`).addEventListener('change', () => commit('have', HAVE_IDS.filter((x) => $(`f-have-${x}`).checked)));
  }
  $('f-kid').addEventListener('change', () => commit('kid', $('f-kid').checked));
  $('settings-form').addEventListener('submit', (e) => e.preventDefault());

  // 清除本機資料：兩段式確認
  const clearBtn = $('clear-data');
  let armed = null;
  clearBtn.addEventListener('click', () => {
    if (!armed) {
      clearBtn.textContent = '再按一次確認清除';
      armed = setTimeout(() => { armed = null; clearBtn.textContent = '清除本機資料'; }, 5000);
      return;
    }
    clearTimeout(armed); armed = null;
    clearBtn.textContent = '清除本機資料';
    state.prefs = { ...DEFAULTS };
    for (const [, id, errId] of FIELDS) setError(errId, id, null);
    fill();
    onClear(state.prefs);
    $('clear-status').textContent = '已清除這個瀏覽器中的設定。';
  });

  fill();
  return {
    refresh(prefs) { state.prefs = prefs; fill(); },
    summary(model, monthly) {
      const bits = [];
      if (model.demo) bits.push('尚未輸入生日與性別，目前顯示示範資料');
      else bits.push(`${model.sex === 'male' ? '男' : '女'}・${model.birth}`);
      bits.push(`月薪 ${money(monthly)}`, `${state.prefs.retire} 歲退休`);
      $('settings-summary').textContent = bits.join('・');
    },
  };
}
