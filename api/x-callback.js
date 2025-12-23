const fetch = require('node-fetch');

module.exports = async (req, res) => {
  const X_CLIENT_ID = 'bHNPWkcxOTRIeHlYY1VFZzZEaV86MTpjaQ';
  const X_CLIENT_SECRET = process.env.X_CLIENT_SECRET;
  const REDIRECT_URI = 'https://activimmo.skyward-agency.ai/api/x-callback';
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;

  const { code, state: clientId } = req.query;

  if (!code) {
    return res.redirect('/error.html?error=no_code');
  }

  try {
    // Échanger le code contre un token
    const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString('base64')
      },
      body: new URLSearchParams({
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
        code_verifier: 'challenge'
      })
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);

    const accessToken = tokenData.access_token;

    // Récupérer le profil utilisateur
    const userRes = await fetch('https://api.twitter.com/2/users/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    const userData = await userRes.json();

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
          twitter_token: accessToken,
          twitter_user_id: userData.data.id
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
          twitter_token: accessToken,
          twitter_user_id: userData.data.id
        })
      });
    }

    res.redirect('/success.html');
  } catch (error) {
    res.redirect('/error.html?error=' + encodeURIComponent(error.message));
  }
};
