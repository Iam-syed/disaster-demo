// Main backend entry point
const express = require('express');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'disaster-response-backend' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
