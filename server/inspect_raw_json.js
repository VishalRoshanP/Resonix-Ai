const http = require('http');

http.get('http://localhost:5000/api/v1/incidents', (res) => {
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      console.log('HTTP Status:', res.statusCode);
      const incidents = data.data?.incidents || (Array.isArray(data.data) ? data.data : []);
      console.log('Total Incidents in Backend:', incidents.length);
      console.log('Top 2 Incidents Raw JSON:');
      console.log(JSON.stringify(incidents.slice(0, 2), null, 2));
    } catch (err) {
      console.error('Parse error:', err.message);
    }
  });
});
