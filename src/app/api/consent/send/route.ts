import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const { firstName, lastName, docNumber, email, phone } = await request.json();

  const player = `${firstName} ${lastName}`.trim() || '(sin nombre)';
  console.log(`[consent/send] → Iniciando envío para: ${player}`);

  // Step 1: GET the form page
  const pageRes = await fetch('https://fantasyskate.com.ar/consentimiento/', {
    headers: {
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  }).catch(err => { console.error('[consent/send] GET falló:', err); return null; });

  if (!pageRes) return NextResponse.json({ success: false, message: 'No se pudo conectar' }, { status: 502 });

  const cookies = pageRes.headers.get('set-cookie') ?? '';
  const html = await pageRes.text();

  function extractHidden(name: string): string {
    const escaped = name.replace(/[[\]]/g, '\\$&');
    return (
      html.match(new RegExp(`name="${escaped}"[^>]*value="([^"]*)"`, 'i'))?.[1] ??
      html.match(new RegExp(`value="([^"]*)"[^>]*name="${escaped}"`, 'i'))?.[1] ??
      ''
    );
  }

  // Extract frm_js localized object
  const frmJsMatch = html.match(/var\s+frm_js\s*=\s*(\{[\s\S]*?\});/);
  let frmJs: Record<string, string> = {};
  if (frmJsMatch) {
    try { frmJs = JSON.parse(frmJsMatch[1]); } catch {}
  }
  const ajaxUrl = frmJs.ajax_url ?? 'https://fantasyskate.com.ar/wp-admin/admin-ajax.php';
  const frmNonce = frmJs.nonce ?? '';
  console.log(`[consent/send]   frm_js.nonce: ${frmNonce} | ajax_url: ${ajaxUrl}`);

  const nonce    = extractHidden('frm_submit_entry_2');
  const frmState = extractHidden('frm_state');

  if (!nonce || !frmState) {
    return NextResponse.json({ success: false, message: 'No se pudo obtener tokens del formulario' }, { status: 502 });
  }

  // Try to find the exact AJAX action Formidable uses for antispam by reading its JS source
  let antispamAction = '';
  {
    // Look for formidable JS script URL in HTML
    const frmJsSrcMatch = html.match(/https?:[^"']+formidable[^"']*(?:frm|front)[^"']*\.js[^"']*/i);
    if (frmJsSrcMatch) {
      const jsUrl = frmJsSrcMatch[0].replace(/\\//g, '/');
      console.log(`[consent/send]   Fetching Formidable JS: ${jsUrl}`);
      try {
        const jsRes = await fetch(jsUrl, { headers: { 'user-agent': 'Mozilla/5.0' } });
        if (jsRes.ok) {
          const jsText = await jsRes.text();
          // Look for the antispam AJAX action name
          const actionMatch = jsText.match(/action['":\s]+['"](frm_antispam[^'"]*)['"]/i)
            ?? jsText.match(/action['":\s]+['"](frm[^'"]*spam[^'"]*)['"]/i);
          if (actionMatch) {
            antispamAction = actionMatch[1];
            console.log(`[consent/send]   Action antispam encontrado en JS: ${antispamAction}`);
          } else {
            // Log the section around antispam mentions
            const idx = jsText.indexOf('antispam');
            if (idx !== -1) {
              console.log(`[consent/send]   Contexto antispam en frm.js: …${jsText.slice(Math.max(0, idx - 100), idx + 300).replace(/\s+/g, ' ')}…`);
            } else {
              console.log(`[consent/send]   "antispam" no aparece en el JS de Formidable`);
            }
          }
        }
      } catch (e) { console.warn('[consent/send]   No se pudo leer frm.js:', e); }
    } else {
      console.log('[consent/send]   No se encontró URL de frm.js en el HTML');
    }
  }

  // Try multiple AJAX actions to get antispam token
  let antispam = '';
  const actionsToTry = [
    antispamAction,
    'frm_antispam_js',
    'frm_antispam',
    'frm_entries_list',
    'frm_form_field_value',
  ].filter(Boolean);

  for (const action of actionsToTry) {
    const body = new URLSearchParams({ action, nonce: frmNonce, form_id: '2', security: frmNonce });
    try {
      const r = await fetch(ajaxUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'cookie': cookies,
          'referer': 'https://fantasyskate.com.ar/consentimiento/',
          'x-requested-with': 'XMLHttpRequest',
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
        body: body.toString(),
      });
      const txt = await r.text();
      console.log(`[consent/send]   AJAX action=${action} → status=${r.status} body=${txt.slice(0, 120)}`);
      if (txt && txt !== '0' && txt !== '-1' && txt !== 'false' && r.status === 200) {
        try {
          const j = JSON.parse(txt);
          const candidate = j?.data ?? j?.token ?? j?.antispam_token ?? (typeof j === 'string' ? j : '');
          if (candidate) { antispam = candidate; console.log(`[consent/send]   ✓ antispam_token obtenido con action=${action}: ${antispam.slice(0, 12)}…`); break; }
        } catch {
          // plain string token
          antispam = txt.trim().replace(/^["'](.*)["']$/, '$1');
          if (antispam) { console.log(`[consent/send]   ✓ antispam_token (plain) con action=${action}: ${antispam.slice(0, 12)}…`); break; }
        }
      }
    } catch (e) { console.warn(`[consent/send]   AJAX ${action} excepción:`, e); }
  }

  // Last resort: try frm_js.nonce itself as the token (some Formidable configs accept this)
  if (!antispam) {
    antispam = frmNonce;
    console.log(`[consent/send]   Usando frm_js.nonce como antispam_token: ${antispam}`);
  }

  const uniqueId = extractHidden('unique_id') || randomUUID();

  console.log(`[consent/send]   Tokens — nonce: ✓ | frm_state: ✓ | antispam: ${antispam ? `✓ (${antispam.slice(0,8)}…)` : '✗'} | unique_id: ✓`);

  const today = new Date().toISOString().split('T')[0];

  const formData = new FormData();
  formData.append('frm_action', 'create');
  formData.append('form_id', '2');
  formData.append('frm_hide_fields_2', '["frm_field_19_container"]');
  formData.append('form_key', 'consentimiento-ingreso-pista');
  formData.append('item_meta[0]', '');
  formData.append('frm_submit_entry_2', nonce);
  formData.append('_wp_http_referer', '/consentimiento/');
  formData.append('item_meta[9][first]', firstName);
  formData.append('item_meta[9][last]', lastName);
  formData.append('item_meta[11]', docNumber);
  formData.append('item_meta[12]', email);
  formData.append('item_meta[13]', phone);
  formData.append('item_meta[35]', 'No');
  formData.append('item_meta[33]', today);
  formData.append('item_meta[34]', today);
  formData.append('item_meta[19][form]', '4');
  formData.append('item_meta[19][row_ids][]', '0');
  formData.append('item_meta[19][0][0]', '');
  formData.append('item_meta[19][0][21][first]', '');
  formData.append('item_meta[19][0][21][last]', '');
  formData.append('item_meta[26][]', 'Declaro haber leído y acepto el consentimiento informado y la asunción de riesgo.');
  formData.append('item_key', '');
  formData.append('item_meta[36]', '');
  formData.append('frm_state', frmState);
  formData.append('antispam_token', antispam);
  formData.append('unique_id', uniqueId);

  const submitRes = await fetch('https://fantasyskate.com.ar/consentimiento/', {
    method: 'POST',
    headers: {
      'cookie': cookies,
      'origin': 'https://fantasyskate.com.ar',
      'referer': 'https://fantasyskate.com.ar/consentimiento/',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
    body: formData,
    redirect: 'follow',
  }).catch(err => { console.error('[consent/send] POST excepción:', err); return null; });

  if (!submitRes) return NextResponse.json({ success: false, message: 'Error al enviar el formulario' }, { status: 502 });

  console.log(`[consent/send]   POST → status ${submitRes.status} | url: ${submitRes.url}`);

  const responseText = await submitRes.text();
  const hasMessage   = responseText.includes('frm_message');
  const hasError     = responseText.includes('frm_error');
  const redirectedAway = submitRes.url !== 'https://fantasyskate.com.ar/consentimiento/';

  const isSuccess = submitRes.ok && (redirectedAway || hasMessage || !hasError);

  if (isSuccess) {
    console.log(`[consent/send] ✓ Enviado: ${player}`);
  } else {
    const errorIdx = responseText.indexOf('frm_error');
    const snippet = errorIdx !== -1
      ? responseText.slice(Math.max(0, errorIdx - 30), errorIdx + 350).replace(/\s+/g, ' ')
      : responseText.slice(0, 300).replace(/\s+/g, ' ');
    console.warn(`[consent/send] ✗ Fallo: ${player} → ${snippet}`);
  }

  return NextResponse.json({
    success: isSuccess,
    message: isSuccess ? 'Consentimiento enviado correctamente' : 'Error al enviar el consentimiento',
  });
}
