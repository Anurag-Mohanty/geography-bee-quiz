export const getApiUrl = async () => {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    // Dynamically check all ports between 3001 and 3010
    for (let port = 3001; port <= 3010; port++) {
      try {
        const url = `${protocol}//${hostname}:${port}/api/health`;
        console.log(`Trying ${url}`);
        const response = await fetch(url, { method: 'GET' });
        if (response.ok) {
          console.log(`API found at ${url}`);
          return `${protocol}//${hostname}:${port}`; // Return base URL to API
        }
      } catch (error) {
        console.log(`Port ${port} not available`);
      }
    }
    console.error('No available API port found after trying all ports');
    throw new Error('No available API port found');
  }

  // For production, assume the API is on the same domain
  return `${protocol}//${hostname}`;
};
