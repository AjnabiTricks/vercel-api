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

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Handle search by CNIC
  if (req.method === 'POST' && req.body.partiesCnic) {
    try {
      const cnic = req.body.partiesCnic;
      console.log(`Searching for CNIC: ${cnic}`);
      
      // Step 1: Search for registries by CNIC
      const searchResponse = await fetch('https://rod.pulse.gop.pk/api/elasticsearch/registries/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
          'Accept-Language': 'ur,en-US;q=0.9,en;q=0.8',
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
          itemsPerPage: 50 // Get more results
        }),
      });

      if (!searchResponse.ok) {
        throw new Error(`Search API failed: ${searchResponse.status}`);
      }

      const searchData = await searchResponse.json();
      
      // Check if we have results
      if (!searchData.data || searchData.data.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No records found for this CNIC',
          data: [],
          total: 0
        });
      }

      console.log(`Found ${searchData.data.length} records for CNIC: ${cnic}`);

      // Step 2: Fetch full details for each registry
      const fullDetailsPromises = searchData.data.map(async (record) => {
        try {
          const registryNumber = record.registryNumber || record.registry_number;
          if (!registryNumber) return null;

          const detailResponse = await fetch(`https://rod.pulse.gop.pk/api/elasticsearch/registry/${registryNumber}`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
              'Accept-Language': 'ur,en-US;q=0.9,en;q=0.8',
              'Origin': 'https://rod.pulse.gop.pk',
              'Referer': `https://rod.pulse.gop.pk/details_page.html?I=${registryNumber}`,
            },
          });

          if (!detailResponse.ok) {
            console.warn(`Failed to fetch details for registry ${registryNumber}: ${detailResponse.status}`);
            return {
              ...record,
              details: null,
              error: 'Details not available'
            };
          }

          const detailData = await detailResponse.json();
          return {
            ...record,
            details: detailData,
            registryNumber: registryNumber
          };
        } catch (error) {
          console.error(`Error fetching details for registry:`, error);
          return {
            ...record,
            details: null,
            error: error.message
          };
        }
      });

      // Wait for all detail fetches to complete
      const fullResults = await Promise.all(fullDetailsPromises);
      
      // Filter out null results
      const validResults = fullResults.filter(result => result !== null);

      // Step 3: Get all party details (if there are multiple parties)
      const allPartiesData = await getAllPartiesDetails(cnic);

      res.status(200).json({
        success: true,
        total: validResults.length,
        data: validResults,
        allParties: allPartiesData,
        cnic: cnic
      });

    } catch (error) {
      console.error('Proxy error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Failed to fetch registry details'
      });
    }
    return;
  }

  // Handle simple GET request for single registry
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
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
          'Accept-Language': 'ur,en-US;q=0.9,en;q=0.8',
          'Origin': 'https://rod.pulse.gop.pk',
          'Referer': `https://rod.pulse.gop.pk/details_page.html?I=${registryNumber}`,
        },
      });

      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      console.error('Error fetching registry:', error);
      res.status(500).json({ error: error.message });
    }
    return;
  }

  // Default response
  res.status(404).json({ error: 'Not found' });
}

// Helper function to get all party details for a CNIC
async function getAllPartiesDetails(cnic) {
  try {
    // This could be extended to fetch parties information
    // You might need to call another API endpoint if available
    const response = await fetch(`https://rod.pulse.gop.pk/api/parties/search?cnic=${cnic}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        'Origin': 'https://rod.pulse.gop.pk',
      },
    });

    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.warn('Could not fetch parties details:', error.message);
    return null;
  }
}
