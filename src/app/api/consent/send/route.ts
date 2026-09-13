import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const { firstName, lastName, docNumber, email, phone } = await request.json();

  // Step 1: GET the form page and extract cookies + tokens
  const pageRes = await fetch('https://fantasyskate.com.ar/consentimiento/', {
    headers: {
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  const cookies = pageRes.headers.get('set-cookie') ?? '';
  const html = await pageRes.text();

  // Extract hidden field values using regex
  function extractHidden(name: string): string {
    const escaped = name.replace(/[[\]]/g, '\\$&');
    const match =
      html.match(new RegExp(`name="${escaped}"[^>]*value="([^"]*)"`, 'i')) ??
      html.match(new RegExp(`value="([^"]*)"[^>]*name="${escaped}"`, 'i'));
    return match?.[1] ?? '';
  }

  const nonce = extractHidden('frm_submit_entry_2');
  const frmState = extractHidden('frm_state');
  const antispam = extractHidden('antispam_token');
  const uniqueId = extractHidden('unique_id');

  if (!nonce || !frmState) {
    return NextResponse.json(
      { success: false, message: 'No se pudo obtener los tokens del formulario' },
      { status: 502 }
    );
  }

  const today = new Date().toISOString().split('T')[0];

  // Step 2: Build and POST the form
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
  });

  // WordPress Formidable typically redirects on success or shows success message
  const responseText = await submitRes.text();
  const isSuccess =
    submitRes.ok &&
    (submitRes.url !== 'https://fantasyskate.com.ar/consentimiento/' ||
      responseText.includes('frm_message') ||
      responseText.includes('success') ||
      !responseText.includes('frm_error'));

  return NextResponse.json({
    success: isSuccess,
    message: isSuccess
      ? 'Consentimiento enviado correctamente'
      : 'Error al enviar el consentimiento',
  });
}
