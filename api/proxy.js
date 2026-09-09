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

  // Handle GET request - Search by CNIC OR Get Single Registry
  if (req.method === 'GET') {
    const cnic = req.query.cnic;
    const registryId = req.query.I || req.query.id || req.query.registryNumber;

    // CASE 1: Search by CNIC
    if (cnic) {
      console.log(`🔍 Searching CNIC: ${cnic}`);
      
      try {
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
            tehsilId: 99,
            districtTehsilIds: null,
            partiesName: null,
            partiesCnic: cnic,
            registeredNumber: null,
            registryYear: null,
            page: 1,
            itemsPerPage: 100
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
            registries: [],
            cnic: cnic
          });
        }

        console.log(`✅ Found ${searchData.results.length} records for CNIC: ${cnic}`);

        // Step 2: Get FULL details for each registry
        const registries = [];
        
        for (const record of searchData.results) {
          const registryIdNum = record.Id;
          
          try {
            const detailResponse = await fetch(`https://rod.pulse.gop.pk/api/elasticsearch/registry/${registryIdNum}`, {
              method: 'GET',
              headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
                'Accept-Language': 'ur,en-US;q=0.9,en;q=0.8,ps;q=0.7',
                'Origin': 'https://rod.pulse.gop.pk',
                'Referer': `https://rod.pulse.gop.pk/details_page.html?I=${registryIdNum}`,
              },
            });

            if (detailResponse.ok) {
              const fullDetails = await detailResponse.json();
              
              // Extract parties for THIS registry only
              const registryParties = fullDetails.RegistryParties || [];
              
              registries.push({
                id: registryIdNum,
                registeredNumber: record.RegisteredNumber,
                registryDate: record.RegistryDate,
                mauzaName: record.MauzaName,
                tehsil: record.Tehsil,
                registryType: fullDetails.RegistryType || '',
                propertyNumber: fullDetails.PropertyNumber || '',
                area: fullDetails.Area || '',
                registryValue: fullDetails.RegistryValue || 0,
                jildNumber: fullDetails.JildNumber || '',
                bahiNumber: fullDetails.BahiNumber || '',
                isApproved: fullDetails.IsApproved || false,
                // ONLY this registry's parties
                parties: registryParties.map(party => ({
                  id: party.Id,
                  name: party.Name || '',
                  cnic: party.CNIC || '',
                  spouseName: party.SpouseName || '',
                  partyTypeId: party.RegistryPartiesTypeId || 0,
                  partyType: party.RegistryPartiesTypeId === 1 ? 'Buyer' : 
                            party.RegistryPartiesTypeId === 2 ? 'Seller' : 
                            party.RegistryPartiesTypeId === 31 ? 'Witness' : 'Other',
                  createdDate: party.CraetedDate || ''
                })),
                fullDetails: fullDetails
              });
            } else {
              registries.push({
                id: registryIdNum,
                registeredNumber: record.RegisteredNumber,
                registryDate: record.RegistryDate,
                mauzaName: record.MauzaName,
                tehsil: record.Tehsil,
                parties: [],
                fullDetails: null,
                error: 'Details not available'
              });
            }
          } catch (error) {
            registries.push({
              id: registryIdNum,
              registeredNumber: record.RegisteredNumber,
              registryDate: record.RegistryDate,
              mauzaName: record.MauzaName,
              tehsil: record.Tehsil,
              parties: [],
              fullDetails: null,
              error: error.message
            });
          }
        }

        // Return ONLY registries with their own parties - NO allParties
        return res.status(200).json({
          success: true,
          cnic: cnic,
          totalCount: searchData.totalCount || registries.length,
          totalRetrieved: registries.length,
          registries: registries
        });

      } catch (error) {
        console.error('❌ Error:', error);
        return res.status(500).json({
          success: false,
          error: error.message
        });
      }
    }

    // CASE 2: Get Single Registry by ID
    if (registryId) {
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
        console.error('❌ Error:', error);
        return res.status(500).json({ 
          success: false,
          error: error.message 
        });
      }
    }

    // No parameter provided
    return res.status(400).json({
      success: false,
      error: 'Please provide either "cnic" OR "I" parameter',
      example: '/api/proxy?cnic=3450188222445 OR /api/proxy?I=10023845043'
    });
  }

  // Handle POST request (alternative method)
  if (req.method === 'POST') {
    const cnic = req.body.cnic || req.body.partiesCnic;
    if (!cnic) {
      return res.status(400).json({
        success: false,
        error: 'CNIC is required in request body'
      });
    }
    
    // Redirect to GET logic with cnic
    req.query.cnic = cnic;
    return handler(req, res);
  }

  res.status(405).json({ 
    error: 'Method not allowed',
    message: 'Only GET and POST methods are supported'
  });
              }
