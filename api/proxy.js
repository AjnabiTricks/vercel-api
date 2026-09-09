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

  // Helper function to clean CNIC (remove dashes, spaces, etc.)
  function cleanCNIC(cnic) {
    if (!cnic) return '';
    // Remove all non-numeric characters (dashes, spaces, etc.)
    return cnic.replace(/[^0-9]/g, '');
  }

  // Handle GET request - Search by CNIC OR Registry Number
  if (req.method === 'GET') {
    const cnic = req.query.cnic;
    const registryNumber = req.query.registry || req.query.reg || req.query.rn || req.query.registryNumber;
    const registryId = req.query.I || req.query.id;

    // CASE 1: Search by CNIC (All formats supported)
    if (cnic) {
      // Clean the CNIC - remove dashes, spaces, etc.
      const cleanedCnic = cleanCNIC(cnic);
      
      if (cleanedCnic.length < 13) {
        return res.status(400).json({
          success: false,
          error: 'Invalid CNIC. Please provide a valid 13-digit CNIC.',
          message: 'Supported formats: 3450188222445, 34501-8822244-5, 34501 8822244 5, etc.',
          credit: {
            developer: '@AZ_Trickcs',
            channel: 'https://t.me/AZ_Tricks',
            message: '🚀 Developed by AZ Tricks'
          }
        });
      }

      console.log(`🔍 Searching CNIC: ${cnic} (Cleaned: ${cleanedCnic})`);
      
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
            partiesCnic: cleanedCnic,
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
            cnic: cnic,
            credit: {
              developer: '@AZ_Trickcs',
              channel: 'https://t.me/AZ_Tricks',
              message: '🚀 Developed by AZ Tricks'
            }
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

        // Return with credit
        return res.status(200).json({
          success: true,
          cnic: cnic,
          cleanedCnic: cleanedCnic,
          totalCount: searchData.totalCount || registries.length,
          totalRetrieved: registries.length,
          registries: registries,
          credit: {
            developer: '@AZ_Trickcs',
            channel: 'https://t.me/AZ_Tricks',
            message: '🚀 Developed by AZ Tricks',
            support: 'Join @AZ_Tricks for more'
          }
        });

      } catch (error) {
        console.error('❌ Error:', error);
        return res.status(500).json({
          success: false,
          error: error.message,
          credit: {
            developer: '@AZ_Trickcs',
            channel: 'https://t.me/AZ_Tricks'
          }
        });
      }
    }

    // CASE 2: Search by Registry Number (Only, no separate API)
    if (registryNumber || registryId) {
      const searchTerm = registryNumber || registryId;
      console.log(`🔍 Searching Registry: ${searchTerm}`);
      
      try {
        // Try to search by registry number via the search API first
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
            partiesCnic: null,
            registeredNumber: searchTerm,
            registryYear: null,
            page: 1,
            itemsPerPage: 1
          }),
        });

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          if (searchData.results && searchData.results.length > 0) {
            const record = searchData.results[0];
            const registryIdNum = record.Id;
            
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
              return res.status(200).json({
                success: true,
                registryNumber: searchTerm,
                data: fullDetails,
                credit: {
                  developer: '@AZ_Trickcs',
                  channel: 'https://t.me/AZ_Tricks'
                }
              });
            }
          }
        }

        // If search fails, try direct registry endpoint
        const response = await fetch(`https://rod.pulse.gop.pk/api/elasticsearch/registry/${searchTerm}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
            'Accept-Language': 'ur,en-US;q=0.9,en;q=0.8,ps;q=0.7',
            'Origin': 'https://rod.pulse.gop.pk',
            'Referer': `https://rod.pulse.gop.pk/details_page.html?I=${searchTerm}`,
          },
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return res.status(200).json({
          success: true,
          registryNumber: searchTerm,
          data: data,
          credit: {
            developer: '@AZ_Trickcs',
            channel: 'https://t.me/AZ_Tricks'
          }
        });
        
      } catch (error) {
        console.error('❌ Error:', error);
        return res.status(500).json({ 
          success: false,
          error: error.message,
          credit: {
            developer: '@AZ_Trickcs',
            channel: 'https://t.me/AZ_Tricks'
          }
        });
      }
    }

    // No parameter provided
    return res.status(400).json({
      success: false,
      error: 'Please provide "cnic" OR "registry" OR "I" parameter',
      examples: {
        cnic: '/api/proxy?cnic=3450188222445',
        cnic_with_dashes: '/api/proxy?cnic=34501-8822244-5',
        cnic_with_spaces: '/api/proxy?cnic=34501 8822244 5',
        registry: '/api/proxy?registry=07120260000655',
        registry_id: '/api/proxy?I=10023845043'
      },
      credit: {
        developer: '@AZ_Trickcs',
        channel: 'https://t.me/AZ_Tricks'
      }
    });
  }

  // Handle POST request
  if (req.method === 'POST') {
    const cnic = req.body.cnic || req.body.partiesCnic;
    const registryNumber = req.body.registry || req.body.registryNumber || req.body.registeredNumber;
    
    if (cnic) {
      req.query.cnic = cnic;
      return handler(req, res);
    }
    
    if (registryNumber) {
      req.query.registry = registryNumber;
      return handler(req, res);
    }
    
    return res.status(400).json({
      success: false,
      error: 'CNIC or Registry Number required in request body',
      credit: {
        developer: '@AZ_Trickcs',
        channel: 'https://t.me/AZ_Tricks'
      }
    });
  }

  res.status(405).json({ 
    error: 'Method not allowed',
    message: 'Only GET and POST methods are supported',
    credit: {
      developer: '@AZ_Trickcs',
      channel: 'https://t.me/AZ_Tricks'
    }
  });
                  }
