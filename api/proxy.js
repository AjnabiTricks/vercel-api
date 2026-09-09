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

  // Handle POST request - Search by CNIC
  if (req.method === 'POST') {
    try {
      // Support both 'cnic' and 'partiesCnic' parameter names
      const cnic = req.body.cnic || req.body.partiesCnic;
      
      if (!cnic) {
        return res.status(400).json({
          success: false,
          error: 'CNIC is required. Please provide "cnic" or "partiesCnic" in request body.'
        });
      }

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
          page: req.body.page || 1,
          itemsPerPage: req.body.itemsPerPage || 100
        }),
      });

      if (!searchResponse.ok) {
        throw new Error(`Search API error: ${searchResponse.status}`);
      }

      const searchData = await searchResponse.json();

      if (!searchData.results || searchData.results.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No records found for this CNIC',
          total: 0,
          data: [],
          cnic: cnic
        });
      }

      console.log(`✅ Found ${searchData.results.length} records for CNIC: ${cnic}`);
      console.log(`📊 Total count: ${searchData.totalCount}`);

      // Step 2: Get FULL details for each registry
      const detailedData = [];
      
      for (const record of searchData.results) {
        const registryId = record.Id;
        const registeredNumber = record.RegisteredNumber;
        
        console.log(`📥 Fetching details for registry ID: ${registryId}`);

        try {
          const detailResponse = await fetch(`https://rod.pulse.gop.pk/api/elasticsearch/registry/${registryId}`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
              'Accept-Language': 'ur,en-US;q=0.9,en;q=0.8,ps;q=0.7',
              'Origin': 'https://rod.pulse.gop.pk',
              'Referer': `https://rod.pulse.gop.pk/details_page.html?I=${registryId}`,
            },
          });

          if (detailResponse.ok) {
            const fullDetails = await detailResponse.json();
            detailedData.push({
              id: registryId,
              registeredNumber: registeredNumber,
              registryDate: record.RegistryDate,
              mauzaName: record.MauzaName,
              tehsil: record.Tehsil,
              fullDetails: fullDetails,
              parties: fullDetails.RegistryParties || [],
              registryType: fullDetails.RegistryType || '',
              propertyNumber: fullDetails.PropertyNumber || '',
              area: fullDetails.Area || '',
              registryValue: fullDetails.RegistryValue || 0,
              jildNumber: fullDetails.JildNumber || '',
              bahiNumber: fullDetails.BahiNumber || '',
              isApproved: fullDetails.IsApproved || false
            });
          } else {
            console.warn(`⚠️ Failed to fetch details for registry ${registryId}`);
            detailedData.push({
              id: registryId,
              registeredNumber: registeredNumber,
              registryDate: record.RegistryDate,
              mauzaName: record.MauzaName,
              tehsil: record.Tehsil,
              fullDetails: null,
              error: `Details not available`
            });
          }
        } catch (error) {
          console.error(`❌ Error fetching registry ${registryId}:`, error.message);
          detailedData.push({
            id: registryId,
            registeredNumber: registeredNumber,
            registryDate: record.RegistryDate,
            mauzaName: record.MauzaName,
            tehsil: record.Tehsil,
            fullDetails: null,
            error: error.message
          });
        }
      }

      // Step 3: Extract ALL parties
      const partiesMap = new Map();
      detailedData.forEach(record => {
        if (record.parties && Array.isArray(record.parties)) {
          record.parties.forEach(party => {
            const key = party.CNIC || party.Id || Math.random().toString();
            if (!partiesMap.has(key)) {
              partiesMap.set(key, {
                name: party.Name || '',
                cnic: party.CNIC || '',
                spouseName: party.SpouseName || '',
                partyTypeId: party.RegistryPartiesTypeId || 0,
                registries: [{
                  id: record.id,
                  number: record.registeredNumber,
                  role: party.RegistryPartiesTypeId === 1 ? 'Buyer' : 
                        party.RegistryPartiesTypeId === 2 ? 'Seller' : 
                        party.RegistryPartiesTypeId === 31 ? 'Witness' : 'Other'
                }]
              });
            } else {
              const existing = partiesMap.get(key);
              existing.registries.push({
                id: record.id,
                number: record.registeredNumber,
                role: party.RegistryPartiesTypeId === 1 ? 'Buyer' : 
                      party.RegistryPartiesTypeId === 2 ? 'Seller' : 
                      party.RegistryPartiesTypeId === 31 ? 'Witness' : 'Other'
              });
            }
          });
        }
      });

      const allParties = Array.from(partiesMap.values());

      // Return COMPLETE response
      return res.status(200).json({
        success: true,
        cnic: cnic,
        totalCount: searchData.totalCount || detailedData.length,
        totalRetrieved: detailedData.length,
        summary: {
          totalRegistries: detailedData.length,
          totalParties: allParties.length,
          uniqueParties: allParties.length
        },
        allParties: allParties,
        registries: detailedData
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

  // Handle GET request for single registry
  if (req.method === 'GET') {
    const registryId = req.query.I || req.query.id || req.query.registryNumber;
    
    if (!registryId) {
      return res.status(400).json({ 
        error: 'Registry ID required',
        message: 'Please provide I, id, or registryNumber parameter'
      });
    }

    try {
      console.log(`📥 Fetching single registry: ${registryId}`);
      
      const response = await fetch(`https://rod.pulse.gop.pk/api/elasticsearch/registry/${registryId}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
          'Accept-Language': 'ur,en-US;q=0.9,en;q=0.8,ps;q=0.7',
          'Origin': 'https://rod.pulse.gop.pk',
          'Referer': `https://rod.pulse.gop.pk/details_page.html?I=${registryId}`,
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      return res.status(200).json({
        success: true,
        registryId: registryId,
        data: data
      });
      
    } catch (error) {
      console.error('❌ Error fetching registry:', error);
      return res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  }

  res.status(405).json({ 
    error: 'Method not allowed',
    message: 'Only GET and POST methods are supported'
  });
                }
