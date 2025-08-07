export default (req, res) => {
  res.status(404).send(`<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8" />
<title>Страница не найдена (404)</title>
<link rel="stylesheet" href="/styles.css" /></head>
<body class="login-body"><div class="login-container">
  <h1 class="login-title">Ошибка 404</h1>
  <p class="login-error">Страница не найдена или была удалена.</p>
</div></body></html>`);
};
