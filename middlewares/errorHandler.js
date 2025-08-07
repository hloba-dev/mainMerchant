export default (err, req, res, next) => {
  console.error(err.stack);

  res.status(500).send(`<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8" />
<title>Внутренняя ошибка (500)</title>
<link rel="stylesheet" href="/styles.css" /></head>
<body class="login-body"><div class="login-container">
  <h1 class="login-title">Ошибка 500</h1>
  <p class="login-error">На сервере произошла ошибка.</p>
  <a href="/evninv0v23sFWFW" class="btn btn-login">Вернуться на главную</a>
</div></body></html>`);
};
