export default function checkAdmin(req, res, next) {
  if (!req.session.isAdmin) return res.redirect('/evninv0v23sFWFW');
  next();
}