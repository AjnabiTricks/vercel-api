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

  // Handle CNIC search with full details
  if (req.method === 'POST' && req.body.partiesCnic) {
    const cnic = req.body.partiesCnic;
    console.log(`🔍 Searching for CNIC: ${cnic}`);

    try {
      // Step 1: Search all records by CNIC
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
          itemsPerPage: 100 // Get maximum results
        }),
      });

      if (!searchResponse.ok) {
        throw new Error(`Search API error: ${searchResponse.status}`);
      }

      const searchData = await searchResponse.json();
      
      // Check if results exist
      if (!searchData.data || searchData.data.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No records found for this CNIC',
          total: 0,
          records: [],
          cnic: cnic
        });
      }

      console.log(`✅ Found ${searchData.data.length} records for CNIC: ${cnic}`);

      // Step 2: Fetch full details for each registry with concurrency control
      const recordsWithDetails = await fetchAllRegistryDetails(searchData.data);

      // Step 3: Extract all unique parties
      const allParties = extractAllParties(recordsWithDetails);

      // Return complete response
      return res.status(200).json({
        success: true,
        total: recordsWithDetails.length,
        cnic: cnic,
        records: recordsWithDetails,
        allParties: allParties,
        summary: {
          totalRegistries: recordsWithDetails.length,
          totalParties: allParties.length,
          registriesWithDetails: recordsWithDetails.filter(r => r.fullDetails !== null).length
        }
      });

    } catch (error) {
      console.error('❌ Proxy error:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
        message: 'Failed to fetch registry details'
      });
    }
  }

  // Handle GET request for single registry details
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
      console.error('Error fetching registry:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  res.status(404).json({ error: 'Not found' });
}

// Function to fetch details for all registries with concurrency control
async function fetchAllRegistryDetails(records, concurrency = 5) {
  const results = [];
  const queue = [...records];

  async function processRecord(record) {
    const registryNumber = record.registryNumber || record.registry_number;
    if (!registryNumber) {
      return { ...record, fullDetails: null, error: 'No registry number' };
    }

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

      if (!detailResponse.ok) {
        console.warn(`⚠️ Failed to fetch details for registry ${registryNumber}: ${detailResponse.status}`);
        return { ...record, fullDetails: null, error: `HTTP ${detailResponse.status}` };
      }

      const detailData = await detailResponse.json();
      return {
        ...record,
        fullDetails: detailData,
        registryNumber: registryNumber,
        fetchedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error(`❌ Error fetching registry ${registryNumber}:`, error.message);
      return { ...record, fullDetails: null, error: error.message };
    }
  }

  // Process with concurrency control
  async function processQueue() {
    const promises = [];
    while (queue.length > 0) {
      const batch = queue.splice(0, concurrency);
      const batchPromises = batch.map(record => processRecord(record));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Small delay between batches to avoid rate limiting
      if (queue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  await processQueue();
  return results;
}

// Function to extract all unique parties from records
function extractAllParties(records) {
  const partiesMap = new Map();

  records.forEach(record => {
    // Extract from fullDetails
    if (record.fullDetails) {
      const details = record.fullDetails;
      
      // Check for parties array
      if (details.parties && Array.isArray(details.parties)) {
        details.parties.forEach(party => {
          const key = party.cnic || party.id || Math.random().toString();
          if (!partiesMap.has(key)) {
            partiesMap.set(key, {
              ...party,
              registryNumbers: [record.registryNumber]
            });
          } else {
            const existing = partiesMap.get(key);
            if (!existing.registryNumbers.includes(record.registryNumber)) {
              existing.registryNumbers.push(record.registryNumber);
            }
          }
        });
      }

      // Check for buyer/seller info
      ['buyer', 'seller', 'vendor', 'purchaser'].forEach(field => {
        if (details[field]) {
          const party = details[field];
          const key = party.cnic || party.id || party.name || Math.random().toString();
          if (!partiesMap.has(key)) {
            partiesMap.set(key, {
              ...party,
              role: field,
              registryNumbers: [record.registryNumber]
            });
          } else {
            const existing = partiesMap.get(key);
            if (!existing.registryNumbers.includes(record.registryNumber)) {
              existing.registryNumbers.push(record.registryNumber);
            }
          }
        }
      });
    }

    // Extract from record itself if it has party info
    if (record.parties && Array.isArray(record.parties)) {
      record.parties.forEach(party => {
        const key = party.cnic || party.id || Math.random().toString();
        if (!partiesMap.has(key)) {
          partiesMap.set(key, {
            ...party,
            registryNumbers: [record.registryNumber]
          });
        } else {
          const existing = partiesMap.get(key);
          if (!existing.registryNumbers.includes(record.registryNumber)) {
            existing.registryNumbers.push(record.registryNumber);
          }
        }
      });
    }
  });

  return Array.from(partiesMap.values());
}
