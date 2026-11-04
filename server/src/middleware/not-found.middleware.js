export function notFoundHandler(req, res) {
  if (
    req.path.startsWith('/api') ||
    req.path.startsWith('/t-shirt-printer')
  ) {
    return res.status(404).json({ message: `API endpoint not found: ${req.method} ${req.path}` });
  }
  return res.status(404).send('Not Found');
}

export default notFoundHandler;
