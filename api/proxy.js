const axios = require("axios");

module.exports = async (req, res) => {

  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // Get CNIC from query or body
    const cnic = req.query.cnic || req.body?.cnic;

    if (!cnic) {
      return res.status(400).json({ 
        success: false,
        error: "CNIC is required" 
      });
    }

    // Remove all dashes and spaces - ONLY NUMBERS
    const cleanCNIC = cnic.replace(/[-\s]/g, '');
    
    // Validate 13 digits
    if (!/^\d{13}$/.test(cleanCNIC)) {
      return res.status(400).json({
        success: false,
        error: "Invalid CNIC format. Must be 13 digits"
      });
    }

    // Convert to number (for Id field)
    const cnicNumber = parseInt(cleanCNIC, 10);

    const url = "https://rodb.pulse.gop.pk/registry_index_3/_search";

    // Search in BOTH Id AND RegistryParties.CNIC
    const requestBody = {
      query: {
        bool: {
          should: [
            {
              term: {
                "Id": cnicNumber
              }
            },
            {
              nested: {
                path: "RegistryParties",
                query: {
                  term: {
                    "RegistryParties.CNIC": cleanCNIC
                  }
                }
              }
            }
          ],
          minimum_should_match: 1
        }
      },
      size: 50
    };

    const response = await axios.post(url, requestBody, {
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic cmVhZF9vbmx5X3VzZXJfdjI6cmVhZG9ubHlfMTIz",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36",
        "Accept": "*/*",
        "Origin": "https://rod.pulse.gop.pk",
        "Referer": "https://rod.pulse.gop.pk/",
        "x-requested-with": "mark.via.gp",
        "sec-ch-ua": '"Not;A=Brand";v="8", "Chromium";v="150", "Android WebView";v="150"',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '"Android"',
        "sec-fetch-site": "same-site",
        "sec-fetch-mode": "cors",
        "sec-fetch-dest": "empty",
        "accept-encoding": "gzip, deflate, br, zstd",
        "accept-language": "en-US,en;q=0.9"
      }
    });

    // Extract data
    const hits = response.data?.hits?.hits || [];
    const total = response.data?.hits?.total?.value || 0;

    return res.status(200).json({
      success: true,
      total: total,
      data: hits,
      credit: "AZ Tricks (https://t.me/AZ_Tricks)"
    });

  } catch (err) {
    console.error("API Error:", err.message);
    
    let errorMessage = "Upstream API failed";
    let details = null;

    if (err.response) {
      details = {
        status: err.response.status,
        data: err.response.data
      };
      errorMessage = `API returned ${err.response.status}`;
    } else if (err.request) {
      details = {
        message: "No response received from upstream API"
      };
      errorMessage = "Upstream API timeout or unreachable";
    }

    return res.status(500).json({
      success: false,
      error: errorMessage,
      details: details,
      message: err.message,
      credit: "AZ Tricks (https://t.me/AZ_Tricks)"
    });
  }
};
