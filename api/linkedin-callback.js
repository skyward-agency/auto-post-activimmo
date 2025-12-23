const fetch = require('node-fetch');

module.exports = async (req, res) => {
  const LINKEDIN_CLIENT_ID = '78n0eypy3kuyk6';
  const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
  const REDIRECT_URI = 'https://activimmo.skyward-agency.ai/api/linkedin-callback';
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;

  const { code, state: clientId } = req.query;

  if (!code) {
    return res.redirect('/error.html?error=no_code');
  }

  try {
    // Échanger le code contre un token
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: LINKEDIN_CLIENT_ID,
        client_secret: LINKEDIN_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI
      })
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error) throw new Error(tokenData.error_description);

    const accessToken = tokenData.access_token;

    // Récupérer le profil
    const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const profileData = await profileRes.json();

    // Vérifier si le client existe déjà
    const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/clients?client_id=eq.${clientId}`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    const existing = await checkRes.json();

    if (existing && existing.length > 0) {
      // UPDATE
      await fetch(`${SUPABASE_URL}/rest/v1/clients?client_id=eq.${clientId}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          linkedin_token: accessToken,
          linkedin_user_id: profileData.sub
        })
      });
    } else {
      // INSERT
      await fetch(`${SUPABASE_URL}/rest/v1/clients`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_id: clientId,
          linkedin_token: accessToken,
          linkedin_user_id: profileData.sub
        })
      });
    }

    res.redirect('/success.html');
  } catch (error) {
    res.redirect('/error.html?error=' + encodeURIComponent(error.message));
  }
};
