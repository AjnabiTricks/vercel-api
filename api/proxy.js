// api/proxy.js
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Handle POST request - CNIC search
  if (req.method === 'POST') {
    try {
      const cnic = req.body.partiesCnic;
      console.log(`🔍 Searching CNIC: ${cnic}`);

      // Step 1: Search by CNIC
      const searchResponse = await fetch('https://rod.pulse.gop.pk/api/elasticsearch/registries/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
          'Accept-Language': 'ur,en-US;q=0.9,en;q=0.8,ps;q=0.7',
          'Origin': 'https://rod.pulse.gop.pk',
          'Referer': 'https://rod.pulse.gop.pk/index.html',
        },
        body: JSON.stringify({
          tehsilId: req.body.tehsilId || 99,
          districtTehsilIds: null,
          partiesName: null,
          partiesCnic: cnic,
          registeredNumber: null,
          registryYear: null,
          page: 1,
          itemsPerPage: 100
        }),
      });

      const searchData = await searchResponse.json();

      if (!searchData.data || searchData.data.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No records found',
          data: [],
          total: 0
        });
      }

      console.log(`✅ Found ${searchData.data.length} records`);

      // Step 2: Get full details for each registry
      const detailedData = [];
      for (const record of searchData.data) {
        const registryNumber = record.registryNumber || record.registry_number;
        if (registryNumber) {
          try {
            const detailResponse = await fetch(`https://rod.pulse.gop.pk/api/elasticsearch/registry/${registryNumber}`, {
              method: 'GET',
              headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
                'Accept-Language': 'ur,en-US;q=0.9,en;q=0.8,ps;q=0.7',
                'Origin': 'https://rod.pulse.gop.pk',
                'Referer': `https://rod.pulse.gop.pk/details_page.html?I=${registryNumber}`,
              },
            });

            if (detailResponse.ok) {
              const detailData = await detailResponse.json();
              detailedData.push({
                ...record,
                fullDetails: detailData
              });
            } else {
              detailedData.push({
                ...record,
                fullDetails: null,
                error: 'Details not available'
              });
            }
          } catch (error) {
            detailedData.push({
              ...record,
              fullDetails: null,
              error: error.message
            });
          }
        }
      }

      // Return complete response
      return res.status(200).json({
        success: true,
        total: detailedData.length,
        data: detailedData,
        cnic: cnic
      });

    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Handle GET request for single registry
  if (req.method === 'GET') {
    const registryNumber = req.query.registryNumber || req.query.I;
    if (!registryNumber) {
      return res.status(400).json({ error: 'Registry number required' });
    }

    try {
      const response = await fetch(`https://rod.pulse.gop.pk/api/elasticsearch/registry/${registryNumber}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
          'Accept-Language': 'ur,en-US;q=0.9,en;q=0.8,ps;q=0.7',
          'Origin': 'https://rod.pulse.gop.pk',
          'Referer': `https://rod.pulse.gop.pk/details_page.html?I=${registryNumber}`,
        },
      });

      const data = await response.json();
      return res.status(response.status).json(data);
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  res.status(404).json({ error: 'Not found' });
        }
