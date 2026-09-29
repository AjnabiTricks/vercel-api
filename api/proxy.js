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
    return cnic.replace(/[^0-9]/g, '');
  }

  // Common headers for POST (search) requests
  const postHeaders = {
    'Content-Type': 'application/json',
    'Accept': '*/*',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36',
    'Origin': 'https://rod.pulse.gop.pk',
    'Referer': 'https://rod.pulse.gop.pk/index.html',
    'Accept-Language': 'ur,en-US;q=0.9,en;q=0.8,ps;q=0.7',
    'sec-ch-ua': '"Chromium";v="152", "Not?A_Brand";v="24", "Google Chrome";v="152"',
    'sec-ch-ua-mobile': '?1',
    'sec-ch-ua-platform': '"Android"',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
  };

  // Common headers for GET (detail) requests
  const getHeaders = {
    'Accept': '*/*',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36',
    'Origin': 'https://rod.pulse.gop.pk',
    'Accept-Language': 'ur,en-US;q=0.9,en;q=0.8,ps;q=0.7',
    'sec-ch-ua': '"Chromium";v="152", "Not?A_Brand";v="24", "Google Chrome";v="152"',
    'sec-ch-ua-mobile': '?1',
    'sec-ch-ua-platform': '"Android"',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
  };

  // Handle GET request - Search by CNIC OR Registry Number
  if (req.method === 'GET') {
    const cnic = req.query.cnic;
    const registryNumber = req.query.registry || req.query.reg || req.query.rn || req.query.registryNumber;
    const registryId = req.query.I || req.query.id;

    // CASE 1: Search by CNIC (ALL districts & tehsils)
    if (cnic) {
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

      console.log(`🔍 Searching CNIC (ALL districts/tehsils): ${cnic} (Cleaned: ${cleanedCnic})`);
      
      try {
        // Step 1: Search by CNIC with NO filters (all districts/tehsils)
        const searchResponse = await fetch('https://rod.pulse.gop.pk/api/elasticsearch/registries/search', {
          method: 'POST',
          headers: postHeaders,
          body: JSON.stringify({
            tehsilId: null,           // ← REMOVED filter
            districtTehsilIds: null,  // ← REMOVED filter
            partiesName: null,
            partiesCnic: cleanedCnic,
            registeredNumber: null,
            registryYear: null,       // ← REMOVED filter
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
            message: 'No records found for this CNIC in any district/tehsil',
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
                ...getHeaders,
                'Referer': `https://rod.pulse.gop.pk/details_page.html?I=${registryIdNum}`
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
                district: record.District || fullDetails.District || '',
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
                district: record.District || '',
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
              district: record.District || '',
              parties: [],
              fullDetails: null,
              error: error.message
            });
          }
        }

        return res.status(200).json({
          success: true,
          cnic: cnic,
          cleanedCnic: cleanedCnic,
          searchScope: 'ALL_DISTRICTS_ALL_TEHSILS',
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

    // CASE 2: Search by Registry Number
    if (registryNumber || registryId) {
      const searchTerm = registryNumber || registryId;
      console.log(`🔍 Searching Registry: ${searchTerm}`);
      
      try {
        // Try direct registry endpoint first
        const response = await fetch(`https://rod.pulse.gop.pk/api/elasticsearch/registry/${searchTerm}`, {
          method: 'GET',
          headers: {
            ...getHeaders,
            'Referer': `https://rod.pulse.gop.pk/details_page.html?I=${searchTerm}`
          },
        });

        if (response.ok) {
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
        }

        // If direct fails, try search API (also no filters)
        const searchResponse = await fetch('https://rod.pulse.gop.pk/api/elasticsearch/registries/search', {
          method: 'POST',
          headers: postHeaders,
          body: JSON.stringify({
            tehsilId: null,
            districtTehsilIds: null,
            partiesName: null,
            partiesCnic: null,
            registeredNumber: searchTerm,
            registryYear: null,
            page: 1,
            itemsPerPage: 5
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
                ...getHeaders,
                'Referer': `https://rod.pulse.gop.pk/details_page.html?I=${registryIdNum}`
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

        throw new Error('Registry not found');
        
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
