import React, { useState, useMemo, useEffect } from 'react';

// ── Google Sheets endpoint ─────────────────────────────────────────────────────
// Paste your deployed Apps Script Web App URL here after setup
const SHEET_ENDPOINT = 'https://script.google.com/a/macros/boostmyschool.com/s/AKfycbz21g93b41d8LT48kZPZLBTK4fUgYk6zVXrgkvAFzSKrPTXal7Eb48UhsMAm8LM_EO1/exec';

// ── Brand ─────────────────────────────────────────────────────────────────────
const C = {
  primary:   '#004d60',
  secondary: '#d2fdfe',
  accent:    '#aafcc0',
  bg:        '#ffffff',
  text:      '#1a2e35',
  muted:     '#5a7a85',
  border:    '#c8e8ec',
  sectionBg: '#f0fbfc',
};

// ── Formatters ────────────────────────────────────────────────────────────────
const fmt$    = (n) => '$' + Math.round(n).toLocaleString('en-US');
const fmtN    = (n) => Math.round(n).toLocaleString('en-US');
const fmtPct  = (n) => (n * 100).toFixed(1) + '%';
const parseVal = (v) => { const n = parseFloat(String(v).replace(/,/g, '')); return isNaN(n) ? 0 : n; };

// ── Constants ─────────────────────────────────────────────────────────────────
const MODERN_PREF_SHARE = 0.50;
const ABANDONMENT_RATE  = 0.09;

const METHODS = [
  { id: 'apple_pay',  label: 'Apple Pay',               share: 0.45, avgGift: 400,  medianGift: 105 },
  { id: 'google_pay', label: 'Google Pay',              share: 0.05, avgGift: 400,  medianGift: 105 },
  { id: 'venmo',      label: 'Venmo',                   share: 0.10, avgGift: 400,  medianGift: 105 },
  { id: 'paypal',     label: 'PayPal',                  share: 0.10, avgGift: 400,  medianGift: 105 },
  { id: 'ach',        label: 'ACH / Bank Transfer',     share: 0.15, avgGift: 2000, medianGift: 500 },
  { id: 'daf',        label: 'DAF (Donor-Advised Fund)', share: 0.15, avgGift: 2000, medianGift: 500 },
];

// ── Method brand colors ───────────────────────────────────────────────────────
const METHOD_COLORS = {
  apple_pay:  '#1a1a1a',
  google_pay: '#4285F4',
  venmo:      '#008CFF',
  paypal:     '#002991',
  ach:        '#004d60',
  daf:        '#2e7d32',
};

// ── Shared styles ─────────────────────────────────────────────────────────────
const card = {
  backgroundColor: '#fff',
  borderRadius: 10,
  padding: 24,
  marginBottom: 20,
  boxShadow: '0 1px 6px rgba(0,77,96,0.09)',
};

const inputBase = {
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  padding: '10px 12px',
  fontSize: 15,
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
  fontFamily: "'Open Sans', sans-serif",
  color: C.text,
  backgroundColor: '#fff',
};

const labelSt = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: C.text,
  marginBottom: 6,
};

// ── Payment method icon ───────────────────────────────────────────────────────
function MethodIcon({ id, width = 80, height = 50 }) {
  const logoMap = {
    apple_pay:  '/logos/apple-pay.svg',
    google_pay: '/logos/google-pay.svg',
    venmo:      '/logos/venmo.svg',
    paypal:     '/logos/paypal.svg',
  };

  const bankPath  = 'M12 2L2 7v1h20V7L12 2zm-7 9v7H3v2h18v-2h-2v-7h-2v7h-4v-7h-2v7H7v-7H5z';
  const heartPath = 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';

  if (logoMap[id]) {
    const isApple = id === 'apple_pay';
    return (
      <div style={{
        width, height, borderRadius: 10, flexShrink: 0,
        backgroundColor: isApple ? '#000' : '#fff',
        border: isApple ? 'none' : `1.5px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: isApple ? 6 : 4, boxSizing: 'border-box', overflow: 'hidden',
      }}>
        <img src={logoMap[id]} alt={id.replace(/_/g, ' ')}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', filter: isApple ? 'invert(1)' : 'none' }} />
      </div>
    );
  }

  const cfg = {
    ach: { bg: C.primary, path: bankPath,  fill: C.secondary, iconSize: 26 },
    daf: { bg: C.accent,  path: heartPath, fill: C.primary,   iconSize: 24 },
  }[id];

  return (
    <div style={{
      width, height, borderRadius: 10, flexShrink: 0,
      backgroundColor: cfg.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg viewBox="0 0 24 24" width={cfg.iconSize} height={cfg.iconSize} fill={cfg.fill}>
        <path d={cfg.path} />
      </svg>
    </div>
  );
}

// ── Goal progress bar visualization ──────────────────────────────────────────
function GoalProgress({ label, current, projected, goal, formatVal }) {
  const hasGoal        = goal > 0 && goal !== current;
  const alreadyExceeding = goal > 0 && current >= goal;
  const exceeds        = hasGoal && !alreadyExceeding && projected > goal;
  const barMax         = Math.max(current, projected, goal || 0) * 1.12;
  const safeMax        = barMax > 0 ? barMax : 1;

  const currentPct   = (current   / safeMax) * 100;
  const projectedPct = (projected / safeMax) * 100;
  const goalPct      = hasGoal ? (goal / safeMax) * 100 : null;

  const gapClosed = hasGoal && !alreadyExceeding && goal > current
    ? (projected - current) / (goal - current)   // no cap — can exceed 1.0
    : null;

  return (
    <div style={{ marginBottom: 0 }}>

      {/* Header: label + badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.primary }}>{label}</span>
        {gapClosed !== null && (
          <span style={{
            fontSize: 13, fontWeight: 700, color: C.primary,
            backgroundColor: C.accent, borderRadius: 20, padding: '3px 10px',
          }}>
            {exceeds ? 'Goal exceeded' : fmtPct(gapClosed) + ' of gap closed'}
          </span>
        )}
        {alreadyExceeding && (
          <span style={{ fontSize: 12, color: C.primary, fontWeight: 600 }}>Already exceeding goal</span>
        )}
      </div>

      {/* Bar track */}
      <div style={{ position: 'relative', height: 28, backgroundColor: '#e4f5f8', borderRadius: 14, marginBottom: 10 }}>

        {/* FY26 fill — primary blue */}
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: currentPct + '%',
          backgroundColor: C.primary,
          borderRadius: '14px 0 0 14px',
          minWidth: currentPct > 0 ? 8 : 0,
        }} />

        {/* Boost increment — accent green, always rounded on right end */}
        {projected > current && (
          <div style={{
            position: 'absolute',
            left: currentPct + '%',
            top: 0, bottom: 0,
            width: Math.max(projectedPct - currentPct, 0) + '%',
            backgroundColor: C.accent,
            borderRadius: '0 14px 14px 0',
            borderLeft: `2px solid rgba(0,77,96,0.15)`,
            minWidth: 4,
          }} />
        )}

        {/* Goal marker line — sits on top */}
        {goalPct !== null && (
          <div style={{
            position: 'absolute',
            left: goalPct + '%',
            top: -8, bottom: -8,
            width: 3, backgroundColor: C.primary, borderRadius: 2,
            zIndex: 2,
          }} />
        )}
      </div>

      {/* Legend: FY26 | [Goal or Boost] | [Boost or Goal] */}
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>

        {/* Left — always FY26 */}
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: C.muted, margin: '0 0 1px 0' }}>{formatVal(current)}</p>
          <p style={{ fontSize: 10, color: C.muted, margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>FY26</p>
        </div>

        {/* Center — FY27 Goal when exceeds, With Boost otherwise */}
        {hasGoal && (
          <div style={{ textAlign: 'center' }}>
            {exceeds ? (
              <>
                <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 1px 0' }}>{formatVal(goal)}</p>
                <p style={{ fontSize: 10, color: C.muted, margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>FY27 Goal</p>
              </>
            ) : (
              <>
                <p style={{ fontSize: 14, fontWeight: 700, color: C.primary, margin: '0 0 1px 0' }}>{formatVal(projected)}</p>
                <p style={{ fontSize: 10, color: C.primary, margin: 0, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>With Boost</p>
              </>
            )}
          </div>
        )}

        {/* Right — With Boost when exceeds, FY27 Goal otherwise */}
        <div style={{ textAlign: 'right' }}>
          {exceeds ? (
            <>
              <p style={{ fontSize: 14, fontWeight: 700, color: C.primary, margin: '0 0 1px 0' }}>{formatVal(projected)}</p>
              <p style={{ fontSize: 10, color: C.primary, margin: 0, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>With Boost</p>
            </>
          ) : hasGoal ? (
            <>
              <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 1px 0' }}>{formatVal(goal)}</p>
              <p style={{ fontSize: 10, color: C.muted, margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>FY27 Goal</p>
            </>
          ) : (
            <>
              <p style={{ fontSize: 14, fontWeight: 700, color: C.primary, margin: '0 0 1px 0' }}>{formatVal(projected)}</p>
              <p style={{ fontSize: 10, color: C.primary, margin: 0, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>With Boost</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={onChange}
      style={{
        position: 'relative', display: 'inline-flex', alignItems: 'center',
        width: 44, height: 24, borderRadius: 12,
        backgroundColor: checked ? C.primary : '#b0cdd4',
        border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0,
      }}>
      <span style={{
        position: 'absolute', left: checked ? 22 : 2,
        width: 20, height: 20, borderRadius: '50%',
        backgroundColor: checked ? C.accent : '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        transition: 'left 0.15s, background-color 0.15s',
      }} />
    </button>
  );
}

function DollarInput({ id, value, onChange, placeholder, hasError }) {
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: C.muted, pointerEvents: 'none' }}>$</span>
      <input id={id} type="text" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...inputBase, paddingLeft: 24, borderColor: hasError ? '#c0392b' : C.border }} />
    </div>
  );
}

function TextInput({ id, value, onChange, placeholder, hasError, type = 'text' }) {
  return (
    <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ ...inputBase, borderColor: hasError ? '#c0392b' : C.border }} />
  );
}

function FieldError({ msg }) {
  if (!msg) return null;
  return <p style={{ fontSize: 12, color: '#c0392b', margin: '4px 0 0 0' }}>{msg}</p>;
}

// ── Calculation hook ──────────────────────────────────────────────────────────
function useCalc(inputs, offered) {
  return useMemo(() => {
    const lastYearDonors       = parseVal(inputs.lastYearDonors);
    const lastYearRevenue      = parseVal(inputs.lastYearRevenue);
    const solicitableCommunity = parseVal(inputs.solicitableCommunity);
    const participationGoal    = parseVal(inputs.participationGoal);
    const revenueGoal          = parseVal(inputs.revenueGoal);

    let totalLostGifts = 0, totalRevAvg = 0, totalRevMedian = 0;
    const contributions = [];

    for (const m of METHODS) {
      if (!offered[m.id]) {
        const lostGifts = solicitableCommunity * MODERN_PREF_SHARE * m.share * ABANDONMENT_RATE;
        const revAvg    = lostGifts * m.avgGift;
        const revMedian = lostGifts * m.medianGift;
        totalLostGifts += lostGifts;
        totalRevAvg    += revAvg;
        totalRevMedian += revMedian;
        contributions.push({ id: m.id, label: m.label, lostGifts, revAvg, revMedian });
      }
    }

    const rawIncrease      = totalLostGifts;
    const maxAdditional    = Math.max(solicitableCommunity - lastYearDonors, 0);
    const cappedIncrease   = Math.min(rawIncrease, maxAdditional);
    const capRatio         = rawIncrease > 0 ? cappedIncrease / rawIncrease : 1;
    const newParticipation = lastYearDonors + cappedIncrease;

    const increaseDollarsAvg    = totalRevAvg    * capRatio;
    const increaseDollarsMedian = totalRevMedian * capRatio;
    const newAFTotalMedian      = lastYearRevenue + increaseDollarsMedian;
    const newAFTotalAvg         = lastYearRevenue + increaseDollarsAvg;

    const gapToParticipation = participationGoal - lastYearDonors;
    const gapToRevenue       = revenueGoal - lastYearRevenue;
    const pctPartGapClosed   = gapToParticipation !== 0 ? cappedIncrease / gapToParticipation   : null;
    const pctRevGapClosed    = gapToRevenue       !== 0 ? increaseDollarsMedian / gapToRevenue  : null;

    const scaled = contributions
      .map((c) => ({
        ...c,
        contribution: c.revMedian * capRatio,
        scaledDonors: c.lostGifts * capRatio,
      }))
      .sort((a, b) => b.contribution - a.contribution);

    const maxContrib   = scaled.reduce((m, c) => Math.max(m, c.contribution), 0);
    const totalContrib = scaled.reduce((s, c) => s + c.contribution, 0);

    const avgGift           = lastYearDonors > 0 ? lastYearRevenue / lastYearDonors : 0;
    const participationRate = solicitableCommunity > 0 ? lastYearDonors / solicitableCommunity : 0;
    const modernPrefDonors  = Math.round(solicitableCommunity * MODERN_PREF_SHARE);
    const revenueLiftPct    = lastYearRevenue > 0 ? increaseDollarsMedian / lastYearRevenue : 0;
    const participationPct  = lastYearDonors > 0 ? cappedIncrease / lastYearDonors : 0;

    return {
      lastYearDonors, lastYearRevenue, participationGoal, revenueGoal,
      cappedIncrease, newParticipation, increaseDollarsAvg, increaseDollarsMedian,
      newAFTotalAvg, newAFTotalMedian,
      gapToParticipation, gapToRevenue, pctPartGapClosed, pctRevGapClosed,
      scaled, maxContrib, totalContrib,
      participationPct, avgGift, participationRate, modernPrefDonors,
      revenueLiftPct,
    };
  }, [inputs, offered]);
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [step, setStep]         = useState('form');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  const [inputs, setInputs] = useState({
    lastYearDonors:       '',
    lastYearRevenue:      '',
    solicitableCommunity: '',
    participationGoal:    '',
    revenueGoal:          '',
  });

  const [offered, setOffered] = useState({
    apple_pay: false, google_pay: false, venmo: false,
    paypal: false, ach: false, daf: false,
  });

  const [lead, setLead]     = useState({ schoolName: '', email: '', platform: '', crm: '' });
  const [errors, setErrors] = useState({});
  const [showModal, setShowModal] = useState(false);

  const calc = useCalc(inputs, offered);

  const setInput     = (k, v) => setInputs((p) => ({ ...p, [k]: v }));
  const toggleMethod = (id)   => setOffered((p) => ({ ...p, [id]: !p[id] }));

  const methodologyLink = (
    <button
      type="button"
      onClick={() => setShowModal(true)}
      style={{
        background: 'none', border: 'none', padding: 0, cursor: 'pointer',
        color: C.primary, textDecoration: 'underline', fontSize: '0.85rem',
        fontFamily: "'Open Sans', sans-serif",
      }}
    >
      How do we calculate this?
    </button>
  );

  const methodologyModal = showModal && (
    <div
      onClick={() => setShowModal(false)}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '20px', boxSizing: 'border-box',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative', backgroundColor: '#fff', borderRadius: 8,
          maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto',
          padding: '2rem', boxSizing: 'border-box',
          boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
        }}
      >
        <button
          onClick={() => setShowModal(false)}
          style={{
            position: 'absolute', top: '1rem', right: '1rem',
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '1.4rem', color: '#535353', lineHeight: 1, padding: 4,
            fontFamily: "'Open Sans', sans-serif",
          }}
        >
          &times;
        </button>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0D2B3E', margin: '0 0 16px 0', paddingRight: '2rem' }}>
          How We Calculate Your Results
        </h2>
        <p style={{ fontSize: 14, color: '#535353', lineHeight: 1.65, margin: '0 0 0 0' }}>
          This calculator estimates how many additional donors and dollars your annual fund could generate by accepting modern payment methods that most K-12 schools don't currently offer.
        </p>

        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0D2B3E', marginTop: '1.5rem', marginBottom: 10 }}>
          The inputs we use:
        </h3>
        <p style={{ fontSize: 14, color: '#535353', lineHeight: 1.8, margin: 0 }}>
          Your donor count and annual fund revenue from last year<br />
          Your solicitable community size (the total number of households you could reach)<br />
          Which modern payment methods your school currently accepts
        </p>

        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0D2B3E', marginTop: '1.5rem', marginBottom: 10 }}>
          The assumptions behind the math:
        </h3>
        <p style={{ fontSize: 14, color: '#535353', lineHeight: 1.8, margin: 0 }}>
          Roughly 50% of donors prefer to give using a modern payment method like Apple Pay, Venmo, ACH, or a donor-advised fund<br />
          When a donor's preferred payment method isn't available, about 9% of them will abandon their gift entirely<br />
          Each payment method has a different adoption rate and average gift size. For example, ACH and DAF donors tend to give significantly larger gifts than digital wallet donors.
        </p>

        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0D2B3E', marginTop: '1.5rem', marginBottom: 10 }}>
          How we get to your number:
        </h3>
        <p style={{ fontSize: 14, color: '#535353', lineHeight: 1.65, margin: '0 0 12px 0' }}>
          For each payment method your school doesn't currently offer, we calculate how many donors in your community would prefer that method, how many of those donors abandon when they can't use it, and what those missed gifts would have been worth. We add those up across all missing methods to get your total estimated lift in donors and dollars.
        </p>
        <p style={{ fontSize: 14, color: '#535353', lineHeight: 1.65, margin: 0 }}>
          If your estimated new donor count would exceed the number of people in your solicitable community who haven't yet given, we cap the results to keep the estimate realistic.
        </p>

        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0D2B3E', marginTop: '1.5rem', marginBottom: 10 }}>
          A note on precision:
        </h3>
        <p style={{ fontSize: 14, color: '#535353', lineHeight: 1.65, margin: 0 }}>
          These are estimates based on industry-wide donor behavior data, not a guarantee. Your actual results will depend on your community, your outreach, and the timing of your campaigns. The goal of this calculator is to help you understand the general scale of what modern payment acceptance could mean for your annual fund, not to predict an exact dollar amount.
        </p>
      </div>
    </div>
  );

  const validate = () => {
    const e = {};
    if (parseVal(inputs.lastYearDonors) <= 0)        e.lastYearDonors       = 'Required';
    if (parseVal(inputs.lastYearRevenue) <= 0)       e.lastYearRevenue      = 'Required';
    if (parseVal(inputs.solicitableCommunity) <= 0)  e.solicitableCommunity = 'Required';
    if (!lead.schoolName.trim())                     e.schoolName           = 'Required';
    if (!lead.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email))
                                                     e.email                = 'Valid email required';
    if (!lead.platform)                              e.platform             = 'Required';
    if (!lead.crm)                                   e.crm                  = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    if (SHEET_ENDPOINT) {
      fetch(SHEET_ENDPOINT, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          schoolName:           lead.schoolName,
          email:                lead.email,
          platform:             lead.platform,
          crm:                  lead.crm,
          lastYearDonors:       inputs.lastYearDonors,
          lastYearRevenue:      inputs.lastYearRevenue,
          solicitableCommunity: inputs.solicitableCommunity,
          participationGoal:    inputs.participationGoal,
          revenueGoal:          inputs.revenueGoal,
          offered,
        }),
      }).catch(() => {}); // fire-and-forget, never block the user
    }

    setStep('results');
    window.scrollTo(0, 0);
  };

  const selectSt = {
    ...inputBase, cursor: 'pointer', appearance: 'none',
    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%235a7a85' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 36,
  };

  // ── Shared header / footer ───────────────────────────────────────────────────
  const header = (
    <header style={{
      backgroundColor: C.primary, color: '#fff', padding: '0 24px', height: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
    }}>
      <span style={{ fontSize: 16, fontWeight: 700 }}>Annual Fund ROI Calculator</span>
      <a href="https://www.boostmyschool.com/demo" target="_blank" rel="noopener noreferrer"
        style={{ color: C.primary, fontWeight: 700, fontSize: 13, textDecoration: 'none', backgroundColor: C.accent, borderRadius: 5, padding: '6px 14px' }}>
        Book a Demo
      </a>
    </header>
  );

  const footer = (
    <footer style={{ textAlign: 'center', padding: '18px 24px', borderTop: `1px solid ${C.border}`, fontSize: 13, color: C.muted }}>
      Powered by{' '}
      <a href="https://www.boostmyschool.com" target="_blank" rel="noopener noreferrer"
        style={{ color: C.primary, fontWeight: 600, textDecoration: 'none' }}>
        Boost My School
      </a>
    </footer>
  );

  // ══════════════════════════════════════════════════════════════════════════════
  // SCREEN 1: FORM
  // ══════════════════════════════════════════════════════════════════════════════
  const formScreen = (
    <main style={{ flex: 1, maxWidth: 980, width: '100%', margin: '0 auto', padding: isMobile ? '24px 16px' : '40px 24px', boxSizing: 'border-box' }}>
      <form onSubmit={handleSubmit} noValidate>

        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: C.primary, margin: '0 0 10px 0', lineHeight: 1.25 }}>
            How much is your school leaving on the table?
          </h1>
          <p style={{ fontSize: 15, color: C.muted, margin: '0 auto', maxWidth: 560, lineHeight: 1.65 }}>
            Enter your school's numbers to see a personalized breakdown of how much additional revenue you could be capturing.
          </p>
        </div>

        {/* School numbers */}
        <div style={card}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: C.primary, margin: '0 0 20px 0' }}>Your School's Numbers</h2>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 16 }}>
            {[
              { id: 'lastYearDonors',       label: "Last Year's Donors",              dollar: false, placeholder: 'e.g. 650', required: true },
              { id: 'lastYearRevenue',      label: "Last Year's Annual Fund Revenue",  dollar: true,  placeholder: 'e.g. 500000', required: true },
              { id: 'solicitableCommunity', label: 'Solicitable Community Size',       dollar: false, placeholder: 'e.g. 5000', helper: 'Total households you could reach', required: true },
              { id: 'participationGoal',    label: "This Year's Participation Goal",   dollar: false, placeholder: 'e.g. 700', optional: true },
              { id: 'revenueGoal',          label: "This Year's Revenue Goal",         dollar: true,  placeholder: 'e.g. 600000', optional: true },
            ].map((f) => (
              <div key={f.id} style={{ marginBottom: 0 }}>
                <label htmlFor={f.id} style={{ ...labelSt, color: errors[f.id] ? '#c0392b' : C.text }}>
                  {f.label}{f.required && <span style={{ color: '#c0392b' }}> *</span>}{f.optional && <span style={{ fontWeight: 400, color: C.muted }}> (optional)</span>}
                </label>
                {f.dollar
                  ? <DollarInput id={f.id} value={inputs[f.id]} onChange={(v) => setInput(f.id, v)} placeholder={f.placeholder} hasError={!!errors[f.id]} />
                  : <TextInput   id={f.id} value={inputs[f.id]} onChange={(v) => setInput(f.id, v)} placeholder={f.placeholder} hasError={!!errors[f.id]} />}
                {f.helper && <p style={{ fontSize: 12, color: C.muted, margin: '4px 0 0 0' }}>{f.helper}</p>}
                <FieldError msg={errors[f.id]} />
              </div>
            ))}
          </div>
        </div>

        {/* Payment methods */}
        <div style={card}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: C.primary, margin: '0 0 6px 0' }}>Payment Methods You Currently Offer</h2>
          <p style={{ fontSize: 12, color: C.muted, margin: '0 0 14px 0', lineHeight: 1.55 }}>
            Toggle on any methods your school already accepts. Most schools using Blackbaud or similar platforms don't offer any of these.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
            {METHODS.map((m) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <MethodIcon id={m.id} width={72} height={44} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{m.label}</span>
                </div>
                <Toggle checked={offered[m.id]} onChange={() => toggleMethod(m.id)} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            {methodologyLink}
          </div>
        </div>

        {/* Contact form */}
        <div style={{ ...card, borderTop: `3px solid ${C.accent}` }}>
          <p style={{ fontSize: 14, color: C.primary, fontWeight: 600, margin: '0 0 8px 0' }}>Almost there, just a couple more details!</p>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: C.primary, margin: '0 0 4px 0' }}>Tell us about your school</h2>
          <p style={{ fontSize: 13, color: C.muted, margin: '0 0 20px 0' }}>Enter your details below to see your results.</p>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 24 }}>
            <div>
              <label htmlFor="schoolName" style={{ ...labelSt, color: errors.schoolName ? '#c0392b' : C.text }}>School Name *</label>
              <TextInput id="schoolName" value={lead.schoolName} onChange={(v) => setLead((p) => ({ ...p, schoolName: v }))} placeholder="Northfield Academy" hasError={!!errors.schoolName} />
              <FieldError msg={errors.schoolName} />
            </div>
            <div>
              <label htmlFor="email" style={{ ...labelSt, color: errors.email ? '#c0392b' : C.text }}>Email *</label>
              <TextInput id="email" type="email" value={lead.email} onChange={(v) => setLead((p) => ({ ...p, email: v }))} placeholder="you@school.edu" hasError={!!errors.email} />
              <FieldError msg={errors.email} />
            </div>
            <div>
              <label htmlFor="platform" style={{ ...labelSt, color: errors.platform ? '#c0392b' : C.text }}>Current Fundraising Platform *</label>
              <select id="platform" value={lead.platform} onChange={(e) => setLead((p) => ({ ...p, platform: e.target.value }))} style={{ ...selectSt, borderColor: errors.platform ? '#c0392b' : C.border }}>
                <option value="">Select...</option>
                {["Raiser's Edge / RE NXT","GiveCampus","Blackbaud (other)","Veracross","GiveSmart","Custom / In-house","Other","Not sure"].map((o) => <option key={o}>{o}</option>)}
              </select>
              <FieldError msg={errors.platform} />
            </div>
            <div>
              <label htmlFor="crm" style={{ ...labelSt, color: errors.crm ? '#c0392b' : C.text }}>Current CRM *</label>
              <select id="crm" value={lead.crm} onChange={(e) => setLead((p) => ({ ...p, crm: e.target.value }))} style={{ ...selectSt, borderColor: errors.crm ? '#c0392b' : C.border }}>
                <option value="">Select...</option>
                {["Raiser's Edge / RE NXT","Veracross","Blackbaud (other)","Salesforce","HubSpot","Other","Not sure"].map((o) => <option key={o}>{o}</option>)}
              </select>
              <FieldError msg={errors.crm} />
            </div>
          </div>

          <button type="submit" style={{
            width: '100%', padding: '14px 24px', backgroundColor: C.primary, color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 700,
            cursor: 'pointer', fontFamily: "'Open Sans', sans-serif", letterSpacing: 0.3,
          }}>
            Show My Results
          </button>
        </div>
      </form>
    </main>
  );

  // ══════════════════════════════════════════════════════════════════════════════
  // SCREEN 2: RESULTS
  // ══════════════════════════════════════════════════════════════════════════════
  const allOffered = METHODS.every((m) => offered[m.id]);
  const hasGoals   = inputs.participationGoal || inputs.revenueGoal;

  const resultsScreen = (
    <main style={{ flex: 1, maxWidth: 1100, width: '100%', margin: '0 auto', padding: isMobile ? '24px 16px' : '40px 24px', boxSizing: 'border-box' }}>

      {/* School name + Recalculate */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <p style={{ fontSize: 13, color: C.muted, margin: '0 0 2px 0' }}>Results for</p>
          <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: C.primary, margin: 0 }}>{lead.schoolName}</h1>
        </div>
        <button onClick={() => { setStep('form'); window.scrollTo(0, 0); }} style={{
          backgroundColor: 'transparent', border: `1px solid ${C.border}`,
          borderRadius: 6, padding: '8px 16px', fontSize: 13, color: C.muted,
          cursor: 'pointer', fontFamily: "'Open Sans', sans-serif",
        }}>
          Recalculate
        </button>
      </div>

      {/* Hero banner */}
      <div style={{
        background: `linear-gradient(135deg, ${C.primary} 0%, #006d87 100%)`,
        borderRadius: 12, padding: isMobile ? '28px 20px' : '40px 48px', marginBottom: 24, color: '#fff',
      }}>
        <p style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.2, color: 'rgba(255,255,255,0.6)', margin: '0 0 16px 0' }}>
          {lead.schoolName} is potentially missing
        </p>

        {/* Primary numbers: revenue and donors side by side */}
        <div style={{ display: 'flex', gap: isMobile ? 20 : 48, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ flex: '1 1 220px' }}>
            <p style={{ fontSize: isMobile ? 48 : 64, fontWeight: 700, margin: '0 0 6px 0', lineHeight: 1, color: C.accent }}>
              {fmt$(calc.increaseDollarsMedian)}
            </p>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', margin: 0, lineHeight: 1.5 }}>
              in annual fund revenue by not accepting modern payment methods
            </p>
          </div>

          {/* Divider */}
          {!isMobile && (
            <div style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'stretch', flexShrink: 0 }} />
          )}

          <div style={{ flex: '1 1 160px' }}>
            <p style={{ fontSize: isMobile ? 48 : 64, fontWeight: 700, margin: '0 0 6px 0', lineHeight: 1, color: C.accent }}>
              +{fmtN(calc.cappedIncrease)}
            </p>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', margin: 0, lineHeight: 1.5 }}>
              additional donors your giving page isn't capturing
            </p>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              color: 'rgba(255,255,255,0.7)', textDecoration: 'underline', fontSize: '0.85rem',
              fontFamily: "'Open Sans', sans-serif",
            }}
          >
            How do we calculate this?
          </button>
        </div>

      </div>

      {/* Two light blue "what you could have hit" boxes */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexDirection: isMobile ? 'column' : 'row' }}>
        <div style={{
          flex: 1, backgroundColor: C.secondary, borderRadius: 10,
          padding: isMobile ? '20px 20px' : '24px 32px',
        }}>
          <p style={{ fontSize: isMobile ? 32 : 40, fontWeight: 700, color: C.primary, margin: '0 0 6px 0', lineHeight: 1 }}>
            {fmt$(calc.newAFTotalMedian)}
          </p>
          <p style={{ fontSize: 13, color: C.muted, margin: 0, lineHeight: 1.5 }}>
            Annual fund total {lead.schoolName} could have raised this year
          </p>
        </div>
        <div style={{
          flex: 1, backgroundColor: C.secondary, borderRadius: 10,
          padding: isMobile ? '20px 20px' : '24px 32px',
        }}>
          <p style={{ fontSize: isMobile ? 32 : 40, fontWeight: 700, color: C.primary, margin: '0 0 6px 0', lineHeight: 1 }}>
            {fmtN(calc.newParticipation)}
          </p>
          <p style={{ fontSize: 13, color: C.muted, margin: 0, lineHeight: 1.5 }}>
            Total donors who could have made a gift this year
          </p>
        </div>
      </div>

      {/* Goal progress bars — shown first */}
      {hasGoals && (
        <div style={card}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: C.primary, margin: '0 0 4px 0' }}>Progress Toward Your FY27 Goals</h3>
          <p style={{ fontSize: 12, color: C.muted, margin: '0 0 28px 0' }}>
            FY26 results vs. what FY27 could look like with modern payment acceptance
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
            {inputs.participationGoal && (
              <GoalProgress
                label="Participation"
                current={calc.lastYearDonors}
                projected={calc.newParticipation}
                goal={calc.participationGoal}
                formatVal={fmtN}
              />
            )}
            {inputs.revenueGoal && (
              <GoalProgress
                label="Annual Fund Revenue"
                current={calc.lastYearRevenue}
                projected={calc.newAFTotalMedian}
                goal={calc.revenueGoal}
                formatVal={fmt$}
              />
            )}
          </div>
        </div>
      )}

      {/* Payment method impact cards */}
      <div style={card}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: C.primary, margin: '0 0 4px 0' }}>New Dollars by Payment Method</h3>
        <p style={{ fontSize: 12, color: C.muted, margin: '0 0 20px 0' }}>
          Methods not currently offered at {lead.schoolName}, sorted by estimated impact
        </p>
        {allOffered ? (
          <p style={{ fontSize: 14, color: C.muted }}>You're already offering all modern payment methods.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 14 }}>
            {calc.scaled.map((c) => (
              <div key={c.id} style={{
                border: `1px solid ${C.border}`,
                borderLeft: `4px solid ${C.primary}`,
                borderRadius: 10, padding: '16px 18px',
                backgroundColor: '#fff',
                display: 'flex', alignItems: 'center', gap: 16,
              }}>
                <MethodIcon id={c.id} width={100} height={64} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.muted, margin: '0 0 10px 0' }}>{c.label}</p>
                  <div style={{ display: 'flex', gap: 24 }}>
                    <div>
                      <p style={{ fontSize: 24, fontWeight: 700, color: C.primary, margin: '0 0 2px 0', lineHeight: 1 }}>{fmt$(c.contribution)}</p>
                      <p style={{ fontSize: 11, color: C.muted, margin: 0, textTransform: 'uppercase', letterSpacing: 0.4 }}>New Dollars</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 24, fontWeight: 700, color: C.primary, margin: '0 0 2px 0', lineHeight: 1 }}>+{fmtN(c.scaledDonors)}</p>
                      <p style={{ fontSize: 11, color: C.muted, margin: 0, textTransform: 'uppercase', letterSpacing: 0.4 }}>Donors</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CTA */}
      <div style={{
        ...card, backgroundColor: C.primary,
        textAlign: 'center', padding: isMobile ? '32px 20px' : '44px 48px', marginBottom: 0,
      }}>
        <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, color: 'rgba(255,255,255,0.5)', margin: '0 0 12px 0' }}>
          Ready to act on this?
        </p>
        <h2 style={{ fontSize: isMobile ? 20 : 26, fontWeight: 700, color: '#fff', margin: '0 0 10px 0', lineHeight: 1.3 }}>
          See how Boost My School helps {lead.schoolName} capture this revenue
        </h2>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', margin: '0 0 28px 0', maxWidth: 460, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.65 }}>
          We'll walk you through how modern payment acceptance works for K-12 annual funds and what implementation looks like for your school.
        </p>
        <a href="https://www.boostmyschool.com/demo" target="_blank" rel="noopener noreferrer" style={{
          display: 'inline-block', backgroundColor: C.accent, color: C.primary,
          textDecoration: 'none', padding: '14px 40px', borderRadius: 8,
          fontSize: 15, fontWeight: 700, letterSpacing: 0.3,
        }}>
          Book a Demo
        </a>
      </div>

    </main>
  );

  return (
    <div style={{ fontFamily: "'Open Sans', sans-serif", color: C.text, backgroundColor: C.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {header}
      {step === 'form' ? formScreen : resultsScreen}
      {footer}
      {methodologyModal}
    </div>
  );
}
