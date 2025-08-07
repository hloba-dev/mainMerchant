import 'dotenv/config';
import speakeasy from 'speakeasy';

export const loginForm = (req, res) => {
  if (req.session.isAdmin) return res.redirect('/irishkachikipiki7843');
  res.render('login', { error: null });
};

export const tfaForm = (req, res) => {
  if (!req.session.primaryAuthPassed) return res.redirect('/evninv0v23sFWFW');

  res.send(`<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Двухфакторная аутентификация</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body class="login-body">
  <div class="login-container">
    <h1 class="login-title">Google Authenticator</h1>
    <form method="POST" action="/rberbszrh45aeegr" class="login-form">
      <div class="form-row">
        <label for="token">Google Authenticator Код</label>
        <input type="text" name="token" id="token" placeholder="Google Authenticator" required />
      </div>
      <button type="submit" class="btn btn-login">Подтвердить</button>
    </form>
  </div>
</body>
</html>`);
};

export const login = (req, res) => {
  const { username, password } = req.body;

  if (
    username === process.env.ADMIN_LOGIN &&
    password === process.env.ADMIN_PASSWORD
  ) {
    req.session.primaryAuthPassed = true;
    return res.redirect('/rberbszrh45aeegr');
  }

  res.render('login', { error: 'Неверный логин или пароль' });
};

export const tfaVerify = (req, res) => {
  if (!req.session.primaryAuthPassed) return res.redirect('/evninv0v23sFWFW');

  const { token } = req.body;
  const verified = speakeasy.totp.verify({
    secret: process.env.ADMIN_2FA_SECRET,
    encoding: 'base32',
    token,
  });

  if (verified) {
    req.session.isAdmin = true;
    delete req.session.primaryAuthPassed;
    return res.redirect('/irishkachikipiki7843');
  }

  res.send(`<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ошибка 2FA</title><link rel="stylesheet" href="/styles.css" />
</head><body class="login-body">
  <div class="login-container">
    <h1 class="login-title">Ошибка 2FA</h1>
    <p class="login-error">Неправильный код Google Authenticator.</p>
    <a href="/rberbszrh45aeegr" class="btn btn-login">Попробовать снова</a>
  </div>
</body></html>`);
};
